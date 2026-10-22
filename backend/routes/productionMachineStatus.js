const express = require("express");
const router = express.Router();

const ProductionMachineStatus = require("../models/ProductionMachineStatus");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// same filters the page used on the client, now applied in MongoDB
const buildQuery = async (q) => {
  const query = {};
  if (q.dateFrom || q.dateTo) {
    query.productionDate = {};
    if (q.dateFrom) query.productionDate.$gte = new Date(`${q.dateFrom}T00:00:00.000Z`);
    if (q.dateTo) query.productionDate.$lte = new Date(`${q.dateTo}T23:59:59.999Z`);
  }
  if (q.month && /^\d{4}-\d{2}$/.test(q.month)) {
    const [y, m] = q.month.split("-").map(Number);
    query.$and = [
      { productionDate: { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) } },
    ];
  }
  if (q.workOrder) query.woNumber = { $regex: escapeRegex(q.workOrder), $options: "i" };
  if (q.customer) query.customerName = q.customer;
  if (q.shift) query.shift = q.shift;
  if (q.machineStatus) query.machineStatus = q.machineStatus;
  if (q.printer) query.printerName = q.printer;
  if (q.location) query.userLocations = q.location;
  if (q.machineId) query.machineId = new mongoose.Types.ObjectId(String(q.machineId));
  if (q.machine) {
    const ids = await mongoose.model("MachineMaster").find({ machineName: q.machine }).distinct("_id");
    query.machineId = { $in: ids };
  }
  return query;
};


// ==========================================
// CREATE
// ==========================================
router.post("/", async (req, res) => {
  try {
    const newRecord = new ProductionMachineStatus({
      productionDate: req.body.productionDate,
      shift: req.body.shift,
      activityId: req.body.activityId,
      machineId: req.body.machineId,
      machineStatus: req.body.machineStatus,
      customerName: req.body.customerName,
      materialType: req.body.materialType,
      fromTime: req.body.fromTime,
      toTime: req.body.toTime,
      remarks: req.body.remarks,
      enteredBy: req.body.enteredBy,
woNumber: req.body.woNumber,
totalPages: req.body.totalPages,
wastageSheets: req.body.wastageSheets,
wastePercentage: req.body.wastePercentage,
reason: req.body.reason,
paperSize:   req.body.paperSize   || "",
printerName: req.body.printerName || "",
   userLocations: req.body.userLocations || [],
    });

    const saved = await newRecord.save();
    clearPersoCache();

    res.status(201).json(saved);
  } catch (err) {
    console.error("Create error:", err);

    res.status(500).json({
      message: "Error creating record",
      error: err.message,
    });
  }
});


// ==========================================
// GET ALL
// ==========================================
router.get("/", async (req, res) => {
  try {
    const q = req.query;
    const query = await buildQuery(q);
    const limit = parseInt(q.limit, 10);
    const pageNo = Math.max(parseInt(q.page, 10) || 1, 1);

    let cursor = ProductionMachineStatus.find(query)
      .populate("activityId", "activityName")
      .populate("machineId", "machineName")
      .sort({ createdAt: -1, _id: -1 });
    if (limit > 0) {
      const size = Math.min(limit, 1000);
      cursor = cursor.skip((pageNo - 1) * size).limit(size);
    }

    if (q.withCount) {
      const [data, total] = await Promise.all([
        cursor.lean(),
        Object.keys(query).length
          ? ProductionMachineStatus.countDocuments(query)
          : ProductionMachineStatus.estimatedDocumentCount(),
      ]);
      return res.json({ data, total });
    }

    res.json(await cursor.lean());
  } catch (err) {
    console.error("Fetch error:", err);

    res.status(500).json({
      message: "Error fetching records",
      error: err.message,
    });
  }
});

