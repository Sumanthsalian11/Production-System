/* =====================================================================
   RAW MATERIAL & INK INDENT PORTAL  - Express route
   Mount:  app.use("/api/raw-material-indent", authMiddleware, require("./routes/rawMaterialIndent"));
   npm i multer exceljs            (xlsx is only needed for old binary .xls files)

   Why it copes with crores of rows
   - Files are streamed from disk (xlsx via exceljs stream reader, text/csv/tab via readline)
     and written in batches of 5,000. Nothing is loaded fully into memory.
   - A new upload is written under a new batch id; the old batch is deleted only after the
     new one is complete, so a failed import never destroys existing data.
   - After each import a small (spec group x plant) summary is built with Mongo aggregation.
     The planning board only reads that summary, never the raw rows.
   - Board is filtered, sorted and paginated on the server.
   Nothing is hard coded: plants, materials, groups, families, units all come from the sheets;
   rules (days, lots, units, types) come from the Settings document.
   ===================================================================== */
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const {
  IndentStock, IndentPO, IndentSummary, IndentJob, IndentSplit,
  IndentOverride, IndentSettings, IndentCart, IndentRegister,
} = require("../models/RawMaterialIndent");

const router = express.Router();
const UPLOAD_DIR = path.join(os.tmpdir(), "rmi-uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 4 * 1024 ** 3 } });
const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => res.status(e.status || 500).json({ message: e.message || "Server error" }));
const fail = (status, message) => Object.assign(new Error(message), { status });
const owner = (req) => String((req.user && (req.user._id || req.user.id)) || "shared");

/* ------------------------------- HELPERS ------------------------------ */
const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);
const normTxt = (s) => String(s === null || s === undefined ? "" : s).trim().toLowerCase();
const cellTxt = (v) => String(v === null || v === undefined ? "" : v).trim();
const cleanCode = (v) => cellTxt(v).replace(/\.0+$/, "").replace(/^0+/, "");
const plantCode = (v) => cellTxt(v).replace(/\.0+$/, "");
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toNum = (v) => {
  if (typeof v === "number") return v;
  let t = cellTxt(v).replace(/,/g, "");
  let neg = false;
  if (t.endsWith("-")) { neg = true; t = t.slice(0, -1); } // SAP trailing minus
  const n = parseFloat(t);
  return isNaN(n) ? 0 : neg ? -n : n;
};
const toISODate = (v) => {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return new Date(v.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const t = cellTxt(v);
  let m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return t;
};
const today = (plusDays = 0) => new Date(Date.now() + plusDays * 86400000).toISOString().slice(0, 10);

/* --------------------------- SETTINGS / SCOPE ------------------------- */
async function getSettings() {
  const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
  try {
    return await IndentSettings.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, opts).lean();
  } catch (e) {
    if (e.code === 11000) return IndentSettings.findOne({ key: "main" }).lean();
    throw e;
  }
}
// only rows in the chosen units / material types are planned. A row with no unit column is kept.
function scopeOf(s) {
  const q = {};
  if (s.planningUnits && s.planningUnits.length) q.uom = { $in: [...s.planningUnits.map((u) => u.toUpperCase()), ""] };
  if (s.materialTypes && s.materialTypes.length) q.type = { $in: s.materialTypes };
  return q;
}
const lotFor = (s, fam) => {
  const f = (s.familyLots || []).find((x) => x.family === fam);
  return f && f.lot > 0 ? f.lot : s.lotSize > 0 ? s.lotSize : 1;
};

/* --------------- SPEC GROUP (from the sheet, never hard coded) --------- */
// override > sheet "Spec group" column > "<GSM> GSM <Material Group>" (GSM read from the description)
function resolveGroup({ override, spec, matGroup, desc, type }) {
  if (override) return override;
  if (spec) return spec.toUpperCase();
  const g = cellTxt(desc).match(/(\d{2,3})\s*GSM/i);
  const base = matGroup || type || "";
  const name = [g ? `${parseInt(g[1], 10)} GSM` : "", base].filter(Boolean).join(" ").trim();
  return (name || "UNGROUPED").toUpperCase();
}

