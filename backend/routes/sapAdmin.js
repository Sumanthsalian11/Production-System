// Stock Reports administration  ->  mounted at  /api/sap-admin   (ADMIN only)
// Settings & thresholds, movement rules (shared and per bank/product), variant maps, report templates,
// Excel logic-workbook import, audit trail, configuration backup / import.
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const XLSX = require("xlsx");

const protect = require("../middleware/authMiddleware");
const SapDataset = require("../models/SapDataset");
const SapTemplate = require("../models/SapTemplate");
const SapRule = require("../models/SapRule");
const SapVariantMap = require("../models/SapVariantMap");
const SapSetting = require("../models/SapSetting");
const SapAudit = require("../models/SapAudit");

const httpError = (status, message) => Object.assign(new Error(message), { status });
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const userName = (u) => String(u?.name || u?.username || u?.email || "user");
const isAdmin = (u) => String(u?.role || "").toUpperCase() === "ADMIN";
const needAdmin = (req, res, next) =>
  isAdmin(req.user) ? next() : res.status(403).json({ error: "Admin access required" });
const oid = (id, what = "Record") => {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, `${what} not found`);
  return new mongoose.Types.ObjectId(String(id));
};

async function audit(req, action, detail = "") {
  try {
    await SapAudit.create({ username: userName(req.user), role: String(req.user?.role || ""), action, detail: String(detail).slice(0, 2000) });
  } catch (e) {
    console.error("sap audit write failed:", e.message);
  }
}

const logicWorkbookUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect, needAdmin);

