const mongoose = require("mongoose");
const Schedule = require("../models/Schedule");
const Machine = require("../models/MachineMaster");
const MachineCapacity = require("../models/MachineCapacity");
const WorkOrder = require("../models/WorkOrder");

// 🧠 helper
const getCapacity = async (machineId) => {
  // ⚡ PERF: .lean() — only capacityPerHour / shiftStart are read
  const cap = await MachineCapacity.findOne({ machineId }).lean();
  if (!cap) throw new Error("Machine capacity missing");
  return cap;
};

// ⚡ PERF: capacity lookup with an optional per-run cache.
// Same query as before (MachineCapacity.findOne({ machineId })), just
// not repeated for every row of every Work Order in a bulk run.
const getCapData = async (machineId, capCache) => {
  const key = String(machineId);
  if (capCache && capCache.has(key)) return capCache.get(key);
  const doc = await MachineCapacity.findOne({ machineId })
    .select("capacityPerHour")
    .lean();
  if (capCache) capCache.set(key, doc);
  return doc;
};

// 🧠 helper — normalize customer whether it's a string or a populated object
const getCustomerName = (wo) => {
  if (!wo) return "";
  return wo.customer?.name || wo.customer || "";
};
const legacyTop = (wo, key) => {
  if (!wo) return undefined;
  const empty = (v) => v === undefined || v === null || v === "";
  let v = wo[key];
  if (empty(v) && typeof wo.get === "function") v = wo.get(key);
  if (empty(v)) v = wo._doc?.[key];
  return v;
};

// 🧠 helper — resolve the exact Activity/Machine row (out of a Work
// Order's `machines[]` array) that a schedule request is for.
//
// Preference order:
//   1. an explicit rowIndex (most reliable — sent by the updated
//      Scheduler UI whenever it knows exactly which row was clicked)
//   2. a machineId (+ optional activityId) match inside the array
//   3. the first row in the array
//   4. LEGACY FALLBACK — Work Orders created before the multi-row
//      Planner update have no `machines[]` array at all. For those we
//      build a pseudo-row straight from the Work Order's own top-level
//      fields so old records keep working unchanged.
const getWorkOrderRow = (wo, { rowIndex, machineId, activityId } = {}) => {
  const rows = wo.machines && wo.machines.length > 0 ? wo.machines : null;

  if (!rows) {
    return {
      activityId: null,
      machineId: null,
      inches: wo.inches || "",
      slitNumber: wo.slitNumber || "",
      UPS: wo.UPS,
      isBooklet: false,
      pages: 0,
      component: "",
      impFront: wo.impFront,
      impBack: wo.impBack,
      totalImp: wo.totalImp
    };
  }

  if (rowIndex !== undefined && rowIndex !== null && rows[rowIndex]) {
    return rows[rowIndex];
  }

  if (machineId) {
    const found = rows.find((m) => {
      const mId = m.machineId?._id || m.machineId;
      const aId = m.activityId?._id || m.activityId;
      return (
        String(mId) === String(machineId) &&
        (!activityId || String(aId) === String(activityId))
      );
    });
    if (found) return found;
  }

  return rows[0];
};

// 🧠 helper — true if this row's Activity is an "Offset" activity.
// Mirrors the Planner Dashboard's own `isOffsetActivity()` check
// (activityName.toLowerCase().includes("offset")). Requires the row's
// activityId to have been populated with `activityName`.
const isOffsetActivityRow = (row) => {
  const name = row?.activityId?.activityName || "";
  return String(name).toLowerCase().includes("offset");
};