/* ----------------------- SHEET FIELDS / COLUMN DETECTION --------------- */
const SAP_FIELDS = {
  MB5B: {
    material: { label: "Material code", required: true, tests: [/^material( no\.?| number| code)?$/, /material/], exclude: /desc|text|type|group|doc/ },
    plant: { label: "Plant / Valuation area", required: true, tests: [/^plant$/, /^valuation area$/, /plant|werks|valuation area/], exclude: /supplying/ },
    qty: { label: "Stock quantity", required: true, tests: [/closing (stock|qty|quantity)|end(ing)? stock|final stock/, /total stock/, /unrestricted/, /stock/, /qty|quantity/], exclude: /value|price|amount|opening|begin|uom|unit|alt/ },
    desc: { label: "Material description", required: false, tests: [/^material desc/, /description|short text|^text$/], exclude: /plant/ },
    uom: { label: "Unit (base UoM)", required: false, tests: [/^base unit/, /unit of measure|^uom$|^unit$/], exclude: /alt/ },
    type: { label: "Material type", required: false, tests: [/^material type$/, /^type$/], exclude: null },
    matGroup: { label: "Material group", required: false, tests: [/^material group$/, /material grp|mat\.? ?group/], exclude: null },
    group: { label: "Spec group (optional)", required: false, tests: [/spec(ification)? group/], exclude: null },
  },
  ME2N: {
    material: { label: "Material code", required: true, tests: [/^material( no\.?| number| code)?$/, /material/], exclude: /desc|text|type|group|doc/ },
    plant: { label: "Plant", required: true, tests: [/^plant$/, /plant|werks/], exclude: /supplying/ },
    qty: { label: "Open / pending quantity", required: true, tests: [/still to be deliv|open (qty|quantity)|to be del|outstanding/, /sched(uled)? qty|schedule.*qty/, /order (qty|quantity)|po qty/, /quantity|qty/], exclude: /price|value|amount|net|uom|unit/ },
    poNo: { label: "PO number", required: false, tests: [/purchasing doc|purch\.? ?doc/, /^po( no\.?| number)?$/], exclude: /item|type|date/ },
    item: { label: "PO item", required: false, tests: [/^item$/, /^po item$/], exclude: null },
    desc: { label: "Material description", required: false, tests: [/^material desc/, /short text|description/, /^text$/], exclude: /plant/ },
    uom: { label: "Unit", required: false, tests: [/^ounit$|order unit|unit of measure|^uom$|^unit$/], exclude: /alt/ },
    vendor: { label: "Vendor", required: false, tests: [/name of (supplier|vendor)/, /supplier|vendor/], exclude: /code|no\.?$/ },
    date: { label: "Delivery date (ETA)", required: false, tests: [/delivery date|del\.? ?date|deliv.*date/, /^eta$|\beta\b|schedule.*date/, /date/], exclude: /doc|creat|posting/ },
    group: { label: "Spec group (optional)", required: false, tests: [/spec(ification)? group/], exclude: null },
  },
};
const fieldList = (type) => Object.entries(SAP_FIELDS[type]).map(([key, r]) => ({ key, label: r.label, required: r.required }));

function detectColumns(type, headers) {
  const result = {};
  Object.entries(SAP_FIELDS[type]).forEach(([key, rule]) => {
    let found = -1;
    for (const re of rule.tests) {
      found = headers.findIndex((h) => re.test(normTxt(h)) && !(rule.exclude && rule.exclude.test(normTxt(h))));
      if (found >= 0) break;
    }
    result[key] = found;
  });
  return result;
}

/* ------------------------------ FILE READERS --------------------------- */
// Every reader yields one array of cell values per row, streaming from disk.
const flat = (v) => {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    return "";
  }
  return v === undefined || v === null ? "" : v;
};
function pickDelim(line) {
  let best = null, max = 0;
  for (const d of ["\t", ";", "|", ","]) {
    const n = line.split(d).length - 1;
    if (n > max) { max = n; best = d; }
  }
  return best;
}
function splitLine(line, d) {
  if (!line.includes('"')) return line.split(d);
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
async function* readRows(file) {
  const fd = await fs.promises.open(file, "r");
  const magic = Buffer.alloc(4);
  await fd.read(magic, 0, 4, 0);
  await fd.close();

  if (magic[0] === 0x50 && magic[1] === 0x4b) {
    // .xlsx / .xlsm  - streamed, first sheet only
    const wb = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: "cache", styles: "cache", hyperlinks: "ignore", worksheets: "emit" });
    for await (const ws of wb) {
      for await (const row of ws) yield Array.from(row.values || []).slice(1).map(flat);
      return;
    }
    return;
  }
  if (magic[0] === 0xd0 && magic[1] === 0xcf) {
    // old binary .xls - cannot be streamed, read with SheetJS
    let XLSX;
    try { XLSX = require("xlsx"); } catch (e) { throw fail(400, "Old binary .xls needs the 'xlsx' package (npm i xlsx), or save the file as .xlsx / .csv."); }
    const wb = XLSX.readFile(file, { cellDates: true });
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    for (const r of grid) yield r;
    return;
  }
  // text: csv / tsv / SAP list saved as .xls (tab separated)
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  let delim = null, first = true;
  for await (let line of rl) {
    if (first) { line = line.replace(/^\uFEFF/, ""); first = false; }
    if (delim === null) delim = pickDelim(line);
    yield splitLine(line, delim || "\t");
  }
}
const isBlank = (r) => !r.some((c) => cellTxt(c) !== "");

async function sniffHeader(file, type) {
  const head = [];
  for await (const row of readRows(file)) { head.push(row); if (head.length >= 30) break; }
  if (!head.length) throw fail(400, "The file is empty.");
  let idx = head.findIndex((r) => r.some((c) => /material/.test(normTxt(c))) && r.filter((c) => cellTxt(c) !== "").length >= 3);
  if (idx < 0) idx = 0;
  const headers = head[idx].map(cellTxt);
  const preview = head.slice(idx + 1).filter((r) => !isBlank(r)).slice(0, 3).map((r) => r.map((c) => (c instanceof Date ? toISODate(c) : cellTxt(c))));
  return { headerRow: idx, headers, map: detectColumns(type, headers), preview };
}