/* ---------------- small helpers used by the config section ---------------- */
const norm = (s) => String(s ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

/* =====================================================================
   SETTINGS, TEMPLATE COLUMNS, CONFIG IMPORT / EXPORT
   ===================================================================== */
// Engine columns a template can show (the report engine computes these).
const COLUMN_DEFS = [
  ["variant", "Customer Stock Variant"], ["sap", "SAP Variant"], ["type", "Card Type"],
  ["open", "Opening Stock"], ["rc", "Receipt"], ["disp", "Dispatch"], ["wa", "Wastage"],
  ["wastePct", "Wastage %"], ["tr", "Transfer"], ["ot", "Other / Unmapped"],
  ["close", "Closing Stock"], ["chk", "Check (should be 0)"],
];
const COLUMN_KEYS = COLUMN_DEFS.map((c) => c[0]);
const makeColumns = (selected) => COLUMN_DEFS.map(([k, l]) => ({ k, l, s: selected.includes(k) }));

// Only fallbacks so the engine never crashes if a settings row is missing; real values live in MongoDB.
const FALLBACK_META = { plantName: "Plant", defaultSheet: "", maxWastePct: 2, requireAckOnWarn: true };
const FALLBACK_OPTIONS = { flip: true, net: true, closeSt: "Good", skipDel: true, hideZero: true, baseDate: "", base: "" };

async function getSettings() {
  const rows = await SapSetting.find({ key: { $in: ["meta", "options"] } }).lean();
  const s = {};
  rows.forEach((r) => { s[r.key] = r.value; });
  return { meta: { ...FALLBACK_META, ...(s.meta || {}) }, options: { ...FALLBACK_OPTIONS, ...(s.options || {}) } };
}

async function mergeSettings(patch) {
  const cur = await getSettings();
  for (const key of ["meta", "options"]) {
    if (patch[key] && typeof patch[key] === "object") {
      const merged = { ...cur[key], ...patch[key] };
      await SapSetting.updateOne({ key }, { $set: { value: merged } }, { upsert: true });
    }
  }
}

const tplOut = (t) => ({
  id: String(t._id), name: t.name, acc: t.acc || "", cust: t.cust || "",
  mapId: t.mapId ? String(t.mapId) : null,
  internal: !!t.internal, title: t.title, foot: t.foot || "", rack: !!t.rack, cols: t.cols || [],
});

function cleanColumns(cols) {
  if (!Array.isArray(cols)) throw httpError(400, "columns must be a list");
  return cols
    .filter((c) => COLUMN_KEYS.includes(c.k))
    .map((c) => ({ k: c.k, l: String(c.l || "").slice(0, 80) || COLUMN_DEFS.find((d) => d[0] === c.k)[1], s: !!c.s }));
}

const cleanMapRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((r) => ({ cv: String(r.cv ?? "").trim(), sap: String(r.sap ?? "").trim(), ct: String(r.ct ?? "").trim() || "Credit" }))
    .filter((r) => r.sap)
    .map((r) => ({ cv: r.cv || r.sap, sap: r.sap, ct: r.ct }));

const cleanCriteriaRows = (rows) =>
  Array.isArray(rows)
    ? rows.map((row) => ({ mt: String(row.mt || ""), fr: String(row.fr || ""), to: String(row.to || ""), st: String(row.st || ""), pc: String(row.pc || "") }))
    : [];

const ruleOut = (r) => ({ key: r.key, name: r.name, mt: r.mt || "", fr: r.fr || "", to: r.to || "", st: r.st || "", rows: r.rows || [] });

// engine shape (the report engine reads the same field names the old SQL rows had)
const ruleToEngine = (r) => {
  const rows = r.rows?.length ? r.rows : r.criteria_rows?.length ? r.criteria_rows : [];
  const first = rows[0] || { mt: r.mt, fr: r.fr, to: r.to, st: r.st };
  return {
    key: r.key, name: r.name,
    movement_types: first.mt || "", from_locations: first.fr || "", to_locations: first.to || "", stock_types: first.st || "",
    criteria_rows: rows,
  };
};

async function exportConfig() {
  const [{ meta, options }, rules, maps, tpls] = await Promise.all([
    getSettings(),
    SapRule.find().sort({ order: 1 }).lean(),
    SapVariantMap.find().sort({ _id: 1 }).lean(),
    SapTemplate.find().sort({ order: 1, _id: 1 }).lean(),
  ]);
  const mapName = new Map(maps.map((m) => [String(m._id), m.name]));
  return {
    meta, options,
    rules: rules.map(ruleOut),
    maps: maps.map((m) => ({ name: m.name, rows: (m.rows || []).map((r) => ({ cv: r.cv, sap: r.sap, ct: r.ct })) })),
    templates: tpls.map((t) => ({
      name: t.name, acc: t.acc, cust: t.cust, map: t.mapId ? mapName.get(String(t.mapId)) : undefined,
      internal: t.internal, title: t.title, foot: t.foot, rack: t.rack, cols: t.cols,
    })),
  };
}

// Used by the Admin "Import configuration" button.
async function importConfig(cfg) {
  if (!cfg || !Array.isArray(cfg.rules) || !Array.isArray(cfg.maps) || !Array.isArray(cfg.templates)) {
    throw httpError(400, "Invalid configuration file (needs rules, maps, templates)");
  }
  await mergeSettings({ meta: cfg.meta, options: cfg.options });

  for (const [i, r] of cfg.rules.entries()) {
    await SapRule.updateOne(
      { key: r.key },
      { $set: { name: r.name || r.key, mt: r.mt || "", fr: r.fr || "", to: r.to || "", st: r.st || "", rows: cleanCriteriaRows(r.rows), order: i } },
      { upsert: true }
    );
  }

  const mapIds = {};
  for (const m of cfg.maps) {
    const doc = await SapVariantMap.findOneAndUpdate(
      { name: m.name }, { $set: { rows: cleanMapRows(m.rows) } }, { upsert: true, new: true }
    );
    mapIds[m.name] = doc._id;
  }

  await SapTemplate.deleteMany({});
  for (const [i, t] of cfg.templates.entries()) {
    const cols = (t.cols || []).every((x) => typeof x === "string") ? makeColumns(t.cols || []) : cleanColumns(t.cols);
    let mapId = mapIds[t.map];
    if (!mapId && t.map) mapId = (await SapVariantMap.findOne({ name: t.map }).select("_id").lean())?._id;
    await SapTemplate.create({
      name: t.name, acc: t.acc || "", cust: t.cust || "", mapId: mapId || null, internal: !!t.internal,
      title: t.title || "Stock Statement", foot: t.foot || "", rack: !!t.rack, cols, order: i,
    });
  }
}



/* ---------- Excel bank logic packages ---------- */
router.post('/logic/parse', logicWorkbookUpload.single('file'), (req, res) => {
  if (!req.file) throw httpError(400, 'Choose an Excel logic workbook');
  const ext = require('path').extname(req.file.originalname).toLowerCase();
  if (!['.xlsx', '.xlsm', '.xls'].includes(ext)) throw httpError(400, 'Logic workbook must be .xlsx, .xlsm, or .xls');

  let workbook;
  try { workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false }); }
  catch { throw httpError(400, 'Could not read the Excel logic workbook'); }

  const normalizeHeader = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const aliases = {
    key: ['rule_key', 'key', 'rule', 'rule_code', 'category_key', 'logic_key'],
    name: ['report_category', 'category', 'name', 'report_type', 'logic_name', 'action', 'movement_category', 'movement_category_name'],
    mt: ['movement_type', 'movement_type_name', 'movement_type_description', 'transaction_type', 'transaction_type_name', 'trans_type', 'movement', 'mt'],
    fr: ['from_location', 'from_location_name', 'source_location', 'from_plant', 'from_plant_name', 'from_storage_location', 'issuing_location', 'from'],
    to: ['to_location', 'to_location_name', 'destination_location', 'to_plant', 'to_plant_name', 'to_storage_location', 'receiving_location', 'to'],
    st: ['stock_type', 'stock_type_name', 'stock_category', 'inventory_type', 'material_type', 'st'],
    pc: ['product_category', 'product_category_name', 'pc'],
    cv: ['customer_variant', 'customer_variant_name', 'customer_item', 'customer_description', 'cv'],
    sap: ['sap_variant', 'sap_description', 'sap_item', 'sap_material_description', 'material_description', 'variant', 'sap'],
    ct: ['card_type', 'type', 'ct']
  };
  const readTable = (sheetName, fields) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
    for (let headerRow = 0; headerRow < Math.min(rows.length, 30); headerRow++) {
      const header = rows[headerRow].map(normalizeHeader);
      const indexes = Object.fromEntries(Object.entries(fields).map(([field, keys]) => [
        field, header.findIndex(value => keys.includes(value))
      ]));
      if (!Object.values(indexes).some(index => index >= 0)) continue;
      const records = rows.slice(headerRow + 1).map(row => Object.fromEntries(Object.entries(indexes)
        .filter(([, index]) => index >= 0)
        .map(([field, index]) => [field, String(row[index] ?? '').trim()])));
      return records;
    }
    return null;
  };
  const ruleKey = value => {
    const text = String(value || '').trim().toLowerCase();
    const known = { receipt: 'rc', receipts: 'rc', dispatch: 'dg', dispatches: 'dg', issue: 'dg', wastage: 'wa', waste: 'wa', transfer: 'tr' };
    return known[text] || text.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
  };
  let rulesRows = null;
  let mapRows = null;
  for (const sheetName of workbook.SheetNames) {
    if (!rulesRows) {
      const candidate = readTable(sheetName, { key: aliases.key, name: aliases.name, mt: aliases.mt, fr: aliases.fr, to: aliases.to, st: aliases.st, pc: aliases.pc });
      if (candidate?.some(row => row.name || row.key) && candidate.some(row => row.mt || row.fr || row.to || row.st || row.pc)) rulesRows = candidate;
    }
    if (!mapRows) {
      const candidate = readTable(sheetName, { cv: aliases.cv, sap: aliases.sap, ct: aliases.ct });
      if (candidate?.some(row => row.sap)) mapRows = candidate.filter(row => row.sap);
    }
  }
  if (!rulesRows) {
    const fieldForCombination = label => Object.entries(aliases)
      .filter(([field]) => ['mt', 'fr', 'to', 'st', 'pc'].includes(field))
      .find(([, names]) => names.includes(normalizeHeader(label)))?.[0];
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      for (let headerRow = 0; headerRow < Math.min(rows.length, 30); headerRow++) {
        const header = rows[headerRow].map(normalizeHeader);
        const categoryIndex = header.findIndex(value => ['data', 'report_category', 'report_category_name', 'category_name'].includes(value));
        const combinationIndexes = header.map((value, index) => ['combination', 'criteria', 'condition'].includes(value) ? index : -1).filter(index => index >= 0);
        if (categoryIndex < 0 || !combinationIndexes.length) continue;
        const criteriaIndex = combinationIndexes[0];
        const repeatedValueIndex = combinationIndexes.find(index => index > criteriaIndex);
        const valueIndex = repeatedValueIndex ?? header.findIndex((value, index) => index > criteriaIndex && ['value', 'values', 'combination_value'].includes(value));
        if (valueIndex < 0) continue;

        const groupedVertical = new Map();
        let categoryName = '';
        for (const row of rows.slice(headerRow + 1)) {
          const listedCategory = String(row[categoryIndex] ?? '').trim();
          if (listedCategory && listedCategory !== '_') categoryName = listedCategory;
          if (categoryName) {
            const key = ruleKey(categoryName);
            if (!groupedVertical.has(key)) groupedVertical.set(key, { key, name: categoryName, criteria: {} });
          }
          const field = fieldForCombination(row[criteriaIndex]);
          const value = String(row[valueIndex] ?? '')
            .split(/\r?\n/)
            .map(line => line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join('\n');
          if (!categoryName || !field || !value || value === '_') continue;
          const key = ruleKey(categoryName);
          const rule = groupedVertical.get(key);
          rule.criteria[field] = rule.criteria[field] ? `${rule.criteria[field]}\n${value}` : value;
        }
        const candidate = [...groupedVertical.values()].map(rule => ({
          key: rule.key, name: rule.name, rows: [rule.criteria]
        }));
        if (candidate.length) {
          rulesRows = candidate;
          break;
        }
      }
      if (rulesRows) break;
    }
  }
  if (!rulesRows) throw httpError(400, 'Could not find movement rules in this workbook. Include a category or rule column and movement type, location, or stock type columns.');

  const grouped = new Map();
  let previousKey = '';
  let previousName = '';
  for (const row of rulesRows) {
    const name = row.name || previousName;
    const key = (row.key || (row.name ? ruleKey(row.name) : previousKey || ruleKey(name))).toLowerCase();
    // vertical-layout rules already carry their criteria in row.rows; flat tables carry them on the row itself
    const criteriaList = (Array.isArray(row.rows) ? row.rows : [row]).map(src => ({
      mt: src.mt || '', fr: src.fr || '', to: src.to || '', st: src.st || '', pc: src.pc || ''
    }));
    if (!key && !name && !criteriaList.some(c => Object.values(c).some(Boolean))) continue;
    const ruleName = name || key;
    if (!/^[a-z0-9_-]{2,64}$/i.test(key) || !ruleName) throw httpError(400, 'Each movement rule needs a category or rule name');
    if (!grouped.has(key)) grouped.set(key, { key, name, rows: [] });
    const rule = grouped.get(key);
    if (!rule.name) rule.name = ruleName;
    if (rule.name !== ruleName) throw httpError(400, `Rule "${key}" has more than one category name`);
    criteriaList.forEach(criteria => {
      if (Object.values(criteria).some(Boolean)) rule.rows.push(criteria);
    });
    previousKey = key;
    previousName = ruleName;
  }
  const rules = [...grouped.values()];
  if (!rules.length) throw httpError(400, 'The Rules sheet has no movement rules');
  if (new Set(rules.map(rule => rule.key)).size !== rules.length) throw httpError(400, 'Rule keys must be unique');

  res.json({ rules, map: mapRows?.length ? { rows: mapRows.map(row => ({ ...row, ct: row.ct || 'Credit' })) } : null });
});


