// Stock Reconciliation Reports  ->  mounted at  /api/sap-reports
// Builds the opening / receipt / dispatch / wastage / closing report from the uploaded SAP data
// (collection sap_movements) using the bank/product template, its movement rules and its variant map.
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const XLSX = require("xlsx");

const protect = require("../middleware/authMiddleware");
const SapDataset = require("../models/SapDataset");
const SapMovement = require("../models/SapMovement");
const SapTemplate = require("../models/SapTemplate");
const SapRule = require("../models/SapRule");
const SapVariantMap = require("../models/SapVariantMap");
const SapSetting = require("../models/SapSetting");

const httpError = (status, message) => Object.assign(new Error(message), { status });
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const userName = (u) => String(u?.name || u?.username || u?.email || "user");
const isAdmin = (u) => String(u?.role || "").toUpperCase() === "ADMIN";
const needAdmin = (req, res, next) =>
  isAdmin(req.user) ? next() : res.status(403).json({ error: "Admin access required" });
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------------- text helpers ---------------- */
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad = n => String(n).padStart(2, '0');
const norm = s => String(s ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const lst = t => String(t || '').split(/[\n;]+/).map(norm).filter(Boolean);
const fd = d => d ? d.slice(8) + '-' + MON[+d.slice(5, 7) - 1] + '-' + d.slice(0, 4) : '';
const nx = d => new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);

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


/* =====================================================================
   REPORT ENGINE (the same maths as the original portal; MongoDB does the grouping)
   ===================================================================== */
const KEYS = ['open', 'rc', 'dg', 'wa', 'tr', 'ot', 'close'];

function classify(r, R, o) {
  let f = r.fr, t = r.to;
  if (o.flip && r.mt.includes('reversal')) [f, t] = [t, f];
  for (const x of R) {
    const activeRows = x.rows.filter(row => row.mt.length || row.fr.length || row.to.length || row.st.length || row.pc.length);
    if (activeRows.length) {
      if (activeRows.some(row => row.mt.includes(r.mt) && (!row.st.length || row.st.includes(r.st)) &&
          (!row.fr.length || row.fr.includes(f)) && (!row.to.length || row.to.includes(t)) &&
          (!row.pc.length || row.pc.includes(r.pc)))) return x.k;
      continue;
    }
    if (x.mt.includes(r.mt) && (!x.st.length || x.st.includes(r.st)) &&
        (!x.fr.length || x.fr.includes(f)) && (!x.to.length || x.to.includes(t))) return x.k;
  }
  return 'ot';
}