// dropdown options for the filter bar
router.get("/filter-options", async (req, res) => {
  try {
    const [customers, locations, printers, machineIds] = await Promise.all([
      ProductionMachineStatus.distinct("customerName"),
      ProductionMachineStatus.distinct("userLocations"),
      ProductionMachineStatus.distinct("printerName"),
      ProductionMachineStatus.distinct("machineId"),
    ]);
    const macDocs = await mongoose
      .model("MachineMaster")
      .find({ _id: { $in: machineIds } })
      .select("machineName")
      .lean();
    res.json({
      customers: customers.filter(Boolean),
      locations: locations.filter(Boolean),
      printers: printers.filter(Boolean),
      machines: [...new Set(macDocs.map((m) => m.machineName).filter(Boolean))],
    });
  } catch (err) {
    console.error("Filter options error:", err);
    res.status(500).json({ message: "Error fetching options", error: err.message });
  }
});

// Summary Report: grouped in MongoDB, only totals are sent
router.get("/summary", async (req, res) => {
  try {
    const query = await buildQuery(req.query);

    const part = (f, i) => ({
      $convert: {
        input: { $arrayElemAt: [{ $split: [{ $ifNull: [f, ""] }, ":"] }, i] },
        to: "int", onError: 0, onNull: 0,
      },
    });
    const toMin = (f) => ({ $add: [{ $multiply: [part(f, 0), 60] }, part(f, 1)] });
    const mins = {
      $cond: [
        { $or: [{ $eq: [{ $ifNull: ["$fromTime", ""] }, ""] }, { $eq: [{ $ifNull: ["$toTime", ""] }, ""] }] },
        0,
        {
          $let: {
            vars: { f: toMin("$fromTime"), t: toMin("$toTime") },
            in: {
              $cond: [
                { $lte: ["$$t", "$$f"] },
                { $subtract: [{ $add: ["$$t", 1440] }, "$$f"] },
                { $subtract: ["$$t", "$$f"] },
              ],
            },
          },
        },
      ],
    };

    const [rows, actDocs, macDocs] = await Promise.all([
      ProductionMachineStatus.aggregate([
        { $match: query },
        {
          $project: {
            a: "$activityId",
            m: "$machineId",
            p: { $ifNull: ["$printerName", ""] },
            s: { $ifNull: ["$shift", ""] },
            st: { $trim: { input: { $ifNull: ["$machineStatus", ""] } } },
            ps: { $trim: { input: { $ifNull: ["$paperSize", ""] } } },
            pages: { $ifNull: ["$totalPages", 0] },
            rm: { $trim: { input: { $ifNull: ["$remarks", ""] } } },
            mins,
          },
        },
        {
          $group: {
            _id: { a: "$a", m: "$m", p: "$p", s: "$s", st: { $toLower: "$st" }, ps: "$ps" },
            label: { $first: "$st" },
            pages: { $sum: "$pages" },
            mins: { $sum: "$mins" },
            n: { $sum: 1 },
            rm: { $addToSet: "$rm" },
          },
        },
      ]).allowDiskUse(true),
      mongoose.model("ActivityMaster").find({}, "activityName").lean(),
      mongoose.model("MachineMaster").find({}, "machineName").lean(),
    ]);

    const actMap = new Map(actDocs.map((a) => [String(a._id), a.activityName]));
    const macMap = new Map(macDocs.map((m) => [String(m._id), m.machineName]));
    const statuses = new Map();
    let total = 0;

    const out = rows.map((r) => {
      total += r.n;
      if (r._id.st && !statuses.has(r._id.st)) statuses.set(r._id.st, r.label || r._id.st);
      return {
        activityName: actMap.get(String(r._id.a)) || "-",
        machineName: macMap.get(String(r._id.m)) || "-",
        printerName: r._id.p,
        shift: r._id.s,
        machineStatus: r.label,
        paperSize: r._id.ps,
        totalPages: r.pages,
        mins: r.mins,
        remarks: (r.rm || []).filter(Boolean),
      };
    });

    res.json({
      rows: out,
      statuses: [...statuses].map(([key, label]) => ({ key, label })),
      total,
    });
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ message: "Error building summary", error: err.message });
  }
});

