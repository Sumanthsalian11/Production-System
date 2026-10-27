const express = require("express");
const router = express.Router();
const ProductionReal = require("../models/ProductionReal");
const User = require("../models/User"); 
const WorkOrder = require("../models/WorkOrder"); // add this import at top
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");
// ---- cache for the /report feed (cleared on every write) ----
const REPORT_TTL_MS = 60 * 1000;
const REPORT_MAX_KEYS = 24;
const reportCache = new Map();
const clearReportCache = () => reportCache.clear();

// only the fields the dashboard actually reads
const SLIM_FIELDS = {
  workOrder: 1, customerName: 1, jobDescription: 1, productType: 1, machineStatus: 1,
  productionDate: 1, productionFromTime: 1, productionToTime: 1,
  productionQty: 1, wastageQty: 1, productionImpression: 1, pages: 1,
  orderQty: 1, remarks: 1, createdAt: 1, userLocations: 1,
  "machiness.activityId": 1, "machiness.machineId": 1,
  "materials.materialGroupDescription": 1,
  productionUser: 1, enteredBy: 1, user: 1, createdBy: 1, userName: 1,
  username: 1, addedBy: 1, updatedBy: 1, operator: 1, name: 1,
};

// escapes user text before it is used inside a regex
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


router.post("/", authMiddleware, async (req, res) => {
  try {
   
    const userId = req.user.id;


    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

   
    const newEntry = new ProductionReal({
      ...req.body,
      enteredBy: user.name,
        enteredById: user._id,    
      userLocations: user.locations || [], // store locations from user
    });

    await newEntry.save();
    clearReportCache();
    res.status(201).json({ message: "Production saved successfully" });
  } catch (error) {
    console.error("Error saving Production:", error);
    res.status(500).json({ message: "Error saving production", error });
  }
});