// Even crores of SAP lines reach Node only as a small summarised set (grouped in MongoDB).
async function aggregate({ user, dataset, tpl, mapRows, cfg, to }) {
  const o = cfg.o;
  const R = cfg.rules.map(x => ({
    k: x.key, mt: lst(x.movement_types), fr: lst(x.from_locations), to: lst(x.to_locations), st: lst(x.stock_types),
    rows: (x.criteria_rows || []).map(row => ({ mt: lst(row.mt), fr: lst(row.fr), to: lst(row.to), st: lst(row.st), pc: lst(row.pc) }))
  }));
  const cs = lst(o.closeSt);

  const V = [], ix = new Map();
  mapRows.forEach(r => {
    const k = norm(r.sap_variant);
    if (k && !ix.has(k)) {
      const v = { id: V.length, name: r.customer_variant, sap: r.sap_variant, type: r.card_type, base: 0 };
      ix.set(k, v); V.push(v);
    }
  });
  const bl = {};
  String(o.base || '').split('\n').forEach(l => { const p = l.split(/[,\t]/); if (p.length > 1) bl[norm(p[0])] = +p[1] || 0; });
  V.forEach(v => { v.base = bl[norm(v.sap)] ?? bl[norm(v.name)] ?? 0; });

  // Same filters the SQL WHERE clause had, now a MongoDB $match on sp_movements.
  const cu = norm(tpl.customer_match);
  const userLocations = user.locations || ['*'];
  const allLocations = user.is_admin || userLocations.includes('*');
  const match = { ds: new mongoose.Types.ObjectId(String(dataset.id)), d: { $lte: to } }; // aggregate() does not auto-cast ids
  if (o.skipDel) match.dl = false;
  if (cu) match.cu = { $regex: escapeRegex(cu) };
  if (o.baseDate) match.d.$gte = o.baseDate;
  if (!allLocations) {
    const locs = userLocations.map(norm);
    match.$or = [{ fr: { $in: locs } }, { to: { $in: locs } }];
  }

  // Heavy lifting is done by MongoDB: lines are grouped by day / SKU / movement combination.
  const grouped = await SapMovement.aggregate([
    { $match: match },
    { $group: {
        _id: { d: '$d', de: '$de', pc: '$pc', mt: '$mt', st: '$st', fr: '$fr', to: '$to' },
        cd: { $min: '$cd' }, q: { $sum: '$q' }, n: { $sum: 1 }
    } }
  ]).allowDiskUse(true);
  const rows = grouped.map(g => ({
    d: g._id.d, desc_n: g._id.de, product_category_n: g._id.pc, card_desc: g.cd,
    mt_n: g._id.mt, st_n: g._id.st, from_n: g._id.fr, to_n: g._id.to, qty: g.q, cnt: g.n
  }));

  const D = {}, un = {}, unMov = [];
  for (const r of rows) {
    const v = ix.get(r.desc_n);
    if (!v) {
      const k = String(r.card_desc).trim();
      un[k] = (un[k] || 0) + Number(r.cnt);
      continue;
    }
    const q = Number(r.qty) || 0;
    const inC = cs.includes(r.st_n);
    const c = classify({ mt: r.mt_n, st: r.st_n, pc: r.product_category_n, fr: r.from_n, to: r.to_n }, R, o);
    const b = ((D[r.d] ??= {})[v.id] ??= Object.fromEntries([...'rc dg wa tr ot'.split(' '), ...cfg.rules.map(x => x.key), 'NET'].map(k => [k, 0])));
    if (c !== 'ot' || inC) b[c] = (b[c] || 0) + q;
    if (c === 'ot' && inC && q !== 0) {
      unMov.push({ date: r.d, variant: v.name, sap: v.sap, mt: r.mt_n, fr: r.from_n, to: r.to_n, st: r.st_n, qty: q });
    }
    if (inC) b.NET += q;
  }

  let RK = [];
  if (tpl.rack && cs.length) {
    const rk = await SapMovement.aggregate([
      { $match: { ...match, rk: { $ne: '' }, st: { $in: cs } } },
      { $group: { _id: { de: '$de', rk: '$rk' }, q: { $sum: '$q' } } }
    ]).allowDiskUse(true);
    RK = rk.filter(r => ix.has(r._id.de)).map(r => ({ id: ix.get(r._id.de).id, rack: r._id.rk, q: Number(r.q) }));
  }
  return { V, D, RK, un, unMov };
}

