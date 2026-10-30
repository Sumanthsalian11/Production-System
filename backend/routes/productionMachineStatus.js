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

    newRecord.durMins = minsOf(newRecord.fromTime, newRecord.toTime);
    newRecord.statusKey = String(newRecord.machineStatus || "").trim().toLowerCase();
    const saved = await newRecord.save();
    try { clearPersoCache(); } catch (e) { console.error("cache clear:", e); }

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
// BULK CREATE (main entry + slots, all or nothing)
// ==========================================
router.post("/bulk", async (req, res) => {
  const ids = [];
  try {
    const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (!entries.length) return res.status(400).json({ message: "No entries to save" });

    const docs = entries.map((b) => {
      const _id = new mongoose.Types.ObjectId();
      ids.push(_id);
      return {
        _id,
        productionDate: b.productionDate,
        shift: b.shift,
        activityId: b.activityId,
        machineId: b.machineId,
        machineStatus: b.machineStatus,
        customerName: b.customerName,
        materialType: b.materialType,
        fromTime: b.fromTime,
        toTime: b.toTime,
        remarks: b.remarks,
        enteredBy: b.enteredBy,
        woNumber: b.woNumber,
        totalPages: b.totalPages || 0,
        wastageSheets: b.wastageSheets || 0,
        wastePercentage: b.wastePercentage || 0,
        reason: b.reason,
        paperSize: b.paperSize || "",
        printerName: b.printerName || "",
        userLocations: b.userLocations || [],
        durMins: minsOf(b.fromTime, b.toTime),
        statusKey: String(b.machineStatus || "").trim().toLowerCase(),
      };
    });

    const saved = await ProductionMachineStatus.insertMany(docs);
    try { clearPersoCache(); } catch (e) { console.error("cache clear:", e); }
    res.status(201).json(saved);
  } catch (err) {
    console.error("Bulk create error:", err);
    // undo any rows that were inserted before the failure
    if (ids.length) await ProductionMachineStatus.deleteMany({ _id: { $in: ids } }).catch(() => {});
    const bad = err.name === "ValidationError" || err.name === "CastError";
    res.status(bad ? 400 : 500).json({ message: "Error creating records", error: err.message });
  }
});
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
// Summary Report: grouped in MongoDB, cached like the Perso report
const summaryKey = (q) => "S|" + JSON.stringify(Object.keys(q).sort().map((k) => [k, q[k]]));

const buildSummaryData = async (q) => {
  const query = await buildQuery(q);

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
          st: { $trim: { input: { $toString: { $ifNull: ["$machineStatus", ""] } } } },
          ps: { $trim: { input: { $toString: { $ifNull: ["$paperSize", ""] } } } },
          pages: { $ifNull: ["$totalPages", 0] },
          rm: { $trim: { input: { $toString: { $ifNull: ["$remarks", ""] } } } },
          mins: { $ifNull: ["$durMins", mins] },
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

  return {
    rows: out,
    statuses: [...statuses].map(([key, label]) => ({ key, label })),
    total,
  };
};

router.get("/summary", async (req, res) => {
  try {
    const q = req.query;
    res.json(await persoCached(summaryKey(q), isHeavy(q), () => buildSummaryData(q)));
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ message: "Error building summary", error: err.message });
  }
});
// ==========================================
// PERSO REPORT (grouped in MongoDB, only totals + first 50 job rows are sent)
// ==========================================
// ---------- cache: one-pass results, stale-while-revalidate for the heavy "no from-date" view ----------
const PERSO_FRESH = 60 * 1000;             // dated queries: recompute after 60s
const PERSO_HEAVY_STALE = 15 * 60 * 1000;  // all-data queries: answer instantly, refresh in background
const PERSO_MAX = 40;
const PERSO_DATED_STALE = 5 * 60 * 1000;   // dated queries: show the last result instantly, refresh behind it
const persoCache = new Map();
const persoInflight = new Map();

// no from-date and no month = scans everything
const isHeavy = (q) => !q.month && !q.dateFrom;
// "from cleared, to = today or later" is the same as all data, so it shares the pre-built cache entry
const normQ = (q) => {
  const n = { ...q };
  const today = new Date().toISOString().slice(0, 10);
  if (!n.dateFrom && !n.month && n.dateTo && n.dateTo >= today) delete n.dateTo;
  return n;
};
const persoKey = (q) =>
  "R|" + ["dateFrom", "dateTo", "month", "workOrder", "customer", "shift", "machineStatus", "machine", "location"]
    .map((k) => q[k] || "").join("|");

