import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

/* =====================================================================
   RAW MATERIAL & INK INDENT PORTAL  (React module)
   - Uploaded data, jobs, cart and indents are kept in this browser (localStorage).
   - Nothing is hard coded: materials, spec groups, plants, stock, open POs
     and job demand all come from the Excel sheets uploaded in
     "Settings & SAP"  (MB5B stock, ME2N pending POs, optional Job Demand).
   - Self-contained: no Tailwind / FontAwesome needed.
   - All styles are scoped with the "rmi-" prefix so they cannot clash
     with your Bootstrap theme. Change colours in the :root block of CSS.
   - Only dependency besides React: "xlsx"  (npm i xlsx)
   ===================================================================== */

const DEFAULT_SETTINGS = {
  workingDays: 26,
  targetCoverDays: 30,
  criticalDays: 12,
  lowDays: 22,
  overstockDays: 60,
  lotSize: 500,
  leadTimeDays: 10,
  mainPlant: "", // plant that gets 100% of demand by default ("" = first plant found in the sheets)
  plantSplits: {}, // { groupId: { plantCode: percent } }
};

/* ------------------------------- HELPERS ------------------------------ */
const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);

const formatNum = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Math.round(num).toLocaleString("en-IN");
};

const formatDec = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0.0";
  return (Math.round(num * 10) / 10).toLocaleString("en-IN");
};

const normTxt = (s) => String(s === null || s === undefined ? "" : s).trim().toLowerCase();
const cellTxt = (v) => String(v === null || v === undefined ? "" : v).trim();
const cleanCode = (v) => cellTxt(v).replace(/\.0+$/, "").replace(/^0+/, "");
const toNum = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(cellTxt(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};
const toISODate = (v) => {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return new Date(v.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  const t = cellTxt(v);
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return t;
};

/* ----------------------- BROWSER STORAGE + TOASTS --------------------- */
const STORAGE_KEY = "rmi-portal-v1";
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
const ToastCtx = createContext(() => {});
const useToast = () => useContext(ToastCtx);

/* --------------- SPEC GROUP DERIVED FROM THE MATERIAL DESCRIPTION ------- */
// Used only when the sheet has no "Spec group" column and no manual override was set.
const FAMILY_ORDER = ["Paper", "Ink", "Glue", "Film", "Other"];

function deriveGroup(desc) {
  const d = cellTxt(desc).toUpperCase();
  const gsmM = d.match(/(\d{2,3})\s*GSM/);
  if (gsmM) {
    const gsm = parseInt(gsmM[1]);
    let kind = "ART PAPER";
    if (/MICR/.test(d)) kind = "MICR PAPER";
    else if (/MAPLITHO|SILVERBRITE|CLASSIC|MAXIMA|CREAMWOVE|WOVE/.test(d)) kind = "MAPLITHO";
    else if (/BOARD|DUPLEX|SBS|FBB/.test(d)) kind = "BOARD";
    return { name: `${gsm} GSM ${kind}${/REEL/.test(d) ? " (REEL)" : ""}`, fam: "Paper", gsm };
  }
  if (/\bINK\b|THERMOCHROMIC|INVISIBLE/.test(d)) return { name: "INKS", fam: "Ink", gsm: 0 };
  if (/GLUE|FEVICOL|ADHESIVE|BINDING GUM|TURBO BOND|\bGUM\b/.test(d)) return { name: "GLUE & ADHESIVE", fam: "Glue", gsm: 0 };
  if (/FILM|BOPP|LAMINAT|THERMAL/.test(d)) return { name: "LAMINATION / BOPP FILM", fam: "Film", gsm: 0 };
  return { name: "OTHER MATERIALS", fam: "Other", gsm: 0 };
}

/* ----------------------- SAP SHEET PARSING (MB5B / ME2N / JOBS) ------- */
// For each field: label, required?, regexes tried in priority order, exclude regex
const SAP_FIELDS = {
  MB5B: {
    material: { label: "Material code", required: true, tests: [/^material( no\.?| number| code)?$/, /material/], exclude: /desc|text|type|group|doc/ },
    desc: { label: "Material description", required: false, tests: [/^material desc/, /description|short text|^text$/], exclude: /plant/ },
    plant: { label: "Plant", required: true, tests: [/^plant$/, /plant|werks/], exclude: /supplying/ },
    qty: { label: "Stock quantity", required: true, tests: [/closing|end(ing)? stock|final stock/, /total stock/, /unrestricted/, /stock/, /qty|quantity/], exclude: /value|price|amount|opening|begin|uom|unit/ },
    group: { label: "Spec group (optional)", required: false, tests: [/spec(ification)? group/], exclude: null },
  },
  ME2N: {
    poNo: { label: "PO number", required: false, tests: [/purchasing doc|purch\.? ?doc/, /^po( no\.?| number)?$/, /document/], exclude: /item|type|date/ },
    material: { label: "Material code", required: true, tests: [/^material( no\.?| number| code)?$/, /material/], exclude: /desc|text|type|group|doc/ },
    desc: { label: "Material description", required: false, tests: [/^material desc/, /short text|description/], exclude: /plant/ },
    plant: { label: "Plant", required: true, tests: [/^plant$/, /plant|werks/], exclude: /supplying/ },
    vendor: { label: "Vendor", required: false, tests: [/name of (supplier|vendor)/, /supplier|vendor/], exclude: /code|no\.?$/ },
    qty: { label: "Open / pending quantity", required: true, tests: [/still to be deliv|open (qty|quantity)|to be deliv|outstanding/, /sched(uled)? qty|schedule.*qty/, /order (qty|quantity)|po qty/, /quantity|qty/], exclude: /price|value|amount|net|uom|unit/ },
    date: { label: "Delivery date (ETA)", required: false, tests: [/delivery date|del\.? ?date|deliv.*date/, /eta|schedule.*date/, /date/], exclude: /doc|creat|posting/ },
    group: { label: "Spec group (optional)", required: false, tests: [/spec(ification)? group/], exclude: null },
  },
  JOBS: {
    job: { label: "Job title / customer", required: true, tests: [/job/, /customer|title|name/], exclude: /group|material|code/ },
    target: { label: "Spec group or material code", required: true, tests: [/spec(ification)? group/, /material (code|no)|^material$/, /group|material|code|spec/], exclude: /desc/ },
    kg: { label: "Monthly requirement (KG)", required: true, tests: [/monthly|per month/, /kg|demand|qty|quantity|req/], exclude: null },
  },
};

const SHEET_TITLES = {
  MB5B: "MB5B stock sheet",
  ME2N: "ME2N pending PO sheet",
  JOBS: "Job demand sheet",
};

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

// Reads the first sheet, finds the header row and returns the rows below it
function readSapSheet(arrayBuffer, type) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const hint = type === "JOBS" ? /job|customer|title|kg|demand|group|material/ : /material/;
  const minCells = type === "JOBS" ? 2 : 3;
  let headerIdx = grid.findIndex(
    (row, i) => i < 25 && row.some((c) => hint.test(normTxt(c))) && row.filter((c) => c !== "").length >= minCells
  );
  if (headerIdx < 0) headerIdx = 0;
  const headers = (grid[headerIdx] || []).map((h) => cellTxt(h));
  const rows = grid.slice(headerIdx + 1).filter((r) => r.some((c) => c !== ""));
  return { headers, rows, map: detectColumns(type, headers) };
}

/* --------------------------- CALCULATION ENGINE ----------------------- */
function calculateGroupHealth(group, appSettings, jobList, pendingPOs, plants) {
  const matCodes = group.mats.map((m) => m.c);

  const plantStock = {};
  const plantPending = {};
  plants.forEach((p) => {
    plantStock[p] = 0;
    plantPending[p] = 0;
  });

  group.mats.forEach((m) => {
    plants.forEach((p) => {
      plantStock[p] += m.st && m.st[p] ? m.st[p] : 0;
    });
  });

  pendingPOs.forEach((po) => {
    if (matCodes.includes(po.m)) {
      plantPending[po.p] = (plantPending[po.p] || 0) + po.q;
    }
  });

  const monthlyReq = jobList
    .filter((j) => j.groupGroupId === group.id)
    .reduce((acc, j) => acc + (j.kg || 0), 0);

  const totalStock = sum(plantStock);
  const totalPending = sum(plantPending);
  const totalAvailable = totalStock + totalPending;

  const dailyReq = monthlyReq > 0 ? monthlyReq / appSettings.workingDays : 0;
  const daysCoverStockOnly = dailyReq > 0 ? totalStock / dailyReq : null;
  const daysCoverWithPending = dailyReq > 0 ? totalAvailable / dailyReq : null;

  let status = "Balanced";
  if (monthlyReq === 0) status = "No Demand";
  else if (daysCoverWithPending < appSettings.criticalDays) status = "Critical";
  else if (daysCoverWithPending < appSettings.lowDays) status = "Low";
  else if (daysCoverWithPending > appSettings.overstockDays) status = "Overstocked";

  const mainPlant = plants.includes(appSettings.mainPlant) ? appSettings.mainPlant : plants[0];
  const customSplits = appSettings.plantSplits[group.id] || (mainPlant ? { [mainPlant]: 100 } : {});
  const totalSplitWeight = sum(customSplits) || 100;

  const plantBreakdown = {};
  let totalIndentRequired = 0;
  const targetBufferPerGroup = dailyReq * appSettings.targetCoverDays;

  plants.forEach((p) => {
    const share = (customSplits[p] || 0) / totalSplitWeight;
    const plantTargetNeed = targetBufferPerGroup * share;
    const plantAvail = plantStock[p] + plantPending[p];
    const rawDeficit = Math.max(0, plantTargetNeed - plantAvail);

    let recommendedIndent = 0;
    if (rawDeficit > 0) {
      const lot = group.fam === "Ink" ? 5 : appSettings.lotSize;
      recommendedIndent = Math.ceil(rawDeficit / lot) * lot;
    }

    plantBreakdown[p] = {
      stock: plantStock[p],
      pending: plantPending[p],
      targetNeed: plantTargetNeed,
      deficit: rawDeficit,
      indent: recommendedIndent,
      surplus: Math.max(0, plantAvail - plantTargetNeed),
    };
    totalIndentRequired += recommendedIndent;
  });

  return {
    group, monthlyReq, totalStock, totalPending, totalAvailable,
    daysCoverStockOnly, daysCoverWithPending, status, plantBreakdown,
    totalIndentRequired, plantSplits: customSplits,
  };
}

/* -------------------------------- ICONS ------------------------------- */
const ICONS = {
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  "arrow-up": '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  "arrow-down": '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      className="rmi-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

/* ------------------------------ STATUS BADGE -------------------------- */
function StatusBadge({ status }) {
  const map = {
    Critical: ["rmi-b-critical", "CRITICAL"],
    Low: ["rmi-b-low", "LOW"],
    Balanced: ["rmi-b-ok", "BALANCED"],
    Overstocked: ["rmi-b-over", "OVERSTOCK"],
  };
  const [cls, label] = map[status] || ["rmi-b-none", "NO DEMAND"];
  return <span className={`rmi-badge ${cls}`}>{label}</span>;
}

/* ------------------------------ SMALL UI PARTS ------------------------ */
const statusClass = (status) => String(status).toLowerCase().replace(/\s+/g, "");

function FilePick({ onFile, children, className }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current && ref.current.click()}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </>
  );
}