/* ------------------------- IMPORT (streamed, batched) ------------------ */
const BATCH = 5000;
const jobs = new Map(); // in-memory progress of running imports

async function materialMaster(codes) {
  if (!codes.length) return new Map();
  const rows = await IndentStock.aggregate([
    { $match: { material: { $in: codes } } },
    { $group: { _id: "$material", group: { $first: "$group" }, type: { $first: "$type" } } },
  ]);
  return new Map(rows.map((r) => [r._id, r]));
}

async function relinkPOs() {
  // after a new stock sheet: make every PO line follow the group / type of its material
  const cur = IndentStock.aggregate([{ $group: { _id: "$material", group: { $first: "$group" }, type: { $first: "$type" } } }], { allowDiskUse: true }).cursor();
  let ops = [];
  for await (const d of cur) {
    ops.push({ updateMany: { filter: { material: d._id, $or: [{ group: { $ne: d.group } }, { type: { $ne: d.type } }] }, update: { $set: { group: d.group, type: d.type } } } });
    if (ops.length >= 1000) { await IndentPO.bulkWrite(ops, { ordered: false }); ops = []; }
  }
  if (ops.length) await IndentPO.bulkWrite(ops, { ordered: false });
}

let rebuildChain = Promise.resolve();
const rebuildSummary = () => (rebuildChain = rebuildChain.then(doRebuild, doRebuild));
async function doRebuild() {
  const s = await getSettings();
  const scope = scopeOf(s);
  const opt = { allowDiskUse: true };
  const [stock, matCount, po] = await Promise.all([
    IndentStock.aggregate([{ $match: scope }, { $group: { _id: { g: "$group", p: "$plant" }, stock: { $sum: "$qty" }, fam: { $first: "$type" }, lead: { $first: "$desc" } } }], opt),
    IndentStock.aggregate([{ $match: scope }, { $group: { _id: { g: "$group", m: "$material" } } }, { $group: { _id: "$_id.g", n: { $sum: 1 } } }], opt),
    IndentPO.aggregate([{ $match: scope }, { $group: { _id: { g: "$group", p: "$plant" }, pending: { $sum: "$qty" } } }], opt),
  ]);
  const mats = new Map(matCount.map((r) => [r._id, r.n]));
  const rows = new Map();
  const get = (g, p) => {
    const k = `${g}\u0000${p}`;
    if (!rows.has(k)) rows.set(k, { group: g, plant: p, fam: "", lead: "", stock: 0, pending: 0 });
    return rows.get(k);
  };
  stock.forEach((r) => Object.assign(get(r._id.g, r._id.p), { stock: r.stock, fam: r.fam || "", lead: r.lead || "" }));
  po.forEach((r) => { get(r._id.g, r._id.p).pending = r.pending; });
  // group level fields (family, lead, material count) are copied onto each plant row
  const groupInfo = new Map();
  rows.forEach((r) => {
    const gi = groupInfo.get(r.group) || {};
    if (!gi.fam && r.fam) gi.fam = r.fam;
    if (!gi.lead && r.lead) gi.lead = r.lead;
    groupInfo.set(r.group, gi);
  });
  const rev = new mongoose.Types.ObjectId();
  const docs = [];
  rows.forEach((r) => {
    const gi = groupInfo.get(r.group);
    docs.push({ rev, group: r.group, plant: r.plant, fam: gi.fam || "", lead: gi.lead || "", mats: mats.get(r.group) || 0, stock: r.stock, pending: r.pending });
  });
  for (let i = 0; i < docs.length; i += BATCH) await IndentSummary.collection.insertMany(docs.slice(i, i + BATCH), { ordered: false });
  await IndentSettings.updateOne({ key: "main" }, { $set: { summaryRev: rev } });
  await IndentSummary.deleteMany({ rev: { $ne: rev } });
}

