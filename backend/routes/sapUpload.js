// SAP Data Upload  ->  mounted at  /api/sap-upload
// Upload the SAP movement export (.xlsx / .xlsm / .xls / .csv). Every movement line is stored in `sap_movements`
// (grouped by dataset) and later used by the stock reconciliation reports.
const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const mongoose = require("mongoose");

const protect = require("../middleware/authMiddleware");
const SapDataset = require("../models/SapDataset");
const SapMovement = require("../models/SapMovement");
const SapTemplate = require("../models/SapTemplate");

const httpError = (status, message) => Object.assign(new Error(message), { status });
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const userName = (u) => String(u?.name || u?.username || u?.email || "user");
const isAdmin = (u) => String(u?.role || "").toUpperCase() === "ADMIN";
const needAdmin = (req, res, next) =>
  isAdmin(req.user) ? next() : res.status(403).json({ error: "Admin access required" });

const BATCH = 5000; // movement lines saved per round trip
const DEFAULT_SHEET = process.env.SAP_DEFAULT_SHEET || ""; // worksheet to read; blank = first sheet

const upload = multer({
  dest: path.join(os.tmpdir(), "sap-upload"),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 500) * 1024 * 1024 },
});

/* ---------------- text / date helpers (same rules as the original portal) ---------------- */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const norm = s => String(s ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// Posting Date -> "YYYY-MM-DD" (Excel serials, Date objects, DD-MM-YYYY, YYYY-MM-DD, DD-Mon-YYYY)
function dkey(d) {
  if (d instanceof Date && !isNaN(d)) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (typeof d === "number" && d > 25000 && d < 80000) {
    return new Date(Math.round((Math.floor(d) - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  if (typeof d === "string") {
    const s = d.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    let m = s.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})$/);
    if (m) {
      const mi = MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
      if (mi >= 0) return `${m[3]}-${pad(mi + 1)}-${pad(m[1])}`;
    }
  }
  return null;
}

const toQty = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/* ---------------- file readers: one object per Excel/CSV row ---------------- */
async function* readLegacyExcelRows(file, preferredSheet) {
  const wb = XLSX.readFile(file, {
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    cellText: false,
    dense: true
  });
  const pref = (preferredSheet || '').trim();
  const name = wb.SheetNames.includes(pref) ? pref : wb.SheetNames[0];
  const ws = name && wb.Sheets[name];
  if (!ws || !ws['!ref']) return;

  const range = XLSX.utils.decode_range(ws['!ref']);
  const cellAt = (r, c) => Array.isArray(ws[r])
    ? ws[r][c]
    : ws[XLSX.utils.encode_cell({ r, c })];
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    headers[c] = String(cellAt(range.s.r, c)?.v ?? '').trim();
  }

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row = {};
    let hasValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = headers[c];
      if (!key) continue;
      const value = cellAt(r, c)?.v ?? '';
      row[key] = value;
      if (value !== '') hasValue = true;
    }
    if (hasValue) yield { row, sheet: name };
  }
}

