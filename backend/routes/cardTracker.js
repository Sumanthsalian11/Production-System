// Card Job Tracker  ->  mounted at  /api/card-tracker
// Upload the AutoTrackDetails Excel, see stage-wise FIFO queues, batches, dispatches and export stage files.
// Everything (Excel column names, stages, priority bands) comes from the configuration below, nothing is hard-coded in the page.
const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");

const protect = require("../middleware/authMiddleware");
const CardTrackerDataset = require("../models/CardTrackerDataset");
const CardTrackerJob = require("../models/CardTrackerJob");
const CardTrackerConfig = require("../models/CardTrackerConfig");

const httpError = (status, message) => Object.assign(new Error(message), { status });
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const userName = (u) => String(u?.name || u?.username || u?.email || "user");
const isAdmin = (u) => String(u?.role || "").toUpperCase() === "ADMIN";
const needAdmin = (req, res, next) =>
  isAdmin(req.user) ? next() : res.status(403).json({ error: "Admin access required" });
const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "Dataset not found");
  return new mongoose.Types.ObjectId(String(id));
};

const upload = multer({
  dest: path.join(os.tmpdir(), "card-tracker-uploads"),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 200) * 1024 * 1024 },
});

/* =====================================================================
   CONFIGURATION (validated). Built-in default below = AutoTrackDetails export.
   ===================================================================== */
const FIELD_TYPES = ['text', 'number', 'date', 'time'];
const TONES = ['ac', 'violet', 'cyan', 'teal', 'ok', 'am', 'wr', 'mt'];
const PQ_MODES = ['total', 'balance', 'balance_or_total'];
const KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
// Logical fields the tracker views rely on. Their Excel headers, labels and types stay configurable.
const REQUIRED_FIELDS = ['recvDate', 'qty', 'bank', 'desc', 'flag', 'dispatchQty', 'dispatchNo', 'dispatchDate', 'dispatchMode'];
// Computed values a column "source" can use besides field keys.
const COMPUTED_SOURCES = ['rank', 'priority', 'age', 'recv', 'processed', 'pq', 'blank'];

// Only fallbacks so exports never crash when a text is missing; real wording lives in the DB.
const EXPORT_FALLBACK = {
  titleTemplate: '{STAGE}', fileName: '{stage}_{asOf}', combinedFileName: 'all_stages_{asOf}',
  labels: {
    asOf: 'As-Of Date', totalJobs: 'Total Jobs', totalCards: 'Total Cards', generated: 'Generated',
    empty: 'No pending jobs', jobs: 'Jobs', cards: 'Cards', waiting: 'Waiting', dispatchedJobs: 'Dispatched Jobs',
    cardsDispatched: 'Cards Dispatched', dispatchNo: 'Dispatch No', date: 'Date', mode: 'Mode', banks: 'Banks',
    status: 'Status', complete: 'Complete', partial: 'Partial', batchesSheet: 'Batches', dispatchedSheet: 'Dispatched'
  }
};

const arr = v => (Array.isArray(v) ? v : []);
const str = v => String(v ?? '').trim();
const strs = v => [...new Set(arr(v).map(str).filter(Boolean))];

function validSource(src, fieldKeys) {
  const s = str(src);
  if (COMPUTED_SOURCES.includes(s) || fieldKeys.has(s)) return true;
  if (s.startsWith('state:')) return true;
  const parts = s.split('/');
  return parts.length > 1 && parts.every(p => fieldKeys.has(p));
}

function cleanColumn(c, fieldKeys, where) {
  const source = str(c?.source);
  if (!validSource(source, fieldKeys)) throw httpError(400, `${where}: unknown column source "${source}"`);
  return { label: str(c.label), source, numeric: !!c.numeric, bold: !!c.bold, badgeWhenPartial: !!c.badgeWhenPartial };
}