// ==========================================
// PERSO REPORT (grouped in MongoDB, only totals + first 50 job rows are sent)
// ==========================================
const PERSO_TTL = 60 * 1000, PERSO_MAX = 24, persoCache = new Map();
const persoGet = (k) => { const h = persoCache.get(k); return h && Date.now() - h.t < PERSO_TTL ? h.v : null; };
const persoPut = (k, v) => {
  if (persoCache.size >= PERSO_MAX) persoCache.delete(persoCache.keys().next().value);
  persoCache.set(k, { t: Date.now(), v });
};
const clearPersoCache = () => { persoCache.clear(); rCache.clear(); }; // also drops the report-page cache

// slim every record down to what the report needs
const persoPrep = (match) => [
  { $match: match },
  { $project: {
      _id: 0,
      d: { $dateToString: { format: "%Y-%m-%d", date: "$productionDate" } },
      pd: "$productionDate",
      ca: { $ifNull: ["$createdAt", "$productionDate"] },
      wo: { $ifNull: ["$woNumber", ""] }, sh: { $ifNull: ["$shift", ""] },
      a: "$activityId", m: "$machineId",
      p: { $ifNull: ["$printerName", ""] }, c: { $ifNull: ["$customerName", ""] },
      mt: { $ifNull: ["$materialType", ""] }, ps: { $ifNull: ["$paperSize", ""] },
      psT: { $trim: { input: { $ifNull: ["$paperSize", ""] } } },
      eb: { $ifNull: ["$enteredBy", ""] },
      f: { $ifNull: ["$fromTime", ""] }, t: { $ifNull: ["$toTime", ""] },
      re: { $ifNull: ["$reason", ""] }, rm: { $ifNull: ["$remarks", ""] },
      pgRaw: rNum("$totalPages"), wsRaw: rNum("$wastageSheets"),
      st: { $toLower: { $trim: { input: { $ifNull: ["$machineStatus", ""] } } } },
      mins: reportMins,
  } },
  { $addFields: {
      pg: { $max: [0, "$pgRaw"] },
      wt: { $max: [0, "$wsRaw"] },
      cat: { $switch: {
          branches: [
            { case: { $in: ["$st", ["production", "working"]] }, then: "__p" },
            { case: { $eq: ["$st", ""] }, then: "__none" },
          ],
          default: "$st",
      } },
  } },
];

// dropdown options (small, cached)
router.get("/perso-options", async (req, res) => {
  try {
    const hit = persoGet("OPTS");
    if (hit) return res.json(hit);
    const [customers, locations, machineIds, statuses] = await Promise.all([
      ProductionMachineStatus.distinct("customerName"),
      ProductionMachineStatus.distinct("userLocations"),
      ProductionMachineStatus.distinct("machineId"),
      ProductionMachineStatus.distinct("machineStatus"),
    ]);
    const macMap = await loadMachineMap();
    const out = {
      customers: customers.filter(Boolean).sort(),
      locations: locations.filter(Boolean),
      machines: [...new Set(machineIds.map((id) => macMap.get(String(id))).filter(Boolean))],
      statuses: statuses.filter(Boolean),
    };
    persoPut("OPTS", out);
    res.json(out);
  } catch (err) {
    console.error("Perso options error:", err);
    res.status(500).json({ message: "Error fetching options", error: err.message });
  }
});