function cellValue(value) {
  if (value == null) return '';
  if (typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('');
  if (value.result !== undefined) return value.result;
  if (value.text !== undefined) return value.text;
  return value;
}

async function* readStreamingExcelRows(file, preferredSheet) {
  // SheetJS reads only workbook metadata here; worksheet cells are streamed below.
  const metadata = XLSX.readFile(file, { bookSheets: true });
  const preferred = (preferredSheet || '').trim();
  const name = metadata.SheetNames.includes(preferred) ? preferred : metadata.SheetNames[0];
  if (!name) return;

  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(file, {
    entries: 'ignore',
    hyperlinks: 'ignore',
    sharedStrings: 'cache',
    styles: 'ignore',
    worksheets: 'emit'
  });

  for await (const worksheet of workbook) {
    const selected = worksheet.name === name;
    let headers = null;
    // Drain unselected sheets too, so the streaming reader can finish and clean up.
    for await (const batch of worksheet) {
      const rows = Array.isArray(batch) ? batch : [batch];
      if (!selected) continue;
      for (const row of rows) {
        const values = row.values || [];
        if (!headers) {
          headers = [];
          for (let c = 1; c < values.length; c++) headers[c] = String(cellValue(values[c]) ?? '').trim();
          continue;
        }

        const result = {};
        let hasValue = false;
        for (let c = 1; c < values.length; c++) {
          const key = headers[c];
          if (!key) continue;
          const value = cellValue(values[c]);
          result[key] = value;
          if (value !== '') hasValue = true;
        }
        if (hasValue) yield { row: result, sheet: name };
      }
    }
  }
}


// CSV without extra packages: streams line by line, understands "quoted, values" and quoted line breaks
function splitCsv(s) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function* readCsvRows(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  let headers = null, buf = "";
  for await (const line of rl) {
    buf = buf ? `${buf}\n${line}` : line;
    if ((buf.match(/"/g) || []).length % 2) continue; // still inside a quoted value
    const cells = splitCsv(buf);
    buf = "";
    if (!headers) { headers = cells.map((h) => String(h).replace(/^\uFEFF/, "").trim()); continue; }
    if (!cells.some((c) => String(c).trim() !== "")) continue;
    const row = {};
    headers.forEach((h, i) => { if (h) row[h] = String(cells[i] ?? "").trim(); });
    yield { row, sheet: "csv" };
  }
}

async function* readRows(file, ext, preferredSheet) {
  if (ext === ".csv") { yield* readCsvRows(file); return; }
  if (ext === ".xls") { yield* readLegacyExcelRows(file, preferredSheet); return; }
  yield* readStreamingExcelRows(file, preferredSheet);
}

/* ---------------- store ---------------- */
const dsOut = (d) => ({
  id: String(d._id), file_name: d.fileName, sheet_name: d.sheetName, row_count: d.rowCount, skipped_rows: d.skippedRows,
  min_date: d.minDate || null, max_date: d.maxDate || null,
  logic_template_id: d.logicTemplateId ? String(d.logicTemplateId) : null,
  uploaded_by: d.uploadedBy, created_at: d.createdAt,
});

// Streams the file into sap_movements in batches; if anything fails the half-loaded dataset is removed again.
async function ingestFile({ file, ext, originalName, user, logicTemplateId }) {
  const it = readRows(file, ext, DEFAULT_SHEET)[Symbol.asyncIterator]();
  const first = await it.next();
  if (first.done) throw httpError(400, "No usable rows found (check Posting Date column)");
  if (!("Posting Date" in first.value.row) || !("Card Description" in first.value.row)) {
    throw httpError(400, "Required columns not found: Posting Date, Card Description");
  }

  const dataset = await SapDataset.create({ fileName: originalName, uploadedBy: userName(user), logicTemplateId: logicTemplateId || null });
  const st = { total: 0, skipped: 0, min: null, max: null, sheet: "" };
  try {
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      await SapMovement.collection.insertMany(batch, { ordered: false }); // native driver: fastest for big files
      batch = [];
    };
    for (let next = first; !next.done; next = await it.next()) {
      const { row, sheet } = next.value;
      st.sheet = sheet;
      const date = dkey(row["Posting Date"]);
      if (!date) { st.skipped++; continue; }
      const description = String(row["Card Description"] ?? "").trim();
      st.total++;
      if (!st.min || date < st.min) st.min = date;
      if (!st.max || date > st.max) st.max = date;
      batch.push({
        ds: dataset._id, d: date,
        cu: norm(row["Customer Name"]), cd: description, de: norm(description),
        mt: norm(row["Movement Type Name"]), st: norm(row["Stock Type"]),
        pc: norm(row["Product Category"] ?? row["Product Category Name"]),
        fr: norm(row["From Location"]), to: norm(row["To Location"]),
        q: toQty(row["Transaction Qty"]),
        rk: String(row["Rack No"] ?? "").trim(),
        dl: String(row["Deletion Indicator"] ?? "").trim() !== "",
      });
      if (batch.length >= BATCH) await flush();
    }
    await flush();
    if (!st.total) throw httpError(400, "No usable rows found (check Posting Date column)");

    const done = await SapDataset.findByIdAndUpdate(
      dataset._id,
      { rowCount: st.total, skippedRows: st.skipped, minDate: st.min, maxDate: st.max, sheetName: st.sheet },
      { new: true }
    ).lean();
    return dsOut(done);
  } catch (err) {
    await SapMovement.deleteMany({ ds: dataset._id }).catch(() => {});
    await SapDataset.deleteOne({ _id: dataset._id }).catch(() => {});
    throw err;
  }
}

/* ---------------- routes ---------------- */
router.use(protect);

// what the page needs on open: bank/product logics + recent uploads
router.get("/data", ah(async (req, res) => {
  const [templates, datasets] = await Promise.all([
    SapTemplate.find().sort({ order: 1, _id: 1 }).select("name internal").lean(),
    SapDataset.find().sort({ _id: -1 }).limit(50).lean(),
  ]);
  res.json({
    templates: templates.map((t) => ({ id: String(t._id), name: t.name, internal: !!t.internal })),
    datasets: datasets.map(dsOut),
  });
}));

router.post("/datasets", upload.single("file"), ah(async (req, res) => {
  if (!req.file) throw httpError(400, "No file received");
  const ext = path.extname(req.file.originalname).toLowerCase();
  try {
    if (![".xlsx", ".xlsm", ".xls", ".csv"].includes(ext)) throw httpError(400, "Upload an .xlsx or .csv file");
    let logicTemplateId = null;
    if (req.body?.logicTemplateId) {
      if (!mongoose.isValidObjectId(req.body.logicTemplateId) || !(await SapTemplate.exists({ _id: req.body.logicTemplateId }))) {
        throw httpError(400, "Select an available bank / product logic");
      }
      logicTemplateId = req.body.logicTemplateId;
    }
    const dataset = await ingestFile({ file: req.file.path, ext, originalName: req.file.originalname, user: req.user, logicTemplateId });
    res.json({ dataset });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
}));

router.delete("/datasets/:id", needAdmin, ah(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Dataset not found");
  const ds = await SapDataset.findByIdAndDelete(req.params.id);
  if (!ds) throw httpError(404, "Dataset not found");
  await SapMovement.deleteMany({ ds: ds._id });
  res.json({ ok: true });
}));

// JSON errors for this router only
router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File too large" });
  if (err.name === "CastError" || err.name === "ValidationError") return res.status(400).json({ error: err.message });
  if (!err.status) console.error("sap-upload error:", err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Server error" });
});

module.exports = router;