function clean(raw) {
  if (!raw || typeof raw !== 'object') throw httpError(400, 'Invalid Card Tracker configuration');

  const fields = arr(raw.fields).map(f => ({
    key: str(f?.key), label: str(f?.label) || str(f?.key), headers: strs(f?.headers),
    type: FIELD_TYPES.includes(f?.type) ? f.type : 'text', required: !!f?.required, default: str(f?.default)
  }));
  const fieldKeys = new Set();
  for (const f of fields) {
    if (!KEY_RE.test(f.key)) throw httpError(400, `Invalid field key "${f.key}"`);
    if (fieldKeys.has(f.key)) throw httpError(400, `Duplicate field key "${f.key}"`);
    fieldKeys.add(f.key);
  }
  for (const k of REQUIRED_FIELDS) {
    const f = fields.find(x => x.key === k);
    if (!f) throw httpError(400, `Field "${k}" is required by the tracker views`);
    if (!f.headers.length) throw httpError(400, `Field "${k}" needs at least one Excel column header`);
  }

  const stageKeys = new Set();
  const stages = arr(raw.stages).map(s => {
    const key = str(s?.key);
    if (!KEY_RE.test(key)) throw httpError(400, `Invalid stage key "${key}"`);
    if (stageKeys.has(key)) throw httpError(400, `Duplicate stage key "${key}"`);
    stageKeys.add(key);
    const need = (k, label) => { if (k && !fieldKeys.has(k)) throw httpError(400, `Stage "${key}": unknown field "${k}" in ${label}`); return k; };
    const qr = s.qtyRule && typeof s.qtyRule === 'object' ? s.qtyRule : null;
    const pr = s.partial && typeof s.partial === 'object' ? s.partial : null;
    const pq = s.pendingQty && typeof s.pendingQty === 'object' ? s.pendingQty : {};
    return {
      key, label: str(s.label) || key, tone: TONES.includes(s.tone) ? s.tone : 'mt',
      statusField: need(str(s.statusField), 'statusField'), doneValues: strs(s.doneValues),
      qtyRule: qr ? { doneField: need(str(qr.doneField), 'qtyRule.doneField'), targetField: need(str(qr.targetField), 'qtyRule.targetField') } : null,
      partial: pr ? {
        statusValues: strs(pr.statusValues),
        doneQtyField: need(str(pr.doneQtyField), 'partial.doneQtyField'), targetField: need(str(pr.targetField), 'partial.targetField')
      } : null,
      naIfDone: strs(s.naIfDone),
      pendingQty: {
        mode: PQ_MODES.includes(pq.mode) ? pq.mode : 'total',
        doneField: need(str(pq.doneField), 'pendingQty.doneField'), fallbackField: need(str(pq.fallbackField), 'pendingQty.fallbackField')
      },
      final: !!s.final,
      dailyCap: Number(s.dailyCap) > 0 ? Number(s.dailyCap) : null,
      columns: arr(s.columns).map(c => cleanColumn(c, fieldKeys, `Stage "${key}"`))
    };
  });
  if (!stages.length) throw httpError(400, 'Define at least one stage');
  for (const s of stages) for (const k of s.naIfDone) if (!stageKeys.has(k)) throw httpError(400, `Stage "${s.key}": naIfDone references unknown stage "${k}"`);
  if (stages.filter(s => s.final).length !== 1) { stages.forEach(s => { s.final = false; }); stages[stages.length - 1].final = true; }

  const priorities = arr(raw.priorities).map(p => ({
    key: str(p?.key), label: str(p?.label) || str(p?.key), minAge: Math.max(0, Number(p?.minAge) || 0),
    tone: TONES.includes(p?.tone) ? p.tone : 'mt'
  }));
  if (!priorities.length || priorities.some(p => !p.key)) throw httpError(400, 'Define priority bands (each needs a key)');
  if (new Set(priorities.map(p => p.key)).size !== priorities.length) throw httpError(400, 'Duplicate priority key');
  if (!priorities.some(p => p.minAge === 0)) throw httpError(400, 'One priority band must start at age 0 days');

  const queueColumns = arr(raw.queueColumns).map(c => cleanColumn(c, fieldKeys, 'queueColumns'));
  const exportColumns = arr(raw.exportColumns).map(c => ({
    ...cleanColumn(c, fieldKeys, 'exportColumns'), stages: strs(c.stages).filter(k => stageKeys.has(k))
  }));

  const ex = raw.export && typeof raw.export === 'object' ? raw.export : {};
  const exp = {
    titleTemplate: str(ex.titleTemplate) || EXPORT_FALLBACK.titleTemplate,
    fileName: str(ex.fileName) || EXPORT_FALLBACK.fileName,
    combinedFileName: str(ex.combinedFileName) || EXPORT_FALLBACK.combinedFileName,
    labels: Object.fromEntries(Object.entries(EXPORT_FALLBACK.labels).map(([k, d]) => [k, str(ex.labels?.[k]) || d]))
  };

  return { defaultSheet: str(raw.defaultSheet), fields, stages, priorities, queueColumns, exportColumns, export: exp };
}