// GET ALL Production Real with populated references (date-bounded)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const q = req.query;
    const from = q.from || q.dateFrom;
    const to = q.to || q.dateTo;

    const query = {};
    if (from || to) {
      query.productionDate = {};
      if (from) query.productionDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) query.productionDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    // optional filters (used by the Production Entry page)
    if (q.month && /^\d{4}-\d{2}$/.test(q.month)) {
      const [y, m] = q.month.split("-").map(Number);
      query.$and = [
        { productionDate: { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) } },
      ];
    }
    if (q.workOrderExact) {
      query.workOrder = Number(q.workOrderExact);
    } else if (q.workOrder) {
      (query.$and = query.$and || []).push({
        $expr: { $regexMatch: { input: { $toString: "$workOrder" }, regex: escapeRegex(q.workOrder) } },
      });
    }
    if (q.machineStatus) query.machineStatus = q.machineStatus;
    if (q.shift) query.shift = q.shift;
    if (q.productType) query.productType = q.productType;
    if (q.customer) query.customerName = q.customer;
    if (q.location) query.userLocations = q.location;
    if (q.machine) {
      const ids = await mongoose.model("MachineMaster").find({ machineName: q.machine }).distinct("_id");
      query["machiness.machineId"] = { $in: ids };
    }
    if (q.machineId) query["machiness.machineId"] = q.machineId;

    // ⚡ limit (+ page) only when asked; no limit = old behaviour
    const limit = parseInt(q.limit, 10);
    const pageNo = Math.max(parseInt(q.page, 10) || 1, 1);
    let cursor = ProductionReal.find(query).select(q.slim ? SLIM_FIELDS : "-__v");
    if (limit > 0) {
      const size = Math.min(limit, 1000);
      const dateFiltered = Boolean(from || to || q.month);
      const sortSpec = dateFiltered ? { productionDate: -1, createdAt: -1 } : { createdAt: -1 };
      cursor = cursor.sort(sortSpec).skip((pageNo - 1) * size).limit(size);
    }

    // ⚡ populate ONLY the fields the UI reads (activityName / machineName;
    // _id always comes along) instead of whole master documents per row.
    // guard: a request with no page limit that would load too many rows is refused instead of crashing the server
    if (!(limit > 0)) {
      const MAX_ROWS = 100000;
      const matching = Object.keys(query).length
        ? await ProductionReal.countDocuments(query)
        : await ProductionReal.estimatedDocumentCount();
      if (matching > MAX_ROWS) {
        return res.status(413).json({ message: `Too many records (${matching.toLocaleString("en-IN")}). Narrow the date range.` });
      }
    }

    const data = await cursor.lean(); // lean so we can freely attach extra fields

    // activity / machine names from the (small) master tables instead of populate()
    // same response shape, far less memory and time on big result sets
    const [actDocs, macDocs] = await Promise.all([
      mongoose.model("ActivityMaster").find({}, "activityName").lean(),
      mongoose.model("MachineMaster").find({}, "machineName").lean(),
    ]);
    const actMap = new Map(actDocs.map((a) => [String(a._id), a]));
    const macMap = new Map(macDocs.map((m) => [String(m._id), m]));
    for (let i = 0; i < data.length; i++) {
      const pairs = data[i].machiness;
      if (!pairs) continue;
      for (let j = 0; j < pairs.length; j++) {
        pairs[j].activityId = actMap.get(String(pairs[j].activityId)) || pairs[j].activityId;
        pairs[j].machineId = macMap.get(String(pairs[j].machineId)) || pairs[j].machineId;
      }
    }

    // ✅ Pull current WorkOrder orderQty for every distinct workOrder number
    const woSet = new Set();
    for (let i = 0; i < data.length; i++) {
      if (data[i].workOrder) woSet.add(data[i].workOrder);
    }
    const woNumbers = [...woSet];

    // ⚡ query in chunks so a huge $in list never hits BSON / planner limits,
    // and run the chunks in parallel
    const CHUNK = 5000;
    const chunks = [];
    for (let i = 0; i < woNumbers.length; i += CHUNK) {
      chunks.push(woNumbers.slice(i, i + CHUNK));
    }

    const chunkResults = await Promise.all(
      chunks.map((ids) =>
        WorkOrder.find(
          { efiWoNumber: { $in: ids } },
          { efiWoNumber: 1, orderQty: 1, _id: 0 }
        ).lean()
      )
    );

    const woMap = {};
    chunkResults.forEach((list) =>
      list.forEach((wo) => {
        woMap[wo.efiWoNumber] = wo.orderQty;
      })
    );

    // ✅ Attach live orderQty alongside the stored snapshot (mutate in place —
    // no second copy of the whole array)
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      item.liveOrderQty = woMap[item.workOrder] ?? item.orderQty; // fallback to snapshot if WO deleted
    }

    // total record count (only when the page asks for it)
    if (q.withCount) {
      const total = Object.keys(query).length
        ? await ProductionReal.countDocuments(query)
        : await ProductionReal.estimatedDocumentCount();
      return res.json({ data, total });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching Production Real:", error);
    res.status(500).json({ message: "Error fetching data" });
  }
});

// earliest / latest production date (used to split "all data" into month windows)
router.get("/date-bounds", authMiddleware, async (req, res) => {
  try {
    const [min, max] = await Promise.all([
      ProductionReal.findOne({ productionDate: { $ne: null } }).sort({ productionDate: 1 }).select("productionDate").lean(),
      ProductionReal.findOne({ productionDate: { $ne: null } }).sort({ productionDate: -1 }).select("productionDate").lean(),
    ]);
    res.json({ min: min?.productionDate || null, max: max?.productionDate || null });
  } catch (error) {
    console.error("Error fetching date bounds:", error);
    res.status(500).json({ message: "Error fetching date bounds" });
  }
});