// 🧠 helper — recompute Impression Front/Back/Total for a row from
// scratch, exactly the way the Planner Dashboard's own
// `computeRowImpression()` does it.
//
// WHY THIS EXISTS: Work Orders created by an older version of the
// Planner never stored impFront/impBack/totalImp on their machines[]
// row at all (that calculation was added later), and the Work Order's
// own top-level totalImp field is no longer readable (commented out of
// the schema). For those rows there is nothing to read — so instead we
// derive the number the same way the Planner would have, from fields
// that ARE still reliably present: orderQty, wasteQty, colorFront/Back
// (on the Work Order) and UPS/pages/isBooklet/isPerfecting/activityId
// (on the row).
//
// UPS itself has the same old-vs-new split: the current Planner UI
// stores UPS per-row (row.UPS, auto-filled from the chosen Machine or
// typed in per Activity/Machine pair). Work Orders created before that
// existed only ever had a single Work-Order-level UPS (wo.UPS). So we
// prefer the row's own UPS and fall back to the Work Order's top-level
// UPS when the row doesn't have one — this is the actual fix for
// "UPS is missing/zero" on old records.
const computeRowImpression = (wo, row) => {
  const colorFront = Number(wo?.colorFront) || 0;
  const colorBack = Number(wo?.colorBack) || 0;
  const qty = Number(wo?.orderQty) || 0;
  const waste = Number(wo?.wasteQty) || 0;
  const ups = Number(row?.UPS) || Number(wo?.UPS) || 0;

  const totalQty = Math.round(qty + qty * (waste / 100));
  const pagesVal = Number(row?.pages) || 0;
  const impQtyBase = row?.isBooklet && pagesVal > 0 ? totalQty * pagesVal : totalQty;

  if (ups <= 0) return { impFront: 0, impBack: 0, totalImp: 0 };

  const imp = Math.round(impQtyBase / ups);
  const impFront = colorFront > 0 ? imp : 0;
  const impBack = colorBack > 0 ? imp : 0;

  const useOffsetRule = isOffsetActivityRow(row) || row?.isPerfecting;

  const totalImp = useOffsetRule
    ? (impFront > 0 && impBack > 0 ? Math.round((impFront + impBack) / 2) : impFront + impBack)
    : impFront + impBack;

  return { impFront, impBack, totalImp };
};

// 🧠 helper — the single source of truth for "what is this row's
// impression?" used by both createSingle and autoSchedule. Tries the
// stored row value first; if that's missing/zero (old records), falls
// back to recomputing it live.
const resolveRowImpression = (wo, row) => {
  const pos = (v) => {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  };

  // NEW Work Orders: value stored on the machines[] row
  if (pos(row?.totalImp) > 0) {
    return {
      impFront: Number(row.impFront) || 0,
      impBack: Number(row.impBack) || 0,
      totalImp: pos(row.totalImp)
    };
  }

  // OLD Work Orders: value stored at the top level of the Work Order
  const topTotal = pos(legacyTop(wo, "totalImp"));
  if (topTotal > 0) {
    return {
      impFront: Number(legacyTop(wo, "impFront")) || 0,
      impBack: Number(legacyTop(wo, "impBack")) || 0,
      totalImp: topTotal
    };
  }

  // Nothing stored anywhere, so recompute
  return computeRowImpression(wo, row);
};

// 🧠 helper — snapshot the relevant Work Order fields onto the Schedule doc
// NOTE: intentionally does NOT include impFront/impBack/totalImp — those
// are always the ROW-specific values, applied by the caller AFTER this
// spread, so they never get clobbered by the Work Order's (now unused)
// top-level aggregate fields.
const snapshotWorkOrder = (wo) => ({
  efiWoNumber: wo.efiWoNumber,
  slNo: wo.slNo,
  productCode: wo.productCode,
  productName: wo.productName,
  productType: wo.productType,
  qtyInLvs: wo.qtyInLvs,

  colorFront: wo.colorFront,
  colorBack: wo.colorBack,

  orderQty: wo.orderQty,
  wasteQty: wo.wasteQty,
  totalQty: wo.totalQty,
  jobSize: wo.jobSize,
  UPS: wo.UPS,

  inkDetails: wo.inkDetails,
  remarks: wo.remarks,

  planningUser: wo.planningUser,

  materials: wo.materials || [],

  machinesDetail: (wo.machines || []).map(m => ({
    activityId: m.activityId?._id || m.activityId,
    machineId: m.machineId?._id || m.machineId,
    inches: m.inches || "",
    slitNumber: m.slitNumber || ""
  })),

  userLocations: wo.userLocations || []
});