const DEFAULT_CONFIG_RAW = {
  defaultSheet: "",
  fields: [
    {"key": "recvDate", "label": "Data Date", "headers": ["DataReceivedDate"], "type": "date", "required": true},
    {"key": "procDate", "label": "Processed Date", "headers": ["DataProcessedDate", "DataProces"], "type": "date"},
    {"key": "procTime", "label": "Processed Time", "headers": ["sedDate"], "type": "time"},
    {"key": "flag", "label": "Lot", "headers": ["Data flag"], "type": "text", "default": "Unflagged"},
    {"key": "bank", "label": "Bank Name", "headers": ["BankName"], "type": "text"},
    {"key": "desc", "label": "Job Description", "headers": ["JobDesc"], "type": "text"},
    {"key": "qcSheet", "label": "QC Sheet", "headers": ["QCAuditSheetNo"], "type": "text", "required": true},
    {"key": "auditSheet", "label": "Audit No", "headers": ["AuditSheetNo"], "type": "text"},
    {"key": "mct", "label": "MCT Ref No", "headers": ["MCTRefNo"], "type": "text"},
    {"key": "qty", "label": "Total Qty", "headers": ["DataProcessedQty"], "type": "number"},
    {"key": "qcCount", "label": "QC Sheets Total", "headers": ["PersoQCCount"], "type": "number"},
    {"key": "qcDone", "label": "QC Sheets Done", "headers": ["PersoQCDoneCount"], "type": "number"},
    {"key": "qcStatus", "label": "Perso QC Status", "headers": ["PersoQCStatus"], "type": "text"},
    {"key": "wlTaken", "label": "WL Taken", "headers": ["WelcomeLetterTakenQty"], "type": "number"},
    {"key": "wlPending", "label": "WL Pending Qty", "headers": ["WelcomeLetterPendingQty"], "type": "number"},
    {"key": "wlStatus", "label": "Welcome Letter Status", "headers": ["WelcomeLetterStatus"], "type": "text"},
    {"key": "fuStatus", "label": "Fulfillment Status", "headers": ["FulfillmentStatus"], "type": "text"},
    {"key": "dispatchQty", "label": "Dispatched", "headers": ["DispatchQTY"], "type": "number"},
    {"key": "dispatchStatus", "label": "Dispatch Status", "headers": ["DispatchStatus"], "type": "text"},
    {"key": "dispatchNo", "label": "Dispatch No", "headers": ["DispatchNo"], "type": "text"},
    {"key": "dispatchDate", "label": "Dispatch Date", "headers": ["DispatchDate"], "type": "date"},
    {"key": "dispatchMode", "label": "Mode", "headers": ["DispatchMode"], "type": "text"}
  ],
  stages: [
    {"key": "qc", "label": "Perso QC", "tone": "am", "statusField": "qcStatus", "doneValues": ["Completed"], "qtyRule": {"doneField": "qcDone", "targetField": "qcCount"}, "naIfDone": ["dispatch"], "pendingQty": {"mode": "total"}, "dailyCap": null, "columns": [{"label": "QC Sheets (Done/Total)", "source": "qcDone/qcCount", "numeric": true}, {"label": "Pending Cards", "source": "pq", "numeric": true, "bold": true}]},
    {"key": "wl", "label": "Welcome Letter", "tone": "violet", "statusField": "wlStatus", "doneValues": ["Completed"], "qtyRule": {"doneField": "wlTaken", "targetField": "qty"}, "naIfDone": ["fulfillment", "dispatch"], "pendingQty": {"mode": "balance_or_total", "doneField": "wlTaken", "fallbackField": "wlPending"}, "dailyCap": null, "columns": [{"label": "Total Qty", "source": "qty", "numeric": true}, {"label": "WL Taken", "source": "wlTaken", "numeric": true}, {"label": "Pending Qty", "source": "pq", "numeric": true, "bold": true}]},
    {"key": "fulfillment", "label": "Fulfillment", "tone": "ac", "statusField": "fuStatus", "doneValues": ["Completed"], "naIfDone": ["dispatch"], "pendingQty": {"mode": "total"}, "dailyCap": null, "columns": [{"label": "Pending Cards", "source": "pq", "numeric": true, "bold": true}, {"label": "Mode", "source": "dispatchMode"}]},
    {"key": "dispatch", "label": "Dispatch", "tone": "teal", "final": true, "statusField": "dispatchStatus", "doneValues": ["Completed"], "qtyRule": {"doneField": "dispatchQty", "targetField": "qty"}, "partial": {"statusValues": ["Partially Dispatched"], "doneQtyField": "dispatchQty", "targetField": "qty"}, "naIfDone": [], "pendingQty": {"mode": "balance", "doneField": "dispatchQty", "fallbackField": ""}, "dailyCap": null, "columns": [{"label": "Total Qty", "source": "qty", "numeric": true}, {"label": "Dispatched", "source": "dispatchQty", "numeric": true}, {"label": "Balance Qty", "source": "pq", "numeric": true, "bold": true, "badgeWhenPartial": true}, {"label": "Mode", "source": "dispatchMode"}]}
  ],
  priorities: [
    {"key": "High", "label": "High (2d+)", "minAge": 2, "tone": "wr"},
    {"key": "Medium", "label": "Medium (1d)", "minAge": 1, "tone": "am"},
    {"key": "Normal", "label": "Normal", "minAge": 0, "tone": "mt"}
  ],
  queueColumns: [
    {"label": "FIFO #", "source": "rank", "numeric": true, "bold": true},
    {"label": "Priority", "source": "priority"},
    {"label": "Data Date", "source": "recv"},
    {"label": "Processed Time", "source": "processed"},
    {"label": "Age (days)", "source": "age", "numeric": true},
    {"label": "Lot", "source": "flag"},
    {"label": "Bank Name", "source": "bank"},
    {"label": "Job Description", "source": "desc"},
    {"label": "QC Sheet", "source": "qcSheet"},
    {"label": "Audit No", "source": "auditSheet"}
  ],
  exportColumns: [
    {"label": "FIFO Rank", "source": "rank"},
    {"label": "Priority", "source": "priority"},
    {"label": "Age (Days)", "source": "age"},
    {"label": "Data Received Date", "source": "recv"},
    {"label": "Processed Date & Time", "source": "processed"},
    {"label": "Lot / Data Flag", "source": "flag"},
    {"label": "Bank Name", "source": "bank"},
    {"label": "Job Description", "source": "desc"},
    {"label": "QC Audit Sheet No", "source": "qcSheet"},
    {"label": "Audit Sheet No", "source": "auditSheet"},
    {"label": "MCT Ref No", "source": "mct"},
    {"label": "Data Processed Qty", "source": "qty"},
    {"label": "QC Sheets Done / Total", "source": "qcDone/qcCount", "stages": ["qc"]},
    {"label": "Pending Cards Qty", "source": "pq", "stages": ["qc", "fulfillment"]},
    {"label": "WL Taken Qty", "source": "wlTaken", "stages": ["wl"]},
    {"label": "WL Pending Qty", "source": "pq", "stages": ["wl"]},
    {"label": "Already Dispatched Qty", "source": "dispatchQty", "stages": ["dispatch"]},
    {"label": "Balance Pending Qty", "source": "pq", "stages": ["dispatch"]},
    {"label": "Dispatch Mode", "source": "dispatchMode", "stages": ["fulfillment", "dispatch"]},
    {"label": "Operator Name", "source": "blank"},
    {"label": "Completed Qty", "source": "blank"},
    {"label": "Completion Status", "source": "blank"},
    {"label": "Supervisor Sign / Remarks", "source": "blank"}
  ],
  export: {"titleTemplate": "{STAGE} — PENDING JOBS HANDOVER SHEET (FIFO ORDER)", "fileName": "{stage}_Pending_FIFO_{asOf}", "combinedFileName": "All_Stages_Pending_FIFO_{asOf}", "labels": {"asOf": "As-Of Date", "totalJobs": "Total Pending Jobs", "totalCards": "Total Pending Cards", "generated": "Generated", "empty": "No pending jobs in this stage", "jobs": "Jobs", "cards": "Cards", "waiting": "Waiting", "dispatchedJobs": "Dispatched Jobs", "cardsDispatched": "Cards Dispatched", "dispatchNo": "Dispatch No", "date": "Date", "mode": "Mode", "banks": "Banks", "status": "Status", "complete": "Complete", "partial": "Partial", "batchesSheet": "Batches", "dispatchedSheet": "Dispatched"}}
};