router.get("/perso-report", async (req, res) => {
  try {
    const q = req.query;
    const all = q.all === "1"; // export: every detail row
    const key = "R|" + ["dateFrom", "dateTo", "month", "workOrder", "customer", "shift", "machineStatus", "machine", "location"]
      .map((k) => q[k] || "").join("|");
    if (!all) { const hit = persoGet(key); if (hit) return res.json(hit); }

    const match = await buildQuery(q);
    const detailLimit = all ? 0 : 50;

    const [facetRes, detailRaw, macMap] = await Promise.all([
      ProductionMachineStatus.aggregate([
        ...persoPrep(match),
        { $facet: {
            sizes: [{ $group: {
              _id: { m: "$m", p: "$p", s: { $toUpper: { $cond: [{ $eq: ["$ps", ""] }, "Unknown", "$ps"] } } },
              pg: { $sum: "$pgRaw" }, last: { $max: "$ca" },
            } }],
            times: [{ $group: { _id: { m: "$m", p: "$p", c: "$cat" }, mins: { $sum: "$mins" } } }],
            paper: [{ $match: { psT: { $ne: "" } } }, { $group: { _id: { $toUpper: "$psT" }, n: { $sum: "$pgRaw" } } }],
            cats: [{ $group: { _id: "$cat", mins: { $sum: "$mins" } } }],
            sums: [{ $group: { _id: null, n: { $sum: 1 }, pages: { $sum: "$pg" }, waste: { $sum: "$wt" }, min: { $min: "$pd" }, max: { $max: "$pd" } } }],
        } },
      ]).allowDiskUse(true),

      // one row per job (same grouping key the page used), newest first
      ProductionMachineStatus.aggregate([
        ...persoPrep(match),
        { $sort: { ca: -1 } },
        { $group: {
            _id: { d: "$d", wo: "$wo", sh: "$sh", a: "$a", m: "$m", p: "$p", c: "$c", mt: "$mt", ps: "$ps", eb: "$eb" },
            pd: { $first: "$pd" }, ca: { $first: "$ca" },
            pages: { $sum: "$pg" }, waste: { $sum: "$wt" },
            items: { $push: { c: "$cat", f: "$f", t: "$t", m: "$mins", re: "$re", rm: "$rm" } },
        } },
        { $sort: { ca: -1 } },
        ...(detailLimit ? [{ $limit: detailLimit }] : []),
      ]).allowDiskUse(true),

      loadMachineMap(),
    ]);

    const nameOf = (id) => macMap.get(String(id)) || "Unknown";
    const f = facetRes[0] || {};

    // consolidated (machine x printer)
    const cm = new Map();
    for (const r of f.sizes || []) {
      const name = nameOf(r._id.m), p = r._id.p || "", k = `${name}||${p}`;
      let e = cm.get(k);
      if (!e) cm.set(k, (e = { machineName: name, printerName: p, counts: {}, printingMins: 0, statusMins: {}, last: 0 }));
      e.counts[r._id.s] = (e.counts[r._id.s] || 0) + r.pg;
      e.last = Math.max(e.last, +r.last || 0);
    }
    for (const r of f.times || []) {
      const e = cm.get(`${nameOf(r._id.m)}||${r._id.p || ""}`);
      if (!e || r._id.c === "__none") continue;
      if (r._id.c === "__p") e.printingMins += r.mins;
      else e.statusMins[r._id.c] = (e.statusMins[r._id.c] || 0) + r.mins;
    }
    const consolidated = [...cm.values()].sort((a, b) => b.last - a.last).map(({ last, ...x }) => x);

    const totals = { pages: 0, waste: 0, printMins: 0, allMins: 0, statusMins: {} };
    for (const c of f.cats || []) {
      if (c._id === "__none") continue;
      totals.allMins += c.mins;
      if (c._id === "__p") totals.printMins = c.mins; else totals.statusMins[c._id] = c.mins;
    }
    const s0 = (f.sums || [])[0] || {};
    totals.pages = s0.pages || 0;
    totals.waste = s0.waste || 0;

    const out = {
      count: s0.n || 0, minDate: s0.min || null, maxDate: s0.max || null,
      consolidated,
      paperSizeTotals: (f.paper || []).map((r) => ({ paperSize: r._id, totalCount: r.n }))
        .sort((a, b) => a.paperSize.localeCompare(b.paperSize)),
      totals,
      detail: detailRaw.map((g) => ({
        productionDate: g.pd, woNumber: g._id.wo, shift: g._id.sh, machineName: nameOf(g._id.m),
        printerName: g._id.p, customerName: g._id.c, materialType: g._id.mt, paperSize: g._id.ps,
        enteredBy: g._id.eb, totalPages: g.pages, wastageSheets: g.waste, items: g.items,
      })),
    };
    if (!all) persoPut(key, out);
    res.json(out);
  } catch (err) {
    console.error("Perso report error:", err);
    res.status(500).json({ message: "Error fetching report", error: err.message });
  }
});