// Distinct values for the Production Entry filter dropdowns
router.get("/filter-options", authMiddleware, async (req, res) => {
  try {
    const [productTypes, customerNames, locations, machineIds] = await Promise.all([
      ProductionReal.distinct("productType"),
      ProductionReal.distinct("customerName"),
      ProductionReal.distinct("userLocations"),
      ProductionReal.distinct("machiness.machineId"),
    ]);
    const machineDocs = await mongoose
      .model("MachineMaster")
      .find({ _id: { $in: machineIds } })
      .select("machineName")
      .lean();

    res.json({
      productTypes: productTypes.filter(Boolean),
      customerNames: customerNames.filter(Boolean),
      locations: locations.filter(Boolean),
      machineNames: [...new Set(machineDocs.map((m) => m.machineName).filter(Boolean))],
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    res.status(500).json({ message: "Error fetching options" });
  }
});

// ---- same filters as GET "/" (used by the summary) ----
const buildProductionQuery = async (q) => {
  const from = q.from || q.dateFrom;
  const to = q.to || q.dateTo;
  const query = {};
  if (from || to) {
    query.productionDate = {};
    if (from) query.productionDate.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) query.productionDate.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (q.month && /^\d{4}-\d{2}$/.test(q.month)) {
    const [y, m] = q.month.split("-").map(Number);
    query.$and = [
      { productionDate: { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) } },
    ];
  }
  if (q.workOrderExact) {
    query.workOrder = Number(q.workOrderExact);
  } else if (q.workOrder) {
    (query.$and = query.$and || []).push({
      $expr: { $regexMatch: { input: { $toString: "$workOrder" }, regex: escapeRegex(q.workOrder) } },
    });
  }
  if (q.machineStatus) query.machineStatus = q.machineStatus;
  if (q.shift) query.shift = q.shift;
  if (q.productType) query.productType = q.productType;
  if (q.customer) query.customerName = q.customer;
  if (q.location) query.userLocations = q.location;
  if (q.machine) {
    const ids = await mongoose.model("MachineMaster").find({ machineName: q.machine }).distinct("_id");
    query["machiness.machineId"] = { $in: ids };
  }
  if (q.machineId) query["machiness.machineId"] = q.machineId;
  return query;
};

// Summary Report: grouped on the server, only the totals are sent to the browser
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const q = req.query;
    const query = await buildProductionQuery(q);
    const limit = parseInt(q.limit, 10);

    const pipeline = [{ $match: query }];
    if (limit > 0) pipeline.push({ $sort: { createdAt: -1 } }, { $limit: Math.min(limit, 1000) });

    pipeline.push(
      {
        $project: {
          shift: { $toLower: { $ifNull: ["$shift", ""] } },
          statusRaw: { $trim: { input: { $ifNull: ["$machineStatus", ""] } } },
          status: { $toLower: { $trim: { input: { $ifNull: ["$machineStatus", ""] } } } },
          imp: { $ifNull: ["$productionImpression", 0] },
          remarks: { $trim: { input: { $ifNull: ["$remarks", ""] } } },
          mins: {
            $let: {
              vars: {
                f: { $split: [{ $ifNull: ["$productionFromTime", ""] }, ":"] },
                t: { $split: [{ $ifNull: ["$productionToTime", ""] }, ":"] },
              },
              in: {
                $cond: [
                  { $or: [{ $lt: [{ $size: "$$f" }, 2] }, { $lt: [{ $size: "$$t" }, 2] }] },
                  0,
                  {
                    $let: {
                      vars: {
                        d: {
                          $subtract: [
                            { $add: [{ $multiply: [{ $toInt: { $arrayElemAt: ["$$t", 0] } }, 60] }, { $toInt: { $arrayElemAt: ["$$t", 1] } }] },
                            { $add: [{ $multiply: [{ $toInt: { $arrayElemAt: ["$$f", 0] } }, 60] }, { $toInt: { $arrayElemAt: ["$$f", 1] } }] },
                          ],
                        },
                      },
                      in: { $cond: [{ $lte: ["$$d", 0] }, { $add: ["$$d", 1440] }, "$$d"] },
                    },
                  },
                ],
              },
            },
          },
          machiness: 1,
        },
      },
      { $unwind: { path: "$machiness", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { a: "$machiness.activityId", m: "$machiness.machineId", shift: "$shift", status: "$status" },
          label: { $first: "$statusRaw" },
          imp: { $sum: "$imp" },
          mins: { $sum: "$mins" },
          remarks: { $addToSet: "$remarks" },
        },
      }
    );

    const [rows, actDocs, macDocs] = await Promise.all([
      ProductionReal.aggregate(pipeline).allowDiskUse(true),
      mongoose.model("ActivityMaster").find({}, "activityName").lean(),
      mongoose.model("MachineMaster").find({}, "machineName").lean(),
    ]);
    const actMap = new Map(actDocs.map((a) => [String(a._id), a.activityName]));
    const macMap = new Map(macDocs.map((m) => [String(m._id), m.machineName]));

    const statuses = new Map();
    const out = rows.map((r) => {
      if (r._id.status && !statuses.has(r._id.status)) statuses.set(r._id.status, r.label || r._id.status);
      return {
        activityName: actMap.get(String(r._id.a)) || "-",
        machineName: macMap.get(String(r._id.m)) || "-",
        shift: r._id.shift,
        status: r._id.status,
        imp: r.imp,
        mins: r.mins,
        remarks: (r.remarks || []).filter(Boolean),
      };
    });

    res.json({
      rows: out,
      statuses: [...statuses].map(([key, label]) => ({ key, label })),
    });
  } catch (error) {
    console.error("Error building summary:", error);
    res.status(500).json({ message: "Error building summary" });
  }
});