let defaultCfg = null;
const getDefaultConfig = () => (defaultCfg ||= clean(DEFAULT_CONFIG_RAW));

async function getConfig() {
  const r = await CardTrackerConfig.findOne({ key: "default" }).lean();
  return r ? r.value : getDefaultConfig();
}


/* =====================================================================
   ENGINE (stage rules, FIFO, batches, dispatches)
   ===================================================================== */
// Rule-driven Card Job Tracker engine. Nothing here knows stage names, Excel headers,
// status words or thresholds: all of that comes from the configuration stored in MongoDB.
const pad = n => String(n).padStart(2, '0');
const DAY = 864e5;
const normHeader = h => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const lc = v => String(v ?? '').trim().toLowerCase();

/* ---------- upload parsing ---------- */
function resolveHeaders(rowKeys, fields) {
  const have = new Map(rowKeys.map(k => [normHeader(k), k]));
  const map = {};
  for (const f of fields) {
    for (const h of f.headers) {
      const hit = have.get(normHeader(h));
      if (hit !== undefined) { map[f.key] = hit; break; }
    }
  }
  return map;
}
const missingRequired = (map, fields) => fields.filter(f => f.required && !map[f.key]);

function toIsoDate(v) {
  if (v instanceof Date) return isNaN(v) ? '' : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number') {
    return v > 20000 && v < 80000 ? new Date(Math.round((Math.floor(v) - 25569) * DAY)).toISOString().slice(0, 10) : '';
  }
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : '';
}

