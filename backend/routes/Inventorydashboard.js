const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const InventoryItem = require("../models/Inventoryitem");
const UploadBatch = require("../models/UploadBatch");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const UPLOAD_BATCH_SIZE = 5000;
const TABLE_PAGE_SIZE_MAX = 200;
const ALLOWED_SORT_FIELDS = new Set([
  "code", "desc", "plant", "requisitioner", "matType",
  "movementStatus", "nonMovingDays", "totalVal",
]);

/* ---------------- Helpers ---------------- */

function pick(row, key) {
  const rowKeys = Object.keys(row);
  const found = rowKeys.find((rk) => rk.trim().toLowerCase() === key.toLowerCase());
  return found ? row[found] : "";
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v) {
  return String(v == null ? "" : v).trim();
}

function formatTimestamp(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function classifyMovement(regVal, slowVal, nonVal) {
  if (nonVal > 0) return "Non Moving";
  if (slowVal > 0) return "Slow Moving";
  return "Regular Moving";
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Any key present (even []) is applied as an exact $in filter. A key that's
// omitted means "no restriction" — the frontend omits it when every option
// in that facet is selected, so an unfiltered dashboard load never pays for
// a no-op $in over millions of documents.
function buildMatch(filters = {}) {
  const match = {};
  if (filters.batchId) {
    // batchId is stored as a String on InventoryItem, so compare as a
    // plain string — wrapping it in ObjectId() would never match.
    match.batchId = filters.batchId;
  }
  if (filters.plants) match.plant = { $in: filters.plants };
  if (filters.reqs) match.requisitioner = { $in: filters.reqs };
  if (filters.types) match.matType = { $in: filters.types };
  if (filters.grps) match.matGrp = { $in: filters.grps };
  if (filters.movements) match.movementStatus = { $in: filters.movements };
  if (filters.search && filters.search.trim()) {
    const safe = escapeRegex(filters.search.trim());
    match.$or = [
      { code: { $regex: safe, $options: "i" } },
      { desc: { $regex: safe, $options: "i" } },
    ];
  }
  return match;
}

function enrichRow(item) {
  return {
    id: item._id.toString(),
    code: item.code,
    desc: item.desc,
    requisitioner: item.requisitioner,
    matType: item.matType,
    matGrp: item.matGrp,
    plant: item.plant,
    totalVal: item.totalVal || 0,
    regVal: item.regVal || 0,
    slowVal: item.slowVal || 0,
    nonVal: item.nonVal || 0,
    val0_90: item.val0_90 || 0,
    val90_180: item.val90_180 || 0,
    val180_365: item.val180_365 || 0,
    val365Plus: item.val365Plus || 0,
    nonMovingDays: item.nonMovingDays || 0,
    movementStatus: item.movementStatus || "Regular Moving",
    comments: item.comments || [],
  };
}

/* ------------------------------------------------------------------ *
 * GET /api/inventory-dashboard/filter-options
 * Distinct values only — served off the indexed fields, never touches
 * full documents. Call once at load and again after a successful upload.
 * ------------------------------------------------------------------ */
router.get("/filter-options", async (req, res) => {
  try {
    const { batchId } = req.query;
    const match = batchId ? { batchId } : {};
    const [plants, reqs, types, grps] = await Promise.all([
      InventoryItem.distinct("plant", match),
      InventoryItem.distinct("requisitioner", match),
      InventoryItem.distinct("matType", match),
      InventoryItem.distinct("matGrp", match),
    ]);
    res.json({
      plants: plants.filter(Boolean).sort(),
      reqs: reqs.filter(Boolean).sort(),
      types: types.filter(Boolean).sort(),
      grps: grps.filter(Boolean).sort(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/uploads", async (req, res) => {
  try {
    const batches = await UploadBatch.find().sort({ createdAt: -1 }).lean();
    res.json({
      batches: batches.map((b) => ({
        id: b._id,
        filename: b.filename,
        recordCount: b.recordCount,
        uploadedAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/uploads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await InventoryItem.deleteMany({ batchId: id });
    await UploadBatch.deleteOne({ _id: id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/inventory-dashboard/aggregate
 * KPIs + all 4 charts + both leaderboards in one $facet — one indexed
 * $match feeds every branch, so the app never sees a raw row to do
 * this math in JS.
 * ------------------------------------------------------------------ */
router.post("/aggregate", async (req, res) => {
  try {
    const match = buildMatch(req.body);
    const [result = {}] = await InventoryItem.aggregate([
      { $match: match },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                total: { $sum: "$totalVal" },
                reg: { $sum: "$regVal" },
                slow: { $sum: "$slowVal" },
                non: { $sum: "$nonVal" },
                count: { $sum: 1 },
              },
            },
          ],
          byRequisitioner: [
            { $group: { _id: "$requisitioner", val: { $sum: "$totalVal" } } },
            { $sort: { val: -1 } },
            { $limit: 8 },
          ],
          byMatType: [
            { $group: { _id: "$matType", val: { $sum: "$totalVal" } } },
            { $sort: { val: -1 } },
            { $limit: 6 },
          ],
          ageing: [
            {
              $group: {
                _id: null,
                a0: { $sum: "$val0_90" },
                a1: { $sum: "$val90_180" },
                a2: { $sum: "$val180_365" },
                a3: { $sum: "$val365Plus" },
              },
            },
          ],
          topNonMoving: [
            { $match: { nonVal: { $gt: 0 } } },
            { $sort: { nonVal: -1 } },
            { $limit: 10 },
            { $project: { code: 1, desc: 1, nonMovingDays: 1, nonVal: 1 } },
          ],
          topSlowMoving: [
            { $match: { slowVal: { $gt: 0 } } },
            { $sort: { slowVal: -1 } },
            { $limit: 10 },
            { $project: { code: 1, desc: 1, nonMovingDays: 1, slowVal: 1 } },
          ],
        },
      },
    ]).allowDiskUse(true);

    const k = result.kpis?.[0] || { total: 0, reg: 0, slow: 0, non: 0, count: 0 };

    res.json({
      kpi: { total: k.total, reg: k.reg, slow: k.slow, non: k.non, count: k.count },
      byRequisitioner: (result.byRequisitioner || []).map((r) => ({ label: r._id || "Unassigned", val: r.val })),
      byMatType: (result.byMatType || []).map((r) => ({ label: r._id || "Other", val: r.val })),
      ageing: result.ageing?.[0] || { a0: 0, a1: 0, a2: 0, a3: 0 },
      topNonMoving: (result.topNonMoving || []).map((r) => ({ ...r, id: r._id })),
      topSlowMoving: (result.topSlowMoving || []).map((r) => ({ ...r, id: r._id })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/inventory-dashboard/table
 * Paginated + server-sorted ledger. Only ever returns pageSize rows —
 * the browser never holds more than one page in memory.
 * ------------------------------------------------------------------ */
router.post("/table", async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 50,
      sortColumn = "totalVal",
      sortAsc = false,
      search,
      ...filters
    } = req.body || {};

    const match = buildMatch({ ...filters, search });
    const sortField = ALLOWED_SORT_FIELDS.has(sortColumn) ? sortColumn : "totalVal";
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.min(TABLE_PAGE_SIZE_MAX, Math.max(1, parseInt(pageSize, 10) || 50));
    const skip = (safePage - 1) * safePageSize;

    const [rows, total] = await Promise.all([
      InventoryItem.find(match)
        .sort({ [sortField]: sortAsc ? 1 : -1 })
        .skip(skip)
        .limit(safePageSize)
        .lean(),
      InventoryItem.countDocuments(match),
    ]);

    res.json({ rows: rows.map(enrichRow), total, page: safePage, pageSize: safePageSize });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/inventory-dashboard/upload
 * Batched insert (never builds one giant array of millions of docs in
 * a single driver call) and a drop+recreate instead of deleteMany({}),
 * which is far faster once the collection holds millions of rows.
 * ------------------------------------------------------------------ */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: `Sheet "${firstSheetName}" is empty` });
    }

    const docs = [];
    for (const row of rows) {
      const totalVal = num(pick(row, "Total Value"));
      const matCode = str(pick(row, "Material Code"));
      if (!matCode && totalVal === 0) continue;

      let requisitioner = str(pick(row, "PR Requisitioner 1")) || "Unassigned";
      if (requisitioner.toLowerCase() === "rajesh g") requisitioner = "RAJESH G";

      const matType = str(pick(row, "Mat Type Descr")) || str(pick(row, "Material Type")) || "Other";
      const matGrp = str(pick(row, "Mat Grp Descr")) || str(pick(row, "Material Group")) || "Other";
      const plant = str(pick(row, "Plant Descr")) || str(pick(row, "Plant")) || "Cards Manipal";

      const regVal = num(pick(row, "Regular Moving"));
      const slowVal = num(pick(row, "Slow Moving"));
      const nonVal = num(pick(row, "Non Moving"));

      const val0_90 = num(pick(row, "Value (0-090)"));
      const val90_180 = num(pick(row, "Value (090-180)"));
      const val180_365 = num(pick(row, "Value (180-365)"));
      const val365Plus = num(pick(row, "Value (>365)")) + num(pick(row, "Value (>1095)"));

      const nonMovingDays = num(pick(row, "Non moving days(from last outward)"));

      docs.push({
        code: matCode,
        desc: str(pick(row, "Material Description")),
        requisitioner, matType, matGrp, plant,
        totalVal, regVal, slowVal, nonVal,
        val0_90, val90_180, val180_365, val365Plus,
        nonMovingDays,
        movementStatus: classifyMovement(regVal, slowVal, nonVal),
      });
    }

    if (!docs.length) {
      return res.status(400).json({ success: false, message: `No valid rows found in sheet "${firstSheetName}"` });
    }

    const batch = await UploadBatch.create({
      filename: req.file.originalname,
      recordCount: docs.length,
    });

    let inserted = 0;
    for (let i = 0; i < docs.length; i += UPLOAD_BATCH_SIZE) {
      const batchDocs = docs.slice(i, i + UPLOAD_BATCH_SIZE).map((d) => ({
        ...d,
        batchId: batch._id,
        comments: [],
      }));
      await InventoryItem.insertMany(batchDocs, { ordered: false });
      inserted += batchDocs.length;
    }

    res.json({
      success: true,
      count: inserted,
      sheet: firstSheetName,
      batchId: batch._id,
      filename: batch.filename,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/inventory-dashboard/comment
 * ------------------------------------------------------------------ */
router.post("/comment", async (req, res) => {
  try {
    const { id, text, user } = req.body;
    if (!id || !text) {
      return res.status(400).json({ success: false, message: "Item id and comment required." });
    }

    const source = await InventoryItem.findById(id, { code: 1 });
    if (!source) {
      return res.status(404).json({ success: false, message: "Item not found: " + id });
    }

    const comment = {
      user: user || req.user?.username || "Dashboard User",
      text,
      timestamp: formatTimestamp(new Date()),
    };

    // Same material code can exist as separate documents across upload
    // batches — push the comment to every document with that code so
    // the comment thread stays in sync no matter which batch it's viewed from.
    await InventoryItem.updateMany(
      { code: source.code },
      { $push: { comments: comment } }
    );

    res.json({ success: true, comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;