const persoRefresh = (key, compute) => {
  if (!persoInflight.has(key)) {
    const p = compute()
      .then((v) => {
        if (persoCache.size >= PERSO_MAX) persoCache.delete(persoCache.keys().next().value);
        persoCache.set(key, { t: Date.now(), v, dirty: false });
        return v;
      })
      .finally(() => persoInflight.delete(key));
    persoInflight.set(key, p);
  }
  return persoInflight.get(key);
};
const persoCached = async (key, heavy, compute) => {
  const hit = persoCache.get(key);
  const age = hit ? Date.now() - hit.t : Infinity;
  if (hit && !hit.dirty && age < PERSO_FRESH) return hit.v;
  if (hit && age < (heavy ? PERSO_HEAVY_STALE : PERSO_DATED_STALE)) {   // serve instantly, rebuild behind the scenes
    persoRefresh(key, compute).catch(console.error);
    return hit.v;
  }
  return persoRefresh(key, compute);
};

// writes mark entries stale (heavy ones are rebuilt in the background); also drops the /report/* cache
let warmTimer = null;
let summaryWarmTimer = null;
const clearPersoCache = () => {
  persoCache.forEach((e) => { e.dirty = true; });
  rCache.clear();
  clearTimeout(warmTimer);
  warmTimer = setTimeout(() => warmPerso(), 45000);
  warmTimer.unref?.();
  clearTimeout(summaryWarmTimer);
  summaryWarmTimer = setTimeout(() => {
    persoRefresh(summaryKey({}), () => buildSummaryData({})).catch(console.error);
  }, 2000);
  summaryWarmTimer.unref?.();
};

// ---------- helpers ----------
const DAY = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const hm = (s) => { const [h, m] = String(s || "").split(":"); return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0); };
const minsOf = (f, t) => { if (!f || !t) return 0; let d = hm(t) - hm(f); if (d <= 0) d += 1440; return d; };
const catOf = (s) => {
  const st = String(s || "").trim().toLowerCase();
  if (!st) return "__none";
  return st === "production" || st === "working" ? "__p" : st;
};
const detailKey = (r) => [
  DAY(r.productionDate), r.woNumber || "", r.shift || "", String(r.activityId || ""), String(r.machineId || ""),
  r.printerName || "", r.customerName || "", r.materialType || "", r.paperSize || "", r.enteredBy || "",
].join("||");
const DETAIL_FIELDS = {
  productionDate: 1, woNumber: 1, shift: 1, activityId: 1, machineId: 1, printerName: 1, customerName: 1,
  materialType: 1, paperSize: 1, enteredBy: 1, fromTime: 1, toTime: 1, reason: 1, remarks: 1,
  machineStatus: 1, totalPages: 1, wastageSheets: 1, createdAt: 1,
};

// folds records (newest first) into job rows; `only` limits it to a set of job keys
const groupJobs = (docs, only) => {
  const map = new Map();
  for (const r of docs) {
    const k = detailKey(r);
    if (only && !only.has(k)) continue;
    let g = map.get(k);
    if (!g) {
      g = {
        productionDate: r.productionDate, woNumber: r.woNumber || "", shift: r.shift || "",
        machineId: r.machineId, printerName: r.printerName || "", customerName: r.customerName || "",
        materialType: r.materialType || "", paperSize: r.paperSize || "", enteredBy: r.enteredBy || "",
        totalPages: 0, wastageSheets: 0, items: [],
      };
      map.set(k, g);
    }
    const pg = Number(r.totalPages) || 0, ws = Number(r.wastageSheets) || 0;
    if (pg > 0) g.totalPages += pg;
    if (ws > 0) g.wastageSheets += ws;
    g.items.push({ c: catOf(r.machineStatus), f: r.fromTime || "", t: r.toTime || "", m: minsOf(r.fromTime, r.toTime), re: r.reason || "", rm: r.remarks || "" });
  }
  return [...map.values()];
};

// newest 50 jobs WITHOUT scanning everything: walk the createdAt index and stop at 50 distinct jobs
const FULL_FETCH_MAX = 30000; // up to this many matches: one filtered query + in-memory sort