/* ---------- settings & rules ---------- */
router.get("/settings", ah(async (req, res) => res.json(await getSettings())));

router.put("/settings", ah(async (req, res) => {
  const { meta = {}, options = {} } = req.body || {};
  if ("maxWastePct" in meta && !(Number(meta.maxWastePct) >= 0)) throw httpError(400, "Wastage threshold must be a number");
  if ("maxWastePct" in meta) meta.maxWastePct = Number(meta.maxWastePct);
  await mergeSettings({ meta, options });
  await audit(req, "UPDATE_SETTINGS", Object.keys({ ...meta, ...options }).join(", "));
  res.json(await getSettings());
}));

router.get("/rules", ah(async (req, res) => {
  const rules = await SapRule.find().sort({ order: 1 }).lean();
  res.json({ rules: rules.map(ruleOut) });
}));

const BUILT_IN = ["rc", "dg", "wa", "tr"];
const RESERVED = ["ot", "open", "close", "net", "variant", "sap", "type", "disp", "chk"];

function cleanRules(input) {
  if (!Array.isArray(input)) throw httpError(400, "rules must be a list");
  return input.map((r, i) => ({
    key: String(r.key || "").trim(), name: String(r.name || "").trim(),
    mt: String(r.mt || ""), fr: String(r.fr || ""), to: String(r.to || ""), st: String(r.st || ""),
    rows: cleanCriteriaRows(r.rows), order: i,
  }));
}