async function runImport(type, file, map, headerRow, fileName, job) {
  const Model = type === "MB5B" ? IndentStock : IndentPO;
  const batch = new mongoose.Types.ObjectId();
  const overrides = new Map((await IndentOverride.find().lean()).map((o) => [o.material, o.group]));
  const col = (r, k) => (map[k] >= 0 ? r[map[k]] : "");
  const codes = new Set();
  let used = 0, skipped = 0, buf = [], seen = -1;

  const flush = async () => {
    if (!buf.length) return;
    let docs = buf;
    buf = [];
    if (type === "ME2N") {
      const master = await materialMaster([...new Set(docs.map((d) => d.material))]);
      docs = docs.map((d) => {
        const m = master.get(d.material);
        const group = overrides.get(d.material) || d._spec || (m && m.group) || resolveGroup({ desc: d.desc });
        delete d._spec;
        return { ...d, group, type: (m && m.type) || "" };
      });
    }
    await Model.collection.insertMany(docs, { ordered: false });
  };

  try {
    for await (const r of readRows(file)) {
      seen++;
      if (seen <= headerRow || isBlank(r)) continue;
      const material = cleanCode(col(r, "material"));
      const plant = plantCode(col(r, "plant"));
      if (!material || !plant) { skipped++; continue; }
      const desc = cellTxt(col(r, "desc"));
      const uom = cellTxt(col(r, "uom")).toUpperCase();
      const spec = cellTxt(col(r, "group"));
      if (type === "MB5B") {
        const matGroup = cellTxt(col(r, "matGroup"));
        const mType = cellTxt(col(r, "type"));
        buf.push({
          batch, material, plant, desc, type: mType, matGroup, spec, uom, qty: toNum(col(r, "qty")),
          group: resolveGroup({ override: overrides.get(material), spec, matGroup, desc, type: mType }),
        });
      } else {
        const qty = toNum(col(r, "qty"));
        if (qty <= 0) { skipped++; continue; }
        buf.push({
          batch, material, plant, desc, uom, qty,
          poNo: cellTxt(col(r, "poNo")), item: cellTxt(col(r, "item")), vendor: cellTxt(col(r, "vendor")),
          eta: toISODate(col(r, "date")), _spec: spec ? spec.toUpperCase() : "",
        });
      }
      codes.add(material);
      used++;
      job.rows = used + skipped;
      if (buf.length >= BATCH) await flush();
    }
    await flush();
    if (!used) throw fail(400, `No usable rows found in ${fileName}. Check the column choices and try again.`);
  } catch (e) {
    await Model.deleteMany({ batch });
    throw e;
  }

  await Model.deleteMany({ batch: { $ne: batch } }); // new batch is complete - retire the old one
  if (type === "MB5B") await relinkPOs();
  await rebuildSummary();
  const log = {
    fileName,
    at: new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    used, skipped, extra: `${codes.size} materials`,
  };
  await IndentSettings.updateOne({ key: "main" }, { $set: { [`imports.${type}`]: log } });
  return log;
}

/* --------------------------- CALCULATION ENGINE ----------------------- */
function calculateGroupHealth(g, s, plants, splitsByPlant, defMain) {
  const plantStock = {}, plantPending = {};
  plants.forEach((p) => { plantStock[p] = g.stock[p] || 0; plantPending[p] = g.pending[p] || 0; });
  const monthlyReq = g.monthlyReq || 0;
  const totalStock = sum(plantStock), totalPending = sum(plantPending), totalAvailable = totalStock + totalPending;
  const dailyReq = monthlyReq > 0 ? monthlyReq / (s.workingDays || 1) : 0;
  const daysCoverStockOnly = dailyReq > 0 ? totalStock / dailyReq : null;
  const daysCoverWithPending = dailyReq > 0 ? totalAvailable / dailyReq : null;

  let status = "Balanced";
  if (monthlyReq === 0) status = "No Demand";
  else if (daysCoverWithPending < s.criticalDays) status = "Critical";
  else if (daysCoverWithPending < s.lowDays) status = "Low";
  else if (daysCoverWithPending > s.overstockDays) status = "Overstocked";

  const mainPlant = plants.includes(s.mainPlant) ? s.mainPlant : defMain || plants[0];
  const customSplits = splitsByPlant && Object.keys(splitsByPlant).length ? splitsByPlant : mainPlant ? { [mainPlant]: 100 } : {};
  const totalSplitWeight = sum(customSplits) || 100;
  const target = dailyReq * s.targetCoverDays;
  const lot = lotFor(s, g.fam);

  const plantBreakdown = {};
  let totalIndentRequired = 0;
  plants.forEach((p) => {
    const share = (customSplits[p] || 0) / totalSplitWeight;
    const targetNeed = target * share;
    const avail = plantStock[p] + plantPending[p];
    const deficit = Math.max(0, targetNeed - avail);
    const indent = deficit > 0 ? Math.ceil(deficit / lot) * lot : 0;
    plantBreakdown[p] = { stock: plantStock[p], pending: plantPending[p], targetNeed, deficit, indent, surplus: Math.max(0, avail - targetNeed) };
    totalIndentRequired += indent;
  });

  return {
    group: { id: g.id, cat: g.id, fam: g.fam, lead: g.lead, matCount: g.mats },
    monthlyReq, totalStock, totalPending, totalAvailable, daysCoverStockOnly, daysCoverWithPending,
    status, plantBreakdown, totalIndentRequired, plantSplits: customSplits, jobNames: g.jobNames || "",
  };
}