// 🚀 AUTO SCHEDULE ALL (by priority, per Activity/Machine row)
exports.autoSchedule = async (req, res) => {
  try {
    const { date } = req.body;

    // clear only non-block schedules
    await Schedule.deleteMany({ isBlocked: false });

    // Populate machines.activityId so resolveRowImpression() can tell
    // whether each row is an "Offset" activity when recomputing
    // impression for older rows that never had it stored.
    const workOrders = await WorkOrder.find({ status: "PLANNED" }).populate({
      path: "machines.activityId",
      select: "activityName"
    });

    // ⚡ PERF: only the _id is ever used from Machine, so fetch just that
    // and look it up through a Set instead of scanning an array per machine
    const machines = await Machine.find().select("_id").lean();
    const machineIdSet = new Set(machines.map((m) => String(m._id)));

    const priorityMap = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    workOrders.sort((a, b) =>
      (priorityMap[a.priority] || 5) - (priorityMap[b.priority] || 5)
    );

    // Explode every Work Order into its individual Activity/Machine rows.
    // A Work Order with 3 rows in `machines[]` becomes 3 independent jobs
    // here, each scheduled on its own machine with its own impression
    // total — instead of the old behaviour of only ever looking at
    // `machines[0]` and ignoring the rest.
    const jobs = [];
    workOrders.forEach((wo) => {
      const rows = wo.machines && wo.machines.length > 0 ? wo.machines : [null];
      rows.forEach((row, idx) => {
        const resolvedRow = row || getWorkOrderRow(wo, {});
        const machineId = resolvedRow?.machineId?._id || resolvedRow?.machineId;
        if (!machineId) return;

        jobs.push({
          wo,
          row: resolvedRow,
          rowIndex: row ? idx : null,
          machineId: String(machineId)
        });
      });
    });

    // group jobs by machine
    const machineMap = {};
    jobs.forEach((job) => {
      if (!machineMap[job.machineId]) machineMap[job.machineId] = [];
      machineMap[job.machineId].push(job);
    });

    const schedules = [];

    for (let machineId in machineMap) {
      if (!machineIdSet.has(machineId)) continue;

      const cap = await getCapacity(machineId);
      const capacityPerHour = Number(cap.capacityPerHour);

      // Same guard as createSingle: a machine with a 0 / missing capacity
      // would otherwise turn every job on it into an Infinity duration
      // and an Invalid Date, which throws when insertMany() runs later.
      if (!capacityPerHour || !isFinite(capacityPerHour) || capacityPerHour <= 0) {
        console.error(`AUTO SCHEDULE: skipping machine ${machineId} — invalid capacityPerHour`);
        continue;
      }

      let currentTime = new Date(date);
      currentTime.setHours(cap.shiftStart, 0, 0, 0);

      const machineJobs = machineMap[machineId];

      // ⚡ PERF: the blocks of a machine cannot change while this loop
      // runs (nothing is written until insertMany below), so query them
      // once per machine instead of once per job. Same data, same order.
      const blocks = await Schedule.find({ machineId, isBlocked: true })
        .select("startTime endTime")
        .lean();

      for (let job of machineJobs) {
        const { wo, row, rowIndex } = job;

        // ROW-specific impression total — prefers what's stored, falls
        // back to a live recalculation (same formula as the Planner
        // Dashboard) for older rows that never had it stored.
        const { impFront: jobImpFront, impBack: jobImpBack, totalImp: rowTotalImp } =
          resolveRowImpression(wo, row);
        if (!rowTotalImp || !isFinite(rowTotalImp) || rowTotalImp <= 0) continue;

        const durationHrs = rowTotalImp / capacityPerHour;
        if (!isFinite(durationHrs) || durationHrs <= 0) continue;

        let startTime = new Date(currentTime);
        let endTime = new Date(startTime.getTime() + durationHrs * 3600000);

        // 🚧 handle blocks
        blocks.forEach(b => {
          if (startTime < b.endTime && endTime > b.startTime) {
            startTime = new Date(b.endTime);
            endTime = new Date(startTime.getTime() + durationHrs * 3600000);
          }
        });

        schedules.push({
          ...snapshotWorkOrder(wo),

          workOrderId: wo._id,
          machineId,
          activityId: row?.activityId?._id || row?.activityId || null,
          rowIndex,

          totalImpression: rowTotalImp,
          machineCapacity: capacityPerHour,
          startTime,
          endTime,
          scheduleDate: date,
          priority: wo.priority,
          location: wo.location,
          customer: getCustomerName(wo),

          inches: row?.inches || "",
          slitNumber: row?.slitNumber || "",
          isBooklet: row?.isBooklet || false,
          pages: row?.pages || 0,
          component: row?.component || "",

          // ROW-specific impression values (override any stale top-level
          // ones snapshotWorkOrder might otherwise have carried).
          impFront: jobImpFront,
          impBack: jobImpBack,
          totalImp: rowTotalImp
        });

        currentTime = endTime;
      }
    }

    await Schedule.insertMany(schedules);

    res.json({ message: "Auto scheduled 🚀", count: schedules.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Scheduling failed" });
  }
};

// 🧠 helper — push a candidate start time forward, machine by machine,
// past any schedule/block it would overlap, until it lands in a free
// slot. Re-queries after every push (rather than computing all
// conflicts once) so a slot that only became free by moving past one
// conflict is correctly checked against the next one too.
const findNextAvailableStart = async (machineId, requestedStart, durationMs) => {
  let candidate = new Date(requestedStart);
  let moved = true;
  let guard = 0; // safety cap so a data problem can't spin this forever

  while (moved && guard < 500) {
    moved = false;
    guard += 1;

    const candidateEnd = new Date(candidate.getTime() + durationMs);

    // ⚡ PERF: only endTime is used, so project just that field (with the
    // {machineId, endTime, startTime} index this is a covered query).
    const conflict = await Schedule.findOne({
      machineId,
      startTime: { $lt: candidateEnd },
      endTime: { $gt: candidate }
    })
      .select({ endTime: 1, _id: 0 })
      .sort({ endTime: 1 })
      .lean();

    if (conflict) {
      candidate = new Date(new Date(conflict.endTime).getTime() + 60 * 1000);
      moved = true;
    }
  }

  return candidate;
};

// 🚀 AUTO-SCHEDULE A JUST-CREATED WORK ORDER (called right after the
// Planner converts a Purchase/Printing Order into a Work Order).
//
// Every row in the Work Order's machines[] gets its own Schedule entry,
// starting as close to "right now" as that row's machine allows (i.e.
// the next free slot on that machine), so it shows up on the Gantt
// immediately — the person can then drag it to whenever they actually
// want it, exactly like any manually scheduled entry.
//
// Deliberately forgiving: a row that can't be auto-scheduled (no
// machine capacity set, no usable impression, etc.) is skipped rather
// than thrown — it simply stays in the Scheduler's "Pending Work
// Orders" list for manual scheduling, same as before this feature
// existed. Work Order creation itself never fails because of this.
//
// ⚡ PERF: the optional second argument `ctx` lets a bulk caller share a
// capacity cache across many Work Orders. Existing callers that pass only
// the workOrderId behave exactly as before.
exports.autoScheduleWorkOrder = async (workOrderId, ctx = {}) => {
  const result = { scheduled: 0, totalRows: 0, skipped: [] };

  const wo = await WorkOrder.findById(workOrderId).populate({
    path: "machines.activityId",
    select: "activityName"
  });

  if (!wo) {
    result.skipped.push("Work Order not found");
    return result;
  }

  const hasRows = wo.machines && wo.machines.length > 0;
  const rows = hasRows ? wo.machines : [null];
  result.totalRows = rows.length;

  // Fetch every existing schedule for this Work Order ONCE, then decide
  // per-row whether it's already covered — using the SAME legacy-aware
  // rule the Scheduler UI's pending list already uses:
  //   - a schedule with a real numeric rowIndex covers exactly that row
  //   - a schedule with rowIndex null/undefined (created before per-row
  //     tracking existed) covers only row 0
  // THIS is the fix for schedules getting duplicated on every run: the
  // old check compared a real number (e.g. 0) directly against `null`,
  // which never matches — so every pre-existing (legacy) schedule looked
  // "not yet scheduled" and got re-created from scratch each time.
  const existingSchedules = await Schedule.find({ workOrderId: wo._id })
    .select("rowIndex")
    .lean();

  const isRowAlreadyScheduled = (idx) => {
    if (!hasRows) {
      // No machines[] array at all — there's only ever one schedulable
      // "row" for this Work Order, so ANY existing schedule covers it.
      return existingSchedules.length > 0;
    }
    return existingSchedules.some((s) => {
      if (s.rowIndex !== undefined && s.rowIndex !== null) {
        return Number(s.rowIndex) === idx;
      }
      return idx === 0; // legacy schedule — only ever covered row 0
    });
  };

  for (let idx = 0; idx < rows.length; idx++) {
    const row = hasRows ? rows[idx] : getWorkOrderRow(wo, {});
    const rowIndex = hasRows ? idx : null;

    try {
      if (isRowAlreadyScheduled(idx)) continue;

      const machineId = row?.machineId?._id || row?.machineId;
      if (!machineId) {
        result.skipped.push(`Row ${idx}: no machine assigned`);
        continue;
      }

      let { impFront, impBack, totalImp } = resolveRowImpression(wo, row);
      // Never skip for missing/invalid impression — fall back to 1 so the
      // row still gets placed on the Gantt (time can be corrected later).
      if (!totalImp || !isFinite(totalImp) || totalImp <= 0) {
        totalImp = 1;
      }

      const capData = await getCapData(machineId, ctx.capCache);
      let capacityPerHour = Number(capData?.capacityPerHour);
      // Never skip for missing/invalid capacity either — fall back to 1.
      if (!capacityPerHour || !isFinite(capacityPerHour) || capacityPerHour <= 0) {
        capacityPerHour = 1;
      }

      let durationHours = totalImp / capacityPerHour;
      if (!isFinite(durationHours) || durationHours <= 0) {
        durationHours = 1; // last-resort fallback so a Schedule is always created
      }

      const durationMs = durationHours * 60 * 60 * 1000;

      // Anchor the search to the Work Order's OWN date (woDate), not the
      // moment the Auto-Schedule button was clicked — falls back to
      // createdAt, then now, only if woDate is somehow missing/invalid.
      const woAnchorDate =
        (wo.woDate && !isNaN(new Date(wo.woDate).getTime()) && new Date(wo.woDate)) ||
        (wo.createdAt && !isNaN(new Date(wo.createdAt).getTime()) && new Date(wo.createdAt)) ||
        new Date();

      const startTime = await findNextAvailableStart(machineId, woAnchorDate, durationMs);
      const endTime = new Date(startTime.getTime() + durationMs);

      await Schedule.create({
        ...snapshotWorkOrder(wo),

        workOrderId: wo._id,
        machineId,
        activityId: row?.activityId?._id || row?.activityId || null,
        rowIndex: hasRows ? rowIndex : null,

        totalImpression: totalImp,
        machineCapacity: capacityPerHour,
        startTime,
        endTime,
        scheduleDate: startTime,
        priority: wo.priority,
        location: wo.location,
        customer: getCustomerName(wo),

        inches: row?.inches || "",
        slitNumber: row?.slitNumber || "",
        isBooklet: row?.isBooklet || false,
        pages: row?.pages || 0,
        component: row?.component || "",

        impFront,
        impBack,
        totalImp
      });

      result.scheduled += 1;
    } catch (err) {
      console.error(`AUTO-SCHEDULE row ${idx} of WO ${workOrderId} failed:`, err.message);
      result.skipped.push(`Row ${idx}: ${err.message}`);
    }
  }

  return result;
};

// 🚀 AUTO-SCHEDULE EVERY CURRENTLY-PENDING WORK ORDER (old + new)
//
// Same per-row logic as autoScheduleWorkOrder() above (next free slot on
// each row's own machine, starting from now), just run across every
// Work Order that's still sitting in the "Pending Work Orders" list —
// including ones created long before this auto-schedule feature
// existed. Safe to call repeatedly: autoScheduleWorkOrder() already
// skips any row that already has a Schedule, so nothing is ever
// double-scheduled.
exports.autoScheduleAllPending = async (req, res) => {
  try {
    // ⚡ PERF: stream the Work Orders one by one through a cursor instead
    // of loading every document into memory first. They are still
    // processed strictly one after another, in the same order as before,
    // because each Work Order's slot depends on the ones scheduled before.
    const cursor = WorkOrder.find({
      status: "PLANNED",
      schedulerHidden: { $ne: true }
    })
      .select("_id efiWoNumber")
      .lean()
      .cursor({ batchSize: 100 });

    const capCache = new Map();

    let workOrdersChecked = 0;
    let totalScheduled = 0;
    const details = [];

    for await (const wo of cursor) {
      workOrdersChecked += 1;

      const r = await exports.autoScheduleWorkOrder(wo._id, { capCache });
      totalScheduled += r.scheduled || 0;

      // Only report Work Orders where something actually happened (or
      // something was skipped), so the response stays readable even
      // when there are hundreds of Work Orders with nothing pending.
      if (r.scheduled > 0 || (r.skipped && r.skipped.length > 0)) {
        details.push({
          workOrderId: wo._id,
          efiWoNumber: wo.efiWoNumber,
          ...r
        });
      }
    }

    res.json({
      message: `Auto-scheduled ${totalScheduled} row(s) across ${workOrdersChecked} Work Order(s) 🚀`,
      totalScheduled,
      workOrdersChecked,
      details
    });
  } catch (err) {
    console.error("AUTO SCHEDULE ALL PENDING ERROR:", err);
    res.status(500).json({ message: err.message || "Auto-schedule (pending) failed" });
  }
};

// 🧹 REMOVE DUPLICATE SCHEDULES
//
// One-time cleanup for schedules that were duplicated by the rowIndex
// mismatch bug in autoScheduleWorkOrder (now fixed above): every run of
// "Auto-Schedule All Pending" could create a brand-new schedule for a
// row that already had one, because a legacy `rowIndex: null` entry
// never matched a freshly-computed numeric rowIndex.
//
// Groups all non-blocked schedules by (workOrderId, normalized
// rowIndex — treating null/undefined as row 0, same convention used
// everywhere else in this file), keeps the OLDEST schedule in each
// group (so any manual drag/resize adjustments on the original survive),
// and deletes the rest. Blocked machine entries (isBlocked: true) are
// never touched.
//
// ⚡ PERF: the grouping now runs inside MongoDB (aggregation) instead of
// pulling every Schedule into Node memory. Same rules: non-blocked only,
// must have a workOrderId, rowIndex null/missing counts as 0, oldest
// createdAt is kept, the rest are deleted.
exports.dedupeSchedules = async (req, res) => {
  try {
    const matchStage = {
      $match: { isBlocked: { $ne: true }, workOrderId: { $ne: null } }
    };

    // same key the old code built: `${workOrderId}::${normalizedRowIndex}`
    const groupKey = {
      wo: "$workOrderId",
      row: { $toString: { $ifNull: ["$rowIndex", 0] } }
    };

    // 1) groups that contain more than one schedule -> ids to delete
    //    (everything except the oldest, which comes first after the sort)
    const dupGroups = await Schedule.aggregate([
      matchStage,
      { $sort: { createdAt: 1, _id: 1 } },
      { $group: { _id: groupKey, ids: { $push: "$_id" } } },
      { $match: { $expr: { $gt: [{ $size: "$ids" }, 1] } } },
      {
        $project: {
          _id: 0,
          dupIds: { $slice: ["$ids", 1, { $size: "$ids" }] }
        }
      }
    ]).allowDiskUse(true);

    const idsToDelete = [];
    dupGroups.forEach((g) => idsToDelete.push(...g.dupIds));

    // 2) total number of groups checked
    const groupCount = await Schedule.aggregate([
      matchStage,
      { $group: { _id: groupKey } },
      { $count: "n" }
    ]).allowDiskUse(true);

    const groupsChecked = groupCount[0]?.n || 0;

    // delete in batches so a huge cleanup never exceeds the 16MB command limit
    let deletedCount = 0;
    const BATCH = 5000;
    for (let i = 0; i < idsToDelete.length; i += BATCH) {
      const delResult = await Schedule.deleteMany({
        _id: { $in: idsToDelete.slice(i, i + BATCH) }
      });
      deletedCount += delResult.deletedCount || 0;
    }

    res.json({
      message: `Removed ${deletedCount} duplicate schedule(s).`,
      deletedCount,
      groupsChecked
    });
  } catch (err) {
    console.error("DEDUPE SCHEDULES ERROR:", err);
    res.status(500).json({ message: err.message || "Dedupe failed" });
  }
};

// ✅ CREATE SINGLE SCHEDULE (schedules ONE Activity/Machine row)
exports.createSingle = async (req, res) => {
  try {
    const {
      workOrderId,
      machineId,
      activityId,   // NEW — which activity this row is for (optional)
      rowIndex,     // NEW — which index inside wo.machines[] this row is (optional)
      scheduleDate
    } = req.body;

    if (!workOrderId || !mongoose.isValidObjectId(workOrderId)) {
      return res.status(400).json({ message: "A valid workOrderId is required" });
    }

    // Populate the row's activityId so `isOffsetActivityRow()` can read
    // its activityName — needed to correctly recompute impression for
    // older rows that never had impFront/impBack/totalImp stored.
    const wo = await WorkOrder.findById(workOrderId).populate({
      path: "machines.activityId",
      select: "activityName"
    });

    if (!wo) {
      return res.status(404).json({ message: "WO not found" });
    }

    const row = getWorkOrderRow(wo, { rowIndex, machineId, activityId });

    const resolvedMachineId =
      machineId || row?.machineId?._id || row?.machineId;
    const resolvedActivityId =
      activityId || row?.activityId?._id || row?.activityId || null;

    if (!resolvedMachineId || !mongoose.isValidObjectId(resolvedMachineId)) {
      return res.status(400).json({
        message: "Machine not found for this Work Order / row"
      });
    }

    // ROW-specific impression total. Prefers whatever is actually stored
    // on the row; for older Work Orders that never had impFront/impBack/
    // totalImp saved on their machines[] row (and whose Work Order-level
    // totalImp is no longer readable either), this recomputes the value
    // live from orderQty/wasteQty/colorFront/colorBack/UPS — the same
    // formula the Planner Dashboard itself uses.
    const { impFront: resolvedImpFront, impBack: resolvedImpBack, totalImp: rowTotalImp } =
      resolveRowImpression(wo, row);

    if (!rowTotalImp || !isFinite(rowTotalImp) || rowTotalImp <= 0) {
      const upsMissing = !(Number(row?.UPS) > 0 || Number(wo?.UPS) > 0);
      return res.status(400).json({
        message: upsMissing
          ? "Cannot calculate Total Impression: UPS is missing/zero on this row AND on the Work Order, and no stored impression value is available either. Please open this Work Order in the Planner and set UPS."
          : "Total Impression is missing or invalid for this Activity/Machine row"
      });
    }

    // ⚡ PERF: .select().lean() — only capacityPerHour is read
    const capData = await MachineCapacity.findOne({ machineId: resolvedMachineId })
      .select("capacityPerHour")
      .lean();

    if (!capData) {
      return res.status(400).json({
        message: "Capacity not set for this machine"
      });
    }

    const capacity = Number(capData.capacityPerHour);

    // Guards against the exact bug that was surfacing as a bare 500:
    // a machine whose MachineCapacity document exists but has
    // capacityPerHour of 0 / missing / non-numeric turns the division
    // below into Infinity or NaN, which then produces an Invalid Date
    // for endTime and makes Schedule.create() throw a Mongoose
    // CastError. We now catch that case explicitly with a clear message
    // instead of letting it fall through to a generic 500.
    if (!capacity || !isFinite(capacity) || capacity <= 0) {
      return res.status(400).json({
        message: "This machine's capacity per hour is 0 or not set correctly — please fix it in Machine Capacity master before scheduling."
      });
    }

    const durationHours = rowTotalImp / capacity;

    if (!isFinite(durationHours) || durationHours <= 0) {
      return res.status(400).json({
        message: "Could not calculate a valid duration for this row"
      });
    }

    let startTime = new Date(scheduleDate);

    if (isNaN(startTime.getTime())) {
      return res.status(400).json({ message: "Invalid schedule date/time" });
    }

    let endTime = new Date(
      startTime.getTime() + durationHours * 60 * 60 * 1000
    );

    if (isNaN(endTime.getTime())) {
      return res.status(400).json({
        message: "Calculated end time is invalid — check machine capacity and total impression for this row"
      });
    }

    const schedule = await Schedule.create({
      ...snapshotWorkOrder(wo),

      workOrderId,
      machineId: resolvedMachineId,
      activityId: resolvedActivityId,
      rowIndex: rowIndex !== undefined ? rowIndex : null,

      totalImpression: rowTotalImp,
      machineCapacity: capacity,
      startTime,
      endTime,
      scheduleDate,
      priority: wo.priority,
      location: wo.location,
      customer: getCustomerName(wo),

      inches: row?.inches || "",
      slitNumber: row?.slitNumber || "",
      isBooklet: row?.isBooklet || false,
      pages: row?.pages || 0,
      component: row?.component || "",

      // ROW-specific impression values — placed AFTER the snapshot spread
      // so they always win over any (now-empty) top-level WO fields.
      // (resolvedImpFront/Back come from stored values when present, or
      // the live recalculation for older rows — see resolveRowImpression.)
      impFront: resolvedImpFront,
      impBack: resolvedImpBack,
      totalImp: rowTotalImp
    });

    res.json(schedule);
  } catch (err) {
    // Log full context so a genuine bug is easy to trace in the server
    // console, and return the real message to the frontend instead of a
    // generic "Schedule failed" — that generic message is exactly what
    // was masking the real cause (an Invalid Date from a zero-capacity
    // machine) behind a bare 500 before.
    console.error("CREATE SCHEDULE ERROR:", {
      body: req.body,
      message: err.message
    });
    res.status(500).json({ message: err.message || "Schedule failed" });
  }
};

// ✅ UPDATE SCHEDULE TIME (drag & drop from Gantt) — unchanged
exports.updateScheduleTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ message: "startTime and endTime are required" });
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    if (isNaN(newStart) || isNaN(newEnd)) {
      return res.status(400).json({ message: "Invalid date values" });
    }

    if (newEnd <= newStart) {
      return res.status(400).json({ message: "endTime must be after startTime" });
    }

    // ⚡ PERF: only machineId is needed from the existing schedule
    const existing = await Schedule.findById(id).select("machineId").lean();
    if (!existing) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // 🔥 CONFLICT CHECK — exclude self
    // ⚡ PERF: we only need to know IF one exists, so fetch a single _id
    // instead of every overlapping document
    const conflict = await Schedule.findOne({
      _id: { $ne: id },
      machineId: existing.machineId,
      isBlocked: { $ne: true },
      startTime: { $lt: newEnd },
      endTime: { $gt: newStart }
    })
      .select("_id")
      .lean();

    if (conflict) {
      return res.status(400).json({ message: "Time slot already occupied ❌" });
    }

    const updated = await Schedule.findByIdAndUpdate(
      id,
      {
        startTime: newStart,
        endTime: newEnd,
        scheduleDate: newStart
      },
      { new: true }
    )
      .populate("machineId", "machineName")
      .populate("workOrderId", "efiWoNumber customer woDate")
      .populate("activityId", "activityName")
      .populate("machinesDetail.activityId", "activityName")
      .populate("machinesDetail.machineId", "machineName");

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
};