async function build({ user, dataset, tpl, mapRows, cfg, from, to, gran, skipEmpty }) {
  const o = cfg.o, maxW = Number(cfg.meta.maxWastePct) || 2.0;
  const { V, D, RK, un, unMov } = await aggregate({ user, dataset, tpl, mapRows, cfg, to });
  const run = V.map(v => v.base);

  Object.keys(D).sort().filter(d => d < from).forEach(d => {
    for (const i in D[d]) run[i] += D[d][i].NET;
  });

  const recs = [];
  for (let d = from; d <= to; d = nx(d)) {
    const x = D[d] || {};
    const rows = V.map(v => {
      const b = x[v.id] || {};
      const r = { open: run[v.id], rc: b.rc || 0, dg: -(b.dg || 0), wa: b.wa || 0, tr: -(b.tr || 0), ot: b.ot || 0 };
      cfg.rules.filter(rule => !['rc', 'dg', 'wa', 'tr', 'ot'].includes(rule.key)).forEach(rule => { r[rule.key] = b[rule.key] || 0; });
      run[v.id] += b.NET || 0; // was `+= b.NET`: a variant with no movement that day gave NaN closing stock
      r.close = run[v.id];
      return r;
    });
    recs.push({ d, rows, act: rows.some(r => Object.entries(r).some(([k, v]) => k !== 'open' && k !== 'close' && v)) });
  }

  const comb = a => a[0].rows.map((_, i) => {
    const dynamicKeys = cfg.rules.filter(rule => !['rc', 'dg', 'wa', 'tr', 'ot'].includes(rule.key)).map(rule => rule.key);
    const sumKeys = ['rc', 'dg', 'wa', 'tr', 'ot', ...dynamicKeys];
    const r = { open: a[0].rows[i].open, close: a.at(-1).rows[i].close, ...Object.fromEntries(sumKeys.map(k => [k, 0])) };
    a.forEach(x => sumKeys.forEach(k => { r[k] += x.rows[i][k] || 0; }));
    return r;
  });

  const ruleLabels = Object.fromEntries(cfg.rules.map(rule => [rule.key, rule.name]));
  const cols = [
    ...tpl.columns.filter(c => c.s).map(c => ruleLabels[c.k] ? { ...c, l: ruleLabels[c.k] } : c),
    ...cfg.rules.filter(rule => !['rc', 'dg', 'wa', 'tr', 'ot'].includes(rule.key)).map(rule => ({ k: rule.key, l: rule.name }))
  ];
  const customRuleKeys = cfg.rules.filter(rule => !['rc', 'dg', 'wa', 'tr', 'ot'].includes(rule.key)).map(rule => rule.key);
  const calcRow = (r, v) => {
    const disp = r.dg - (o.net ? r.wa : 0);
    const customTotal = customRuleKeys.reduce((sum, key) => sum + (r[key] || 0), 0);
    const chk = r.close - (r.open + r.rc - r.dg - r.tr + r.ot + customTotal);
    const wp = r.dg > 0 ? +(r.wa / r.dg * 100).toFixed(2) : 0;
    return { variant: v.name, sap: v.sap, type: v.type, open: r.open, rc: r.rc, disp, wa: r.wa, wastePct: wp, tr: r.tr, ot: r.ot, close: r.close, chk, ...Object.fromEntries(customRuleKeys.map(key => [key, r[key] || 0])) };
  };

  const tz = process.env.REPORT_TZ || 'Asia/Kolkata';
  const genMeta = `Generated: ${new Date().toLocaleString('en-IN', { timeZone: tz })} · By: ${user.username} · Source: ${dataset.file_name} · ${cfg.meta.plantName}`;

  const tb = (subTitle, rows) => {
    const body = [], meta = [];
    let totDg = 0, totWa = 0;
    rows.forEach((r, i) => {
      if (o.hideZero && !Object.entries(r).some(([k, value]) => !['open', 'close'].includes(k) && value)) return;
      const cr = calcRow(r, V[i]);
      totDg += r.dg; totWa += r.wa;
      meta.push({
        neg: cr.close < 0,
        chk: Math.abs(cr.chk) > 1e-6,
        highW: r.dg > 0 && cr.wastePct > maxW,
        ot: cr.ot !== 0
      });
      body.push(cols.map(c => cr[c.k]));
    });
    const tot = cols.map((c, j) => {
      if (j === 0) return 'TOTAL';
      if (['variant', 'sap', 'type'].includes(c.k)) return '';
      if (c.k === 'wastePct') return totDg > 0 ? +(totWa / totDg * 100).toFixed(2) : 0;
      return body.reduce((s, b) => s + (typeof b[j] === 'number' ? b[j] : 0), 0);
    });
    const footRows = tpl.footer ? [[], [tpl.footer], [genMeta]] : [[], [genMeta]];
    return { a: [[tpl.title], [subTitle], [], cols.map(c => c.l), ...body, tot, ...footRows], colKeys: cols.map(c => c.k), rowMeta: meta };
  };

  const sheets = [], use = skipEmpty ? recs.filter(r => r.act) : recs;
  if (gran === 'daily') {
    use.forEach(r => sheets.push({ n: fd(r.d), ...tb('Date: ' + fd(r.d), r.rows) }));
  } else {
    const g = {};
    use.forEach(r => (g[r.d.slice(0, 7)] ??= []).push(r));
    Object.keys(g).forEach(k => {
      const a = g[k];
      sheets.push({ n: MON[+k.slice(5) - 1] + '-' + k.slice(0, 4), ...tb('Period: ' + fd(a[0].d) + ' to ' + fd(a.at(-1).d), comb(a)) });
    });
  }

  const unMovIn = unMov.filter(x => x.date >= from && x.date <= to);
  const consRows = recs.length ? comb(recs) : [];
  const kpi = { open: 0, rc: 0, dg: 0, disp: 0, wa: 0, tr: 0, ot: 0, close: 0, wastePct: 0, negCount: 0, chkCount: 0, highWCount: 0, unSkuCount: Object.keys(un).length, unMovCount: unMovIn.length };
  const excRows = [];
  consRows.forEach((r, i) => {
    const cr = calcRow(r, V[i]);
    kpi.open += r.open; kpi.rc += r.rc; kpi.dg += r.dg; kpi.disp += cr.disp;
    kpi.wa += r.wa; kpi.tr += r.tr; kpi.ot += r.ot; kpi.close += r.close;
    if (cr.close < 0) { kpi.negCount++; excRows.push(['NEGATIVE STOCK', V[i].name, V[i].sap, `Closing stock is ${cr.close}`]); }
    if (Math.abs(cr.chk) > 1e-6) { kpi.chkCount++; excRows.push(['RECON VARIANCE', V[i].name, V[i].sap, `Check variance is ${cr.chk}`]); }
    if (r.dg > 0 && cr.wastePct > maxW) { kpi.highWCount++; excRows.push(['HIGH WASTAGE', V[i].name, V[i].sap, `Wastage ${cr.wastePct}% exceeds ${maxW}% SLA (${r.wa} / ${r.dg})`]); }
  });
  kpi.wastePct = kpi.dg > 0 ? +(kpi.wa / kpi.dg * 100).toFixed(2) : 0;
  Object.entries(un).forEach(([desc, cnt]) => excRows.push(['UNMAPPED SKU', '-', desc, `${cnt} movement row(s) excluded from report`]));
  unMovIn.forEach(x => excRows.push(['UNMAPPED MOVEMENT', x.variant, x.sap, `${fd(x.date)} | ${x.mt} | ${x.fr} → ${x.to} (${x.st}) Qty: ${x.qty}`]));

  if (tpl.rack) {
    const rows = RK.filter(x => x.q)
      .map(x => [V[x.id].name, V[x.id].sap, x.rack, x.q])
      .sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]));
    sheets.push({
      n: 'Rack-wise Closing',
      colKeys: ['variant', 'sap', 'rack', 'close'],
      rowMeta: rows.map(r => ({ neg: r[3] < 0 })),
      a: [[tpl.title], ['Rack-wise closing stock as on ' + fd(to)], [], ['Customer Stock Variant', 'SAP Variant', 'Rack No', 'Closing Qty'], ...rows, ['TOTAL', '', '', rows.reduce((s, r) => s + r[3], 0)]]
    });
  }

  if (tpl.internal) {
    sheets.push({
      n: 'Exceptions & Audit',
      colKeys: ['type', 'variant', 'sap', 'detail'],
      rowMeta: excRows.map(r => ({ neg: r[0] === 'NEGATIVE STOCK' || r[0] === 'RECON VARIANCE', highW: ['HIGH WASTAGE', 'UNMAPPED SKU', 'UNMAPPED MOVEMENT'].includes(r[0]) })),
      a: [[tpl.title], ['Operational Exceptions & Governance Audit (' + fd(from) + ' to ' + fd(to) + ')'], [], ['Exception Type', 'Customer Variant', 'SAP Variant / Description', 'Details'],
        ...(excRows.length ? excRows : [['PASS', '-', '-', 'No operational or reconciliation exceptions detected']])]
    });
  }

  if (recs.length) sheets.push({ n: 'Summary', ...tb('Consolidated summary: ' + fd(from) + ' to ' + fd(to), consRows) });

  return {
    sheets, un, kpi, excCount: excRows.length, from, to,
    source: dataset.file_name,
    tpl: { id: tpl.id, name: tpl.name, internal: tpl.internal, mapId: tpl.map_id, title: tpl.title },
    limits: { maxWastePct: maxW, requireAckOnWarn: !!cfg.meta.requireAckOnWarn }
  };
}