const topJobs = async (match, all, count) => {
  const sort = { createdAt: -1, _id: -1 };
  if (all) {
    const cur = ProductionMachineStatus.find(match).select(DETAIL_FIELDS).sort(sort).lean().cursor({ batchSize: 5000 });
    const docs = [];
    for await (const r of cur) docs.push(r);
    return groupJobs(docs);
  }

  // few matches (typical for WO / customer / machine filters): one indexed query, sort in memory
  if (count <= FULL_FETCH_MAX) {
    const docs = await ProductionMachineStatus.find(match).select(DETAIL_FIELDS).sort(sort).lean();
    return groupJobs(docs).slice(0, 50);
  }

  // many matches: walking the createdAt index finds 50 distinct jobs almost immediately
  const keys = new Map();
  const cur = ProductionMachineStatus.find(match).select(DETAIL_FIELDS).sort(sort).lean().cursor({ batchSize: 200 });
  try {
    for await (const r of cur) {
      const k = detailKey(r);
      if (!keys.has(k)) {
        keys.set(k, { wo: r.woNumber || "", day: DAY(r.productionDate) });
        if (keys.size >= 50) break;
      }
    }
  } finally { await cur.close().catch(() => {}); }
  if (!keys.size) return [];

  const vals = [...keys.values()];
  const wos = [...new Set(vals.map((x) => x.wo))];
  const days = vals.map((x) => x.day).filter(Boolean).sort();
  const noDate = vals.some((x) => !x.day);
  const range = days.length
    ? { productionDate: { $gte: new Date(`${days[0]}T00:00:00.000Z`), $lte: new Date(`${days[days.length - 1]}T23:59:59.999Z`) } }
    : null;
  const dateCond = range ? (noDate ? { $or: [range, { productionDate: null }] } : range) : { productionDate: null };
  const docs = await ProductionMachineStatus.find({ $and: [match, { woNumber: { $in: wos } }, dateCond] })
    .select(DETAIL_FIELDS).sort(sort).lean();
  return groupJobs(docs, new Set(keys.keys()));
};

const topJobsOld = async (match, all) => {
  const sort = { createdAt: -1, _id: -1 };
  if (all) {
    const cur = ProductionMachineStatus.find(match).select(DETAIL_FIELDS).sort(sort).lean().cursor({ batchSize: 5000 });
    const docs = [];
    for await (const r of cur) docs.push(r);
    return groupJobs(docs);
  }
  const keys = new Map();
  const cur = ProductionMachineStatus.find(match).select(DETAIL_FIELDS).sort(sort).lean().cursor({ batchSize: 200 });
  try {
    for await (const r of cur) {
      const k = detailKey(r);
      if (!keys.has(k)) {
        keys.set(k, { wo: r.woNumber || "", day: DAY(r.productionDate) });
        if (keys.size >= 50) break;
      }
    }
  } finally { await cur.close().catch(() => {}); }
  if (!keys.size) return [];

  // fetch every record of those 50 jobs (narrowed by WO number + day range)
  const vals = [...keys.values()];
  const wos = [...new Set(vals.map((x) => x.wo))];
  const days = vals.map((x) => x.day).filter(Boolean).sort();
  const noDate = vals.some((x) => !x.day);
  const range = days.length
    ? { productionDate: { $gte: new Date(`${days[0]}T00:00:00.000Z`), $lte: new Date(`${days[days.length - 1]}T23:59:59.999Z`) } }
    : null;
  const dateCond = range ? (noDate ? { $or: [range, { productionDate: null }] } : range) : { productionDate: null };
  const docs = await ProductionMachineStatus.find({ $and: [match, { woNumber: { $in: wos } }, dateCond] })
    .select(DETAIL_FIELDS).sort(sort).lean();
  return groupJobs(docs, new Set(keys.keys()));
};

// ONE pass, no $project stage; uses stored durMins / statusKey when present, falls back to computing them
const summaryRows = (match) =>
  ProductionMachineStatus.aggregate([
    { $match: match },
    { $group: {
        _id: {
          m: "$machineId",
          p: { $ifNull: ["$printerName", ""] },
          s: "$paperSize",
          st: { $ifNull: ["$statusKey", { $toLower: { $trim: { input: { $toString: { $ifNull: ["$machineStatus", ""] } } } } }] },
        },
        n: { $sum: 1 },
        pgRaw: { $sum: "$totalPages" },
        pg: { $sum: { $max: [0, "$totalPages"] } },
        wt: { $sum: { $max: [0, "$wastageSheets"] } },
        mins: { $sum: { $ifNull: ["$durMins", reportMins] } },
        last: { $max: { $ifNull: ["$createdAt", "$productionDate"] } },
        min: { $min: "$productionDate" },
        max: { $max: "$productionDate" },
    } },
  ]).allowDiskUse(true);