async function loadHealth(s) {
  const [rows, jobAgg, splits] = await Promise.all([
    IndentSummary.find({ rev: s.summaryRev }).lean(),
    IndentJob.aggregate([{ $group: { _id: "$groupGroupId", kg: { $sum: "$kg" }, names: { $push: "$name" } } }]),
    IndentSplit.find().lean(),
  ]);
  const plants = [...new Set(rows.map((r) => r.plant))].sort();
  // default "main plant" = the plant holding the most stock + open POs (used when Settings has none chosen)
  const plantTotal = {};
  rows.forEach((r) => { plantTotal[r.plant] = (plantTotal[r.plant] || 0) + (r.stock || 0) + (r.pending || 0); });
  const defMain = plants.slice().sort((a, b) => plantTotal[b] - plantTotal[a])[0];
  const jobMap = new Map(jobAgg.map((j) => [j._id, j]));
  const splitMap = new Map();
  splits.forEach((x) => { if (!splitMap.has(x.group)) splitMap.set(x.group, {}); splitMap.get(x.group)[x.plant] = x.pct; });
  const groups = new Map();
  rows.forEach((r) => {
    if (!groups.has(r.group)) groups.set(r.group, { id: r.group, fam: r.fam, lead: r.lead, mats: r.mats, stock: {}, pending: {} });
    const g = groups.get(r.group);
    g.stock[r.plant] = r.stock;
    g.pending[r.plant] = r.pending;
  });
  const list = [...groups.values()].map((g) => {
    const j = jobMap.get(g.id);
    g.monthlyReq = j ? j.kg : 0;
    g.jobNames = j ? j.names.slice(0, 8).join(", ") + (j.names.length > 8 ? ` +${j.names.length - 8} more` : "") : "";
    return calculateGroupHealth(g, s, plants, splitMap.get(g.id), defMain);
  });
  return { plants, list, jobCount: jobAgg.reduce((a, j) => a + j.names.length, 0) };
}

/* ================================= ROUTES ============================== */

/* ---- upload step 1: save file, detect columns ---- */
router.post("/upload/:type/preview", upload.single("file"), wrap(async (req, res) => {
  const type = req.params.type;
  if (!SAP_FIELDS[type]) throw fail(400, "Unknown sheet type.");
  if (!req.file) throw fail(400, "No file received.");
  fs.readdir(UPLOAD_DIR, (e, names) => (names || []).forEach((n) => { // drop abandoned uploads older than 6h
    const f = path.join(UPLOAD_DIR, n);
    fs.stat(f, (er, st) => { if (!er && Date.now() - st.mtimeMs > 6 * 3600 * 1000) fs.unlink(f, () => {}); });
  }));
  try {
    const head = await sniffHeader(req.file.path, type);
    res.json({ type, uploadId: req.file.filename, fileName: req.file.originalname, sizeMB: Math.round(req.file.size / 1048576 * 10) / 10, fields: fieldList(type), ...head });
  } catch (e) {
    fs.unlink(req.file.path, () => {});
    throw e;
  }
}));

/* ---- upload step 2: import in the background, poll for progress ---- */
router.post("/upload/:type/apply", wrap(async (req, res) => {
  const type = req.params.type;
  if (!SAP_FIELDS[type]) throw fail(400, "Unknown sheet type.");
  const { uploadId, map, headerRow, fileName } = req.body || {};
  if (!/^[a-f0-9]{32}$/.test(String(uploadId))) throw fail(400, "Invalid upload.");
  const file = path.join(UPLOAD_DIR, uploadId);
  if (!fs.existsSync(file)) throw fail(400, "Upload expired. Please choose the file again.");
  const missing = fieldList(type).filter((f) => f.required && !(map && map[f.key] >= 0));
  if (missing.length) throw fail(400, `Choose the column for: ${missing.map((f) => f.label).join(", ")}.`);
  for (const j of jobs.values()) if (j.type === type && j.state === "running") throw fail(409, "An import of this sheet is already running.");

  const id = crypto.randomUUID();
  const job = { type, state: "running", rows: 0 };
  jobs.set(id, job);
  setTimeout(() => jobs.delete(id), 3600 * 1000).unref();
  runImport(type, file, map, parseInt(headerRow) || 0, fileName || "sheet", job)
    .then((log) => { job.state = "done"; job.result = log; })
    .catch((e) => { job.state = "error"; job.error = e.message; })
    .finally(() => fs.unlink(file, () => {}));
  res.json({ jobId: id });
}));

router.get("/upload/job/:id", wrap(async (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) throw fail(404, "Import not found.");
  res.json(j);
}));