// LIGHTWEIGHT feed for the Production Report page (only the fields it reads)
// LIGHTWEIGHT feed for the Production Report page (same response shape as before)
router.get("/report", authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    const key = `${from || ""}|${to || ""}`;

    const hit = reportCache.get(key);
    if (hit && Date.now() - hit.t < REPORT_TTL_MS) {
      return res.type("application/json").send(hit.body);
    }

    const query = {};
    if (from || to) {
      query.productionDate = {};
      if (from) query.productionDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) query.productionDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const [data, macDocs] = await Promise.all([
      ProductionReal.find(query)
        .select({
          _id: 0,
          workOrder: 1, customerName: 1, orderQty: 1,
          productionDate: 1, productionFromTime: 1, productionToTime: 1,
          productionQty: 1, wastageQty: 1, wastePercent: 1,
          machineStatus: 1, userLocations: 1, createdAt: 1, productType: 1,
          "machiness.machineId": 1, "machiness.activityId": 1,
        })
        .lean(),
      mongoose.model("MachineMaster").find({}, "machineName").lean(),
    ]);

    const macMap = new Map(macDocs.map((m) => [String(m._id), m.machineName]));

    for (let i = 0; i < data.length; i++) {
      const pairs = data[i].machiness;
      if (!pairs) continue;
      for (let j = 0; j < pairs.length; j++) {
        const name = macMap.get(String(pairs[j].machineId));
        pairs[j].machineId = name !== undefined ? { machineName: name } : pairs[j].machineId;
      }
    }

    const body = JSON.stringify(data);

    if (reportCache.size >= REPORT_MAX_KEYS) {
      reportCache.delete(reportCache.keys().next().value);
    }
    reportCache.set(key, { t: Date.now(), body });

    res.type("application/json").send(body);
  } catch (error) {
    console.error("Error fetching production report:", error);
    res.status(500).json({ message: "Error fetching data" });
  }
});