const buildPersoReport = async (q, all) => {
  const base = await buildQuery(q);
  // WO search: index-friendly prefix first; falls back to the original "contains" if nothing matches
  const withWO = (contains) =>
    !q.workOrder ? base : {
      ...base,
      woNumber: contains
        ? { $regex: escapeRegex(q.workOrder), $options: "i" }
        : { $regex: "^" + escapeRegex(q.workOrder) },
    };

  const macP = loadMachineMap();
  let match = withWO(false);
  let rows = await summaryRows(match);
  if (!rows.length && q.workOrder) { match = withWO(true); rows = await summaryRows(match); }
  const count = rows.reduce((s, r) => s + r.n, 0);
  const [jobs, macMap] = await Promise.all([topJobs(match, all, count), macP]);

  const nameOf = (id) => macMap.get(String(id)) || "Unknown";
  const cm = new Map(), paper = new Map();
  const totals = { pages: 0, waste: 0, printMins: 0, allMins: 0, statusMins: {} };
  let minD = null, maxD = null;

  for (const r of rows) {
    const raw = r._id.s == null ? "" : String(r._id.s);
    const psU = raw === "" ? "Unknown" : raw.toUpperCase();
    const psT = raw.trim().toUpperCase();

    const name = nameOf(r._id.m), p = r._id.p || "", k = `${name}||${p}`;
    let e = cm.get(k);
    if (!e) cm.set(k, (e = { machineName: name, printerName: p, counts: {}, printingMins: 0, statusMins: {}, last: 0 }));
    e.counts[psU] = (e.counts[psU] || 0) + r.pgRaw;
    e.last = Math.max(e.last, +r.last || 0);

    const c = catOf(r._id.st);
    if (c !== "__none") {
      if (c === "__p") { e.printingMins += r.mins; totals.printMins += r.mins; }
      else {
        e.statusMins[c] = (e.statusMins[c] || 0) + r.mins;
        totals.statusMins[c] = (totals.statusMins[c] || 0) + r.mins;
      }
      totals.allMins += r.mins;
    }
    if (psT) paper.set(psT, (paper.get(psT) || 0) + r.pgRaw);
    totals.pages += r.pg; totals.waste += r.wt;
    if (r.min && (!minD || r.min < minD)) minD = r.min;
    if (r.max && (!maxD || r.max > maxD)) maxD = r.max;
  }

  return {
    count, minDate: minD, maxDate: maxD,
    consolidated: [...cm.values()].sort((a, b) => b.last - a.last).map(({ last, ...x }) => x),
    paperSizeTotals: [...paper].map(([paperSize, totalCount]) => ({ paperSize, totalCount }))
      .sort((a, b) => a.paperSize.localeCompare(b.paperSize)),
    totals,
    detail: jobs.map((g) => ({ ...g, machineName: nameOf(g.machineId), machineId: undefined })),
  };
};