// latest entry per activity + machine + printer (for the Last Used PDF / Excel)
router.get("/last-used", async (req, res) => {
  try {
    const match = {};
    if (req.query.location) match.userLocations = req.query.location;

    const rows = await ProductionMachineStatus.aggregate([
      { $match: match },
      { $sort: { productionDate: -1, createdAt: -1 } },
      {
        $group: {
          _id: { a: "$activityId", m: "$machineId", p: { $ifNull: ["$printerName", ""] } },
          productionDate: { $first: "$productionDate" },
          createdAt: { $first: "$createdAt" },
          woNumber: { $first: "$woNumber" },
          customerName: { $first: "$customerName" },
          shift: { $first: "$shift" },
          enteredBy: { $first: "$enteredBy" },
          userLocations: { $first: "$userLocations" },
        },
      },
      {
        $project: {
          _id: 0,
          activityId: "$_id.a",
          machineId: "$_id.m",
          printerName: "$_id.p",
          productionDate: 1, createdAt: 1, woNumber: 1, customerName: 1,
          shift: 1, enteredBy: 1, userLocations: 1,
        },
      },
    ]).allowDiskUse(true);

    res.json(rows);
  } catch (err) {
    console.error("Last used error:", err);
    res.status(500).json({ message: "Error fetching last used", error: err.message });
  }
});


// ==========================================
// UPDATE
// ==========================================
router.put("/:id", async (req, res) => {
  try {
    const updated = await ProductionMachineStatus.findByIdAndUpdate(
      req.params.id,
      {
        productionDate: req.body.productionDate,
        shift: req.body.shift,
        activityId: req.body.activityId,
        machineId: req.body.machineId,
        machineStatus: req.body.machineStatus,
        customerName: req.body.customerName,
        materialType: req.body.materialType,
        fromTime: req.body.fromTime,
        toTime: req.body.toTime,
        remarks: req.body.remarks,
        woNumber: req.body.woNumber,
totalPages: req.body.totalPages,
wastageSheets: req.body.wastageSheets,
wastePercentage: req.body.wastePercentage,
reason: req.body.reason,
paperSize:   req.body.paperSize   || "",
printerName: req.body.printerName || "",
        enteredBy: req.body.enteredBy,
userLocations: req.body.userLocations || [],
       
      },
      {
        new: true,
      }
    );

    clearPersoCache();
    res.json(updated);
  } catch (err) {
    console.error("Update error:", err);

    res.status(500).json({
      message: "Error updating record",
      error: err.message,
    });
  }
});


// ==========================================
// DELETE
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    await ProductionMachineStatus.findByIdAndDelete(req.params.id);
    clearPersoCache();

    res.json({
      message: "Deleted successfully",
    });
  } catch (err) {
    console.error("Delete error:", err);

    res.status(500).json({
      message: "Error deleting record",
      error: err.message,
    });
  }
});