// ✅ DELETE SCHEDULE — unchanged
exports.deleteSchedule = async (req, res) => {
  try {
    // ⚡ PERF: one round trip instead of findById + findByIdAndDelete.
    // Same outcome: 404 when it doesn't exist, otherwise it is deleted.
    const schedule = await Schedule.findByIdAndDelete(req.params.id);

    if (!schedule) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "Deleted successfully ✅" });
  } catch (e) {
    res.status(500).json({ message: "Delete failed" });
  }
};

// 🚧 BLOCK MACHINE — unchanged
exports.blockMachine = async (req, res) => {
  try {

    const {
      machineId,
      startTime,
      endTime,
      reason
    } = req.body;

    if (
      !machineId ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({
        message: "End time must be greater than start time"
      });
    }

    const block = await Schedule.create({
      machineId,
      startTime: start,
      endTime: end,
      scheduleDate: start,
      isBlocked: true,
      blockReason: reason || "Machine Blocked"
    });

    res.json({
      message: "Machine blocked successfully 🚧",
      block
    });

  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Block failed"
    });
  }
};

// 📊 GET SCHEDULES
//
// ⚡ PERF: .lean() skips building full Mongoose documents (large memory
// and CPU saving on big result sets). The JSON sent to the frontend has
// the same fields.
//
// ⚡ PERF: optional `?from=...&to=...` (ISO dates) limits the result to
// schedules whose startTime is in that range. When neither is sent (which
// is what the current frontend does) the filter is empty and the result
// is exactly what it was before.
exports.getSchedules = async (req, res) => {
  const filter = {};
  const fromDate = req.query?.from ? new Date(req.query.from) : null;
  const toDate = req.query?.to ? new Date(req.query.to) : null;

  if (fromDate && !isNaN(fromDate.getTime())) {
    filter.startTime = { ...(filter.startTime || {}), $gte: fromDate };
  }
  if (toDate && !isNaN(toDate.getTime())) {
    filter.startTime = { ...(filter.startTime || {}), $lte: toDate };
  }

  try {
    const data = await Schedule.find(filter)
      .populate("machineId", "machineName")
      .populate("workOrderId", "efiWoNumber customer woDate")
      .populate("activityId", "activityName")
      .populate("machinesDetail.activityId", "activityName")
      .populate("machinesDetail.machineId", "machineName")
      .lean();

    res.json(data);
  } catch (e) {
    console.error("GET SCHEDULES ERROR:", e.message);

    // Fallback: return schedules without the nested populates so the
    // frontend still gets data instead of a hard 500 (e.g. if an old
    // Schedule doc references an activityId that no longer resolves).
    try {
      const fallbackData = await Schedule.find(filter)
        .populate("machineId", "machineName")
        .populate("workOrderId", "efiWoNumber customer woDate")
        .lean();

      res.json(fallbackData);
    } catch (fallbackErr) {
      console.error("GET SCHEDULES FALLBACK ERROR:", fallbackErr.message);
      res.status(500).json({ message: "Fetch failed" });
    }
  }
};