/* ---- planning board (summary is pre-computed; filter/sort/page here) ---- */
const STATUS_ORDER = ["Critical", "Low", "Balanced", "Overstocked", "No Demand"];
router.get("/board", wrap(async (req, res) => {
  const s = await getSettings();
  const { plants, list, jobCount } = await loadHealth(s);
  const q = req.query;

  let matGroups = null;
  const term = String(q.search || "").trim();
  if (term.length >= 2) {
    const rx = new RegExp(escapeRx(term), "i");
    matGroups = new Set(await IndentStock.distinct("group", { $or: [{ material: rx }, { desc: rx }] }).maxTimeMS(10000));
  }
  const t = term.toLowerCase();
  const filtered = list.filter((h) => {
    if (term && !(`${h.group.cat} ${h.group.lead} ${h.jobNames}`.toLowerCase().includes(t) || (matGroups && matGroups.has(h.group.id)))) return false;
    if (q.family && h.group.fam !== q.family) return false;
    if (q.status && h.status !== q.status) return false;
    if (q.onlyShortage === "1" && !(h.totalIndentRequired > 0)) return false;
    return true;
  });

  const num = (v) => (v === null || v === undefined ? Infinity : v);
  const sortVal = (h, key) => ({
    cat: h.group.cat, stock: h.totalStock, req: h.monthlyReq, pending: h.totalPending,
    stockDays: num(h.daysCoverStockOnly), totalDays: num(h.daysCoverWithPending), indent: h.totalIndentRequired,
  })[key] ?? STATUS_ORDER.indexOf(h.status);
  const key = q.sort || "status", dir = q.dir === "desc" ? -1 : 1;
  filtered.sort((a, b) => {
    const va = sortVal(a, key), vb = sortVal(b, key);
    let c = typeof va === "string" ? va.localeCompare(vb) : va === vb ? 0 : va - vb;
    if (c === 0 && key === "status") { const da = num(a.daysCoverWithPending), db = num(b.daysCoverWithPending); c = da === db ? 0 : da - db; }
    return c * dir;
  });

  const all = q.limit === "all";
  const limit = all ? filtered.length : Math.min(200, Math.max(1, parseInt(q.limit) || 50));
  const pages = Math.max(1, Math.ceil(filtered.length / (limit || 1)));
  const page = Math.min(pages, Math.max(1, parseInt(q.page) || 1));
  const rows = all ? filtered : filtered.slice((page - 1) * limit, page * limit);

  const counts = { "": list.length };
  STATUS_ORDER.forEach((st) => { counts[st] = list.filter((h) => h.status === st).length; });
  let shortLines = 0, shortKG = 0;
  list.forEach((h) => plants.forEach((p) => { const i = h.plantBreakdown[p].indent; if (i > 0) { shortLines++; shortKG += i; } }));

  res.json({
    plants, settings: s, importLog: s.imports || {}, rows, total: filtered.length, page, pages, counts,
    families: [...new Set(list.map((h) => h.group.fam).filter(Boolean))].sort(),
    groupCount: list.length, shortLines, shortKG,
    kpis: {
      stock: list.reduce((a, h) => a + h.totalStock, 0),
      pending: list.reduce((a, h) => a + h.totalPending, 0),
      monthlyReq: list.reduce((a, h) => a + h.monthlyReq, 0),
      critical: list.filter((h) => h.status === "Critical" || h.status === "Low").length,
      indent: list.reduce((a, h) => a + h.totalIndentRequired, 0),
      jobs: jobCount,
    },
  });
}));

/* ---- vendors seen in the pending PO sheet (for the cart vendor list) ---- */
router.get("/vendors", wrap(async (req, res) => {
  const v = await IndentPO.distinct("vendor").maxTimeMS(10000);
  res.json(v.filter(Boolean).sort().slice(0, 2000));
}));

/* ---- list of spec groups (for dropdowns) ---- */
router.get("/groups", wrap(async (req, res) => {
  const s = await getSettings();
  const rows = await IndentSummary.aggregate([
    { $match: { rev: s.summaryRev } },
    { $group: { _id: "$group", lead: { $first: "$lead" }, fam: { $first: "$fam" } } },
    { $sort: { _id: 1 } },
  ]);
  res.json(rows.map((r) => ({ id: r._id, cat: r._id, lead: r.lead, fam: r.fam })));
}));

/* ---- one spec group: health + materials + open POs (capped lists) ---- */
router.get("/group", wrap(async (req, res) => {
  const id = String(req.query.id || "");
  const s = await getSettings();
  const { plants, list } = await loadHealth(s);
  const health = list.find((h) => h.group.id === id);
  if (!health) throw fail(404, "Spec group not found.");
  const scope = scopeOf(s);
  const [matRows, pos] = await Promise.all([
    IndentStock.aggregate([
      { $match: { group: id, ...scope } },
      { $group: { _id: "$material", desc: { $first: "$desc" }, st: { $push: { p: "$plant", q: "$qty" } } } },
      { $sort: { _id: 1 } }, { $limit: 300 },
    ]),
    IndentPO.find({ group: id, ...scope }).sort({ eta: 1 }).limit(300).lean(),
  ]);
  const mats = matRows.map((m) => {
    const st = {};
    m.st.forEach((x) => { st[x.p] = (st[x.p] || 0) + x.q; });
    return { c: m._id, s: m.desc || m._id, st };
  });
  res.json({
    health, plants, mats, matsTruncated: health.group.matCount > mats.length,
    pos: pos.map((p) => ({ poNo: p.poNo || "-", v: p.vendor, p: p.plant, q: p.qty, e: p.eta, m: p.material })),
  });
}));

/* ---- plant split ---- */
router.put("/split", wrap(async (req, res) => {
  const { group, plant } = req.body || {};
  const pct = Math.max(0, parseFloat(req.body.pct) || 0);
  if (!group || !plant) throw fail(400, "group and plant are required.");
  const s = await getSettings();
  const { plants, list } = await loadHealth(s);
  const h = list.find((x) => x.group.id === group);
  const current = h ? h.plantSplits : {};
  // first manual change stores the current effective split for every plant, so the others do not reset
  const ops = plants.map((p) => ({
    updateOne: { filter: { group, plant: p }, update: { $set: { pct: p === plant ? pct : current[p] || 0 } }, upsert: true },
  }));
  if (ops.length) await IndentSplit.bulkWrite(ops, { ordered: false });
  res.json({ ok: true });
}));