const buildPersoReportOld = async (q, all) => {
  const match = await buildQuery(q);

  const [rows, jobs, macMap] = await Promise.all([
    // ONE pass; the output is only a few hundred small groups
    ProductionMachineStatus.aggregate([
      { $match: match },
      { $project: {
          _id: 0, m: "$machineId", p: { $ifNull: ["$printerName", ""] },
          psU: { $toUpper: { $cond: [{ $eq: [{ $ifNull: ["$paperSize", ""] }, ""] }, "Unknown", { $ifNull: ["$paperSize", ""] }] } },
          psT: { $toUpper: { $trim: { input: { $ifNull: ["$paperSize", ""] } } } },
          st: { $toLower: { $trim: { input: { $ifNull: ["$machineStatus", ""] } } } },
          pgRaw: rNum("$totalPages"), wsRaw: rNum("$wastageSheets"), mins: reportMins,
          pd: "$productionDate", ca: { $ifNull: ["$createdAt", "$productionDate"] },
      } },
      { $group: {
          _id: { m: "$m", p: "$p", s: "$psU", t: "$psT", st: "$st" },
          n: { $sum: 1 }, pgRaw: { $sum: "$pgRaw" },
          pg: { $sum: { $max: [0, "$pgRaw"] } }, wt: { $sum: { $max: [0, "$wsRaw"] } },
          mins: { $sum: "$mins" }, last: { $max: "$ca" }, min: { $min: "$pd" }, max: { $max: "$pd" },
      } },
    ]).allowDiskUse(true),
    topJobs(match, all),
    loadMachineMap(),
  ]);

  const nameOf = (id) => macMap.get(String(id)) || "Unknown";
  const cm = new Map(), paper = new Map();
  const totals = { pages: 0, waste: 0, printMins: 0, allMins: 0, statusMins: {} };
  let count = 0, minD = null, maxD = null;

  for (const r of rows) {
    const name = nameOf(r._id.m), p = r._id.p || "", k = `${name}||${p}`;
    let e = cm.get(k);
    if (!e) cm.set(k, (e = { machineName: name, printerName: p, counts: {}, printingMins: 0, statusMins: {}, last: 0 }));
    e.counts[r._id.s] = (e.counts[r._id.s] || 0) + r.pgRaw;
    e.last = Math.max(e.last, +r.last || 0);

    const c = catOf(r._id.st);
    if (c !== "__none") {
      if (c === "__p") { e.printingMins += r.mins; totals.printMins += r.mins; }
      else {
        e.statusMins[c] = (e.statusMins[c] || 0) + r.mins;
        totals.statusMins[c] = (totals.statusMins[c] || 0) + r.mins;
      }
      totals.allMins += r.mins;
    }
    if (r._id.t) paper.set(r._id.t, (paper.get(r._id.t) || 0) + r.pgRaw);
    totals.pages += r.pg; totals.waste += r.wt; count += r.n;
    if (r.min && (!minD || r.min < minD)) minD = r.min;
    if (r.max && (!maxD || r.max > maxD)) maxD = r.max;
  }

  return {
    count, minDate: minD, maxDate: maxD,
    consolidated: [...cm.values()].sort((a, b) => b.last - a.last).map(({ last, ...x }) => x),
    paperSizeTotals: [...paper].map(([paperSize, totalCount]) => ({ paperSize, totalCount }))
      .sort((a, b) => a.paperSize.localeCompare(b.paperSize)),
    totals,
    detail: jobs.map((g) => ({ ...g, machineName: nameOf(g.machineId), machineId: undefined })),
  };
};

// dropdown options
const buildPersoOptions = async () => {
  const [customers, locations, machineIds, statuses] = await Promise.all([
    ProductionMachineStatus.distinct("customerName"),
    ProductionMachineStatus.distinct("userLocations"),
    ProductionMachineStatus.distinct("machineId"),
    ProductionMachineStatus.distinct("machineStatus"),
  ]);
  const macMap = await loadMachineMap();
  return {
    customers: customers.filter(Boolean).sort(),
    locations: locations.filter(Boolean),
    machines: [...new Set(machineIds.map((id) => macMap.get(String(id))).filter(Boolean))],
    statuses: statuses.filter(Boolean),
  };
};

router.get("/perso-options", async (req, res) => {
  try {
    res.json(await persoCached("OPTS", true, buildPersoOptions));
  } catch (err) {
    console.error("Perso options error:", err);
    res.status(500).json({ message: "Error fetching options", error: err.message });
  }
});

router.get("/perso-report", async (req, res) => {
  try {
    const q = normQ(req.query);
    if (req.query.all === "1") return res.json(await buildPersoReport(q, true)); // export: never cached
    res.json(await persoCached(persoKey(q), isHeavy(q), () => buildPersoReport(q, false)));
  } catch (err) {
    console.error("Perso report error:", err);
    res.status(500).json({ message: "Error fetching report", error: err.message });
  }
});

// pre-build the "all data" view + options so clearing the From date is instant
const warmPerso = () => {
  persoRefresh(persoKey({}), () => buildPersoReport({}, false)).catch(console.error);
  const d = (x) => x.toISOString().slice(0, 10);
  const to = new Date(), from = new Date();
  from.setDate(from.getDate() - 6);
  const weekQ = { dateFrom: d(from), dateTo: d(to) };          // same default the page opens with
  persoRefresh(persoKey(weekQ), () => buildPersoReport(weekQ, false)).catch(console.error);
  persoRefresh("OPTS", buildPersoOptions).catch(console.error);
  persoRefresh(summaryKey({}), () => buildSummaryData({})).catch(console.error);   // Summary Report, no filters
  persoRefresh(summaryKey(weekQ), () => buildSummaryData(weekQ)).catch(console.error);
};
setTimeout(warmPerso, 5000).unref?.();
setInterval(warmPerso, 10 * 60 * 1000).unref?.();
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
        durMins: minsOf(req.body.fromTime, req.body.toTime),
        statusKey: String(req.body.machineStatus || "").trim().toLowerCase(),
      },
      {
        returnDocument: "after",
      }
    );

    try { clearPersoCache(); } catch (e) { console.error("cache clear:", e); }
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
    try { clearPersoCache(); } catch (e) { console.error("cache clear:", e); }

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