// ==========================================
// EXCEL EXPORT (streamed, handles lakhs of rows)
// ==========================================
router.get("/export", async (req, res) => {
  try {
    const query = await buildQuery(req.query);

    const [actDocs, macDocs] = await Promise.all([
      mongoose.model("ActivityMaster").find({}, "activityName").lean(),
      mongoose.model("MachineMaster").find({}, "machineName").lean(),
    ]);
    const actMap = new Map(actDocs.map((a) => [String(a._id), a.activityName]));
    const macMap = new Map(macDocs.map((m) => [String(m._id), m.machineName]));

    const fmtDate = (d) =>
      d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "UTC" }) : "";
    const fmtTime = (t) => {
      if (!t) return "";
      const [h, m] = String(t).split(":");
      let hr = Number(h);
      const ap = hr >= 12 ? "PM" : "AM";
      hr = hr % 12 || 12;
      return `${hr}:${m} ${ap}`;
    };
    const totalTime = (from, to) => {
      if (!from || !to) return "";
      const [fh, fm] = from.split(":").map(Number);
      const [th, tm] = to.split(":").map(Number);
      let mins = th * 60 + tm - (fh * 60 + fm);
      if (mins <= 0) mins += 24 * 60;
      return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
    };

    const stamp = new Date().toISOString().split("T")[0];
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Production_Records_${stamp}.xlsx"`
    );

    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const ws = wb.addWorksheet("Production Records");
    ws.columns = [
      { header: "Sl No", key: "sl", width: 8 },
      { header: "Date", key: "date", width: 12 },
      { header: "WO Number", key: "wo", width: 14 },
      { header: "Shift", key: "shift", width: 8 },
      { header: "Printer", key: "printer", width: 14 },
      { header: "Activity", key: "activity", width: 18 },
      { header: "Machine", key: "machine", width: 20 },
      { header: "Status", key: "status", width: 14 },
      { header: "Customer", key: "customer", width: 26 },
      { header: "Item", key: "item", width: 20 },
      { header: "From Time", key: "from", width: 11 },
      { header: "To Time", key: "to", width: 11 },
      { header: "Total Time", key: "total", width: 11 },
      { header: "Total Pages", key: "pages", width: 12 },
      { header: "Wastage Sheets", key: "waste", width: 14 },
      { header: "Waste %", key: "wp", width: 9 },
      { header: "Reason", key: "reason", width: 22 },
      { header: "Paper Size", key: "size", width: 11 },
      { header: "User", key: "user", width: 18 },
      { header: "Remarks", key: "remarks", width: 24 },
    ];

    const cursor = ProductionMachineStatus.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .lean()
      .cursor({ batchSize: 2000 });

    let i = 0;
    for await (const item of cursor) {
      i++;
      ws.addRow({
        sl: i,
        date: fmtDate(item.productionDate),
        wo: item.woNumber || "",
        shift: item.shift || "",
        printer: item.printerName || "",
        activity: actMap.get(String(item.activityId)) || "",
        machine: macMap.get(String(item.machineId)) || "",
        status: item.machineStatus || "",
        customer: item.customerName || "",
        item: item.materialType || "",
        from: fmtTime(item.fromTime),
        to: fmtTime(item.toTime),
        total: totalTime(item.fromTime, item.toTime),
        pages: item.totalPages || "",
        waste: item.wastageSheets || "",
        wp: item.wastePercentage || "",
        reason: item.reason || "",
        size: item.paperSize || "",
        user: item.enteredBy || "",
        remarks: item.remarks || "",
      }).commit();
    }

    ws.commit();
    await wb.commit();
  } catch (err) {
    console.error("Export error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error exporting records", error: err.message });
    } else {
      res.destroy(err);
    }
  }
});

// ==========================================
// REPORT PAGE  (grouped + paginated in MongoDB)
// ==========================================
const rNum = (f) => ({ $convert: { input: f, to: "double", onError: 0, onNull: 0 } });
const rPart = (f, i) => ({
  $convert: {
    input: { $arrayElemAt: [{ $split: [{ $ifNull: [f, ""] }, ":"] }, i] },
    to: "int", onError: 0, onNull: 0,
  },
});
const rToMin = (f) => ({ $add: [{ $multiply: [rPart(f, 0), 60] }, rPart(f, 1)] });
const reportMins = {
  $cond: [
    { $or: [{ $eq: [{ $ifNull: ["$fromTime", ""] }, ""] }, { $eq: [{ $ifNull: ["$toTime", ""] }, ""] }] },
    0,
    {
      $let: {
        vars: { f: rToMin("$fromTime"), t: rToMin("$toTime") },
        in: {
          $cond: [
            { $lte: ["$$t", "$$f"] },
            { $subtract: [{ $add: ["$$t", 1440] }, "$$f"] },
            { $subtract: ["$$t", "$$f"] },
          ],
        },
      },
    },
  ],
};