function DropZone({ type, title, hint, log, busy, onFile, step }) {
  const [over, setOver] = useState(false);
  const ref = useRef(null);
  const pick = () => ref.current && ref.current.click();
  return (
    <div
      className={`rmi-drop ${over ? "over" : ""} ${log ? "done" : ""}`}
      role="button"
      tabIndex={0}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f, type);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (f) onFile(f, type);
        }}
      />
      <div className="rmi-drop-icon">
        <Icon name={log ? "check" : "upload"} size={20} />
      </div>
      <div className="rmi-drop-text">
        <div className="rmi-drop-title">
          {step ? <span className="rmi-step">{step}</span> : null}
          {title}
        </div>
        {busy ? (
          <div className="rmi-drop-hint">Reading file...</div>
        ) : log ? (
          <>
            <div className="rmi-drop-hint">
              <strong>{log.fileName}</strong> &bull; {log.at}
            </div>
            <div className="rmi-drop-hint">
              {formatNum(log.used)} rows used{log.extra ? ` (${log.extra})` : ""}
              {log.skipped > 0 ? ` \u2022 ${formatNum(log.skipped)} skipped` : ""}
            </div>
            {log.unmatched && log.unmatched.length > 0 && (
              <div className="rmi-drop-hint rmi-red">
                {log.unmatched.length} job target(s) not found: {log.unmatched.slice(0, 5).join(", ")}
                {log.unmatched.length > 5 ? " ..." : ""}
              </div>
            )}
            <div className="rmi-drop-action">Drop or click to replace</div>
          </>
        ) : (
          <>
            <div className="rmi-drop-hint">{hint}</div>
            <div className="rmi-drop-action">Drop a file here or click to choose</div>
          </>
        )}
      </div>
    </div>
  );
}