/* ---- jobs ---- */
router.get("/jobs", wrap(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const term = String(req.query.search || "").trim();
  const f = term ? { $or: [{ name: new RegExp(escapeRx(term), "i") }, { groupGroupId: new RegExp(escapeRx(term), "i") }] } : {};
  const [rows, total] = await Promise.all([
    IndentJob.find(f).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    IndentJob.countDocuments(f),
  ]);
  res.json({ rows: rows.map((j) => ({ id: j._id, name: j.name, groupGroupId: j.groupGroupId, kg: j.kg })), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));
router.post("/jobs", wrap(async (req, res) => {
  const { name, groupGroupId } = req.body || {};
  const kg = parseFloat(req.body.kg);
  if (!name || !groupGroupId || !kg) throw fail(400, "Enter a job title, choose a spec group and enter the monthly KG.");
  const j = await IndentJob.create({ name: String(name).trim(), groupGroupId, kg });
  res.json({ id: j._id });
}));
router.patch("/jobs/:id", wrap(async (req, res) => {
  const set = {};
  if (req.body.name !== undefined) set.name = String(req.body.name);
  if (req.body.groupGroupId !== undefined) set.groupGroupId = String(req.body.groupGroupId);
  if (req.body.kg !== undefined) set.kg = parseFloat(req.body.kg) || 0;
  await IndentJob.updateOne({ _id: req.params.id }, { $set: set });
  res.json({ ok: true });
}));
router.delete("/jobs/:id", wrap(async (req, res) => {
  await IndentJob.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
}));
router.post("/jobs/:id/shift", wrap(async (req, res) => {
  const job = await IndentJob.findById(req.params.id);
  if (!job) throw fail(404, "Job not found.");
  const { targetGroupId } = req.body || {};
  const pct = Math.min(100, Math.max(0, parseFloat(req.body.pct) || 0));
  if (!targetGroupId || targetGroupId === job.groupGroupId) throw fail(400, "The target spec group is the same as the current one.");
  const shifted = Math.round(job.kg * (pct / 100));
  job.kg -= shifted;
  await job.save();
  await IndentJob.create({ name: `${job.name} (Shifted Spec)`, groupGroupId: targetGroupId, kg: shifted });
  res.json({ shifted });
}));

/* ---- cart ---- */
router.get("/cart", wrap(async (req, res) => {
  const lines = await IndentCart.find({ owner: owner(req) }).sort({ createdAt: 1, _id: 1 }).lean();
  res.json(lines.map(({ _id, owner: o, createdAt, updatedAt, ...l }) => l));
}));
router.put("/cart/line", wrap(async (req, res) => {
  const { groupId, plant } = req.body || {};
  if (!groupId || !plant) throw fail(400, "groupId and plant are required.");
  const s = await getSettings();
  const set = {};
  ["qty", "vendor", "requiredBy", "notes"].forEach((k) => { if (req.body[k] !== undefined) set[k] = k === "qty" ? Math.max(0, parseFloat(req.body[k]) || 0) : req.body[k]; });
  const setOnInsert = { requiredBy: today(s.leadTimeDays), vendor: "", notes: "" };
  Object.keys(set).forEach((k) => delete setOnInsert[k]);
  await IndentCart.updateOne({ owner: owner(req), groupId, plant }, { $set: set, $setOnInsert: setOnInsert }, { upsert: true });
  res.json({ ok: true });
}));
router.delete("/cart/line", wrap(async (req, res) => {
  await IndentCart.deleteOne({ owner: owner(req), groupId: req.query.groupId, plant: req.query.plant });
  res.json({ ok: true });
}));
router.delete("/cart", wrap(async (req, res) => {
  await IndentCart.deleteMany({ owner: owner(req) });
  res.json({ ok: true });
}));
// add the recommended shortage lines of one spec group (groupId) or of all groups
router.post("/cart/shortages", wrap(async (req, res) => {
  const s = await getSettings();
  const { plants, list } = await loadHealth(s);
  const only = req.body && req.body.groupId;
  const ops = [];
  let kg = 0;
  list.filter((h) => !only || h.group.id === only).forEach((h) => plants.forEach((p) => {
    const q = h.plantBreakdown[p].indent;
    if (q > 0) {
      kg += q;
      ops.push({ updateOne: { filter: { owner: owner(req), groupId: h.group.id, plant: p }, update: { $set: { qty: q }, $setOnInsert: { vendor: "", notes: "", requiredBy: today(s.leadTimeDays) } }, upsert: true } });
    }
  }));
  for (let i = 0; i < ops.length; i += 1000) await IndentCart.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  res.json({ added: ops.length, kg });
}));

/* ---- indent register ---- */
router.post("/indents", wrap(async (req, res) => {
  const lines = await IndentCart.find({ owner: owner(req) }).sort({ createdAt: 1, _id: 1 }).lean();
  if (!lines.length) throw fail(400, "The cart is empty.");
  const s = await IndentSettings.findOneAndUpdate({ key: "main" }, { $inc: { indentSeq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  const doc = await IndentRegister.create({
    indentNo: `IND-${s.indentSeq}`, owner: owner(req), date: today(), status: "Draft",
    lines: lines.map(({ groupId, plant, qty, vendor, requiredBy, notes }) => ({ groupId, plant, qty, vendor, requiredBy, notes })),
    totalKG: lines.reduce((a, l) => a + l.qty, 0),
  });
  await IndentCart.deleteMany({ owner: owner(req) });
  res.json({ indentNo: doc.indentNo });
}));
router.get("/indents", wrap(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const [rows, total] = await Promise.all([
    IndentRegister.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    IndentRegister.countDocuments(),
  ]);
  res.json({ rows, total });
}));
router.patch("/indents/:indentNo/status", wrap(async (req, res) => {
  const status = req.body && req.body.status;
  if (!["Draft", "Submitted", "Approved", "PO Placed", "Closed"].includes(status)) throw fail(400, "Invalid status.");
  await IndentRegister.updateOne({ indentNo: req.params.indentNo }, { $set: { status } });
  res.json({ ok: true });
}));

/* ---- settings ---- */
router.get("/settings", wrap(async (req, res) => res.json(await getSettings())));
router.put("/settings", wrap(async (req, res) => {
  const before = await getSettings();
  const set = {};
  ["workingDays", "targetCoverDays", "criticalDays", "lowDays", "overstockDays", "lotSize", "leadTimeDays"].forEach((k) => {
    if (req.body[k] !== undefined) { const n = parseFloat(req.body[k]); if (!isNaN(n) && n >= 0) set[k] = n; }
  });
  if (req.body.mainPlant !== undefined) set.mainPlant = String(req.body.mainPlant);
  if (Array.isArray(req.body.planningUnits)) set.planningUnits = req.body.planningUnits.map((u) => String(u).trim().toUpperCase()).filter(Boolean);
  if (Array.isArray(req.body.materialTypes)) set.materialTypes = req.body.materialTypes.map(String);
  if (Array.isArray(req.body.familyLots)) set.familyLots = req.body.familyLots.filter((f) => f.family && parseFloat(f.lot) > 0).map((f) => ({ family: String(f.family), lot: parseFloat(f.lot) }));
  const after = await IndentSettings.findOneAndUpdate({ key: "main" }, { $set: set }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
  const scopeChanged = JSON.stringify(scopeOf(before)) !== JSON.stringify(scopeOf(after));
  if (scopeChanged) await rebuildSummary();
  res.json(after);
}));
// units / material types found in the uploaded stock sheet (for the settings screen)
router.get("/meta", wrap(async (req, res) => {
  const [units, types] = await Promise.all([
    IndentStock.aggregate([{ $group: { _id: "$uom", n: { $sum: 1 } } }, { $sort: { n: -1 } }], { allowDiskUse: true }),
    IndentStock.aggregate([{ $group: { _id: "$type", n: { $sum: 1 } } }, { $sort: { n: -1 } }], { allowDiskUse: true }),
  ]);
  res.json({ units: units.filter((u) => u._id).map((u) => ({ unit: u._id, rows: u.n })), types: types.filter((t) => t._id).map((t) => ({ type: t._id, rows: t.n })) });
}));

/* ---- material -> spec group (manual correction) ---- */
router.get("/materials", wrap(async (req, res) => {
  const limit = 100;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const term = String(req.query.search || "").trim();
  const match = term ? { $or: ["material", "desc", "group"].map((k) => ({ [k]: new RegExp(escapeRx(term), "i") })) } : {};
  const rows = await IndentStock.aggregate([
    { $match: match }, { $sort: { material: 1 } },
    { $group: { _id: "$material", desc: { $first: "$desc" }, group: { $first: "$group" } } },
    { $sort: { _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit + 1 },
  ], { allowDiskUse: true });
  res.json({ rows: rows.slice(0, limit).map((r) => ({ code: r._id, desc: r.desc, group: r.group })), hasMore: rows.length > limit, page });
}));
router.put("/material-group", wrap(async (req, res) => {
  const material = cleanCode(req.body && req.body.material);
  const name = cellTxt(req.body && req.body.group).toUpperCase();
  if (!material) throw fail(400, "material is required.");
  if (name) await IndentOverride.updateOne({ material }, { $set: { group: name } }, { upsert: true });
  else await IndentOverride.deleteOne({ material });
  const rows = await IndentStock.find({ material }).lean();
  if (rows.length) {
    await IndentStock.bulkWrite(rows.map((r) => ({
      updateOne: { filter: { _id: r._id }, update: { $set: { group: name || resolveGroup({ spec: r.spec, matGroup: r.matGroup, desc: r.desc, type: r.type }) } } },
    })), { ordered: false });
    const g = (await IndentStock.findOne({ material }).lean()).group;
    await IndentPO.updateMany({ material }, { $set: { group: g } });
  } else if (name) {
    await IndentPO.updateMany({ material }, { $set: { group: name } });
  }
  await rebuildSummary();
  res.json({ ok: true });
}));

/* ---- clear everything ---- */
router.delete("/all", wrap(async (req, res) => {
  if (!(req.body && req.body.confirm)) throw fail(400, "Confirmation required.");
  await Promise.all([IndentStock, IndentPO, IndentSummary, IndentJob, IndentSplit, IndentOverride, IndentSettings, IndentCart, IndentRegister].map((m) => m.deleteMany({})));
  res.json({ ok: true });
}));

module.exports = router;