router.put("/rules", ah(async (req, res) => {
  const clean = cleanRules(req.body?.rules);
  if (clean.some((r) => !/^[a-z0-9_-]{2,64}$/i.test(r.key) || !r.name)) throw httpError(400, "Each rule needs a valid key and name");
  if (clean.some((r) => !BUILT_IN.includes(r.key) && RESERVED.includes(r.key.toLowerCase()))) throw httpError(400, "That key is reserved for report calculations");
  if (new Set(clean.map((r) => r.key)).size !== clean.length) throw httpError(400, "Rule keys must be unique");
  if (clean.some((r) => !BUILT_IN.includes(r.key) && ![...r.rows.flatMap((row) => [row.mt, row.fr, row.to, row.st, row.pc]), r.mt, r.fr, r.to, r.st].some((v) => v.trim()))) {
    throw httpError(400, "Each new movement rule needs at least one matching value");
  }
  await SapRule.deleteMany({ key: { $nin: clean.map((r) => r.key) } });
  for (const r of clean) {
    const first = r.rows[0] || { mt: r.mt, fr: r.fr, to: r.to, st: r.st };
    await SapRule.updateOne({ key: r.key }, { $set: { name: r.name, mt: first.mt, fr: first.fr, to: first.to, st: first.st, rows: r.rows, order: r.order } }, { upsert: true });
  }
  await audit(req, "UPDATE_RULES", `${clean.length} rules saved`);
  res.json({ ok: true });
}));

