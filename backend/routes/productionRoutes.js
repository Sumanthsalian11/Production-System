const express = require("express");
const router = express.Router();
const Production = require("../models/Production");
const WorkOrder = require("../models/WorkOrder");   // ✅ ADDED
const authMiddleware = require("../middleware/authMiddleware");
const {
  getWorkOrder,
  saveProduction,
  getLastReelData,
  getReelsByWorkOrder
} = require("../controllers/productionController");

/* ----------------------------------------------------------------------------
   SUMMARY REPORT - grouping runs inside MongoDB, so only small grouped results
   travel to the page (works for millions of records).
   ---------------------------------------------------------------------------- */

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Number(x || 0) equivalent
const num = (input) => ({ $convert: { input, to: "double", onError: 0, onNull: 0 } });

// same as the page's normalizeGroup()
const normalizeGroup = (name) => {
  if (!name) return "";
  name = String(name).trim();
  if (name.startsWith("Non Surface Sized")) return "Non Surface Sized Maplit";
  if (name === "Parachment Paper") return "Parchment Paper";
  return name;
};

const isDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  return !isNaN(new Date(`${s}T00:00:00.000Z`).getTime());
};

// ---- filters (same rules as the page's Apply) ----
const buildMatch = (raw) => {
  const q = {};
  ["wo", "from", "to", "group", "mill", "gsm", "type", "location", "customer"].forEach(
    (k) => { q[k] = typeof raw[k] === "string" ? raw[k] : ""; }
  );

  const and = [];

  if (q.wo) {
    and.push(
      /^\d+$/.test(q.wo) && String(Number(q.wo)) === q.wo
        ? { efiWoNumber: Number(q.wo) }
        : { _id: { $in: [] } } // nothing can match
    );
  }

  if (isDate(q.from)) {
    and.push({ productionDate: { $gte: new Date(`${q.from}T00:00:00.000Z`) } });
  }
  if (isDate(q.to)) {
    const end = new Date(`${q.to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    and.push({ productionDate: { $lt: end } });
  }

  if (q.mill) and.push({ mill: { $regex: `^\\s*${esc(q.mill)}\\s*$` } });

  if (q.gsm) {
    const g = [{ "materials.gsm": q.gsm }];
    if (!isNaN(Number(q.gsm))) g.push({ "materials.gsm": Number(q.gsm) });
    and.push({ $or: g });
  }

  if (q.group) {
    let cond;
    if (q.group === "Non Surface Sized Maplit") {
      cond = { $regex: "^\\s*Non Surface Sized" };
    } else if (q.group === "Parchment Paper") {
      cond = { $regex: "^\\s*(Parchment Paper|Parachment Paper)\\s*$" };
    } else {
      cond = { $regex: `^\\s*${esc(q.group)}\\s*$` };
    }
    and.push({ "materials.materialGroupDescription": cond });
  }

  if (q.type) and.push({ productionType: q.type });
  if (q.location) and.push({ userLocations: q.location });
  if (q.customer) and.push({ customerName: q.customer });

  return and.length ? { $and: and } : {};
};

// ---- group keys (same fallbacks as the page) ----
const customerKey = {
  $cond: [
    { $gt: [{ $strLenCP: { $ifNull: ["$customerName", ""] } }, 0] },
    "$customerName",
    "Unknown",
  ],
};

const millKey = {
  $let: {
    vars: {
      m: {
        $cond: [
          { $eq: [{ $type: "$mill" }, "string"] },
          { $trim: { input: "$mill" } },
          "",
        ],
      },
    },
    in: { $cond: [{ $gt: [{ $strLenCP: "$$m" }, 0] }, "$$m", "Unknown"] },
  },
};

const woKey = {
  $cond: [{ $gt: [{ $ifNull: ["$efiWoNumber", 0] }, 0] }, "$efiWoNumber", "Unknown"],
};

// ups: array -> first value > 0, otherwise the plain number
const upsExpr = {
  $cond: [
    { $isArray: "$ups" },
    num({
      $arrayElemAt: [
        { $filter: { input: "$ups", as: "u", cond: { $gt: [num("$$u"), 0] } } },
        0,
      ],
    }),
    num("$ups"),
  ],
};

const AGG_OPTS = { allowDiskUse: true, maxTimeMS: 120000 };

// GET /api/production/summary
const getSummaryReport = async (req, res) => {
  try {
    const match = buildMatch(req.query);

    // no filter selected -> only the latest 20 records (same as the page's default view)
    // filter selected    -> ALL matching records
    const hasFilter = Object.keys(match).length > 0;
    const scope = hasFilter
      ? [{ $match: match }]
      : [{ $sort: { productionDate: -1, createdAt: -1 } }, { $limit: 20 }];

    const [customers, mills, workOrders, totalCount] = await Promise.all([
      Production.aggregate([
        ...scope,
        {
          $group: {
            _id: customerKey,
            weight: { $sum: num("$actualNetWeight") },
            waste: { $sum: num("$totalWaste") },
            n: { $sum: 1 },
            latest: { $max: { d: "$productionDate", c: "$createdAt" } },
          },
        },
        { $sort: { latest: -1, _id: 1 } },
      ]).option(AGG_OPTS),

      Production.aggregate([
        ...scope,
        {
          $group: {
            _id: millKey,
            weight: { $sum: num("$actualNetWeight") },
            waste: { $sum: num("$totalWaste") },
            latest: { $max: { d: "$productionDate", c: "$createdAt" } },
          },
        },
        { $sort: { latest: -1, _id: 1 } },
      ]).option(AGG_OPTS),

      Production.aggregate([
        ...scope,
        {
          $group: {
            _id: woKey,
            weight: { $sum: num("$actualNetWeight") },
            waste: { $sum: num("$totalWaste") },
            output: { $sum: num("$productionOutput") },
            achieved: { $sum: { $multiply: [num("$productionOutput"), upsExpr] } },
            last: { $max: { d: "$productionDate", c: "$createdAt", n: "$customerName" } },
          },
        },
        {
          $lookup: {
            from: WorkOrder.collection.name,
            let: { wo: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$efiWoNumber", "$$wo"] } } },
              { $project: { qtyInLvs: 1 } },
              { $limit: 1 },
            ],
            as: "wo",
          },
        },
        {
          $project: {
            weight: 1,
            waste: 1,
            output: 1,
            achieved: 1,
            last: 1,
            customer: {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ["$last.n", ""] } }, 0] },
                "$last.n",
                "Unknown",
              ],
            },
            planned: num({ $arrayElemAt: ["$wo.qtyInLvs", 0] }),
          },
        },
      ]).option(AGG_OPTS),

      Production.estimatedDocumentCount(),
    ]);

    // same order the old page produced: newest group first, then JS object key order
    // (numeric keys such as work order numbers come first, ascending)
    const t = (v) => (v ? new Date(v).getTime() || 0 : 0);
    workOrders.sort((a, b) => t(b.last?.d) - t(a.last?.d) || t(b.last?.c) - t(a.last?.c));

    const asObject = (arr, keyOf) => {
      const o = {};
      arr.forEach((x) => { o[keyOf(x)] = x; });
      return Object.values(o);
    };
    const customersOrdered = asObject(customers, (c) => c._id);
    const millsOrdered = asObject(mills, (m) => m._id);
    const workOrdersOrdered = asObject(workOrders, (w) => w._id);

    res.json({
      totalCount,
      filteredCount: customers.reduce((s, c) => s + c.n, 0),
      customers: customersOrdered.map((c) => ({
        customerName: c._id,
        weight: c.weight,
        waste: c.waste,
      })),
      mills: millsOrdered.map((m) => ({ mill: m._id, weight: m.weight, waste: m.waste })),
      workOrders: workOrdersOrdered.map((w) => ({
        workOrder: w._id,
        customer: w.customer,
        weight: w.weight,
        waste: w.waste,
        plannedQty: w.planned,
        output: w.output,
        achievedQty: w.achieved,
      })),
    });
  } catch (err) {
    console.error("SUMMARY REPORT ERROR:", err);
    res.status(500).json({ message: "Error building summary report" });
  }
};

// GET /api/production/summary-options  (filter dropdown values, cached 5 min)
//   ?by=production -> locations ordered like the Wastage page (newest production date first)
const optionsCache = {};

const getSummaryOptions = async (req, res) => {
  try {
    const by = req.query.by === "production" ? "production" : "created";
    const hit = optionsCache[by];
    if (hit && Date.now() - hit.at < 5 * 60 * 1000) return res.json(hit.data);

    const locationPipeline =
      by === "production"
        ? [
            { $project: { userLocations: 1, productionDate: 1, createdAt: 1 } },
            { $unwind: "$userLocations" },
            { $group: { _id: "$userLocations", latest: { $max: { d: "$productionDate", c: "$createdAt" } } } },
            { $sort: { latest: -1 } },
          ]
        : [
            { $project: { userLocations: 1, createdAt: 1 } },
            { $unwind: "$userLocations" },
            { $group: { _id: "$userLocations", latest: { $max: "$createdAt" } } },
            { $sort: { latest: -1 } },
          ];

    const [locations, customers, groups, mills, gsms] = await Promise.all([
      Production.aggregate(locationPipeline).option(AGG_OPTS),
      Production.distinct("customerName"),
      Production.distinct("materials.materialGroupDescription"),
      Production.distinct("mill"),
      Production.distinct("materials.gsm"),
    ]);

    const data = {
      locations: locations.map((l) => l._id).filter(Boolean),
      customers: customers.filter(Boolean).sort(),
      groups: [...new Set(groups.map(normalizeGroup).filter(Boolean))].sort(),
      mills: [
        ...new Set(
          mills.filter((m) => typeof m === "string").map((m) => m.trim()).filter(Boolean)
        ),
      ].sort(),
      gsms: [...new Set(gsms.map((g) => String(g)).filter(Boolean))].sort(),
    };

    optionsCache[by] = { at: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.error("SUMMARY OPTIONS ERROR:", err);
    res.status(500).json({ message: "Error loading filter options" });
  }
};

/* ----------------------------------------------------------------------------
   WASTAGE REPORT - filtering + paging run inside MongoDB (works for millions)
   ---------------------------------------------------------------------------- */

const WASTAGE_FIELDS = {
  efiWoNumber: 1, date: 1, productionDate: 1, customerName: 1, jobDescription: 1,
  "materials.materialCode": 1, "materials.materialDescription": 1,
  "materials.materialGroupDescription": 1, "materials.gsm": 1, "materials.paperSize": 1,
  mill: 1, reelNo: 1, productionType: 1, grossWeight: 1, millNetWeight: 1,
  actualNetWeight: 1, productionOutput: 1, mattWaste: 1, printWaste: 1,
  realEndWaste: 1, coreWeight: 1, totalWaste: 1, balance: 1, wastePercent: 1,
  remarks: 1, userLocations: 1, createdAt: 1,
};

// same order as the old page: production date newest first, then newest saved
const WASTAGE_SORT = { productionDate: -1, createdAt: -1, _id: -1 };

// ---- filters (same rules as the old Wastage page's Apply) ----
const buildWastageMatch = (raw) => {
  const q = {};
  ["wo", "date", "month", "from", "to", "group", "mill", "gsm", "customer", "type", "location"].forEach(
    (k) => { q[k] = typeof raw[k] === "string" ? raw[k] : ""; }
  );

  const and = [{ productionDate: { $ne: null } }]; // old page dropped records without a date
  let extra = false;
  const add = (c) => { and.push(c); extra = true; };

  // old rule: String(efiWoNumber).includes(filter)
  if (q.wo) {
    add({ $expr: { $regexMatch: { input: { $toString: "$efiWoNumber" }, regex: esc(q.wo) } } });
  }

  // old rule: UTC date string === filter
  if (isDate(q.date)) {
    const s = new Date(`${q.date}T00:00:00.000Z`);
    const e = new Date(s);
    e.setUTCDate(e.getUTCDate() + 1);
    add({ productionDate: { $gte: s, $lt: e } });
  }

  // old rule: UTC date string starts with "YYYY-MM"
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(q.month)) {
    const [y, m] = q.month.split("-").map(Number);
    add({ productionDate: { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) } });
  }

  if (isDate(q.from)) add({ productionDate: { $gte: new Date(`${q.from}T00:00:00.000Z`) } });
  if (isDate(q.to)) {
    const end = new Date(`${q.to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    add({ productionDate: { $lt: end } });
  }

  if (q.mill) add({ mill: { $regex: `^\\s*${esc(q.mill)}\\s*$` } });

  if (q.gsm) {
    const g = [{ "materials.gsm": q.gsm }];
    if (!isNaN(Number(q.gsm))) g.push({ "materials.gsm": Number(q.gsm) });
    add({ $or: g });
  }

  if (q.group) {
    let cond;
    if (q.group === "Non Surface Sized Maplit") cond = { $regex: "^\\s*Non Surface Sized" };
    else if (q.group === "Parchment Paper") cond = { $regex: "^\\s*(Parchment Paper|Parachment Paper)\\s*$" };
    else cond = { $regex: `^\\s*${esc(q.group)}\\s*$` };
    add({ "materials.materialGroupDescription": cond });
  }

  if (q.type) add({ productionType: q.type });
  if (q.location) add({ userLocations: q.location });
  if (q.customer) add({ customerName: q.customer });

  return { match: { $and: and }, extra };
};

// GET /api/production/wastage
//   ?latest=1                  -> the latest 30 records (the page's default view)
//   ?page=1&limit=50&<filters> -> one page of ALL records matching the filters
const getWastageRows = async (req, res) => {
  try {
    const totalCount = await Production.estimatedDocumentCount();

    if (req.query.latest === "1") {
      const rows = await Production.find({}, WASTAGE_FIELDS)
        .sort(WASTAGE_SORT)
        .limit(30)
        .maxTimeMS(120000)
        .lean();
      return res.json({ totalCount, total: rows.length, rows });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 5000);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const { match, extra } = buildWastageMatch(req.query);

    const total = extra
      ? await Production.countDocuments(match).maxTimeMS(120000)
      : totalCount;

    const rows = await Production.find(match, WASTAGE_FIELDS)
      .sort(WASTAGE_SORT)
      .skip((page - 1) * limit)
      .limit(limit)
      .maxTimeMS(120000)
      .lean();

    res.json({ totalCount, total, page, limit, rows });
  } catch (err) {
    console.error("WASTAGE REPORT ERROR:", err);
    res.status(500).json({ message: "Error loading wastage report" });
  }
};

router.get("/workorder/:efi", authMiddleware, getWorkOrder);
router.get("/reel/:reelNo", authMiddleware, getLastReelData);
router.post("/", authMiddleware, saveProduction);
router.get("/workorder/:wo/reels", authMiddleware, getReelsByWorkOrder);

// SUMMARY + WASTAGE REPORT routes (must stay above the "/" and "/:id" routes)
router.get("/summary", authMiddleware, getSummaryReport);
router.get("/summary-options", authMiddleware, getSummaryOptions);

// WASTAGE REPORT
router.get("/wastage", authMiddleware, getWastageRows);

// GET ALL RECORDS
router.get("/", authMiddleware, async (req, res) => {
  try {
    const data = await Production.find().sort({ createdAt: -1 }).lean();

    const woNumbers = [...new Set(data.map(d => d.efiWoNumber).filter(Boolean))];

    const workOrders = await WorkOrder.find(
      { efiWoNumber: { $in: woNumbers } },
      { efiWoNumber: 1, orderQty: 1 }
    ).lean();

    const woMap = {};
    workOrders.forEach(wo => {
      woMap[wo.efiWoNumber] = wo.orderQty;
    });

    const enriched = data.map(item => ({
      ...item,
      liveOrderQty: woMap[item.efiWoNumber] ?? null
    }));

    res.json(enriched);
  } catch (err) {
    console.error("Error fetching production:", err);
    res.status(500).json({ message: "Error fetching production" });
  }
});

// UPDATE
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const {
      mattWaste,
      printWaste,
      realEndWaste,
      coreWeight,
      actualNetWeight
    } = req.body;

    const totalWaste =
      Number(mattWaste || 0) +
      Number(printWaste || 0) +
      Number(realEndWaste || 0) +
      Number(coreWeight || 0);

    const wastePercent =
      Number(actualNetWeight) > 0
        ? ((totalWaste / Number(actualNetWeight)) * 100).toFixed(2)
        : 0;

    const updated = await Production.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        totalWaste,
        wastePercent
      },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.log("UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE
router.delete("/:id", authMiddleware, async (req, res) => {
  await Production.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// exposed only so the optional verify script can call it directly
router.getSummaryReport = getSummaryReport;
router.getWastageRows = getWastageRows;

module.exports = router;