const safeSheetName = n => n.replace(/[\\\/?*\[\]:]/g, '-').slice(0, 31);
const colWidths = a => (a[3] || []).map((_, i) => ({ wch: Math.min(55, Math.max(11, ...a.slice(3).map(r => String(r[i] ?? '').length + 2))) }));

function toWorkbookBuffer(out) {
  const wb = XLSX.utils.book_new();
  out.sheets.forEach(s => {
    const ws = XLSX.utils.aoa_to_sheet(s.a);
    ws['!cols'] = colWidths(s.a);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(s.n));
  });
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}
const sheetToCsv = s => XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(s.a));


/* =====================================================================
   ROUTES
   ===================================================================== */
router.use(protect);

const dsOut = (d) => ({
  id: String(d._id), file_name: d.fileName, sheet_name: d.sheetName, row_count: d.rowCount, skipped_rows: d.skippedRows,
  min_date: d.minDate || null, max_date: d.maxDate || null,
  logic_template_id: d.logicTemplateId ? String(d.logicTemplateId) : null,
  uploaded_by: d.uploadedBy, created_at: d.createdAt,
});

// what the page needs on open: plant meta, report templates, uploaded datasets
router.get("/data", ah(async (req, res) => {
  const [{ meta }, templates, datasets] = await Promise.all([
    getSettings(),
    SapTemplate.find().sort({ order: 1, _id: 1 }).select("name internal").lean(),
    SapDataset.find().sort({ _id: -1 }).limit(50).lean(),
  ]);
  res.json({
    meta: { plantName: meta.plantName, maxWastePct: meta.maxWastePct, requireAckOnWarn: meta.requireAckOnWarn },
    templates: templates.map((t) => ({ id: String(t._id), name: t.name, internal: !!t.internal })),
    datasets: datasets.map(dsOut),
  });
}));