// ⚡ SERVER-SIDE SUMMARY for the Production Report page (aggregated in MongoDB)
router.get("/report-summary", authMiddleware, async (req, res) => {
  try {
    const { from, to, wo, customer, machine, location, productType } = req.query;
    const key = ["S", from, to, wo, customer, machine, location, productType].map((v) => v || "").join("|");
    const hit = reportCache.get(key);
    if (hit && Date.now() - hit.t < REPORT_TTL_MS) {
      return res.type("application/json").send(hit.body);
    }
    const put = (k, v) => {
      if (reportCache.size >= REPORT_MAX_KEYS) reportCache.delete(reportCache.keys().next().value);
      reportCache.set(k, v);
    };

    const MachineMaster = mongoose.model("MachineMaster");
    const dateMatch = {};
    if (from || to) {
      dateMatch.productionDate = {};
      if (from) dateMatch.productionDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) dateMatch.productionDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    const match = { ...dateMatch };
    if (wo) {
      match.$expr = {
        $regexMatch: {
          input: { $toString: "$workOrder" },
          regex: escapeRegex(wo),
        },
      };
    }
    if (customer) match.customerName = customer;
    if (productType) {
      // trimmed + case-insensitive, so "Book" and "book " are treated as one type
      match.productType = new RegExp("^\\s*" + escapeRegex(String(productType).trim()) + "\\s*$", "i");
    }
    if (location) match.userLocations = location;

    // machine filter: ids are passed as ObjectId AND string (aggregation does not cast types)
    let machineIds = null;
    if (machine) {
      const found = (
        await MachineMaster.find({ machineName: new RegExp("^\\s*" + escapeRegex(String(machine).trim()) + "\\s*$", "i") })
          .select("_id")
          .lean()
      ).map((m) => new mongoose.Types.ObjectId(String(m._id)));
      machineIds = [...found, ...found.map(String)];
      match["machiness.machineId"] = { $in: machineIds };
    }
    const prodMatch = { ...match, machineStatus: "PRODUCTION" };

    // minutes between "HH:MM" strings (rolls over midnight, same as the UI did)
    const part = (f, i) => ({
      $convert: { input: { $arrayElemAt: [{ $split: [f, ":"] }, i] }, to: "int", onError: 0, onNull: 0 },
    });
    const toMin = (f) => ({ $add: [{ $multiply: [part(f, 0), 60] }, part(f, 1)] });
    const minutes = {
      $let: {
        vars: { f: toMin("$productionFromTime"), t: toMin("$productionToTime") },
        in: {
          $cond: [
            { $lte: ["$$t", "$$f"] },
            { $subtract: [{ $add: ["$$t", 1440] }, "$$f"] },
            { $subtract: ["$$t", "$$f"] },
          ],
        },
      },
    };
    const agg = (p) => ProductionReal.aggregate(p).allowDiskUse(true);

    // Exclude work orders with no production in the selected report scope from every report total.
    const eligibleWORows = await agg([
      { $match: match },
      { $group: { _id: "$workOrder", production: { $sum: { $ifNull: ["$productionQty", 0] } } } },
      { $match: { production: { $gt: 0 } } },
      { $project: { _id: 1 } },
    ]);
    const eligibleWOs = eligibleWORows.map((r) => r._id);
    const reportMatch = { $and: [match, { workOrder: { $in: eligibleWOs } }] };
    const reportProdMatch = { $and: [prodMatch, { workOrder: { $in: eligibleWOs } }] };

    // dropdown options (date range only, so they don't shrink when a filter is picked)
    const okey = `O|${from || ""}|${to || ""}`;
    const optsP = (async () => {
      const c = reportCache.get(okey);
      if (c && Date.now() - c.t < REPORT_TTL_MS) return c.v;
      const [cu, lo, pt] = await Promise.all([
        ProductionReal.distinct("customerName", dateMatch),
        ProductionReal.distinct("userLocations", dateMatch),
        ProductionReal.distinct("productType", dateMatch),
      ]);
      const seenPT = new Set();
      const productTypes = pt
        .filter((x) => {
          const k = String(x ?? "").trim().toLowerCase();
          if (!k || seenPT.has(k)) return false;
          seenPT.add(k);
          return true;
        })
        .map((x) => String(x).trim())
        .sort((a, b) => a.localeCompare(b));
      const v = { customers: cu.filter(Boolean), locations: lo.filter(Boolean), productTypes };
      put(okey, { t: Date.now(), v });
      return v;
    })();

    const [macDocs, kpiRaw, utilRaw, jobsRaw, actRaw, opts] = await Promise.all([
      MachineMaster.find({}, "machineName").lean(),
      // KPI totals
      agg([
        { $match: reportMatch },
        {
          $group: {
            _id: "$workOrder",
            oq: { $first: "$orderQty" },
            p: { $sum: "$productionQty" },
            w: { $sum: "$wastageQty" },
            prod: { $max: { $cond: [{ $eq: ["$machineStatus", "PRODUCTION"] }, 1, 0] } },
          },
        },
        {
          $group: {
            _id: null,
            totalOrderQty: { $sum: "$oq" },
            totalProduction: { $sum: "$p" },
            totalWastage: { $sum: "$w" },
            totalOrders: { $sum: "$prod" },
          },
        },
      ]),
      // machine utilization (machine x date x status)
      agg([
        { $match: reportMatch },
        {
          $project: {
            _id: 0,
            d: { $dateToString: { format: "%Y-%m-%d", date: "$productionDate" } },
            s: "$machineStatus",
            ft: "$productionFromTime",
            m: minutes,
            ids: "$machiness.machineId",
          },
        },
        { $unwind: "$ids" },
        ...(machineIds ? [{ $match: { ids: { $in: machineIds } } }] : []),
        { $group: { _id: { m: "$ids", d: "$d", s: "$s" }, min: { $sum: "$m" }, ft: { $min: "$ft" } } },
      ]),
      // job level: latest PRODUCTION entry per work order
      agg([
        { $match: reportProdMatch },
        {
          $group: {
            _id: "$workOrder",
            c: { $first: "$customerName" },
            oq: { $first: "$orderQty" },
            pt: { $max: "$productType" },
            jd: { $max: "$jobDescription" },
            latest: {
              $max: {
                t: "$createdAt",
                p: "$productionQty",
                w: "$wastageQty",
                pt: "$productType",
                lm: { $arrayElemAt: ["$machiness.machineId", -1] },
              },
            },
          },
        },
      ]),
      // job x activity x machine sums
      agg([
        { $match: reportProdMatch },
        {
          $project: {
            _id: 0, wo: "$workOrder", p: "$productionQty", w: "$wastageQty", wp: "$wastePercent", pairs: "$machiness",
          },
        },
        { $unwind: "$pairs" },
        ...(machineIds ? [{ $match: { "pairs.machineId": { $in: machineIds } } }] : []),
        {
          $group: {
            _id: { wo: "$wo", a: "$pairs.activityId", m: "$pairs.machineId" },
            p: { $sum: "$p" }, w: { $sum: "$w" }, wp: { $sum: "$wp" },
          },
        },
      ]),
      optsP,
    ]);

    const macName = new Map(macDocs.map((m) => [String(m._id), m.machineName]));
    const nameOf = (id) => macName.get(String(id)) || "Unassigned";

    // jobs
    const jobs = new Map();
    for (const r of jobsRaw) {
      jobs.set(r._id, {
        workOrder: r._id,
        customer: r.c,
        orderQty: r.oq,
        productType: (r.latest && r.latest.pt) || r.pt,
        jobDescription: r.jd || "",
        latestProduction: Number(r.latest?.p) || 0,
        latestWastage: Number(r.latest?.w) || 0,
        byActivity: {},
        machines: {},
        lastMachine: r.latest?.lm ? nameOf(r.latest.lm) : null,
      });
    }
    for (const r of actRaw) {
      const e = jobs.get(r._id.wo);
      if (!e) continue;
      const m = nameOf(r._id.m);
      const act = String(r._id.a || "");
      if (act) {
        const bm = e.byActivity[act] || (e.byActivity[act] = {});
        const cur = bm[m] || (bm[m] = { production: 0, wastage: 0 });
        cur.production += r.p;
        cur.wastage += r.w;
      }
      const mm = e.machines[m] || (e.machines[m] = { production: 0, wastage: 0, wastePercent: 0 });
      mm.production += r.p;
      mm.wastage += r.w;
      mm.wastePercent += r.wp;
    }

    // utilization rows + first-seen order of machines
    const rowMap = new Map();
    const first = new Map();
    for (const r of utilRaw) {
      const machineName = nameOf(r._id.m);
      const date = r._id.d;
      const k = machineName + "_" + date;
      let row = rowMap.get(k);
      if (!row) rowMap.set(k, (row = { machine: machineName, date }));
      if (r._id.s) row[r._id.s] = (row[r._id.s] || 0) + r.min;
      const ts = Date.parse(`${date}T${r.ft || "00:00"}:00Z`) || 0;
      const prev = first.get(machineName);
      if (prev === undefined || ts < prev) first.set(machineName, ts);
    }

    const k0 = kpiRaw[0] || {};
    const body = JSON.stringify({
      kpi: {
        totalOrderQty: k0.totalOrderQty || 0,
        totalOrders: k0.totalOrders || 0,
        totalProduction: k0.totalProduction || 0,
        totalWastage: k0.totalWastage || 0,
      },
      jobs: [...jobs.values()],
      util: [...rowMap.values()],
      machineOrder: [...first.entries()],
      customers: opts.customers,
      locations: opts.locations,
      productTypes: opts.productTypes,
    });

    put(key, { t: Date.now(), body });
    res.type("application/json").send(body);
  } catch (error) {
    console.error("Error fetching production summary:", error);
    res.status(500).json({ message: "Error fetching data" });
  }
});

// UPDATE Production Real and keep user locations
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const updated = await ProductionReal.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        userLocations: user.locations || [],  
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Record not found" });
    clearReportCache();

    res.json({ message: "Production updated successfully", updated });
  } catch (error) {
    console.error("Error updating Production:", error);
    res.status(500).json({ message: "Error updating production", error });
  }
});

// DELETE Production Real
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await ProductionReal.findByIdAndDelete(req.params.id);

    if (!deleted) return res.status(404).json({ message: "Record not found" });
    clearReportCache();

    res.json({ message: "Production deleted successfully" });
  } catch (error) {
    console.error("Error deleting Production:", error);
    res.status(500).json({ message: "Error deleting production", error });
  }
});

module.exports = router;