// rules of ONE bank / product: its own saved set, else a copy of the shared defaults
router.get("/rules/template/:id", ah(async (req, res) => {
  const tpl = await SapTemplate.findById(oid(req.params.id, "Bank / product template")).select("ruleSet").lean();
  if (!tpl) throw httpError(404, "Bank / product template not found");
  if (tpl.ruleSet) return res.json({ rules: tpl.ruleSet.map(ruleOut), customized: true });
  const base = await SapRule.find().sort({ order: 1 }).lean();
  res.json({
    rules: base.map((r) => ({ ...ruleOut(r), rows: r.rows?.length ? r.rows : [{ mt: r.mt, fr: r.fr, to: r.to, st: r.st }] })),
    customized: false,
  });
}));

router.put("/rules/template/:id", ah(async (req, res) => {
  const id = oid(req.params.id, "Bank / product template");
  if (!(await SapTemplate.exists({ _id: id }))) throw httpError(404, "Bank / product template not found");
  const rules = cleanRules(req.body?.rules);
  if (rules.some((r) => !/^[a-z0-9_-]{2,64}$/i.test(r.key) || !r.name)) throw httpError(400, "Each rule needs a valid key and name");
  if (new Set(rules.map((r) => r.key)).size !== rules.length) throw httpError(400, "Rule keys must be unique");
  const stored = rules.map((r) => ({
    key: r.key, name: r.name,
    mt: r.rows[0]?.mt ?? r.mt, fr: r.rows[0]?.fr ?? r.fr, to: r.rows[0]?.to ?? r.to, st: r.rows[0]?.st ?? r.st,
    rows: r.rows,
  }));
  await SapTemplate.updateOne({ _id: id }, { $set: { ruleSet: stored, ruleSetAt: new Date() } });
  await audit(req, "UPDATE_TEMPLATE_RULES", `Template ${req.params.id}: ${rules.length} rules`);
  res.json({ ok: true });
}));