async function runReport(user, body) {
  const { datasetId, templateId, from, to, gran = "daily", skipEmpty = true } = body || {};
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
  if (!isDate(from) || !isDate(to) || from > to) throw httpError(400, "Check the From / To dates");
  if (!["daily", "monthly"].includes(gran)) throw httpError(400, "Invalid granularity");
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > 3660) throw httpError(400, "Date range too large (max 10 years)");

  if (!mongoose.isValidObjectId(datasetId)) throw httpError(400, "Select an uploaded SAP dataset first");
  const dataset = await SapDataset.findById(datasetId).lean();
  if (!dataset) throw httpError(400, "Select an uploaded SAP dataset first");
  if (!mongoose.isValidObjectId(templateId)) throw httpError(404, "Template not found");
  const tpl = await SapTemplate.findById(templateId).lean();
  if (!tpl) throw httpError(404, "Template not found");

  const map = tpl.mapId ? await SapVariantMap.findById(tpl.mapId).lean() : null;
  const mapRows = (map?.rows || []).map((r) => ({ customer_variant: r.cv, sap_variant: r.sap, card_type: r.ct }));
  if (!tpl.mapId) throw httpError(400, `Template "${tpl.name}" has no variant map. Open Admin > Stock: Report Templates, select the variant map and save.`);
  if (!map) throw httpError(400, `The variant map of template "${tpl.name}" no longer exists. Select a map again in Stock: Report Templates.`);
  if (!mapRows.length) throw httpError(400, `The variant map "${map.name}" has no rows.`);

  const [settings, baseRules] = await Promise.all([getSettings(), SapRule.find().sort({ order: 1 }).lean()]);

  // movement logic: the bank/product the data was uploaded with, else the selected template, else the shared defaults
  const logicId = dataset.logicTemplateId || tpl._id;
  const logicTpl = String(logicId) === String(tpl._id) ? tpl : await SapTemplate.findById(logicId).select("ruleSet").lean();
  const rules = (logicTpl?.ruleSet || baseRules).map(ruleToEngine);

  return build({
    user: { username: userName(user), is_admin: isAdmin(user), locations: ["*"] },
    dataset: { id: dataset._id, file_name: dataset.fileName },
    tpl: {
      id: String(tpl._id), name: tpl.name, customer_match: tpl.cust, map_id: tpl.mapId ? String(tpl.mapId) : null,
      internal: tpl.internal, title: tpl.title, footer: tpl.foot, rack: tpl.rack, columns: tpl.cols,
    },
    mapRows, cfg: { meta: settings.meta, o: settings.options, rules }, from, to, gran, skipEmpty: !!skipEmpty,
  });
}