// machine names (tiny collection) cached for 5 minutes
let machineMapCache = { t: 0, v: null };
const loadMachineMap = async () => {
  if (machineMapCache.v && Date.now() - machineMapCache.t < 300000) return machineMapCache.v;
  const v = new Map(
    (await mongoose.model("MachineMaster").find({}, "machineName").lean()).map((m) => [String(m._id), m.machineName])
  );
  machineMapCache = { t: Date.now(), v };
  return v;
};

// short result cache: same filters within 30s are answered instantly
const R_TTL = 30000;
const rCache = new Map();
const rGet = (k) => {
  const h = rCache.get(k);
  return h && Date.now() - h.t < R_TTL ? h.v : null;
};
const rSet = (k, v) => {
  if (rCache.size > 200) rCache.clear();
  rCache.set(k, { t: Date.now(), v });
};

// runs the pipeline on the covering index ("report_cover") when no filter outside that index is used
const runAgg = async (pipeline, q) => {
  const hinted = !q.workOrder && !q.location && !q.shift;
  try {
    const a = ProductionMachineStatus.aggregate(pipeline).allowDiskUse(true);
    return await (hinted ? a.hint("report_cover") : a);
  } catch (e) {
    // index not built yet -> run without the hint
    if (hinted && /hint|index/i.test(String(e.message))) {
      return ProductionMachineStatus.aggregate(pipeline).allowDiskUse(true);
    }
    throw e;
  }
};

// KPI cards + Machine Production table + machine column list
router.get("/report/summary", async (req, res) => {
  try {
    const ck = req.originalUrl;
    const hit = rGet(ck);
    if (hit) return res.json(hit);

    const query = await buildQuery(req.query);
    const isProd = { $eq: ["$machineStatus", "PRODUCTION"] };

    const [grp, orders, macMap] = await Promise.all([
      // ONE pass over the data gives KPIs, machine table and machine order
      runAgg([
        { $match: query },
        {
          $group: {
            _id: { m: "$machineId", p: { $ifNull: ["$printerName", ""] }, pr: isProd },
            n: { $sum: 1 },
            pages: { $sum: rNum("$totalPages") },
            waste: { $sum: rNum("$wastageSheets") },
            last: { $max: "$createdAt" },
          },
        },
      ], req.query),
      runAgg([
        { $match: { $and: [query, { machineStatus: "PRODUCTION" }, { woNumber: { $nin: [null, ""] } }] } },
        { $group: { _id: "$woNumber" } },
        { $count: "n" },
      ], req.query),
      loadMachineMap(),
    ]);

    let totalRecords = 0, totalProduction = 0, totalWastage = 0;
    const machineProduction = [];
    const lastByMachine = new Map();

    grp.forEach((g) => {
      totalRecords += g.n;
      const mk = String(g._id.m);
      const prev = lastByMachine.get(mk);
      if (!prev || g.last > prev) lastByMachine.set(mk, g.last);
      if (g._id.pr) {
        totalProduction += g.pages;
        totalWastage += g.waste;
        const name = macMap.get(mk);
        if (name && (g.pages > 0 || g.waste > 0)) {
          machineProduction.push({ machine: name, printer: g._id.p, production: g.pages, wastage: g.waste });
        }
      }
    });

    const usedMachineNames = [
      ...new Set(
        [...lastByMachine.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => macMap.get(id))
          .filter(Boolean)
      ),
    ];

    const payload = {
      totalRecords, totalProduction, totalWastage,
      totalOrders: orders[0]?.n || 0,
      usedMachineNames,
      machineProduction,
    };
    rSet(ck, payload);
    res.json(payload);
  } catch (err) {
    console.error("Report summary error:", err);
    res.status(500).json({ message: "Error building report summary", error: err.message });
  }
});