/* ---------- variant maps ---------- */
const mapOut = (m) => ({ id: String(m._id), name: m.name, rows: (m.rows || []).map((r) => ({ cv: r.cv, sap: r.sap, ct: r.ct })) });

router.get("/maps", ah(async (req, res) => {
  const maps = await SapVariantMap.find().sort({ _id: 1 }).lean();
  res.json({ maps: maps.map(mapOut) });
}));

router.post("/maps", ah(async (req, res) => {
  const name = String(req.body?.name || "").trim() || `New map ${Date.now()}`;
  const m = await SapVariantMap.create({ name, rows: [] });
  await audit(req, "CREATE_MAP", name);
  res.json({ id: String(m._id) });
}));

router.put("/maps/:id", ah(async (req, res) => {
  const { name, rows = [] } = req.body || {};
  if (!String(name || "").trim()) throw httpError(400, "Map name is required");
  const clean = cleanMapRows(rows);
  const m = await SapVariantMap.findByIdAndUpdate(oid(req.params.id, "Map"), { $set: { name: String(name).trim(), rows: clean } });
  if (!m) throw httpError(404, "Map not found");
  await audit(req, "UPDATE_MAP", `${name} (${clean.length} variants)`);
  res.json({ ok: true, count: clean.length });
}));

router.delete("/maps/:id", ah(async (req, res) => {
  const id = oid(req.params.id, "Map");
  const m = await SapVariantMap.findByIdAndDelete(id);
  if (!m) throw httpError(404, "Map not found");
  await SapTemplate.updateMany({ mapId: id }, { $set: { mapId: null } }); // same as ON DELETE SET NULL
  await audit(req, "DELETE_MAP", m.name);
  res.json({ ok: true });
}));

// "Quick-Add to Variant Map" from the unmapped-SKU alert on a report.
router.post("/maps/:id/quick-add", ah(async (req, res) => {
  const list = (req.body?.descriptions || []).map((s) => String(s).trim()).filter(Boolean);
  if (!list.length) throw httpError(400, "Nothing to add");
  const m = await SapVariantMap.findByIdAndUpdate(
    oid(req.params.id, "Map"),
    { $push: { rows: { $each: list.map((d) => ({ cv: d, sap: d, ct: "Credit" })) } } }
  );
  if (!m) throw httpError(404, "Map not found");
  await audit(req, "QUICK_MAP_SKU", `Added ${list.length} SKU(s) to ${m.name}`);
  res.json({ added: list.length, map: m.name });
}));