function CoverBar({ days, status, appSettings }) {
  if (days === null || days === undefined) return <span className="rmi-faint">-</span>;
  const max = Math.max(appSettings.overstockDays * 1.25, 1);
  const pct = Math.min(100, (days / max) * 100);
  return (
    <div className="rmi-cover">
      <span className="rmi-cover-num">{formatDec(days)} d</span>
      <div className="rmi-bar" aria-hidden="true">
        <i className={`rmi-fill s-${statusClass(status)}`} style={{ width: `${pct}%` }} />
        <b style={{ left: `${Math.min(100, (appSettings.criticalDays / max) * 100)}%` }} />
        <b style={{ left: `${Math.min(100, (appSettings.lowDays / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function ToastStack({ toasts, onClose }) {
  return (
    <div className="rmi-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`rmi-toast t-${t.type}`}>
          <span>{t.msg}</span>
          {t.actionLabel && (
            <button
              className="rmi-toast-act"
              onClick={() => {
                t.onAction && t.onAction();
                onClose(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
          <button className="rmi-toast-x" onClick={() => onClose(t.id)} aria-label="Dismiss">
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ----------------------- COLUMN CONFIRMATION DIALOG ------------------- */
function ImportModal({ draft, onColumn, onApply, onCancel }) {
  const fields = Object.entries(SAP_FIELDS[draft.type]);
  const missing = fields.filter(([key, rule]) => rule.required && draft.map[key] < 0);
  const mapped = fields.filter(([key]) => draft.map[key] >= 0);
  const preview = draft.rows.slice(0, 3);

  return (
    <div className="rmi-modal-back" onClick={onCancel}>
      <div className="rmi-modal" role="dialog" aria-modal="true" aria-label="Confirm columns" onClick={(e) => e.stopPropagation()}>
        <div className="rmi-modal-head">
          <div>
            <h3>Check the columns</h3>
            <p>
              {SHEET_TITLES[draft.type]} &bull; {draft.fileName} &bull; {formatNum(draft.rows.length)} rows
            </p>
          </div>
          <button className="rmi-iconbtn" onClick={onCancel} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="rmi-modal-body">
          <div className={`rmi-detect ${missing.length ? "bad" : "good"}`}>
            <Icon name={missing.length ? "alert" : "check"} size={16} />
            {missing.length
              ? `Choose the column for: ${missing.map(([, r]) => r.label).join(", ")}.`
              : "All required columns were found. Review them below, then apply."}
          </div>

          <div className="rmi-form3">
            {fields.map(([key, rule]) => (
              <div key={key}>
                <label>
                  {rule.label}
                  {rule.required ? " *" : ""}
                </label>
                <select
                  className={`rmi-input w100 ${rule.required && draft.map[key] < 0 ? "rmi-invalid" : ""}`}
                  value={draft.map[key]}
                  onChange={(e) => onColumn(key, e.target.value)}
                >
                  <option value={-1}>- not in sheet -</option>
                  {draft.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `(column ${i + 1})`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {mapped.length > 0 && preview.length > 0 && (
            <div>
              <div className="rmi-sec-head">
                <h4>Preview of the first {preview.length} rows</h4>
              </div>
              <div className="rmi-tablewrap">
                <table className="rmi-table rmi-table-sm">
                  <thead>
                    <tr>
                      {mapped.map(([key, rule]) => (
                        <th key={key}>{rule.label.replace(" (optional)", "")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>
                        {mapped.map(([key]) => {
                          const v = r[draft.map[key]];
                          return <td key={key}>{v instanceof Date ? toISODate(v) : cellTxt(v) || "-"}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="rmi-modal-foot">
          <button className="rmi-btn rmi-btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button className="rmi-btn rmi-btn-primary" onClick={onApply} disabled={missing.length > 0}>
            <Icon name="check" size={14} /> Apply {SHEET_TITLES[draft.type]}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================ FIRST-RUN GUIDE ====================== */
function SetupGuide({ importLog, reading, onFile }) {
  return (
    <div className="rmi-guide">
      <h3 className="rmi-guide-title">Load your SAP sheets to start planning</h3>
      <p className="rmi-guide-sub">
        Everything in this portal is built from your Excel files. Drag a file onto a card or click it. You will check
        the detected columns before anything is applied.
      </p>
      <div className="rmi-guide-grid">
        <DropZone
          step="1"
          type="MB5B"
          title="Stock sheet (MB5B)"
          hint="Materials, descriptions and stock per plant. Start here."
          log={importLog.MB5B}
          busy={reading === "MB5B"}
          onFile={onFile}
        />
        <DropZone
          step="2"
          type="ME2N"
          title="Pending POs (ME2N)"
          hint="Material already on order, with vendor and delivery date."
          log={importLog.ME2N}
          busy={reading === "ME2N"}
          onFile={onFile}
        />

      </div>
    </div>
  );
}

/* ================================ MAIN ================================= */
export default function RawMaterialIndent() {
  const saved = useRef(loadSaved()).current;

  const [activeTab, setActiveTab] = useState("board");
  const [appSettings, setAppSettings] = useState({ ...DEFAULT_SETTINGS, ...(saved.appSettings || {}) });
  const [jobList, setJobList] = useState(saved.jobList || []); // from Job Demand sheet or added by hand
  const [indentCart, setIndentCart] = useState(saved.indentCart || []);
  const [indentRegister, setIndentRegister] = useState(saved.indentRegister || []);
  const indentSeq = useRef(saved.indentSeq || 1001);

  /* ---- data coming from the uploaded sheets ---- */
  const [stockMap, setStockMap] = useState(saved.stockMap || {}); // MB5B: { code: { plant: qty } }
  const [mbInfo, setMbInfo] = useState(saved.mbInfo || {}); // MB5B: { code: { desc, group } }
  const [pendingPOs, setPendingPOs] = useState(saved.pendingPOs || []); // ME2N lines
  const [meInfo, setMeInfo] = useState(saved.meInfo || {}); // ME2N: { code: { desc, group } }
  const [groupOverride, setGroupOverride] = useState(saved.groupOverride || {}); // manual { code: groupName }
  const [importLog, setImportLog] = useState(saved.importLog || {}); // last applied upload per sheet type
  const [importDraft, setImportDraft] = useState(null); // sheet read but not applied yet
  const [reading, setReading] = useState(""); // sheet type being read right now

  const [filters, setFilters] = useState({ search: "", family: "", status: "", onlyShortage: false });
  const [drawerGroupId, setDrawerGroupId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ---- toasts ---- */
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const closeToast = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  const notify = useCallback((msg, opts = {}) => {
    const id = ++toastId.current;
    setToasts((p) => [...p.slice(-3), { id, msg, type: opts.type || "info", actionLabel: opts.actionLabel, onAction: opts.onAction }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), opts.duration || 6000);
  }, []);

  /* ---- keep everything in this browser so a refresh does not lose it ---- */
  const saveFailed = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            appSettings, jobList, indentCart, indentRegister, indentSeq: indentSeq.current,
            stockMap, mbInfo, pendingPOs, meInfo, groupOverride, importLog,
          })
        );
        saveFailed.current = false;
      } catch (e) {
        if (!saveFailed.current) {
          saveFailed.current = true;
          notify("Could not save data in this browser. It will be lost on refresh.", { type: "warn" });
        }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [appSettings, jobList, indentCart, indentRegister, stockMap, mbInfo, pendingPOs, meInfo, groupOverride, importLog, notify]);

  /* ---- Esc closes the open dialog or drawer ---- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (importDraft) setImportDraft(null);
      else if (drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importDraft, drawerOpen]);

  /* ---- plants found in the sheets ---- */
  const plants = useMemo(() => {
    const set = new Set();
    Object.values(stockMap).forEach((byPlant) => Object.keys(byPlant).forEach((p) => set.add(p)));
    pendingPOs.forEach((po) => set.add(po.p));
    return Array.from(set).sort();
  }, [stockMap, pendingPOs]);

  /* ---- material catalog + spec groups built from the sheets ---- */
  const catalog = useMemo(() => {
    const codes = new Set([
      ...Object.keys(stockMap),
      ...Object.keys(mbInfo),
      ...Object.keys(meInfo),
      ...pendingPOs.map((po) => po.m),
    ]);
    const groups = {};
    codes.forEach((code) => {
      const desc = (mbInfo[code] && mbInfo[code].desc) || (meInfo[code] && meInfo[code].desc) || "";
      const sheetGroup = (mbInfo[code] && mbInfo[code].group) || (meInfo[code] && meInfo[code].group) || "";
      const derived = deriveGroup(desc);
      const chosen = groupOverride[code] || sheetGroup;
      const name = chosen || derived.name;
      const fromName = chosen ? deriveGroup(chosen) : derived;
      const fam = fromName.fam !== "Other" ? fromName.fam : derived.fam;
      const gsm = fromName.gsm || derived.gsm;
      if (!groups[name]) groups[name] = { id: name, cat: name, fam, gsm, lead: "", mats: [] };
      groups[name].mats.push({ c: code, s: desc || code, st: stockMap[code] || {}, auto: !chosen });
    });
    return Object.values(groups)
      .map((g) => {
        const mats = g.mats.sort((a, b) => a.c.localeCompare(b.c));
        return { ...g, mats, lead: mats[0].s };
      })
      .sort(
        (a, b) =>
          FAMILY_ORDER.indexOf(a.fam) - FAMILY_ORDER.indexOf(b.fam) ||
          b.gsm - a.gsm ||
          a.cat.localeCompare(b.cat)
      );
  }, [stockMap, mbInfo, meInfo, pendingPOs, groupOverride]);

  const allHealth = useMemo(
    () => catalog.map((g) => calculateGroupHealth(g, appSettings, jobList, pendingPOs, plants)),
    [catalog, appSettings, jobList, pendingPOs, plants]
  );

  const vendors = useMemo(
    () => Array.from(new Set(pendingPOs.map((po) => po.v).filter(Boolean))).sort(),
    [pendingPOs]
  );

  /* ---- drawer ---- */
  const openMaterialDrawer = (groupId) => {
    setDrawerGroupId(groupId);
    setDrawerOpen(true);
  };
  const closeDrawer = () => setDrawerOpen(false);

  /* ---- plant split ---- */
  const updatePlantSplit = (groupId, plant, value) => {
    setAppSettings((prev) => {
      const mainPlant = plants.includes(prev.mainPlant) ? prev.mainPlant : plants[0];
      const current = prev.plantSplits[groupId] || (mainPlant ? { [mainPlant]: 100 } : {});
      return {
        ...prev,
        plantSplits: {
          ...prev.plantSplits,
          [groupId]: { ...current, [plant]: parseFloat(value) || 0 },
        },
      };
    });
  };

  /* ---- cart ---- */
  const upsertCart = (prev, groupId, plant, qty) => {
    const idx = prev.findIndex((c) => c.groupId === groupId && c.plant === plant);
    if (idx >= 0) {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty };
      return copy;
    }
    return [
      ...prev,
      {
        groupId,
        plant,
        qty,
        vendor: "",
        requiredBy: new Date(Date.now() + appSettings.leadTimeDays * 86400000)
          .toISOString()
          .slice(0, 10),
        notes: "",
      },
    ];
  };

  const addToCartSingle = (groupId, plant, qty) => {
    setIndentCart((prev) => upsertCart(prev, groupId, plant, qty));
    notify(`Added ${formatNum(qty)} KG for plant ${plant} to the cart`, {
      type: "success",
      actionLabel: "View cart",
      onAction: () => setActiveTab("cart"),
    });
  };

  const addGroupShortages = (h) => {
    const lines = plants
      .filter((p) => h.plantBreakdown[p].indent > 0)
      .map((p) => [h.group.id, p, h.plantBreakdown[p].indent]);
    if (lines.length === 0) {
      notify("Nothing to indent for this spec group.");
      return;
    }
    setIndentCart((prev) => lines.reduce((acc, [g, p, q]) => upsertCart(acc, g, p, q), prev));
    notify(`${lines.length} line${lines.length === 1 ? "" : "s"} from ${h.group.cat} added to the cart`, {
      type: "success",
      actionLabel: "View cart",
      onAction: () => setActiveTab("cart"),
    });
  };

  const addAllShortagesToCart = () => {
    const lines = [];
    allHealth.forEach((h) => {
      plants.forEach((p) => {
        const pb = h.plantBreakdown[p];
        if (pb.indent > 0) lines.push([h.group.id, p, pb.indent]);
      });
    });

    if (lines.length === 0) {
      notify("No material shortages detected requiring indenting.");
      return;
    }
    setIndentCart((prev) => lines.reduce((acc, [g, p, q]) => upsertCart(acc, g, p, q), prev));
    notify(`${lines.length} shortage lines added to the cart`, { type: "success" });
    setActiveTab("cart");
  };

  const updateCartLine = (i, patch) =>
    setIndentCart((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const removeCartLine = (i) => {
    const line = indentCart[i];
    if (!line) return;
    setIndentCart((prev) => prev.filter((_, idx) => idx !== i));
    notify("Line removed from the cart", {
      actionLabel: "Undo",
      onAction: () =>
        setIndentCart((prev) => {
          const copy = [...prev];
          copy.splice(Math.min(i, copy.length), 0, line);
          return copy;
        }),
    });
  };

  const clearCart = () => {
    const before = indentCart;
    setIndentCart([]);
    notify("Cart cleared", { actionLabel: "Undo", onAction: () => setIndentCart(before) });
  };

  const raiseOfficialIndent = () => {
    if (indentCart.length === 0) return;
    const indentNo = `IND-${indentSeq.current++}`;
    const newIndent = {
      indentNo,
      date: new Date().toISOString().slice(0, 10),
      status: "Draft",
      lines: [...indentCart],
      totalKG: indentCart.reduce((a, c) => a + c.qty, 0),
    };
    setIndentRegister((prev) => [newIndent, ...prev]);
    setIndentCart([]);
    setActiveTab("register");
    notify(`Indent ${indentNo} raised as Draft`, { type: "success" });
  };

  const setIndentStatus = (idx, status) =>
    setIndentRegister((prev) => prev.map((r, i) => (i === idx ? { ...r, status } : r)));

  const exportIndentToExcel = (index) => {
    const indent = indentRegister[index];
    const data = indent.lines.map((l) => {
      const group = catalog.find((g) => g.id === l.groupId);
      return {
        "Indent Number": indent.indentNo,
        "Indent Date": indent.date,
        Status: indent.status,
        "Material Specification": group ? group.cat : l.groupId,
        "Plant Location": l.plant,
        "Quantity (KG)": l.qty,
        Vendor: l.vendor,
        "Required By": l.requiredBy,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Material Indent");
    XLSX.writeFile(wb, `${indent.indentNo}_Material_Indent.xlsx`);
  };

  /* ---- jobs ---- */
  const addJob = (name, groupId, kg) => {
    setJobList((prev) => [...prev, { id: Date.now(), name, groupGroupId: groupId, kg }]);
    notify(`Job "${name}" added`, { type: "success" });
  };

  const updateJob = (id, key, value) =>
    setJobList((prev) => prev.map((j) => (j.id === id ? { ...j, [key]: value } : j)));

  const deleteJob = (id) => {
    const idx = jobList.findIndex((j) => j.id === id);
    const job = jobList[idx];
    if (!job) return;
    setJobList((prev) => prev.filter((j) => j.id !== id));
    notify(`Job "${job.name}" removed`, {
      actionLabel: "Undo",
      onAction: () =>
        setJobList((prev) => {
          const copy = [...prev];
          copy.splice(Math.min(idx, copy.length), 0, job);
          return copy;
        }),
    });
  };

  const shiftJobDemand = (jobId, targetGroupId, shiftPctRaw) => {
    const job = jobList.find((j) => j.id === jobId);
    if (!job) return;
    if (targetGroupId === job.groupGroupId) {
      notify("The target spec group is the same as the current one.", { type: "warn" });
      return;
    }
    const shiftedKg = Math.round(job.kg * (shiftPctRaw / 100));
    setJobList((prev) => [
      ...prev.map((j) => (j.id === jobId ? { ...j, kg: j.kg - shiftedKg } : j)),
      {
        id: Date.now(),
        name: `${job.name} (Shifted Spec)`,
        groupGroupId: targetGroupId,
        kg: shiftedKg,
      },
    ]);
    notify(`${formatNum(shiftedKg)} KG shifted to ${targetGroupId}`, { type: "success" });
  };

  /* ---- manual spec group for one material ---- */
  const setMaterialGroup = (code, name) =>
    setGroupOverride((prev) => {
      const next = { ...prev };
      if (name) next[code] = name;
      else delete next[code];
      return next;
    });

  /* ---- sheet upload (step 1: read file, detect columns) ---- */
  const handleSapFile = (file, type) => {
    if (!file) return;
    if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name)) {
      notify("Please choose an Excel file (.xlsx or .xls).", { type: "warn" });
      return;
    }
    setReading(type);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = readSapSheet(ev.target.result, type);
        setImportDraft({ type, fileName: file.name, ...parsed });
      } catch (err) {
        notify("Error parsing Excel file. Please ensure standard SAP layout.", { type: "warn" });
      }
      setReading("");
    };
    reader.onerror = () => {
      setReading("");
      notify("Could not read that file.", { type: "warn" });
    };
    reader.readAsArrayBuffer(file);
  };

  const setDraftColumn = (field, value) =>
    setImportDraft((d) => ({ ...d, map: { ...d.map, [field]: parseInt(value) } }));

  /* ---- sheet upload (step 2: apply the mapped columns) ---- */
  const applyImport = () => {
    if (!importDraft) return;
    const { type, rows, map, fileName } = importDraft;
    const col = (r, key) => (map[key] >= 0 ? r[map[key]] : "");
    let used = 0;
    let skipped = 0;
    let unmatched = [];
    let extra = "";
    let commit = () => {};

    if (type === "MB5B") {
      const stock = {};
      const info = {};
      rows.forEach((r) => {
        const code = cleanCode(col(r, "material"));
        const plant = cellTxt(col(r, "plant"));
        if (!code || !plant) {
          skipped++;
          return;
        }
        stock[code] = stock[code] || {};
        stock[code][plant] = (stock[code][plant] || 0) + toNum(col(r, "qty"));
        info[code] = info[code] || { desc: "", group: "" };
        if (cellTxt(col(r, "desc"))) info[code].desc = cellTxt(col(r, "desc"));
        if (cellTxt(col(r, "group"))) info[code].group = cellTxt(col(r, "group"));
        used++;
      });
      extra = `${Object.keys(info).length} materials`;
      commit = () => {
        setStockMap(stock);
        setMbInfo(info);
      };
    } else if (type === "ME2N") {
      const list = [];
      const info = {};
      rows.forEach((r) => {
        const code = cleanCode(col(r, "material"));
        const plant = cellTxt(col(r, "plant"));
        const qty = toNum(col(r, "qty"));
        if (!code || !plant || qty <= 0) {
          skipped++;
          return;
        }
        list.push({
          m: code,
          p: plant,
          poNo: map.poNo >= 0 ? cellTxt(col(r, "poNo")) : "-",
          v: cellTxt(col(r, "vendor")),
          q: qty,
          e: toISODate(col(r, "date")),
        });
        info[code] = info[code] || { desc: "", group: "" };
        if (cellTxt(col(r, "desc"))) info[code].desc = cellTxt(col(r, "desc"));
        if (cellTxt(col(r, "group"))) info[code].group = cellTxt(col(r, "group"));
        used++;
      });
      extra = `${new Set(list.map((l) => l.m)).size} materials`;
      commit = () => {
        setPendingPOs(list);
        setMeInfo(info);
      };
    } else {
      // JOBS: link every row to a spec group (by group name or by a material code in the group)
      const codeToGroup = {};
      const nameToGroup = {};
      catalog.forEach((g) => {
        nameToGroup[g.cat.toLowerCase()] = g.id;
        g.mats.forEach((m) => {
          codeToGroup[m.c] = g.id;
        });
      });
      const missing = new Set();
      const jobs = [];
      rows.forEach((r, i) => {
        const name = cellTxt(col(r, "job"));
        const target = cellTxt(col(r, "target"));
        const kg = toNum(col(r, "kg"));
        if (!name || !kg) {
          skipped++;
          return;
        }
        const gid = codeToGroup[cleanCode(target)] || nameToGroup[target.toLowerCase()];
        if (!gid) {
          missing.add(target || "(blank)");
          return;
        }
        jobs.push({ id: Date.now() + i, name, groupGroupId: gid, kg });
        used++;
      });
      unmatched = Array.from(missing);
      extra = `${jobs.length} jobs`;
      commit = () => setJobList(jobs);
    }

    if (used === 0) {
      notify(`No usable rows found in ${fileName}. Check the column choices and try again.`, { type: "warn" });
      return;
    }

    commit();
    setImportLog((prev) => ({
      ...prev,
      [type]: {
        fileName,
        at: new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        totalRows: rows.length,
        used,
        skipped,
        extra,
        unmatched,
      },
    }));
    setImportDraft(null);
    notify(`${SHEET_TITLES[type]} loaded: ${formatNum(used)} rows (${extra})`, { type: "success" });
  };

  const setSetting = (key, value) => setAppSettings((prev) => ({ ...prev, [key]: value }));

  const resetAll = () => {
    if (!window.confirm("Clear all uploaded sheets, jobs, cart, indents and settings from this browser?")) return;
    setStockMap({});
    setMbInfo({});
    setPendingPOs([]);
    setMeInfo({});
    setGroupOverride({});
    setJobList([]);
    setIndentCart([]);
    setIndentRegister([]);
    setImportLog({});
    setAppSettings(DEFAULT_SETTINGS);
    indentSeq.current = 1001;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    notify("All data cleared.");
  };

  /* ---- KPIs ---- */
  const hasMaterials = allHealth.length > 0;
  const totalStockKG = allHealth.reduce((a, c) => a + c.totalStock, 0);
  const totalPendingKG = allHealth.reduce((a, c) => a + c.totalPending, 0);
  const totalMonthlyReqKG = allHealth.reduce((a, c) => a + c.monthlyReq, 0);
  const criticalCount = allHealth.filter((c) => c.status === "Critical" || c.status === "Low").length;
  const totalIndentNeededKG = allHealth.reduce((a, c) => a + c.totalIndentRequired, 0);
  const dash = (v) => (hasMaterials ? v : "-");

  const kpis = [
    { title: "Current stock", val: dash(`${formatNum(totalStockKG)} KG`), sub: `Across ${plants.length} plant${plants.length === 1 ? "" : "s"}`, icon: "package", tone: "teal" },
    { title: "Pending delivery", val: dash(`${formatNum(totalPendingKG)} KG`), sub: "Open purchase orders", icon: "truck", tone: "blue" },
    { title: "Monthly demand", val: dash(`${formatNum(totalMonthlyReqKG)} KG`), sub: `${jobList.length} job${jobList.length === 1 ? "" : "s"} allocated`, icon: "trend", tone: "green" },
    { title: "Critical / low", val: dash(`${criticalCount} group${criticalCount === 1 ? "" : "s"}`), sub: `Under ${appSettings.lowDays} days of cover`, icon: "alert", tone: hasMaterials && criticalCount > 0 ? "red" : "green" },
    { title: "Recommended indent", val: dash(`${formatNum(totalIndentNeededKG)} KG`), sub: "To reach the target buffer", icon: "cart", tone: "gold" },
  ];

  const tabs = [
    { id: "board", label: "Planning Board", icon: "grid", badge: hasMaterials && criticalCount > 0 ? criticalCount : 0, badgeTone: "red" },
    { id: "jobs", label: "Job Demand", icon: "layers", badge: 0 },
    { id: "register", label: "Indent Register", icon: "file", badge: 0 },
    { id: "settings", label: "Data & Settings", icon: "sliders", badge: 0 },
  ];

  const selectNumber = (e) => {
    if (e.target && e.target.type === "number" && e.target.select) e.target.select();
  };

  /* ================================ RENDER ============================= */
  return (
    <ToastCtx.Provider value={notify}>
      <div className="rmi-root" onFocus={selectNumber}>
        <style>{CSS}</style>

        {/* ---------- Header ---------- */}
        <div className="rmi-header">

          <button className="rmi-btn rmi-btn-gold rmi-cart-btn" onClick={() => setActiveTab("cart")}>
            <Icon name="cart" />
            <span>Indent cart</span>
            <span className="rmi-cart-badge">{indentCart.length}</span>
          </button>
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="rmi-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`rmi-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
              {t.badge > 0 && <span className={`rmi-tab-badge b-${t.badgeTone}`}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* ---------- KPI cards ---------- */}
        <div className="rmi-kpis">
          {kpis.map((k) => (
            <div className="rmi-kpi" key={k.title}>
              <div className="rmi-kpi-top">
                <span className="rmi-kpi-title">{k.title}</span>
                <span className={`rmi-kpi-icon tone-${k.tone}`}>
                  <Icon name={k.icon} />
                </span>
              </div>
              <div className="rmi-kpi-val">{k.val}</div>
              <div className="rmi-kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ---------- Tab content ---------- */}
        <div className="rmi-panel">
          {activeTab === "board" &&
            (hasMaterials ? (
              <PlanningBoard
                allHealth={allHealth}
                jobList={jobList}
                filters={filters}
                setFilters={setFilters}
                appSettings={appSettings}
                plants={plants}
                importLog={importLog}
                cart={indentCart}
                onOpen={openMaterialDrawer}
                onAddAll={addAllShortagesToCart}
                onAddGroup={addGroupShortages}
                onGoTab={setActiveTab}
              />
            ) : (
              <SetupGuide importLog={importLog} reading={reading} onFile={handleSapFile} />
            ))}
          {activeTab === "jobs" && (
            <JobPlanner
              groups={catalog}
              jobList={jobList}
              onAdd={addJob}
              onUpdate={updateJob}
              onDelete={deleteJob}
              onShift={shiftJobDemand}
            />
          )}
          {activeTab === "cart" && (
            <IndentCart
              cart={indentCart}
              groups={catalog}
              vendors={vendors}
              onGoBoard={() => setActiveTab("board")}
              onClear={clearCart}
              onRaise={raiseOfficialIndent}
              onUpdate={updateCartLine}
              onRemove={removeCartLine}
            />
          )}
          {activeTab === "register" && (
            <IndentRegister
              register={indentRegister}
              groups={catalog}
              onStatus={setIndentStatus}
              onExport={exportIndentToExcel}
            />
          )}
          {activeTab === "settings" && (
            <SettingsPage
              appSettings={appSettings}
              setSetting={setSetting}
              plants={plants}
              catalog={catalog}
              importLog={importLog}
              reading={reading}
              onFile={handleSapFile}
              onMaterialGroup={setMaterialGroup}
              onReset={resetAll}
            />
          )}
        </div>

        {/* ---------- Footer ---------- */}
        <div className="rmi-footer">
          <div>
            <strong>Raw Material Indenting System</strong> &bull; Plants: {plants.length ? plants.join(", ") : "none loaded yet"}
          </div>
          <div>
            Target buffer <strong>{appSettings.targetCoverDays} days</strong> &bull; Lot rounding{" "}
            <strong>{appSettings.lotSize} KG</strong>
          </div>
        </div>

        {/* ---------- Drawer ---------- */}
        <div className={`rmi-backdrop ${drawerOpen ? "open" : ""}`} onClick={closeDrawer}>
          <div className="rmi-drawer" role="dialog" aria-modal="true" aria-label="Spec group details" onClick={(e) => e.stopPropagation()}>
            {drawerGroupId !== null && (
              <MaterialDrawer
                health={allHealth.find((h) => h.group.id === drawerGroupId)}
                appSettings={appSettings}
                pendingPOs={pendingPOs}
                plants={plants}
                cart={indentCart}
                onClose={closeDrawer}
                onSplit={updatePlantSplit}
                onAddToCart={addToCartSingle}
                onAddGroup={addGroupShortages}
              />
            )}
          </div>
        </div>

        {importDraft && (
          <ImportModal
            draft={importDraft}
            onColumn={setDraftColumn}
            onApply={applyImport}
            onCancel={() => setImportDraft(null)}
          />
        )}

        <ToastStack toasts={toasts} onClose={closeToast} />
      </div>
    </ToastCtx.Provider>
  );
}

/* ============================ PLANNING BOARD =========================== */
const STATUS_ORDER = ["Critical", "Low", "Balanced", "Overstocked", "No Demand"];
const STATUS_LABEL = {
  Critical: "Critical",
  Low: "Low",
  Balanced: "Balanced",
  Overstocked: "Overstock",
  "No Demand": "No demand",
};

function PlanningBoard({
  allHealth, jobList, filters, setFilters, appSettings, plants, importLog, cart,
  onOpen, onAddAll, onAddGroup, onGoTab,
}) {
  const [sort, setSort] = useState({ key: "status", dir: "asc" });

  const jobsFor = (groupId) =>
    jobList.filter((j) => j.groupGroupId === groupId).map((j) => j.name).join(", ");
  const families = Array.from(new Set(allHealth.map((h) => h.group.fam)));
  const num = (v) => (v === null || v === undefined ? Infinity : v);

  const counts = { "": allHealth.length };
  STATUS_ORDER.forEach((s) => {
    counts[s] = allHealth.filter((h) => h.status === s).length;
  });

  const filtered = allHealth.filter((h) => {
    const matchesSearch =
      !filters.search ||
      (
        h.group.cat + " " + h.group.lead + " " + jobsFor(h.group.id) + " " +
        h.group.mats.map((m) => m.c + m.s).join(" ")
      )
        .toLowerCase()
        .includes(filters.search.toLowerCase());
    const matchesFam = !filters.family || h.group.fam === filters.family;
    const matchesStatus = !filters.status || h.status === filters.status;
    const matchesShortage = !filters.onlyShortage || h.totalIndentRequired > 0;
    return matchesSearch && matchesFam && matchesStatus && matchesShortage;
  });

  const sortVal = (h, key) => {
    switch (key) {
      case "cat": return h.group.cat;
      case "stock": return h.totalStock;
      case "req": return h.monthlyReq;
      case "pending": return h.totalPending;
      case "stockDays": return num(h.daysCoverStockOnly);
      case "totalDays": return num(h.daysCoverWithPending);
      case "indent": return h.totalIndentRequired;
      default: return STATUS_ORDER.indexOf(h.status);
    }
  };
  const rows = [...filtered].sort((a, b) => {
    const va = sortVal(a, sort.key);
    const vb = sortVal(b, sort.key);
    let c = typeof va === "string" ? va.localeCompare(vb) : va === vb ? 0 : va - vb;
    if (c === 0 && sort.key === "status") {
      const da = num(a.daysCoverWithPending);
      const db = num(b.daysCoverWithPending);
      c = da === db ? 0 : da - db;
    }
    return sort.dir === "asc" ? c : -c;
  });

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: ["cat", "status", "stockDays", "totalDays"].includes(key) ? "asc" : "desc" }
    );

  const SortTh = ({ k, label, align }) => (
    <th className={align || ""} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className={`rmi-sort ${sort.key === k ? "on" : ""}`} onClick={() => toggleSort(k)}>
        {label}
        {sort.key === k && <Icon name={sort.dir === "asc" ? "arrow-up" : "arrow-down"} size={11} />}
      </button>
    </th>
  );

  // shortage summary for the main action button
  let shortLines = 0;
  let shortKG = 0;
  allHealth.forEach((h) =>
    plants.forEach((p) => {
      const ind = h.plantBreakdown[p].indent;
      if (ind > 0) {
        shortLines++;
        shortKG += ind;
      }
    })
  );

  const inCartAll = (h) => {
    const lines = plants.filter((p) => h.plantBreakdown[p].indent > 0);
    return (
      lines.length > 0 &&
      lines.every((p) => cart.some((c) => c.groupId === h.group.id && c.plant === p && c.qty === h.plantBreakdown[p].indent))
    );
  };

  const exportBoard = () => {
    const data = rows.map((h) => ({
      "Spec Group": h.group.cat,
      Family: h.group.fam,
      "Main Material": h.group.lead,
      "Mapped Jobs": jobsFor(h.group.id),
      "Current Stock (KG)": Math.round(h.totalStock),
      "Monthly Req (KG)": Math.round(h.monthlyReq),
      "Pending PO (KG)": Math.round(h.totalPending),
      "Stock Days": h.daysCoverStockOnly === null ? "" : Math.round(h.daysCoverStockOnly * 10) / 10,
      "Total Days": h.daysCoverWithPending === null ? "" : Math.round(h.daysCoverWithPending * 10) / 10,
      "Indent Required (KG)": h.totalIndentRequired,
      Status: h.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planning Board");
    XLSX.writeFile(wb, "Planning_Board.xlsx");
  };

  const filtersActive = filters.search || filters.family || filters.status || filters.onlyShortage;
  const clearFilters = () => setFilters({ search: "", family: "", status: "", onlyShortage: false });

  const strip = [
    { type: "MB5B", label: "Stock" },
    { type: "ME2N", label: "Pending POs" },

  ];

  return (
    <div>
      {/* data status */}
      <div className="rmi-strip">
        {strip.map((s) => {
          const l = importLog[s.type];
          return (
            <button key={s.type} className={`rmi-datachip ${l ? "ok" : "off"}`} onClick={() => onGoTab("settings")} title="Manage data sources">
              <i />
              <span className="rmi-datachip-name">{s.label}</span>
              <span className="rmi-datachip-meta">{l ? l.at : "not loaded"}</span>
            </button>
          );
        })}
        {jobList.length === 0 && (
          <button className="rmi-linkbtn" onClick={() => onGoTab("jobs")}>
            Add job demand to get cover days and indent suggestions
          </button>
        )}
      </div>

      {/* status chips */}
      <div className="rmi-chips" role="group" aria-label="Filter by health">
        {[["", "All"], ...STATUS_ORDER.map((s) => [s, STATUS_LABEL[s]])].map(([val, label]) => (
          <button
            key={val || "all"}
            className={`rmi-chip c-${statusClass(val || "all")} ${filters.status === val ? "on" : ""} ${val && !counts[val] ? "zero" : ""}`}
            onClick={() => setFilters({ ...filters, status: val })}
            aria-pressed={filters.status === val}
          >
            {label} <b>{counts[val]}</b>
          </button>
        ))}
      </div>

      {/* filters + actions */}
      <div className="rmi-filterbar">
        <div className="rmi-filters">
          <div className="rmi-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Search spec, job or material code"
              aria-label="Search spec groups"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select
            className="rmi-input"
            aria-label="Family"
            value={filters.family}
            onChange={(e) => setFilters({ ...filters, family: e.target.value })}
          >
            <option value="">All families</option>
            {families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <label className="rmi-switch">
            <input
              type="checkbox"
              checked={filters.onlyShortage}
              onChange={(e) => setFilters({ ...filters, onlyShortage: e.target.checked })}
            />
            <span className="rmi-switch-track" />
            <span>Shortages only</span>
          </label>

          {filtersActive && (
            <button className="rmi-linkbtn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="rmi-actions">
          <button className="rmi-btn rmi-btn-outline" onClick={exportBoard} disabled={rows.length === 0}>
            <Icon name="download" size={14} /> Export
          </button>
          <button className="rmi-btn rmi-btn-primary" onClick={onAddAll} disabled={shortLines === 0}>
            <Icon name="cart" size={14} />
            {shortLines > 0
              ? `Add all shortages (${shortLines} lines, ${formatNum(shortKG)} KG)`
              : "No shortages to indent"}
          </button>
        </div>
      </div>

      <div className="rmi-resultline">
        Showing {rows.length} of {allHealth.length} spec groups
      </div>

      <div className="rmi-tablewrap rmi-sticky">
        <table className="rmi-table">
          <thead>
            <tr>
              <SortTh k="cat" label="Spec group" />
              <th>Mapped jobs</th>
              <SortTh k="stock" label="Stock" align="r" />
              <SortTh k="req" label="Monthly req." align="r" />
              <SortTh k="pending" label="Pending PO" align="r" />
              <SortTh k="stockDays" label="Stock days" align="r" />
              <SortTh k="totalDays" label="Total cover" />
              <SortTh k="indent" label="Indent needed" align="r" />
              <SortTh k="status" label="Health" align="c" />
              <th className="c">Cart</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="rmi-empty-row">
                  No spec groups match these filters.{" "}
                  <button className="rmi-linkbtn" onClick={clearFilters}>
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              rows.map((h) => (
                <tr
                  key={h.group.id}
                  className={`rmi-row-click st-${statusClass(h.status)}`}
                  tabIndex={0}
                  onClick={() => onOpen(h.group.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(h.group.id);
                  }}
                >
                  <td>
                    <div className="rmi-strong">{h.group.cat}</div>
                    <div className="rmi-muted rmi-trunc">{h.group.lead}</div>
                    <div className="rmi-link-note">
                      {h.group.mats.length} material code{h.group.mats.length === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="rmi-jobs-cell">{jobsFor(h.group.id) || <span className="rmi-faint">-</span>}</td>
                  <td className="r rmi-strong">{formatNum(h.totalStock)} KG</td>
                  <td className="r rmi-strong">{h.monthlyReq > 0 ? `${formatNum(h.monthlyReq)} KG` : <span className="rmi-faint">-</span>}</td>
                  <td className="r rmi-indigo">{h.totalPending > 0 ? `+${formatNum(h.totalPending)} KG` : <span className="rmi-faint">-</span>}</td>
                  <td className={`r ${h.daysCoverStockOnly !== null && h.daysCoverStockOnly < appSettings.criticalDays ? "rmi-red rmi-bold" : ""}`}>
                    {h.daysCoverStockOnly !== null ? `${formatDec(h.daysCoverStockOnly)} d` : <span className="rmi-faint">-</span>}
                  </td>
                  <td>
                    <CoverBar days={h.daysCoverWithPending} status={h.status} appSettings={appSettings} />
                  </td>
                  <td className={`r rmi-bold ${h.totalIndentRequired > 0 ? "rmi-gold" : "rmi-faint"}`}>
                    {h.totalIndentRequired > 0 ? `${formatNum(h.totalIndentRequired)} KG` : "-"}
                  </td>
                  <td className="c">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="c" onClick={(e) => e.stopPropagation()}>
                    {h.totalIndentRequired > 0 ? (
                      inCartAll(h) ? (
                        <span className="rmi-incart">
                          <Icon name="check" size={12} /> In cart
                        </span>
                      ) : (
                        <button className="rmi-btn rmi-btn-gold rmi-btn-xs" onClick={() => onAddGroup(h)}>
                          + Add
                        </button>
                      )
                    ) : (
                      <span className="rmi-faint">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="rmi-hint">Click a row to see plant split, alternate codes and open POs.</div>
    </div>
  );
}

/* ============================== MATERIAL DRAWER ======================== */
function MaterialDrawer({ health, appSettings, pendingPOs, plants, cart, onClose, onSplit, onAddToCart, onAddGroup }) {
  if (!health) return null;
  const { group } = health;
  const matCodes = group.mats.map((m) => m.c);
  const pos = pendingPOs.filter((p) => matCodes.includes(p.m));

  return (
    <>
      <div className="rmi-drawer-head">
        <div>
          <div className="rmi-drawer-kicker">
            {group.fam}
            {group.gsm ? ` \u2022 ${group.gsm} GSM` : ""} &nbsp;
            <StatusBadge status={health.status} />
          </div>
          <h3 className="rmi-drawer-title">{group.cat}</h3>
          <div className="rmi-drawer-lead">{group.lead}</div>
        </div>
        <button className="rmi-drawer-x" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="rmi-drawer-body">
        {/* Health metrics */}
        <div className="rmi-metrics">
          <div>
            <div className="rmi-muted">Total Stock</div>
            <div className="rmi-metric">{formatNum(health.totalStock)} KG</div>
          </div>
          <div>
            <div className="rmi-muted">Pending POs</div>
            <div className="rmi-metric rmi-indigo">+{formatNum(health.totalPending)} KG</div>
          </div>
          <div>
            <div className="rmi-muted">Monthly Req.</div>
            <div className="rmi-metric">{formatNum(health.monthlyReq)} KG</div>
          </div>
          <div>
            <div className="rmi-muted">Total Cover</div>
            <div
              className={`rmi-metric ${
                health.daysCoverWithPending < appSettings.criticalDays ? "rmi-red" : "rmi-green"
              }`}
            >
              {health.daysCoverWithPending !== null ? `${formatDec(health.daysCoverWithPending)} Days` : "N/A"}
            </div>
          </div>
        </div>

        {/* Multi-location breakdown */}
        <div>
          <div className="rmi-sec-head">
            <h4>Multi-Location Indent Breakdown &amp; Stock Balance</h4>
            <span className="rmi-muted">Adjust demand % split across plants</span>
          </div>
          <div className="rmi-tablewrap">
            <table className="rmi-table rmi-table-sm">
              <thead>
                <tr>
                  <th>Plant Location</th>
                  <th className="c">Req Share %</th>
                  <th className="r">Current Stock</th>
                  <th className="r">Pending PO</th>
                  <th className="r">Target ({appSettings.targetCoverDays}d)</th>
                  <th className="r">Indent Rec.</th>
                  <th className="c">Action</th>
                </tr>
              </thead>
              <tbody>
                {plants.map((p) => {
                  const pb = health.plantBreakdown[p];
                  const currentSplit = health.plantSplits[p] || 0;
                  const hasSurplusElsewhere = plants.some(
                    (other) => other !== p && health.plantBreakdown[other].surplus > 0
                  );
                  return (
                    <tr key={p}>
                      <td className="rmi-strong">
                        Plant {p}
                      </td>
                      <td className="c">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={currentSplit}
                          onChange={(e) => onSplit(group.id, p, e.target.value)}
                          className="rmi-input rmi-num-sm"
                        />{" "}
                        %
                      </td>
                      <td className="r">{formatNum(pb.stock)} KG</td>
                      <td className="r rmi-indigo">{pb.pending > 0 ? `+${formatNum(pb.pending)}` : "-"}</td>
                      <td className="r rmi-strong">{formatNum(pb.targetNeed)} KG</td>
                      <td className={`r rmi-bold ${pb.indent > 0 ? "rmi-gold" : "rmi-faint"}`}>
                        {pb.indent > 0 ? `${formatNum(pb.indent)} KG` : "-"}
                        {pb.indent > 0 && hasSurplusElsewhere && (
                          <div className="rmi-transfer">
                            <Icon name="refresh" size={10} /> Transfer available
                          </div>
                        )}
                      </td>
                      <td className="c">
                        {pb.indent > 0 && cart.some((c) => c.groupId === group.id && c.plant === p && c.qty === pb.indent) ? (
                          <span className="rmi-incart">
                            <Icon name="check" size={12} /> In cart
                          </span>
                        ) : pb.indent > 0 ? (
                          <button
                            className="rmi-btn rmi-btn-gold rmi-btn-xs"
                            onClick={() => onAddToCart(group.id, p, pb.indent)}
                          >
                            + Cart
                          </button>
                        ) : (
                          <span className="rmi-faint rmi-xs">Balanced</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alternate codes */}
        <div>
          <div className="rmi-sec-head">
            <h4>Alternate Interchangeable Codes in Group</h4>
          </div>
          <div className="rmi-tablewrap">
            <table className="rmi-table rmi-table-sm">
              <thead>
                <tr>
                  <th>SAP Code</th>
                  <th>Material Description</th>
                  {plants.map((p) => (
                    <th key={p} className="r">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.mats.map((m) => (
                  <tr key={m.c}>
                    <td className="rmi-mono rmi-bold">{m.c}</td>
                    <td>{m.s}</td>
                    {plants.map((p) => (
                      <td key={p} className="r">{m.st && m.st[p] ? formatNum(m.st[p]) : "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Open POs */}
        <div>
          <div className="rmi-sec-head">
            <h4>Active Open Purchase Orders (PO)</h4>
          </div>
          {pos.length === 0 ? (
            <div className="rmi-note-empty">No active pending POs for this material spec group.</div>
          ) : (
            <div className="rmi-tablewrap">
              <table className="rmi-table rmi-table-sm">
                <thead>
                  <tr>
                    <th>PO Document</th>
                    <th>Vendor</th>
                    <th>Plant</th>
                    <th className="r">Quantity</th>
                    <th className="r">ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po, i) => (
                    <tr key={`${po.poNo}-${po.m}-${po.p}-${i}`}>
                      <td className="rmi-mono">{po.poNo}</td>
                      <td>{po.v}</td>
                      <td className="rmi-strong">{po.p}</td>
                      <td className="r rmi-indigo rmi-bold">{formatNum(po.q)} KG</td>
                      <td className="r">{po.e || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rmi-drawer-foot">
        <span className="rmi-muted">Plant split changes apply immediately.</span>
        <div className="rmi-actions">
          {health.totalIndentRequired > 0 && (
            <button className="rmi-btn rmi-btn-gold" onClick={() => onAddGroup(health)}>
              <Icon name="cart" size={14} /> Add all shortages ({formatNum(health.totalIndentRequired)} KG)
            </button>
          )}
          <button className="rmi-btn rmi-btn-dark" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* ============================ JOB DEMAND PLANNER ======================= */
function JobPlanner({ groups, jobList, onAdd, onUpdate, onDelete, onShift }) {
  const notify = useToast();
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [kg, setKg] = useState("");

  const handleAdd = () => {
    const kgNum = parseFloat(kg);
    const gid = groupId || (groups[0] && groups[0].id);
    if (!name || !kgNum || !gid) {
      notify("Enter a job title, choose a spec group and enter the monthly KG.", { type: "warn" });
      return;
    }
    onAdd(name, gid, kgNum);
    setName("");
    setKg("");
  };

  return (
    <div className="rmi-stack">
      <div className="rmi-sec-top">
        <div>
          <h3 className="rmi-h3">Job demand</h3>
          <p className="rmi-muted">
            Monthly KG per job drives cover days and indent suggestions. {jobList.length} job
            {jobList.length === 1 ? "" : "s"} loaded.
          </p>
        </div>

      </div>

      <div className="rmi-callout">
        <Icon name="info" size={16} />
        <div>
          Use <strong>Shift</strong> to move a share of a job to another spec group (for example from 170 GSM to 130 GSM).
          Stock health and indent suggestions update straight away.
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rmi-note-empty">
          Upload the MB5B stock sheet first. Spec groups are built from the materials in it.
        </div>
      ) : (
        <div className="rmi-card">
          <h4 className="rmi-card-title">Add New Job Demand</h4>
          <div className="rmi-addjob">
            <div className="span2">
              <label>Job Title / Customer</label>
              <input
                type="text"
                className="rmi-input w100"
                placeholder="e.g. HDFC COVER PAGES"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label>Material Spec Group</label>
              <select
                className="rmi-input w100"
                value={groupId || groups[0].id}
                onChange={(e) => setGroupId(e.target.value)}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Monthly Req. (KG)</label>
              <input
                type="number"
                className="rmi-input w100"
                placeholder="e.g. 5000"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </div>
            <div className="rmi-addjob-btn">
              <button className="rmi-btn rmi-btn-primary w100" onClick={handleAdd}>
                <Icon name="plus" size={14} /> Add Job
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rmi-tablewrap">
        <table className="rmi-table">
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Assigned Material Spec Group</th>
              <th className="r">Monthly Demand (KG)</th>
              <th className="c">Shift Demand Spec</th>
              <th className="c">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobList.length === 0 ? (
              <tr>
                <td colSpan={5} className="rmi-empty-row">
                  No jobs yet. Add a job using the form above.
                </td>
              </tr>
            ) : (
              jobList.map((j) => (
                <JobRow key={j.id} job={j} groups={groups} onUpdate={onUpdate} onDelete={onDelete} onShift={onShift} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobRow({ job, groups, onUpdate, onDelete, onShift }) {
  const [shiftTarget, setShiftTarget] = useState("");
  const [shiftPct, setShiftPct] = useState(50);
  const known = groups.some((g) => g.id === job.groupGroupId);
  const target = shiftTarget || (groups[0] && groups[0].id) || "";

  return (
    <tr>
      <td>
        <input
          type="text"
          value={job.name}
          onChange={(e) => onUpdate(job.id, "name", e.target.value)}
          className="rmi-inline-input"
        />
      </td>
      <td>
        <select
          className="rmi-input"
          value={job.groupGroupId}
          onChange={(e) => onUpdate(job.id, "groupGroupId", e.target.value)}
        >
          {!known && <option value={job.groupGroupId}>{job.groupGroupId} (not in current sheets)</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.cat}
            </option>
          ))}
        </select>
      </td>
      <td className="r">
        <input
          type="number"
          value={job.kg}
          onChange={(e) => onUpdate(job.id, "kg", parseFloat(e.target.value))}
          className="rmi-input rmi-num-md r"
        />{" "}
        KG
      </td>
      <td className="c">
        <div className="rmi-shift">
          <select className="rmi-input" value={target} onChange={(e) => setShiftTarget(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.cat}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="100"
            value={shiftPct}
            onChange={(e) => setShiftPct(parseFloat(e.target.value))}
            className="rmi-input rmi-num-sm"
          />{" "}
          %
          <button
            className="rmi-btn rmi-btn-light rmi-btn-xs"
            disabled={!target}
            onClick={() => onShift(job.id, target, shiftPct)}
          >
            Shift
          </button>
        </div>
      </td>
      <td className="c">
        <button className="rmi-iconbtn rmi-red" onClick={() => onDelete(job.id)} title="Delete job">
          <Icon name="trash" size={14} />
        </button>
      </td>
    </tr>
  );
}

/* ================================ INDENT CART ========================== */
function IndentCart({ cart, groups, vendors, onGoBoard, onClear, onRaise, onUpdate, onRemove }) {
  if (cart.length === 0) {
    return (
      <div className="rmi-empty">
        <div className="rmi-empty-icon">
          <Icon name="cart" size={26} />
        </div>
        <h4>Your indent cart is empty</h4>
        <p>Add shortages from the Planning Board to build a purchase requisition.</p>
        <button className="rmi-btn rmi-btn-primary" onClick={onGoBoard}>
          Go to Planning Board
        </button>
      </div>
    );
  }

  const totalCartKG = cart.reduce((a, c) => a + c.qty, 0);
  const byPlant = {};
  cart.forEach((c) => {
    byPlant[c.plant] = (byPlant[c.plant] || 0) + c.qty;
  });
  const noVendor = cart.filter((c) => !c.vendor).length;

  return (
    <div className="rmi-stack">
      <div className="rmi-sec-top">
        <div>
          <h3 className="rmi-h3">Review purchase indent</h3>
          <p className="rmi-muted">Set quantities, vendors and delivery dates, then raise the indent.</p>
        </div>
        <div className="rmi-actions">
          <button className="rmi-btn rmi-btn-outline" onClick={onClear}>
            Clear cart
          </button>
          <button className="rmi-btn rmi-btn-primary" onClick={onRaise}>
            <Icon name="send" size={14} /> Raise material indent
          </button>
        </div>
      </div>

      <div className="rmi-tiles">
        <div className="rmi-tile">
          <span>Lines</span>
          <strong>{cart.length}</strong>
        </div>
        <div className="rmi-tile">
          <span>Total quantity</span>
          <strong>{formatNum(totalCartKG)} KG</strong>
        </div>
        {Object.entries(byPlant).map(([p, kg]) => (
          <div className="rmi-tile" key={p}>
            <span>Plant {p}</span>
            <strong>{formatNum(kg)} KG</strong>
          </div>
        ))}
      </div>

      {noVendor > 0 && (
        <div className="rmi-callout">
          <Icon name="info" size={16} />
          <div>
            {noVendor} line{noVendor === 1 ? " has" : "s have"} no vendor yet. You can still raise the indent and add
            vendors later.
          </div>
        </div>
      )}

      <datalist id="rmi-vendors">
        {vendors.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className="rmi-tablewrap">
        <table className="rmi-table">
          <thead>
            <tr>
              <th>Spec group</th>
              <th>Plant</th>
              <th className="r">Quantity</th>
              <th>Vendor</th>
              <th>Required by</th>
              <th className="c">Remove</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((c, i) => {
              const group = groups.find((g) => g.id === c.groupId);
              return (
                <tr key={`${c.groupId}-${c.plant}`}>
                  <td>
                    <div className="rmi-strong">{group ? group.cat : c.groupId}</div>
                    <div className="rmi-muted">{group ? group.lead : ""}</div>
                  </td>
                  <td className="rmi-strong">Plant {c.plant}</td>
                  <td className="r">
                    <input
                      type="number"
                      min="0"
                      value={c.qty}
                      aria-label="Indent quantity"
                      onChange={(e) => onUpdate(i, { qty: parseFloat(e.target.value) || 0 })}
                      className="rmi-input rmi-num-md r"
                    />{" "}
                    KG
                  </td>
                  <td>
                    <input
                      type="text"
                      list="rmi-vendors"
                      className="rmi-input w100"
                      placeholder="Type or pick a vendor"
                      aria-label="Vendor"
                      value={c.vendor}
                      onChange={(e) => onUpdate(i, { vendor: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className="rmi-input"
                      aria-label="Required delivery date"
                      value={c.requiredBy}
                      onChange={(e) => onUpdate(i, { requiredBy: e.target.value })}
                    />
                  </td>
                  <td className="c">
                    <button className="rmi-iconbtn rmi-red" onClick={() => onRemove(i)} title="Remove line" aria-label="Remove line">
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== INDENT REGISTER ======================== */
function IndentRegister({ register, groups, onStatus, onExport }) {
  const [closed, setClosed] = useState({});

  if (register.length === 0) {
    return (
      <div className="rmi-empty">
        <div className="rmi-empty-icon">
          <Icon name="inbox" size={26} />
        </div>
        <h4>No indents raised yet</h4>
        <p>Indents you raise from the cart will be listed here, newest first.</p>
      </div>
    );
  }

  return (
    <div className="rmi-stack">
      <div className="rmi-sec-top">
        <h3 className="rmi-h3">Raised indents</h3>
        <span className="rmi-muted">{register.length} total</span>
      </div>

      {register.map((r, idx) => {
        const isClosed = !!closed[r.indentNo];
        return (
          <div className="rmi-card" key={r.indentNo}>
            <div className="rmi-reg-head">
              <button
                className="rmi-reg-toggle"
                onClick={() => setClosed((c) => ({ ...c, [r.indentNo]: !c[r.indentNo] }))}
                aria-expanded={!isClosed}
              >
                <span className={`rmi-caret ${isClosed ? "" : "open"}`}>
                  <Icon name="chevron" size={14} />
                </span>
                <span className="rmi-reg-no">{r.indentNo}</span>
                <span className="rmi-muted">{r.date}</span>
                <span className="rmi-strong">
                  {r.lines.length} line{r.lines.length === 1 ? "" : "s"} &bull; {formatNum(r.totalKG)} KG
                </span>
              </button>
              <div className="rmi-actions">
                <select
                  className={`rmi-input rmi-bold rmi-stat s-${statusClass(r.status)}`}
                  value={r.status}
                  aria-label="Indent status"
                  onChange={(e) => onStatus(idx, e.target.value)}
                >
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="PO Placed">PO Placed</option>
                  <option value="Closed">Closed</option>
                </select>
                <button className="rmi-btn rmi-btn-green rmi-btn-xs" onClick={() => onExport(idx)}>
                  <Icon name="download" size={12} /> Export
                </button>
              </div>
            </div>

            {!isClosed && (
              <div className="rmi-tablewrap rmi-bg-white">
                <table className="rmi-table rmi-table-sm">
                  <thead>
                    <tr>
                      <th>Spec group</th>
                      <th>Plant</th>
                      <th className="r">Quantity</th>
                      <th>Vendor</th>
                      <th>Required by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((l) => {
                      const group = groups.find((g) => g.id === l.groupId);
                      return (
                        <tr key={`${l.groupId}-${l.plant}`}>
                          <td className="rmi-strong">{group ? group.cat : l.groupId}</td>
                          <td>Plant {l.plant}</td>
                          <td className="r rmi-strong">{formatNum(l.qty)} KG</td>
                          <td>{l.vendor || <span className="rmi-faint">Not set</span>}</td>
                          <td>{l.requiredBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================ SETTINGS ============================= */
function SettingsPage({
  appSettings, setSetting, plants, catalog, importLog, reading, onFile, onMaterialGroup, onReset,
}) {
  const num = (key) => (e) => setSetting(key, parseFloat(e.target.value));
  const [matSearch, setMatSearch] = useState("");

  const matRows = catalog
    .flatMap((g) => g.mats.map((m) => ({ code: m.c, desc: m.s, group: g.cat })))
    .filter((r) => !matSearch || `${r.code} ${r.desc} ${r.group}`.toLowerCase().includes(matSearch.toLowerCase()));

  return (
    <div className="rmi-stack">
      <div className="rmi-sec-top">
        <div>
          <h3 className="rmi-h3">Data &amp; settings</h3>
          <p className="rmi-muted">Load your sheets, tune the planning rules and correct spec groups.</p>
        </div>
      </div>

      <div className="rmi-card">
        <h4 className="rmi-card-title">Excel sheets</h4>
        <p className="rmi-muted rmi-mb">
          A new upload replaces the previous one of the same kind. Your data is kept in this browser, so it is still here
          after a refresh.
        </p>
        <div className="rmi-guide-grid">
          <DropZone
            type="MB5B"
            title="Stock sheet (MB5B)"
            hint="Materials, descriptions and stock per plant."
            log={importLog.MB5B}
            busy={reading === "MB5B"}
            onFile={onFile}
          />
          <DropZone
            type="ME2N"
            title="Pending POs (ME2N)"
            hint="Material on order, vendor and delivery date."
            log={importLog.ME2N}
            busy={reading === "ME2N"}
            onFile={onFile}
          />

        </div>
      </div>

      <div className="rmi-card">
        <h4 className="rmi-card-title">Planning rules</h4>
        <div className="rmi-form3">
          <div>
            <label>Working days per month</label>
            <input type="number" className="rmi-input w100" value={appSettings.workingDays} onChange={num("workingDays")} />
          </div>
          <div>
            <label>Target buffer cover (days)</label>
            <input type="number" className="rmi-input w100" value={appSettings.targetCoverDays} onChange={num("targetCoverDays")} />
          </div>
          <div>
            <label>Lot rounding size (KG)</label>
            <input type="number" className="rmi-input w100" value={appSettings.lotSize} onChange={num("lotSize")} />
          </div>
          <div>
            <label>Critical below (days of cover)</label>
            <input type="number" className="rmi-input w100" value={appSettings.criticalDays} onChange={num("criticalDays")} />
          </div>

        </div>
      </div>

      {catalog.length > 0 && (
        <div className="rmi-card">
          <h4 className="rmi-card-title">Spec groups ({catalog.length})</h4>
          <p className="rmi-muted rmi-mb">
            Groups come from a "Spec group" column if your sheet has one. Otherwise they are worked out from the
            description. Retype the group of any material to correct it. Materials with the same group name are planned
            together.
          </p>
          <div className="rmi-search rmi-mb">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Search material code, description or group"
              aria-label="Search materials"
              value={matSearch}
              onChange={(e) => setMatSearch(e.target.value)}
            />
          </div>
          <datalist id="rmi-group-names">
            {catalog.map((g) => (
              <option key={g.id} value={g.cat} />
            ))}
          </datalist>
          <div className="rmi-tablewrap rmi-scroll">
            <table className="rmi-table rmi-table-sm">
              <thead>
                <tr>
                  <th>SAP code</th>
                  <th>Material description</th>
                  <th>Spec group</th>
                </tr>
              </thead>
              <tbody>
                {matRows.slice(0, 100).map((r) => (
                  <tr key={`${r.code}-${r.group}`}>
                    <td className="rmi-mono rmi-bold">{r.code}</td>
                    <td>{r.desc}</td>
                    <td>
                      <input
                        type="text"
                        list="rmi-group-names"
                        className="rmi-input w100"
                        aria-label={`Spec group for ${r.code}`}
                        defaultValue={r.group}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.group) onMaterialGroup(r.code, v);
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {matRows.length > 100 && (
                  <tr>
                    <td colSpan={3} className="rmi-empty-row">
                      Showing the first 100 of {matRows.length} materials. Use the search to narrow down.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rmi-card rmi-danger">
        <div className="rmi-sec-top rmi-nobar">
          <div>
            <h4 className="rmi-card-title">Saved data</h4>
            <p className="rmi-muted">Removes uploaded sheets, jobs, cart, indents and settings from this browser.</p>
          </div>
          <button className="rmi-btn rmi-btn-outline rmi-btn-danger" onClick={onReset}>
            <Icon name="trash" size={14} /> Clear all data
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================== CSS ================================ */
const CSS = `
.rmi-root{
  --rmi-teal:#0f6b74; --rmi-teal-dark:#0a4f56; --rmi-teal-soft:#e6f2f4;
  --rmi-gold:#b8892a; --rmi-gold-soft:#fbf3de;
  --rmi-ink:#16323a; --rmi-muted:#64808a; --rmi-line:#d6e4e8; --rmi-bg:#f3f8f9;
  --rmi-red:#d0453a; --rmi-green:#1f8a5b; --rmi-indigo:#4a55b5;
  color:var(--rmi-ink); font-size:13px; line-height:1.45; padding:4px 0 24px;
}
.rmi-root *{box-sizing:border-box}
.rmi-icon{flex:none;vertical-align:middle}

/* header */
.rmi-header{position:relative;display:flex;justify-content:flex-end;align-items:center;padding:6px 0 14px}
.rmi-title-wrap{text-align:center}
.rmi-title{margin:0;font-size:22px;font-weight:700;color:var(--rmi-teal-dark);letter-spacing:.2px}
.rmi-subtitle{margin:2px 0 0;color:var(--rmi-muted);font-size:12px}
.rmi-title-wrap:after{content:"";display:block;width:64px;height:3px;border-radius:2px;background:var(--rmi-gold);margin:8px auto 0}
.rmi-cart-btn{position:absolute;right:0;top:6px}
.rmi-cart-badge{background:#fff;color:var(--rmi-gold);font-weight:800;font-size:11px;padding:1px 8px;border-radius:999px;margin-left:4px}

/* tabs */
.rmi-tabs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:16px}
.rmi-tab{display:flex;align-items:center;gap:6px;border:1px solid var(--rmi-line);background:#fff;color:var(--rmi-teal-dark);
  padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s,color .15s}
.rmi-tab:hover{background:var(--rmi-teal-soft)}
.rmi-tab.active{background:var(--rmi-teal);border-color:var(--rmi-teal);color:#fff}

/* kpis */
.rmi-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px}
.rmi-kpi{background:#fff;border:1px solid var(--rmi-line);border-radius:10px;padding:12px 14px}
.rmi-kpi-top{display:flex;justify-content:space-between;align-items:center}
.rmi-kpi-title{font-size:11px;font-weight:600;color:var(--rmi-muted)}
.rmi-kpi-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center}
.tone-teal{background:var(--rmi-teal-soft);color:var(--rmi-teal)}
.tone-blue{background:#e8ecfb;color:var(--rmi-indigo)}
.tone-green{background:#e3f4ec;color:var(--rmi-green)}
.tone-red{background:#fbe8e6;color:var(--rmi-red)}
.tone-gold{background:var(--rmi-gold-soft);color:var(--rmi-gold)}
.rmi-kpi-val{font-size:19px;font-weight:800;margin-top:8px}
.rmi-kpi-sub{font-size:11px;color:var(--rmi-muted)}

/* panel */
.rmi-panel{background:#fff;border:1px solid var(--rmi-line);border-radius:12px;padding:16px;min-height:420px}
.rmi-stack{display:flex;flex-direction:column;gap:16px}

/* buttons / inputs */
.rmi-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:8px;
  padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer;transition:filter .15s,background .15s}
.rmi-btn:hover{filter:brightness(.94)}
.rmi-btn-primary{background:var(--rmi-teal);color:#fff}
.rmi-btn-gold{background:var(--rmi-gold);color:#fff}
.rmi-btn-dark{background:var(--rmi-teal-dark);color:#fff}
.rmi-btn-green{background:var(--rmi-green);color:#fff}
.rmi-btn-light{background:#e4eef0;color:var(--rmi-ink)}
.rmi-btn-outline{background:#fff;border-color:var(--rmi-line);color:var(--rmi-ink)}
.rmi-btn-outline:hover{color:var(--rmi-red)}
.rmi-btn-xs{padding:3px 9px;font-size:11px}
.rmi-iconbtn{background:#eef4f5;border:0;border-radius:6px;padding:6px 8px;color:var(--rmi-ink);cursor:pointer}
.rmi-iconbtn:hover{background:var(--rmi-teal-soft);color:var(--rmi-teal)}
.rmi-iconbtn.rmi-red{background:transparent}
.rmi-input{font-size:12px;background:#f6fafb;border:1px solid #c9dade;border-radius:6px;padding:5px 8px;color:var(--rmi-ink)}
.rmi-input:focus,.rmi-search input:focus,.rmi-inline-input:focus{outline:2px solid rgba(15,107,116,.35);outline-offset:0}
.rmi-num-sm{width:58px;text-align:center}
.rmi-num-md{width:96px}
.rmi-root .r{text-align:right}.rmi-root .c{text-align:center}
.w100{width:100%}
.rmi-file{display:block;width:100%;font-size:12px}
.rmi-log{margin-top:6px;font-size:11px;color:#47636c;line-height:1.5}
.rmi-form3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.rmi-form3 label{display:block;font-size:11px;font-weight:600;color:#47636c;margin-bottom:3px}
.rmi-mt{margin-top:12px}
.rmi-span2{grid-column:span 2}
.rmi-scroll{max-height:420px;overflow-y:auto}
.rmi-btn:disabled{opacity:.5;cursor:not-allowed}
.rmi-linkbtn{background:none;border:0;padding:0;color:var(--rmi-teal);font-weight:700;text-decoration:underline;cursor:pointer;font-size:12px}

/* filters */
.rmi-filterbar{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid var(--rmi-line)}
.rmi-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;flex:1;min-width:260px}
.rmi-search{position:relative;flex:1;min-width:200px;color:var(--rmi-muted)}
.rmi-search .rmi-icon{position:absolute;left:10px;top:9px}
.rmi-search input{width:100%;padding:6px 10px 6px 30px;font-size:12px;background:#f6fafb;border:1px solid #c9dade;border-radius:8px}
.rmi-check{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;cursor:pointer;margin:0}

/* tables */
.rmi-tablewrap{overflow-x:auto;border:1px solid var(--rmi-line);border-radius:8px}
.rmi-bg-white{background:#fff}
.rmi-table{width:100%;border-collapse:collapse;font-size:12px}
.rmi-table thead{background:var(--rmi-teal-soft);color:var(--rmi-teal-dark)}
.rmi-table th{padding:10px 12px;font-weight:700;text-align:left;white-space:nowrap;border-bottom:1px solid var(--rmi-line)}
.rmi-table td{padding:10px 12px;border-bottom:1px solid #e7f0f2;vertical-align:middle}
.rmi-table tbody tr:last-child td{border-bottom:0}
.rmi-table th.r{text-align:right}.rmi-table th.c{text-align:center}
.rmi-table-sm th,.rmi-table-sm td{padding:8px 10px}
.rmi-row-click{cursor:pointer}
.rmi-row-click:hover{background:#f3f9fa}
.rmi-jobs-cell{font-size:11px;color:#47636c;max-width:240px}
.rmi-empty-row{text-align:center;color:var(--rmi-muted);padding:32px !important}
.rmi-trunc{max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rmi-link-note{font-size:10px;color:var(--rmi-teal);font-weight:600}
.rmi-inline-input{width:100%;background:transparent;border:0;border-bottom:1px solid transparent;padding:2px 0;font-weight:600;color:var(--rmi-ink)}
.rmi-inline-input:hover{border-bottom-color:#b6cbd0}
.rmi-shift{display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap}

/* text helpers */
.rmi-strong{font-weight:600}.rmi-bold{font-weight:800}.rmi-muted{color:var(--rmi-muted);font-size:11px}
.rmi-xs{font-size:10px}.rmi-faint{color:#9bb0b6}.rmi-red{color:var(--rmi-red)}.rmi-green{color:var(--rmi-green)}
.rmi-gold{color:var(--rmi-gold)}.rmi-indigo{color:var(--rmi-indigo)}.rmi-mono{font-family:ui-monospace,Menlo,Consolas,monospace}
.rmi-mb{margin-bottom:10px}
.rmi-h3{margin:0;font-size:16px;font-weight:700}
.rmi-bordered{padding-bottom:8px;border-bottom:1px solid var(--rmi-line)}

/* badges */
.rmi-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:800;border:1px solid transparent}
.rmi-b-critical{background:#fbe3e0;color:#b3342a;border-color:#f3c3be}
.rmi-b-low{background:#fdf0d4;color:#9a6a0b;border-color:#f1dca7}
.rmi-b-ok{background:#ddf2e8;color:#176d47;border-color:#b9e2cf}
.rmi-b-over{background:#ece4f8;color:#6a43a8;border-color:#d6c8ee}
.rmi-b-none{background:#eef3f4;color:#6b8188;border-color:#d9e3e6}

/* cards & forms */
.rmi-card{background:var(--rmi-bg);border:1px solid var(--rmi-line);border-radius:10px;padding:14px}
.rmi-card-title{margin:0 0 10px;font-size:13px;font-weight:700;color:var(--rmi-teal-dark)}
.rmi-callout{display:flex;gap:10px;align-items:flex-start;background:var(--rmi-gold-soft);border:1px solid #ecd9a6;color:#6e5214;border-radius:10px;padding:12px 14px;font-size:12px}
.rmi-callout .rmi-icon{margin-top:2px;color:var(--rmi-gold)}
.rmi-addjob{display:grid;grid-template-columns:2fr 1.4fr 1fr auto;gap:10px;align-items:end}
.rmi-addjob .span2{grid-column:span 1}
.rmi-addjob label,.rmi-form2 label,.rmi-form1 label{display:block;font-size:11px;font-weight:600;color:#47636c;margin-bottom:3px}
.rmi-addjob-btn{min-width:120px}
.rmi-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.rmi-form2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rmi-form1{display:flex;flex-direction:column;gap:10px}

/* cart / register */
.rmi-sec-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--rmi-line)}
.rmi-sec-top p{margin:2px 0 0}
.rmi-actions{display:flex;align-items:center;gap:8px}
.rmi-total{display:flex;justify-content:space-between;align-items:center;background:var(--rmi-gold-soft);border:1px solid #ecd9a6;border-radius:10px;padding:12px 16px;font-weight:600}
.rmi-total-val{font-size:18px;font-weight:800}
.rmi-reg-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid var(--rmi-line)}
.rmi-reg-id{display:flex;align-items:center;gap:12px}
.rmi-reg-no{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;font-size:14px;color:var(--rmi-teal)}
.rmi-empty{text-align:center;padding:56px 12px;color:var(--rmi-muted)}
.rmi-empty h4{margin:10px 0 4px;color:var(--rmi-ink);font-size:15px}
.rmi-empty p{max-width:360px;margin:0 auto 14px;font-size:12px}
.rmi-empty-icon{width:60px;height:60px;border-radius:50%;background:var(--rmi-teal-soft);color:var(--rmi-teal);display:flex;align-items:center;justify-content:center;margin:0 auto}
.rmi-note-empty{padding:12px;text-align:center;color:var(--rmi-muted);background:var(--rmi-bg);border:1px solid var(--rmi-line);border-radius:8px}

/* footer */
.rmi-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:14px;font-size:11px;color:var(--rmi-muted)}

/* drawer */
.rmi-backdrop{position:fixed;inset:0;background:rgba(10,40,46,.55);z-index:2000;opacity:0;pointer-events:none;transition:opacity .25s}
.rmi-backdrop.open{opacity:1;pointer-events:auto}
.rmi-drawer{position:absolute;top:0;right:0;bottom:0;width:min(760px,100vw);background:#fff;display:flex;flex-direction:column;
  transform:translateX(100%);transition:transform .3s ease;box-shadow:-8px 0 30px rgba(0,0,0,.2)}
.rmi-backdrop.open .rmi-drawer{transform:translateX(0)}
.rmi-drawer-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 22px;background:var(--rmi-teal-dark);color:#fff}
.rmi-drawer-kicker{font-size:11px;color:#e4c775;font-weight:600}
.rmi-drawer-title{margin:2px 0 0;font-size:18px;font-weight:700;color:#fff}
.rmi-drawer-lead{font-size:11px;color:#b8d3d8;margin-top:2px}
.rmi-drawer-x{background:rgba(255,255,255,.12);border:0;color:#fff;border-radius:8px;padding:7px;cursor:pointer}
.rmi-drawer-x:hover{background:rgba(255,255,255,.22)}
.rmi-drawer-body{flex:1;overflow-y:auto;padding:20px 22px;display:flex;flex-direction:column;gap:20px}
.rmi-drawer-foot{display:flex;justify-content:space-between;align-items:center;padding:12px 22px;background:var(--rmi-bg);border-top:1px solid var(--rmi-line)}
.rmi-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;background:var(--rmi-bg);border:1px solid var(--rmi-line);border-radius:10px;padding:14px}
.rmi-metric{font-size:15px;font-weight:800}
.rmi-sec-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.rmi-sec-head h4{margin:0;font-size:13px;font-weight:700}
.rmi-transfer{font-size:9px;font-weight:500;color:var(--rmi-indigo)}

@media (max-width:1100px){.rmi-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:720px){
  .rmi-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rmi-two,.rmi-addjob,.rmi-form3{grid-template-columns:1fr}
  .rmi-metrics{grid-template-columns:repeat(2,1fr)}
  .rmi-cart-btn{position:static}
}

/* ===== v2 additions ===== */
.rmi-root :focus-visible{outline:2px solid var(--rmi-gold);outline-offset:2px}
.rmi-panel{box-shadow:0 1px 2px rgba(15,60,70,.05),0 8px 24px -12px rgba(15,60,70,.12)}
.rmi-kpi{box-shadow:0 1px 2px rgba(15,60,70,.04)}
.rmi-tab{position:relative}
.rmi-tab-badge{min-width:18px;padding:0 5px;border-radius:999px;font-size:10px;font-weight:800;line-height:18px;text-align:center;color:#fff}
.rmi-tab-badge.b-red{background:var(--rmi-red)}
.rmi-tab-badge.b-gold{background:var(--rmi-gold)}
.rmi-tab.active .rmi-tab-badge{box-shadow:0 0 0 2px var(--rmi-teal)}

/* first-run guide + drop zones */
.rmi-guide{max-width:980px;margin:0 auto;padding:18px 4px 8px;text-align:center}
.rmi-guide-title{margin:0 0 6px;font-size:18px;font-weight:700;color:var(--rmi-teal-dark)}
.rmi-guide-sub{margin:0 auto 18px;max-width:560px;color:var(--rmi-muted);font-size:12.5px}
.rmi-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;text-align:left}
.rmi-drop{display:flex;gap:12px;align-items:flex-start;padding:16px;border:1.5px dashed #a9c3c9;border-radius:12px;background:var(--rmi-bg);cursor:pointer;transition:border-color .15s,background .15s}
.rmi-drop:hover,.rmi-drop.over{border-color:var(--rmi-teal);background:var(--rmi-teal-soft)}
.rmi-drop.done{border-style:solid;border-color:#b9e2cf;background:#f1faf5}
.rmi-drop-icon{flex:none;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#fff;color:var(--rmi-teal);border:1px solid var(--rmi-line)}
.rmi-drop.done .rmi-drop-icon{background:var(--rmi-green);border-color:var(--rmi-green);color:#fff}
.rmi-drop-title{font-weight:700;font-size:13px;display:flex;align-items:center;gap:8px}
.rmi-step{display:inline-flex;width:20px;height:20px;border-radius:50%;background:var(--rmi-teal);color:#fff;font-size:11px;align-items:center;justify-content:center}
.rmi-drop-hint{font-size:11.5px;color:#47636c;margin-top:3px;word-break:break-word}
.rmi-drop-action{font-size:11px;font-weight:600;color:var(--rmi-teal);margin-top:6px}

/* data strip + chips */
.rmi-strip{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px}
.rmi-datachip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--rmi-line);background:#fff;border-radius:999px;padding:4px 12px 4px 10px;font-size:11.5px;cursor:pointer;color:var(--rmi-ink)}
.rmi-datachip:hover{background:var(--rmi-teal-soft)}
.rmi-datachip i{width:8px;height:8px;border-radius:50%;background:#b9c9cd}
.rmi-datachip.ok i{background:var(--rmi-green)}
.rmi-datachip-name{font-weight:700}
.rmi-datachip-meta{color:var(--rmi-muted)}
.rmi-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.rmi-chip{border:1px solid var(--rmi-line);background:#fff;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:600;cursor:pointer;color:var(--rmi-ink);transition:background .15s}
.rmi-chip b{margin-left:4px;font-weight:800}
.rmi-chip:hover{background:var(--rmi-teal-soft)}
.rmi-chip.zero{opacity:.55}
.rmi-chip.on{background:var(--rmi-teal);border-color:var(--rmi-teal);color:#fff}
.rmi-chip.c-critical b{color:var(--rmi-red)}
.rmi-chip.c-low b{color:#b07a0c}
.rmi-chip.on b{color:#fff}
.rmi-resultline{font-size:11.5px;color:var(--rmi-muted);margin:2px 0 8px}
.rmi-hint{font-size:11px;color:var(--rmi-muted);margin-top:8px;text-align:center}

/* switch */
.rmi-switch{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:500;cursor:pointer;margin:0}
.rmi-switch input{position:absolute;opacity:0;pointer-events:none}
.rmi-switch-track{width:32px;height:18px;border-radius:999px;background:#b9c9cd;position:relative;transition:background .15s}
.rmi-switch-track:after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}
.rmi-switch input:checked + .rmi-switch-track{background:var(--rmi-teal)}
.rmi-switch input:checked + .rmi-switch-track:after{transform:translateX(14px)}
.rmi-switch input:focus-visible + .rmi-switch-track{outline:2px solid var(--rmi-gold);outline-offset:2px}

/* table upgrades */
.rmi-sticky{max-height:min(64vh,660px);overflow:auto}
.rmi-sticky .rmi-table thead th{position:sticky;top:0;z-index:2;background:#e6f2f4;box-shadow:0 1px 0 var(--rmi-line)}
.rmi-sort{display:inline-flex;align-items:center;gap:4px;background:none;border:0;padding:0;font:inherit;font-weight:700;color:inherit;cursor:pointer;white-space:nowrap}
.rmi-sort:hover,.rmi-sort.on{color:var(--rmi-teal)}
.rmi-table th.r .rmi-sort{justify-content:flex-end}
.rmi-table th.c .rmi-sort{justify-content:center}
.rmi-row-click:focus-visible{outline-offset:-2px}
tr.st-critical td:first-child{box-shadow:inset 4px 0 0 var(--rmi-red)}
tr.st-low td:first-child{box-shadow:inset 4px 0 0 #e0a21f}
tr.st-balanced td:first-child{box-shadow:inset 4px 0 0 var(--rmi-green)}
tr.st-overstocked td:first-child{box-shadow:inset 4px 0 0 #8a63c9}
tr.st-nodemand td:first-child{box-shadow:inset 4px 0 0 #cbd7da}
.rmi-cover{display:flex;flex-direction:column;gap:4px;min-width:110px}
.rmi-cover-num{font-weight:700;font-size:12px}
.rmi-bar{position:relative;height:6px;border-radius:999px;background:#e3edef;overflow:visible}
.rmi-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
.rmi-fill.s-critical{background:var(--rmi-red)}.rmi-fill.s-low{background:#e0a21f}.rmi-fill.s-balanced{background:var(--rmi-green)}
.rmi-fill.s-overstocked{background:#8a63c9}.rmi-fill.s-nodemand{background:#b9c9cd}
.rmi-bar b{position:absolute;top:-2px;bottom:-2px;width:1px;background:rgba(22,50,58,.35)}
.rmi-incart{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--rmi-green)}
.rmi-invalid{border-color:var(--rmi-red) !important;background:#fdf1f0 !important}

/* tiles */
.rmi-tiles{display:flex;flex-wrap:wrap;gap:10px}
.rmi-tile{flex:1 1 130px;background:var(--rmi-bg);border:1px solid var(--rmi-line);border-radius:10px;padding:10px 14px}
.rmi-tile span{display:block;font-size:11px;color:var(--rmi-muted)}
.rmi-tile strong{font-size:17px;font-weight:800}
.rmi-nobar{border:0;padding:0}
.rmi-danger{border-color:#efcfca;background:#fdf6f5}
.rmi-btn-danger{color:var(--rmi-red)}

/* register */
.rmi-reg-toggle{display:flex;align-items:center;gap:12px;background:none;border:0;padding:0;cursor:pointer;color:inherit;font:inherit;text-align:left}
.rmi-caret{display:inline-flex;transition:transform .15s;transform:rotate(-90deg)}
.rmi-caret.open{transform:rotate(0)}
.rmi-stat.s-draft{background:#eef3f4}.rmi-stat.s-submitted{background:#e8ecfb}.rmi-stat.s-approved{background:#e3f4ec}
.rmi-stat.s-poplaced{background:var(--rmi-gold-soft)}.rmi-stat.s-closed{background:#e4e8e9;color:#5a6b70}

/* modal */
.rmi-modal-back{position:fixed;inset:0;z-index:2100;background:rgba(10,40,46,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.rmi-modal{width:min(780px,100%);max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden}
.rmi-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 20px;border-bottom:1px solid var(--rmi-line)}
.rmi-modal-head h3{margin:0;font-size:16px;font-weight:700}
.rmi-modal-head p{margin:2px 0 0;font-size:11.5px;color:var(--rmi-muted)}
.rmi-modal-body{padding:16px 20px;overflow:auto;display:flex;flex-direction:column;gap:16px}
.rmi-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--rmi-line);background:var(--rmi-bg)}
.rmi-detect{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;font-size:12px;font-weight:600}
.rmi-detect.good{background:#e3f4ec;color:#176d47}
.rmi-detect.bad{background:#fbe8e6;color:#a8342a}

/* toasts */
.rmi-toasts{position:fixed;right:18px;bottom:18px;z-index:2200;display:flex;flex-direction:column;gap:8px;max-width:min(380px,calc(100vw - 36px))}
.rmi-toast{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--rmi-teal-dark);color:#fff;font-size:12.5px;box-shadow:0 10px 30px rgba(0,0,0,.25);animation:rmi-in .2s ease-out}
.rmi-toast.t-success{background:#17694a}
.rmi-toast.t-warn{background:#9a3b22}
.rmi-toast span{flex:1}
.rmi-toast-act{background:rgba(255,255,255,.18);border:0;color:#fff;font-weight:700;font-size:11.5px;padding:3px 10px;border-radius:6px;cursor:pointer}
.rmi-toast-act:hover{background:rgba(255,255,255,.3)}
.rmi-toast-x{background:none;border:0;color:rgba(255,255,255,.7);cursor:pointer;padding:2px}
@keyframes rmi-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

@media (max-width:900px){.rmi-guide-grid{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){
  .rmi-toast{animation:none}
  .rmi-drawer,.rmi-backdrop,.rmi-caret,.rmi-switch-track,.rmi-switch-track:after{transition:none}
}
`;