function toSecs(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : v.getUTCHours() * 3600 + v.getUTCMinutes() * 60 + v.getUTCSeconds();
  if (typeof v === 'number') return Math.round((Math.abs(v) % 1) * 86400);
  const m = String(v).match(/(\d{1,2}):(\d{2}):?(\d{2})?/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +(m[3] || 0) : null;
}

const toNum = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// One sheet row -> the stored record { recv, ts, f }. Rows without a received date are skipped (null).
function parseRow(row, map, fields) {
  const f = {};
  let procSecs = 0;
  for (const fd of fields) {
    const raw = map[fd.key] !== undefined ? row[map[fd.key]] : undefined;
    if (fd.type === 'number') f[fd.key] = toNum(raw);
    else if (fd.type === 'date') f[fd.key] = toIsoDate(raw);
    else if (fd.type === 'time') {
      const s = toSecs(raw);
      f[fd.key] = s == null ? '' : `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
      if (fd.key === 'procTime' && s != null) procSecs = s;
    } else f[fd.key] = String(raw ?? '').replace(/\u00a0/g, ' ').trim() || fd.default || '';
  }
  if (!f.recvDate) return null;
  const base = Date.parse(f.procDate || f.recvDate);
  return { recv: f.recvDate, ts: base + procSecs * 1000, f };
}

/* ---------- stage logic ---------- */
function pendingQty(stage, f) {
  const n = k => Number(f[k]) || 0;
  const qty = n('qty');
  const mode = stage.pendingQty.mode;
  if (mode === 'total') return qty;
  const balance = qty > 0 ? Math.max(qty - n(stage.pendingQty.doneField), 0) : n(stage.pendingQty.fallbackField);
  return mode === 'balance_or_total' ? (balance || qty) : balance;
}

function computeJob(row, cfg) {
  const f = row.f;
  const n = k => Number(f[k]) || 0;
  const status = st => lc(f[st.statusField]);
  const stages = cfg.stages;
  const final = stages.find(s => s.final) || stages[stages.length - 1];

  const done = {};
  for (const st of stages) {
    const byStatus = !!st.statusField && st.doneValues.some(v => lc(v) === status(st));
    const q = st.qtyRule;
    const byQty = !!q && n(q.targetField) > 0 && n(q.doneField) >= n(q.targetField);
    done[st.key] = byStatus || byQty;
  }

  const states = {};
  for (const st of stages) {
    if (done[st.key]) { states[st.key] = 'Completed'; continue; }
    const p = st.partial;
    const partial = !!p && (p.statusValues.some(v => lc(v) === status(st)) || (n(p.doneQtyField) > 0 && n(p.doneQtyField) < n(p.targetField)));
    states[st.key] = partial ? 'Partial' : (st.naIfDone.some(k => done[k]) ? 'N/A' : 'Pending');
  }

  // Current stage: a partial stage first, else the first pending one, else the final stage.
  let cur = null;
  if (!done[final.key]) {
    cur = stages.find(s => states[s.key] === 'Partial') || stages.find(s => states[s.key] === 'Pending') || final;
  }

  return {
    i: row.row_no, recv: row.recv, ts: Number(row.ts), f, states,
    cur: cur ? cur.key : '', pq: cur ? pendingQty(cur, f) : 0,
    done: done[final.key], partial: states[final.key] === 'Partial'
  };
}

/* ---------- aggregates (independent of the as-of date) ---------- */
const fifoSort = (a, b) => (Date.parse(a.recv) - Date.parse(b.recv)) || (a.ts - b.ts) || (a.i - b.i);

function batches(jobs) {
  const m = new Map();
  for (const j of jobs) {
    const k = `${j.recv}|${j.f.flag}`;
    let b = m.get(k);
    if (!b) m.set(k, b = { recv: j.recv, flag: j.f.flag, jobs: 0, cards: 0, waiting: {}, done: 0, dispatchedCards: 0 });
    b.jobs++;
    b.cards += j.f.qty;
    b.dispatchedCards += j.done ? j.f.qty : (j.f.dispatchQty || 0);
    if (j.cur) b.waiting[j.cur] = (b.waiting[j.cur] || 0) + 1; else b.done++;
  }
  return [...m.values()].sort((a, b) => a.recv.localeCompare(b.recv) || a.flag.localeCompare(b.flag));
}

function dispatches(jobs) {
  const m = new Map();
  for (const j of jobs) {
    if (!j.f.dispatchNo && !j.done) continue;
    const key = j.f.dispatchNo || `DIRECT-${j.f.dispatchDate || j.recv}`;
    let g = m.get(key);
    if (!g) m.set(key, g = { no: j.f.dispatchNo || '—', date: j.f.dispatchDate || '', mode: j.f.dispatchMode, jobs: 0, cards: 0, banks: new Set(), partial: 0 });
    g.jobs++;
    g.cards += j.f.dispatchQty || j.f.qty;
    g.banks.add(j.f.bank);
    if (j.partial) g.partial++;
  }
  return [...m.values()]
    .map(g => ({ ...g, banks: [...g.banks] }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.no.localeCompare(b.no));
}

/* ---------- as-of date helpers (used by exports) ---------- */
const ageDays = (recv, asOf) => Math.max(0, Math.round((Date.parse(asOf) - Date.parse(recv)) / DAY));
function priorityFor(age, priorities) {
  const sorted = [...priorities].sort((a, b) => b.minAge - a.minAge);
  return (sorted.find(p => age >= p.minAge) || sorted[sorted.length - 1]).key;
}
const fmtDate = iso => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '');


const E = { resolveHeaders, missingRequired, parseRow, computeJob, fifoSort, batches, dispatches, ageDays, priorityFor, fmtDate };

/* =====================================================================
   EXCEL EXPORT
   ===================================================================== */

const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
const safeSheet = s => String(s).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
const safeFile = s => String(s).replace(/[^\w\-. ]+/g, '_');

// Resolves a configured column "source" for one job. Composite sources "a/b" join with " / ".
function cellValue(source, ctx) {
  const { j, rank, age, priority } = ctx;
  if (source === 'blank') return '';
  if (source === 'rank') return rank;
  if (source === 'priority') return priority;
  if (source === 'age') return age;
  if (source === 'recv') return E.fmtDate(j.recv);
  if (source === 'processed') return [E.fmtDate(j.f.procDate), j.f.procTime].filter(Boolean).join(' ');
  if (source === 'pq') return j.pq;
  if (source.startsWith('state:')) return j.states[source.slice(6)] || '';
  if (source.includes('/')) return source.split('/').map(k => j.f[k] ?? '').join(' / ');
  const v = j.f[source];
  return v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? E.fmtDate(v) : (v ?? '');
}

function stageQueue(jobs, stageKey) {
  return jobs.filter(j => j.cur === stageKey).sort(E.fifoSort);
}

function stageSheet(jobs, cfg, stage, asOf) {
  const L = stageQueue(jobs, stage.key);
  const cols = cfg.exportColumns.filter(c => !c.stages.length || c.stages.includes(stage.key));
  const lb = cfg.export.labels;
  const rows = L.map((j, idx) => {
    const age = E.ageDays(j.recv, asOf);
    const ctx = { j, rank: idx + 1, age, priority: E.priorityFor(age, cfg.priorities) };
    return Object.fromEntries(cols.map(c => [c.label, cellValue(c.source, ctx)]));
  });
  const totalCards = L.reduce((a, j) => a + j.pq, 0);
  const head = [
    [fill(cfg.export.titleTemplate, { stage: stage.label, STAGE: stage.label.toUpperCase() })],
    [`${lb.asOf}: ${E.fmtDate(asOf)}`, `${lb.totalJobs}: ${L.length}`, `${lb.totalCards}: ${totalCards}`, `${lb.generated}: ${E.fmtDate(new Date().toISOString().slice(0, 10))}`],
    []
  ];
  const ws = XLSX.utils.aoa_to_sheet(head);
  XLSX.utils.sheet_add_json(ws, rows.length ? rows : [{ [lb.status]: lb.empty }], { origin: 'A4' });
  const labels = rows.length ? cols.map(c => c.label) : [lb.status];
  ws['!cols'] = labels.map(l => ({
    wch: Math.min(60, Math.max(String(l).length, ...rows.slice(0, 200).map(r => String(r[l] ?? '').length)) + 2)
  }));
  return ws;
}

function fileBase(tpl, vars) { return safeFile(fill(tpl, vars)); }

function stageWorkbook(jobs, cfg, stage, asOf) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, stageSheet(jobs, cfg, stage, asOf), safeSheet(stage.label));
  return {
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    fileName: `${fileBase(cfg.export.fileName, { stage: stage.label, asOf })}.xlsx`
  };
}

function combinedWorkbook(jobs, cfg, asOf, summaries) {
  const lb = cfg.export.labels;
  const fieldLabel = k => cfg.fields.find(f => f.key === k)?.label || k;
  const wb = XLSX.utils.book_new();
  cfg.stages.forEach(st => XLSX.utils.book_append_sheet(wb, stageSheet(jobs, cfg, st, asOf), safeSheet(st.label)));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaries.batches.map(b => ({
    [fieldLabel('recvDate')]: E.fmtDate(b.recv), [fieldLabel('flag')]: b.flag, [lb.jobs]: b.jobs, [lb.cards]: b.cards,
    ...Object.fromEntries(cfg.stages.map(s => [`${lb.waiting} ${s.label}`, b.waiting[s.key] || 0])),
    [lb.dispatchedJobs]: b.done, [lb.cardsDispatched]: b.dispatchedCards
  }))), safeSheet(lb.batchesSheet));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaries.dispatches.map(g => ({
    [lb.dispatchNo]: g.no, [lb.date]: E.fmtDate(g.date), [lb.mode]: g.mode, [lb.jobs]: g.jobs, [lb.cards]: g.cards,
    [lb.banks]: g.banks.join(', '), [lb.status]: g.partial ? lb.partial : lb.complete
  }))), safeSheet(lb.dispatchedSheet));
  return {
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    fileName: `${fileBase(cfg.export.combinedFileName, { asOf })}.xlsx`
  };
}


/* =====================================================================
   UPLOAD (reads .xlsx / .xlsm / .xls / .csv and stores one document per job)
   ===================================================================== */
function readSheetRows(file, preferredSheet) {
  const wb = XLSX.readFile(file, { cellDates: false });
  const pref = String(preferredSheet || "").trim();
  const name = wb.SheetNames.includes(pref) ? pref : wb.SheetNames[0];
  const ws = name && wb.Sheets[name];
  if (!ws) return { rows: [], sheet: "" };
  return { rows: XLSX.utils.sheet_to_json(ws, { defval: "", raw: true }), sheet: name };
}

const dsOut = (d) => ({
  id: String(d._id), file_name: d.fileName, sheet_name: d.sheetName, row_count: d.rowCount, skipped_rows: d.skippedRows,
  min_date: d.minDate || null, max_date: d.maxDate || null, uploaded_by: d.uploadedBy, created_at: d.createdAt,
});

async function ingestTrackerFile({ file, originalName, user, cfg }) {
  const { rows, sheet } = readSheetRows(file, cfg.defaultSheet);
  if (!rows.length) throw httpError(400, "No rows found in the uploaded file");

  const map = E.resolveHeaders(Object.keys(rows[0]), cfg.fields);
  const missing = E.missingRequired(map, cfg.fields);
  if (missing.length) {
    throw httpError(400, `This does not look like a tracker sheet. Missing column(s): ${missing.map((f) => f.headers.join(" / ")).join(", ")}`);
  }

  const ds = await CardTrackerDataset.create({ fileName: originalName, uploadedBy: userName(user) });
  try {
    const st = { total: 0, skipped: 0, min: null, max: null };
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      await CardTrackerJob.insertMany(batch, { ordered: false });
      batch = [];
    };
    for (let i = 0; i < rows.length; i++) {
      const rec = E.parseRow(rows[i], map, cfg.fields);
      if (!rec) { st.skipped++; continue; }
      st.total++;
      if (!st.min || rec.recv < st.min) st.min = rec.recv;
      if (!st.max || rec.recv > st.max) st.max = rec.recv;
      batch.push({ dataset: ds._id, rowNo: i, recv: rec.recv, ts: rec.ts, f: rec.f });
      if (batch.length >= 1000) await flush();
    }
    await flush();
    if (!st.total) throw httpError(400, "No usable rows found (check the received-date column)");

    const done = await CardTrackerDataset.findByIdAndUpdate(
      ds._id,
      { rowCount: st.total, skippedRows: st.skipped, minDate: st.min, maxDate: st.max, sheetName: sheet },
      { new: true }
    ).lean();
    return dsOut(done);
  } catch (err) {
    await CardTrackerJob.deleteMany({ dataset: ds._id }).catch(() => {});
    await CardTrackerDataset.deleteOne({ _id: ds._id }).catch(() => {});
    throw err;
  }
}

async function loadJobs(datasetId, cfg) {
  const id = oid(datasetId);
  const ds = await CardTrackerDataset.findById(id).lean();
  if (!ds) throw httpError(404, "Dataset not found");
  const rows = await CardTrackerJob.find({ dataset: id }).sort({ rowNo: 1 }).lean();
  return {
    ds: dsOut(ds),
    jobs: rows.map((r) => E.computeJob({ row_no: r.rowNo, recv: r.recv, ts: r.ts, f: r.f }, cfg)),
  };
}

/* =====================================================================
   ROUTES
   ===================================================================== */
router.use(protect);

const listDatasets = async () =>
  (await CardTrackerDataset.find().sort({ _id: -1 }).limit(50).lean()).map(dsOut);

// config + dataset list (the page calls this on open)
router.get("/config", ah(async (req, res) => {
  res.json({ configured: true, config: await getConfig(), datasets: await listDatasets() });
}));

// admin: save a customised configuration (validated) / go back to the built-in default
router.put("/config", needAdmin, ah(async (req, res) => {
  const cfg = clean(req.body);
  await CardTrackerConfig.updateOne({ key: "default" }, { $set: { value: cfg } }, { upsert: true });
  res.json({ ok: true, config: cfg });
}));
router.delete("/config", needAdmin, ah(async (req, res) => {
  await CardTrackerConfig.deleteOne({ key: "default" });
  res.json({ ok: true });
}));

router.post("/datasets", upload.single("file"), ah(async (req, res) => {
  if (!req.file) throw httpError(400, "No file received");
  const ext = path.extname(req.file.originalname).toLowerCase();
  try {
    if (![".xlsx", ".xlsm", ".xls", ".csv"].includes(ext)) throw httpError(400, "Upload an .xlsx, .xls or .csv file");
    const dataset = await ingestTrackerFile({ file: req.file.path, originalName: req.file.originalname, user: req.user, cfg: await getConfig() });
    res.json({ dataset });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
}));

router.delete("/datasets/:id", needAdmin, ah(async (req, res) => {
  const id = oid(req.params.id);
  const ds = await CardTrackerDataset.findByIdAndDelete(id);
  if (!ds) throw httpError(404, "Dataset not found");
  await CardTrackerJob.deleteMany({ dataset: id });
  res.json({ ok: true });
}));

router.get("/datasets/:id", ah(async (req, res) => {
  const { ds, jobs } = await loadJobs(req.params.id, await getConfig());
  res.json({
    dataset: ds, jobs, batches: E.batches(jobs), dispatches: E.dispatches(jobs),
    asOf: jobs.reduce((m, j) => (j.recv > m ? j.recv : m), ""),
  });
}));

router.post("/export", ah(async (req, res) => {
  const { datasetId, target, asOf } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf))) throw httpError(400, "Invalid as-of date");
  const cfg = await getConfig();
  const { jobs } = await loadJobs(datasetId, cfg);

  let out;
  if (target === "COMBINED") out = combinedWorkbook(jobs, cfg, asOf, { batches: E.batches(jobs), dispatches: E.dispatches(jobs) });
  else {
    const stage = cfg.stages.find((s) => s.key === target);
    if (!stage) throw httpError(400, "Unknown stage");
    out = stageWorkbook(jobs, cfg, stage, asOf);
  }
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Refreshed-Token"); // lets the page read the file name
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${out.fileName}"`);
  res.send(out.buffer);
}));

// JSON errors for this router only
router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File too large" });
  if (err.name === "CastError" || err.name === "ValidationError") return res.status(400).json({ error: err.message });
  if (!err.status) console.error("card-tracker error:", err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Server error" });
});

module.exports = router;