router.post("/generate", ah(async (req, res) => {
  res.json(await runReport(req.user, req.body));
}));

router.post("/download", ah(async (req, res) => {
  const { format = "xlsx", sheetIndex = 0, acknowledged = false } = req.body || {};
  const out = await runReport(req.user, req.body);
  // pre-release safeguard is enforced here, not only in the browser
  if (!out.tpl.internal && out.limits.requireAckOnWarn && out.excCount > 0 && !acknowledged) {
    throw httpError(409, "Customer report has open exceptions; acknowledge the warning to download");
  }
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Refreshed-Token"); // lets the page read the file name
  const base = `${out.tpl.name}_${out.from}_to_${out.to}`.replace(/[^\w\-]+/g, "_");
  if (format === "csv") {
    const s = out.sheets[sheetIndex];
    if (!s) throw httpError(400, "Sheet not found");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${base}_${s.n.replace(/[^\w\-]+/g, "_")}.csv"`);
    return res.send(sheetToCsv(s));
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
  res.send(toWorkbookBuffer(out));
}));

// "Quick-Add to Variant Map" button of the unmapped-SKU alert (admin)
router.post("/maps/:id/quick-add", needAdmin, ah(async (req, res) => {
  const list = (req.body?.descriptions || []).map((s) => String(s).trim()).filter(Boolean);
  if (!list.length) throw httpError(400, "Nothing to add");
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Map not found");
  const m = await SapVariantMap.findByIdAndUpdate(req.params.id, {
    $push: { rows: { $each: list.map((d) => ({ cv: d, sap: d, ct: "Credit" })) } },
  });
  if (!m) throw httpError(404, "Map not found");
  res.json({ added: list.length, map: m.name });
}));

// Load / back up the configuration (rules, variant maps, templates, settings) as JSON.
// Use "Export Configuration" of the old stock portal and POST that file here once (see STEPS.md).
router.get("/config/export", needAdmin, ah(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="stock_portal_config.json"');
  res.send(JSON.stringify(await exportConfig(), null, 2));
}));
router.post("/config/import", needAdmin, ah(async (req, res) => {
  await importConfig(req.body);
  res.json({ ok: true, maps: req.body.maps.length, templates: req.body.templates.length, rules: req.body.rules.length });
}));

// JSON errors for this router only
router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.code === 11000) return res.status(409).json({ error: "That name already exists" });
  if (err.name === "CastError" || err.name === "ValidationError") return res.status(400).json({ error: err.message });
  if (!err.status) console.error("sap-reports error:", err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Server error" });
});

module.exports = router;