/* ---------- templates ---------- */
router.get("/templates", ah(async (req, res) => {
  const rows = await SapTemplate.find().sort({ order: 1, _id: 1 }).lean();
  res.json({ templates: rows.map(tplOut) });
}));

function tplValues(t) {
  let mapId = null;
  if (t.mapId) {
    if (!require("mongoose").isValidObjectId(t.mapId)) throw httpError(400, "Invalid variant map");
    mapId = t.mapId;
  }
  return {
    name: String(t.name || "").trim() || "New template", acc: t.acc || "", cust: t.cust || "", mapId,
    internal: !!t.internal, title: t.title || "Stock Statement", foot: t.foot || "", rack: !!t.rack,
    cols: t.cols ? cleanColumns(t.cols) : makeColumns(["variant", "open", "rc", "disp", "wa", "tr", "close"]),
  };
}

router.post("/templates", ah(async (req, res) => {
  const last = await SapTemplate.findOne().sort({ order: -1 }).select("order").lean();
  const t = await SapTemplate.create({ ...tplValues(req.body || {}), order: (last?.order || 0) + 1 });
  await audit(req, "CREATE_TEMPLATE", req.body?.name || "");
  res.json({ id: String(t._id) });
}));

router.put("/templates/:id", ah(async (req, res) => {
  const r = await SapTemplate.findByIdAndUpdate(oid(req.params.id, "Template"), { $set: tplValues(req.body || {}) });
  if (!r) throw httpError(404, "Template not found");
  await audit(req, "UPDATE_TEMPLATE", req.body?.name || req.params.id);
  res.json({ ok: true });
}));

router.delete("/templates/:id", ah(async (req, res) => {
  const id = oid(req.params.id, "Template");
  const r = await SapTemplate.findByIdAndDelete(id);
  if (!r) throw httpError(404, "Template not found");
  await SapDataset.updateMany({ logicTemplateId: id }, { $set: { logicTemplateId: null } }); // same as ON DELETE SET NULL
  await audit(req, "DELETE_TEMPLATE", r.name);
  res.json({ ok: true });
}));

/* ---------- audit trail (read-only: no clear/delete endpoint by design) ---------- */
router.get("/audit", ah(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 300, 5000);
  const rows = await SapAudit.find().sort({ _id: -1 }).limit(limit).lean();
  res.json({ rows: rows.map((r) => ({ id: String(r._id), ts: r.ts, username: r.username, role: r.role, action: r.action, detail: r.detail })) });
}));

router.get("/audit.csv", ah(async (req, res) => {
  const rows = await SapAudit.find().sort({ _id: -1 }).limit(50000).lean();
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = ["Timestamp,User,Role,Action,Details", ...rows.map((r) => [new Date(r.ts).toISOString(), r.username, r.role, r.action, r.detail].map(q).join(","))].join("\n");
  await audit(req, "EXPORT_AUDIT", `${rows.length} rows`);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Refreshed-Token");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="stock_portal_audit_log.csv"');
  res.send(csv);
}));

/* ---------- backup / migration ---------- */
router.get("/config/export", ah(async (req, res) => {
  await audit(req, "EXPORT_CFG", "JSON backup downloaded");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Refreshed-Token");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="stock_portal_config.json"');
  res.send(JSON.stringify(await exportConfig(), null, 2));
}));

router.post("/config/import", ah(async (req, res) => {
  await importConfig(req.body);
  await audit(req, "IMPORT_CFG", `${req.body.maps.length} maps, ${req.body.templates.length} templates`);
  res.json({ ok: true });
}));


// JSON errors for this router only
router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.code === 11000) return res.status(409).json({ error: "That name already exists" });
  if (err.name === "CastError" || err.name === "ValidationError") return res.status(400).json({ error: err.message });
  if (!err.status) console.error("sap-admin error:", err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Server error" });
});

module.exports = router;