// Jobwise Machine Production / Jobwise Wastage / Work Order Production (one row per WO, paginated)
router.get("/report/jobs", async (req, res) => {
  try {
    const q = req.query;
    const ck = req.originalUrl;
    const hit = rGet(ck);
    if (hit) return res.json(hit);

    const query = await buildQuery(q);
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), 500);
    const page = Math.max(parseInt(q.page, 10) || 1, 1);
    const all = q.all === "1";

    const base = [
      {
        $match: {
          $and: [query, { machineStatus: "PRODUCTION" }, { woNumber: { $nin: [null, ""] } }, { machineId: { $ne: null } }],
        },
      },
      {
        $group: {
          _id: { w: "$woNumber", m: "$machineId" },
          customer: { $first: "$customerName" },
          p: { $sum: rNum("$totalPages") },
          ws: { $sum: rNum("$wastageSheets") },
        },
      },
      {
        $group: {
          _id: "$_id.w",
          customer: { $first: "$customer" },
          ms: { $push: { m: "$_id.m", p: "$p", w: "$ws" } },
          production: { $sum: "$p" },
          wastageTotal: { $sum: "$ws" },
        },
      },
      { $addFields: { n: rNum("$_id") } },
      { $sort: { n: -1, _id: -1 } },
    ];

    const [agg, macMap] = await Promise.all([
      runAgg(
        all
          ? base
          : [...base, { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: "n" }] } }],
        q
      ),
      loadMachineMap(),
    ]);

    const rawRows = all ? agg : agg[0]?.rows || [];
    const total = all ? agg.length : agg[0]?.total?.[0]?.n || 0;

    const rows = rawRows.map((r) => {
      const machines = {}, wastage = {};
      r.ms.forEach((x) => {
        const nm = macMap.get(String(x.m));
        if (!nm) return;
        machines[nm] = (machines[nm] || 0) + x.p;
        wastage[nm] = (wastage[nm] || 0) + x.w;
      });
      return {
        workOrder: r._id, customer: r.customer,
        machines, wastage, production: r.production, wastageTotal: r.wastageTotal,
      };
    });

    const payload = { rows, total };
    if (!all) rSet(ck, payload);
    res.json(payload);
  } catch (err) {
    console.error("Report jobs error:", err);
    res.status(500).json({ message: "Error building job report", error: err.message });
  }
});

// Machine Utilization (date-wise, paginated)
router.get("/report/utilization", async (req, res) => {
  try {
    const q = req.query;
    const ck = req.originalUrl;
    const hit = rGet(ck);
    if (hit) return res.json(hit);

    const query = await buildQuery(q);
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), 500);
    const page = Math.max(parseInt(q.page, 10) || 1, 1);
    const all = q.all === "1";

    const base = [
      {
        $match: {
          $and: [
            query,
            { machineId: { $ne: null } },
            { productionDate: { $gte: new Date("2000-01-01T00:00:00Z"), $lt: new Date("2100-01-01T00:00:00Z") } },
          ],
        },
      },
      {
        $group: {
          _id: {
            m: "$machineId",
            p: { $ifNull: ["$printerName", ""] },
            d: { $dateToString: { format: "%Y-%m-%d", date: "$productionDate" } },
            s: "$machineStatus",
          },
          mins: { $sum: reportMins },
        },
      },
      {
        $group: {
          _id: { m: "$_id.m", p: "$_id.p", d: "$_id.d" },
          st: { $push: { k: "$_id.s", v: "$mins" } },
        },
      },
      { $sort: { "_id.d": -1, "_id.m": 1, "_id.p": 1 } },
    ];

    const [agg, macMap] = await Promise.all([
      runAgg(
        all
          ? base
          : [...base, { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: "n" }] } }],
        q
      ),
      loadMachineMap(),
    ]);

    const rawRows = all ? agg : agg[0]?.rows || [];
    const total = all ? agg.length : agg[0]?.total?.[0]?.n || 0;

    const rows = rawRows.map((r) => {
      const status = {};
      r.st.forEach((x) => { if (x.k) status[x.k] = (status[x.k] || 0) + x.v; });
      return { date: r._id.d, machine: macMap.get(String(r._id.m)) || "-", printer: r._id.p, status };
    });

    const payload = { rows, total };
    if (!all) rSet(ck, payload);
    res.json(payload);
  } catch (err) {
    console.error("Report utilization error:", err);
    res.status(500).json({ message: "Error building utilization report", error: err.message });
  }
});

module.exports = router;