import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

/* ─────────────── embedded icons (same set as the Reel Register page) ─────────────── */
const Icons = {
  Factory: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" />
    </svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Reel: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v5" /><path d="M12 16v5" /><path d="M3 12h5" /><path d="M16 12h5" />
    </svg>
  ),
  Alert: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Gauge: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  )
};

/* 🎨 presentation helper: round icon badge + heading + small pill */
const SectionHead = ({ icon: Icon, color = "blue", title, pill }) => (
  <div className="pr-section-title">
    <div className="pr-heading-with-icon">
      <div className={`pr-heading-icon-badge ${color}`}>
        <Icon />
      </div>
      <h2>{title}</h2>
    </div>
    {pill ? <span className="pr-section-pill">{pill}</span> : null}
  </div>
);

/* ─────────────────────────────── STYLES ─────────────────────────────── */
const CSS = `
  @keyframes prGlowPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }

  .pr-root {
    min-height: 100vh;
    color: #0b2f4f;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    background:
      radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.85) 0, rgba(255, 255, 255, 0) 30%),
      radial-gradient(circle at 88% 18%, rgba(160, 228, 255, 0.7) 0, rgba(160, 228, 255, 0) 32%),
      radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
      linear-gradient(165deg, #eaf8ff 0%, #c9ecfb 38%, #a6dcf5 72%, #d9f2fd 100%);
    background-attachment: fixed;
  }
  .pr-root * { box-sizing: border-box; }

  /* ── glossy hero header ── */
  .pr-header {
    position: sticky;
    top: 8px;
    z-index: 100;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin: 8px 18px 0;
    padding: 9px 20px;
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(222, 244, 254, 0.8) 100%);
    border: 1px solid rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 14px 30px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140, 210, 245, 0.2);
  }
  .pr-header-left { display: flex; align-items: center; gap: 14px; }
  .pr-emblem {
    width: 42px; height: 42px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
    background: radial-gradient(circle at 30% 25%, #b6ecff 0%, #34b6f0 40%, #0a6fb8 100%);
    box-shadow: 0 8px 18px rgba(2, 60, 110, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.8), inset 0 -4px 8px rgba(0, 60, 120, 0.35);
  }
  .pr-header-title { font-size: 21px; font-weight: 800; color: #0a4f8c; letter-spacing: -0.4px; }
  .pr-header-sub   { font-size: 11.5px; color: #4a7391; font-weight: 600; margin-top: 1px; }
  .pr-header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .pr-count-pill {
    display: flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 30px;
    font-size: 12px; font-weight: 700; color: #0b2f4f;
    background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
    border: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 12px rgba(2, 60, 110, 0.25), inset 0 1px 0 #fff;
  }
  .pr-pulse-dot {
    width: 9px; height: 9px; border-radius: 50%;
    background: #22c55e; box-shadow: 0 0 10px #22c55e; animation: prGlowPulse 2s infinite;
  }
  .pr-export-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.6);
    font-size: 13px; font-weight: 800; color: #fff; cursor: pointer;
    text-shadow: 0 1px 2px rgba(0, 60, 110, 0.35);
    background: linear-gradient(180deg, #b9f5d6 0%, #5fdda6 48%, #2cc58a 52%, #14a870 100%);
    box-shadow: 0 3px 0 #0d8a5a, 0 8px 14px rgba(20, 168, 112, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.85);
    transition: transform .12s ease, filter .12s ease;
  }
  .pr-export-btn:hover { transform: translateY(-1px); filter: brightness(1.05); }
  .pr-export-btn:active { transform: translateY(2px); }
    .pr-field .pr-export-btn { min-height: 36px; justify-content: center; }

  /* ── body ── */
  .pr-body { max-width: 1500px; margin: 0 auto; padding: 16px 18px 40px; }

  /* ── glass filter card ── */
  .pr-filter-card {
    position: relative;
    margin-bottom: 18px;
    padding: 14px 18px 16px;
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(226, 246, 255, 0.86) 100%);
    border: 1px solid rgba(255, 255, 255, 0.95);
    box-shadow: 0 14px 32px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff, inset 0 -12px 26px rgba(140, 210, 245, 0.2);
  }
  .pr-filter-title {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    font-size: 12px; font-weight: 800; color: #0a4f8c;
    text-transform: uppercase; letter-spacing: 0.6px;
  }
  .pr-filter-title::before {
    content: ''; display: inline-block; width: 4px; height: 14px; border-radius: 2px;
    background: linear-gradient(180deg, #5cc4f2, #1b8fd6);
  }
  .pr-filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
    gap: 10px 12px;
    align-items: end;
  }
  .pr-field { display: flex; flex-direction: column; gap: 4px; }
  .pr-label { font-size: 11px; font-weight: 800; color: #0b2f4f; text-transform: uppercase; letter-spacing: 0.4px; }
  .pr-input, .pr-select {
    min-height: 36px; padding: 6px 12px; outline: none;
    border: 1.5px solid #9ccbe6; border-radius: 12px;
    background: #ffffff; color: #0b2f4f; font-size: 13px; font-weight: 700;
    box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.12), 0 1px 0 rgba(255, 255, 255, 0.9);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .pr-input::placeholder { color: #7b9db5; font-weight: 600; }
  .pr-input:focus, .pr-select:focus {
    border-color: #1b9be0;
    box-shadow: inset 0 1px 2px rgba(10, 80, 130, 0.08), 0 0 0 4px rgba(27, 155, 224, 0.22);
  }
  .pr-clear-btn {
    min-height: 36px; padding: 0 16px; cursor: pointer;
    border: 1.5px solid #9ccbe6; border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
    color: #0a4f8c; font-size: 13px; font-weight: 800;
    box-shadow: 0 3px 8px rgba(10, 80, 130, 0.12), inset 0 1px 0 #fff;
    transition: all 0.15s;
  }
  .pr-clear-btn:hover { background: linear-gradient(180deg, #ffe9e9 0%, #ffc9c9 100%); border-color: #f1a1a1; color: #b91c1c; }

  /* ── table visibility dropdown ── */
  .tv-wrapper { position: relative; }
  .tv-trigger {
    display: flex; align-items: center; gap: 8px; width: 100%;
    min-height: 36px; padding: 0 14px; cursor: pointer; white-space: nowrap;
    border: 1.5px solid #9ccbe6; border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
    color: #0a4f8c; font-size: 13px; font-weight: 800;
    box-shadow: 0 3px 8px rgba(10, 80, 130, 0.12), inset 0 1px 0 #fff;
    transition: 0.15s;
  }
  .tv-trigger:hover { border-color: #1b9be0; color: #0a5fa8; }
  .tv-trigger .tv-arrow { font-size: 10px; transition: transform 0.2s; margin-left: auto; }
  .tv-trigger .tv-arrow.open { transform: rotate(180deg); }
  .tv-dropdown {
    position: absolute; top: calc(100% + 8px); right: 0; z-index: 999;
    min-width: 250px; padding: 8px 6px;
    background: linear-gradient(180deg, #ffffff 0%, #eaf8ff 100%);
    border: 1.5px solid #a6d6ee; border-radius: 16px;
    box-shadow: 0 16px 40px rgba(10, 80, 130, 0.25);
    animation: tvFadeIn 0.15s ease;
  }
  @keyframes tvFadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .tv-dropdown-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 10px 10px; margin-bottom: 4px; border-bottom: 1px solid #cfe6f5;
  }
  .tv-dropdown-header span {
    font-size: 11px; font-weight: 800; color: #4a7391;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .tv-select-all {
    font-size: 11px; font-weight: 800; color: #0a5fa8;
    cursor: pointer; border: none; background: none; padding: 0;
  }
  .tv-select-all:hover { text-decoration: underline; }
  .tv-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 10px;
    cursor: pointer; transition: background 0.1s; user-select: none;
  }
  .tv-item:hover { background: #d9f2fc; }
  .tv-checkbox {
    width: 16px; height: 16px; flex-shrink: 0;
    border: 2px solid #9ccbe6; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; background: #fff;
  }
  .tv-checkbox.checked { background: #1b8fd6; border-color: #1b8fd6; }
  .tv-checkbox.checked::after { content: '✓'; color: #fff; font-size: 10px; font-weight: 900; }
  .tv-item-label { font-size: 13px; font-weight: 700; color: #0b2f4f; }

  /* ── section heading with round icon badge ── */
  .pr-section-title {
    display: flex; justify-content: space-between; align-items: center;
    margin: 18px 0 8px;
  }
  .pr-heading-with-icon { display: flex; align-items: center; gap: 10px; }
  .pr-heading-icon-badge {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: #fff;
    box-shadow: 0 5px 12px rgba(2, 60, 110, 0.3), inset 0 2px 2px rgba(255, 255, 255, 0.7);
  }
  .pr-heading-icon-badge svg { width: 16px; height: 16px; }
  .pr-heading-icon-badge.blue   { background: radial-gradient(circle at 30% 25%, #b6ecff, #34b6f0 45%, #0a6fb8); }
  .pr-heading-icon-badge.purple { background: radial-gradient(circle at 30% 25%, #d9ccff, #8b5cf6 50%, #5b21b6); }
  .pr-heading-icon-badge.amber  { background: radial-gradient(circle at 30% 25%, #ffe6a8, #f59e0b 50%, #b45309); }
  .pr-heading-icon-badge.green  { background: radial-gradient(circle at 30% 25%, #b4f5d0, #10b981 50%, #047857); }
  .pr-section-title h2 { font-size: 15px; font-weight: 800; margin: 0; color: #0b2f4f; }
  .pr-section-pill {
    font-size: 11px; font-weight: 800; padding: 4px 11px; border-radius: 20px;
    text-transform: uppercase; letter-spacing: 0.5px;
    background: linear-gradient(180deg, #ffffff, #d4f0fd); color: #0a4f8c; border: 1px solid #a6d6ee;
  }

  /* ── KPI cards ── */
  .pr-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
    gap: 14px;
    margin-bottom: 8px;
  }
  .pr-kpi {
    padding: 16px 16px; text-align: center; border-radius: 22px;
    background: linear-gradient(180deg, #ffffff 0%, #eaf7fe 100%);
    border: 1px solid #cfe8f6;
    box-shadow: 0 12px 24px rgba(10, 100, 160, 0.14), inset 0 1px 0 #fff;
    transition: 0.2s;
  }
  .pr-kpi:hover { transform: translateY(-2px); box-shadow: 0 16px 28px rgba(10, 100, 160, 0.2), inset 0 1px 0 #fff; }
  .pr-kpi-label { font-size: 11px; font-weight: 800; color: #4a7391; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
  .pr-kpi-value { font-size: 28px; font-weight: 900; color: #0b2f4f; letter-spacing: -0.5px; }
  .pr-kpi-value.danger { color: #dc2626; }
  .pr-kpi-value.success { color: #059669; }
  .pr-kpi-value.info { color: #0a5fa8; }

  /* ── colorful table card ── */
  .pr-table-card {
    margin-bottom: 8px; overflow: hidden; border-radius: 18px;
    background: #ffffff; border: 1px solid #a6d6ee;
    box-shadow: 0 8px 20px rgba(10, 100, 160, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }
  .pr-table-wrap {
    max-height: 280px; overflow: auto;
    scrollbar-width: thin; scrollbar-color: #84b5ce #e8f4fa;
  }
  .pr-table {
    width: 100%; border-collapse: separate; border-spacing: 0;
    white-space: nowrap; font-size: 13px; background: #fff;
  }
  .pr-table th {
    position: sticky; top: 0; z-index: 3;
    padding: 11px 14px; text-align: left;
    background: linear-gradient(180deg, #f4fbff 0%, #d9eefb 100%);
    color: #0a4f8c; font-size: 11px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.4px;
    border-bottom: 2px solid #9ccbe6;
    border-right: 1px solid #e1f0f9;
  }
  .pr-table th:last-child { border-right: none; }
  .pr-table td {
    padding: 10px 14px;
    border-bottom: 1px solid #dcecf6;
    border-right: 1px solid #f1f8fc;
    color: #0b2f4f; font-weight: 600; background: #ffffff;
  }
  .pr-table td:last-child { border-right: none; }
  .pr-table tbody tr:nth-child(even) td { background: #f3faff; }
  .pr-table tbody tr:hover td { background: #d9f2fc; }
  .pr-table tbody tr:hover td:first-child { border-left: 3px solid #1b8fd6; }

  .pr-table td:first-child {
    color: #4a7391; font-weight: 800; font-size: 12px;
    text-align: center; width: 40px;
  }

  /* ── badge ── */
  .pr-badge {
    display: inline-flex; align-items: center;
    border-radius: 10px; padding: 3px 10px;
    font-size: 11px; font-weight: 800;
  }
  .pr-badge-prod   { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .pr-badge-idle   { background: #dff1fd; color: #0a5fa8; border: 1px solid #a6d6ee; }
  .pr-badge-break  { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  .pr-badge-other  { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

  .pr-shift-day   { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
  .pr-shift-night { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }

  .pr-trunc {
    display: inline-block; max-width: 130px;
    overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; cursor: pointer; vertical-align: bottom;
    color: #0b2f4f;
  }
  .pr-trunc:hover { color: #0a5fa8; }
  .pr-trunc.expanded { max-width: 300px; white-space: normal; word-break: break-word; }

  .pr-empty {
    padding: 48px; text-align: center; color: #4a7391;
    font-weight: 700; font-size: 14px;
  }

  .waste-good  { color: #059669 !important; font-weight: 800; }
  .waste-bad   { color: #dc2626 !important; font-weight: 800; }
  .util-good { color: #059669 !important; font-weight: 800; }
  .util-bad  { color: #dc2626 !important; font-weight: 800; }

  @media (max-width: 768px) {
    .pr-header { margin: 8px 10px 0; padding: 10px 14px; top: 0; position: relative; }
    .pr-body { padding-left: 10px; padding-right: 10px; }
    .pr-kpi-value { font-size: 22px; }
    .tv-dropdown { right: auto; left: 0; }
  }
`;

/* ─────────────────────── helpers ─────────────────────── */
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN") : "—";

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  let hr = Number(h);
  const ap = hr >= 12 ? "PM" : "AM";
  hr = hr % 12 || 12;
  return `${hr}:${m} ${ap}`;
};

const getMinutes = (from, to) => {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let a = fh * 60 + fm, b = th * 60 + tm;
  if (b <= a) b += 24 * 60;
  return b - a;
};

const fmtMinutes = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}h ${m}m`;
};

/* table ids used throughout */
const TABLE_DEFS = [
  { id: "jobMachine", label: "Jobwise Machine Production" },
  { id: "jobWaste",   label: "Jobwise Wastage" },
  { id: "woProduction", label: "Work Order Production" },
  { id: "machineProd",label: "Machine Production" },
  { id: "machineUtil",label: "Machine Utilization" },
  { id: "allRecords", label: "All Records" },
];

function StatusBadge({ status }) {
  const v = status?.toLowerCase();
  const cls = v === "production" ? "pr-badge-prod"
    : v === "idle" ? "pr-badge-idle"
    : v === "breakdown" ? "pr-badge-break"
    : "pr-badge-other";
  return <span className={`pr-badge ${cls}`}>{status || "—"}</span>;
}

function TruncCell({ text, id, expanded, setExpanded }) {
  const isOpen = expanded === id;
  return (
    <span
      className={`pr-trunc${isOpen ? " expanded" : ""}`}
      title={text}
      onClick={() => setExpanded(isOpen ? null : id)}
    >
      {text || "—"}
    </span>
  );
}

/* ── Table Visibility Dropdown ── */
function TableVisibilityDropdown({ visible, setVisible }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id) => {
    setVisible(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setVisible(TABLE_DEFS.map(t => t.id));
  const clearAll  = () => setVisible([]);

  return (
    <div className="tv-wrapper" ref={ref}>
      <button className="tv-trigger" onClick={() => setOpen(o => !o)}>
        📋 Show Tables ({visible.length}/{TABLE_DEFS.length})
        <span className={`tv-arrow${open ? " open" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="tv-dropdown">
          <div className="tv-dropdown-header">
            <span>Select Tables</span>
            <button
              className="tv-select-all"
              onClick={visible.length === TABLE_DEFS.length ? clearAll : selectAll}
            >
              {visible.length === TABLE_DEFS.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          {TABLE_DEFS.map(t => (
            <div key={t.id} className="tv-item" onClick={() => toggle(t.id)}>
              <div className={`tv-checkbox${visible.includes(t.id) ? " checked" : ""}`} />
              <span className="tv-item-label">{t.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */
export default function Productionreportt() {
  const token = localStorage.getItem("token");
  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [records, setRecords]                 = useState([]);
  const [machines, setMachines]               = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [expanded, setExpanded]               = useState(null);

  /* all tables visible by default */
  const [visibleTables, setVisibleTables] = useState(["jobMachine"]);

  const show = (id) => visibleTables.includes(id);

  /* ── filters ── */
  const [searchWO, setSearchWO]             = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [machineFilter, setMachineFilter]   = useState("");
  const [statusFilter, setStatusFilter]     = useState("");
  const [shiftFilter, setShiftFilter]       = useState("");
  const [fromDate, setFromDate]             = useState("");
  const [toDate, setToDate]                 = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [printerFilter, setPrinterFilter]   = useState("");

  /* ── fetch ── */
  useEffect(() => {
    if (!token) return;
    axios.get(`${BASE_URL}/api/production-machine-status`, authHeaders)
      .then(r => setRecords((r.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))))
      .catch(console.error);
    axios.get(`${BASE_URL}/api/master/machines`, authHeaders)
      .then(r => setMachines(r.data || [])).catch(console.error);
    axios.get(`${BASE_URL}/api/master/machine-status`, authHeaders)
      .then(r => setMachineStatuses(r.data || [])).catch(console.error);
  }, [token]);

  const customers = useMemo(() =>
    [...new Set(records.map(r => r.customerName).filter(Boolean))], [records]);

  const locationOptions = useMemo(() =>
    [...new Set(records.flatMap(r => r.userLocations || []).filter(Boolean))], [records]);

  const printerOptions = useMemo(() =>
    [...new Set(records.map(r => r.printerName).filter(Boolean))], [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      const d = item.productionDate ? new Date(item.productionDate) : null;
      if (searchWO && !String(item.woNumber || "").toLowerCase().includes(searchWO.toLowerCase())) return false;
      if (customerFilter && item.customerName?.trim() !== customerFilter.trim()) return false;
      if (machineFilter && (item.machineId?.machineName || item.machineName) !== machineFilter) return false;
      if (statusFilter && item.machineStatus !== statusFilter) return false;
      if (shiftFilter && item.shift !== shiftFilter) return false;
      if (fromDate && d && d < new Date(fromDate)) return false;
      if (toDate && d && d > new Date(new Date(toDate).setHours(23, 59, 59, 999))) return false;
      if (locationFilter && !(item.userLocations || []).includes(locationFilter)) return false;
      if (printerFilter && item.printerName !== printerFilter) return false;
      return true;
    });
  }, [records, searchWO, customerFilter, machineFilter, statusFilter, shiftFilter, fromDate, toDate, locationFilter, printerFilter]);

  const clearFilters = () => {
    setSearchWO(""); setCustomerFilter(""); setMachineFilter("");
    setStatusFilter(""); setShiftFilter(""); setFromDate(""); setToDate("");
    setLocationFilter(""); setPrinterFilter("");
  };

  /* ══════════════ ANALYTICS ══════════════ */
  const prodRecords = useMemo(() =>
    filteredRecords.filter(r => r.machineStatus === "PRODUCTION"), [filteredRecords]);

  const totalOrders     = useMemo(() => new Set(prodRecords.map(r => r.woNumber).filter(Boolean)).size, [prodRecords]);
  const totalProduction = useMemo(() => prodRecords.reduce((s, r) => s + Number(r.totalPages || 0), 0), [prodRecords]);
  const totalWastage    = useMemo(() => prodRecords.reduce((s, r) => s + Number(r.wastageSheets || 0), 0), [prodRecords]);
  const avgWaste        = useMemo(() => totalProduction ? ((totalWastage / totalProduction) * 100).toFixed(2) : "0.00", [totalProduction, totalWastage]);

  const usedMachineNames = useMemo(() => {
    const seen = new Set(), list = [];
    filteredRecords.forEach(item => {
      const m = item.machineId?.machineName || item.machineName;
      if (m && !seen.has(m)) { seen.add(m); list.push(m); }
    });
    return list;
  }, [filteredRecords]);

  const jobMachinePerf = useMemo(() => {
    const map = {};
    prodRecords.forEach(item => {
      const wo = item.woNumber;
      const machine = item.machineId?.machineName || item.machineName;
      if (!wo || !machine) return;
      if (!map[wo]) map[wo] = { workOrder: wo, customer: item.customerName, machines: {}, wastage: {} };
      map[wo].machines[machine] = (map[wo].machines[machine] || 0) + Number(item.totalPages || 0);
      map[wo].wastage[machine]  = (map[wo].wastage[machine] || 0) + Number(item.wastageSheets || 0);
    });
    return Object.values(map).sort((a, b) => b.workOrder - a.workOrder);
  }, [prodRecords]);

  const woProduction = useMemo(() => {
    const map = {};
    jobMachinePerf.forEach(job => {
      const key = job.workOrder;
      if (!map[key]) map[key] = { workOrder: key, customer: job.customer, production: 0, wastage: 0 };
      usedMachineNames.forEach(m => {
        map[key].production += job.machines[m] || 0;
        map[key].wastage    += job.wastage[m]  || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.workOrder - a.workOrder);
  }, [jobMachinePerf, usedMachineNames]);

  const machineProduction = useMemo(() => {
    const map = {};
    prodRecords.forEach(item => {
      const m = item.machineId?.machineName || item.machineName;
      if (!m) return;
      const p = item.printerName || "";
      const key = m + "||" + p;
      if (!map[key]) map[key] = { machine: m, printer: p, production: 0, wastage: 0 };
      map[key].production += Number(item.totalPages    || 0);
      map[key].wastage    += Number(item.wastageSheets || 0);
    });
    return Object.values(map).filter(m => m.production > 0 || m.wastage > 0);
  }, [prodRecords]);

  const machineUtilization = useMemo(() => {
    const map = {};
    filteredRecords.forEach(item => {
      const machine = item.machineId?.machineName || item.machineName;
      const printer = item.printerName || "";
      const date = item.productionDate ? new Date(item.productionDate).toISOString().split("T")[0] : null;
      if (!machine || !date) return;
      const key = machine + "_" + printer + "_" + date;
      if (!map[key]) {
        map[key] = { machine, printer, date };
        machineStatuses.forEach(s => { map[key][s.statusName] = 0; });
      }
      const mins = getMinutes(item.fromTime, item.toTime);
      const status = item.machineStatus;
      if (status && map[key][status] !== undefined) map[key][status] += mins;
    });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredRecords, machineStatuses]);

  /* ══════════════════════════ EXPORT ══════════════════════════ */
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
      "Total Orders": totalOrders,
      "Total Production (Pages)": totalProduction,
      "Total Wastage (Sheets)": totalWastage,
      "Average Waste %": avgWaste
    }]), "KPI");
    const jmpData = jobMachinePerf.map(j => {
      const row = { "WO No": j.workOrder, "Customer": j.customer };
      usedMachineNames.forEach(m => { if ((j.machines[m] || 0) > 0) row[m + " Production"] = j.machines[m]; });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jmpData), "Job Machine Production");
    const jwData = jobMachinePerf.map(j => {
      const row = { "WO No": j.workOrder, "Customer": j.customer };
      usedMachineNames.forEach(m => { if ((j.wastage[m] || 0) > 0) row[m + " Wastage"] = j.wastage[m]; });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jwData), "Job Wastage");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      woProduction.map(m => ({
        "Work Order": m.workOrder, "Customer": m.customer,
        "Production": m.production, "Wastage": m.wastage,
        "Wastage %": m.production ? ((m.wastage / m.production) * 100).toFixed(2) : "0.00"
      }))
    ), "WO Production");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      machineProduction.map(m => ({
        Machine: m.machine, Printer: m.printer || "", Production: m.production, Wastage: m.wastage,
        "Wastage %": m.production ? ((m.wastage / m.production) * 100).toFixed(2) : "0.00"
      }))
    ), "Machine Production");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      machineUtilization.map(m => {
        const row = { Date: m.date, Machine: m.machine, Printer: m.printer || "" };
        machineStatuses.forEach(s => { row[s.statusName] = fmtMinutes(m[s.statusName] || 0); });
        row["Utilization %"] = (((m["PRODUCTION"] || 0) / 60 / 24) * 100).toFixed(2);
        return row;
      })
    ), "Machine Utilization");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      filteredRecords.map((item, i) => ({
        "#": i + 1, Date: fmtDate(item.productionDate),
        "WO Number": item.woNumber || "", Shift: item.shift || "",
        Activity: item.activityId?.activityName || item.activityName || "",
        Machine: item.machineId?.machineName || item.machineName || "",
        Status: item.machineStatus || "", Customer: item.customerName || "",
        Item: item.materialType || "",
        "From Time": fmtTime(item.fromTime), "To Time": fmtTime(item.toTime),
        "Total Pages": item.totalPages || "", "Wastage Sheets": item.wastageSheets || "",
        "Waste %": item.wastePercentage || "", Reason: item.reason || "",
        Operator: item.enteredBy || "", Remarks: item.remarks || ""
      }))
    ), "All Records");
    XLSX.writeFile(wb, "Production_Report.xlsx");
  };

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <div className="pr-root">
      <style>{CSS}</style>



      <div className="pr-body">

        {/* ── Filters ── */}
        <div className="pr-filter-card">
          <div className="pr-filter-title text-black">
            Filters
            <span
              className="pr-count-pill"
              style={{ marginLeft: "auto", textTransform: "none", letterSpacing: 0 }}
            >
              <span className="pr-pulse-dot"></span>
              <span>{filteredRecords.length} records</span>
            </span>
          </div>
          <div className="pr-filter-grid">
            <div className="pr-field">
              <label className="pr-label">WO Number</label>
              <input className="pr-input" placeholder="Search WO…" value={searchWO}
                onChange={e => setSearchWO(e.target.value)} />
            </div>
            <div className="pr-field">
              <label className="pr-label">Customer</label>
              <select className="pr-select" value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}>
                <option value="">All Customers</option>
                {customers.map((c, i) => <option key={i}>{c}</option>)}
              </select>
            </div>
            <div className="pr-field">
              <label className="pr-label">Machine</label>
              <select className="pr-select" value={machineFilter} onChange={e => setMachineFilter(e.target.value)}>
                <option value="">All Machines</option>
                {machines.map(m => <option key={m._id} value={m.machineName}>{m.machineName}</option>)}
              </select>
            </div>
            <div className="pr-field">
              <label className="pr-label">Status</label>
              <select className="pr-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {machineStatuses.map(s => <option key={s._id} value={s.statusName}>{s.statusName}</option>)}
              </select>
            </div>
            <div className="pr-field">
              <label className="pr-label">Shift</label>
              <select className="pr-select" value={shiftFilter} onChange={e => setShiftFilter(e.target.value)}>
                <option value="">All Shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <div className="pr-field">
              <label className="pr-label">From Date</label>
              <input type="date" className="pr-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="pr-field">
              <label className="pr-label">To Date</label>
              <input type="date" className="pr-input" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <div className="pr-field">
              <label className="pr-label">User Location</label>
              <select className="pr-select" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                <option value="">All Locations</option>
                {locationOptions.map((l, i) => <option key={i} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="pr-field">
              <label className="pr-label">Printer</label>
              <select className="pr-select" value={printerFilter} onChange={e => setPrinterFilter(e.target.value)}>
                <option value="">All Printers</option>
                {printerOptions.map((p, i) => <option key={i} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="pr-field">
              <label className="pr-label">&nbsp;</label>
              <button className="pr-clear-btn" onClick={clearFilters}>✕ Clear</button>
            </div>
            <div className="pr-field">
              <label className="pr-label">Show Tables</label>
              <TableVisibilityDropdown visible={visibleTables} setVisible={setVisibleTables} />
            </div>
            <div className="pr-field">
              <label className="pr-label">&nbsp;</label>
              <button className="pr-export-btn" onClick={exportExcel}>⬇ Export Excel</button>
            </div>
          </div>
        </div>

        {/* ══ KPI ══ */}
        <SectionHead icon={Icons.Gauge} color="blue" title="KPI Overview" />
        <div className="pr-kpi-grid">
          <div className="pr-kpi">
            <div className="pr-kpi-label">Total Orders</div>
            <div className="pr-kpi-value info">{totalOrders}</div>
          </div>
          <div className="pr-kpi">
            <div className="pr-kpi-label">Total Production</div>
            <div className="pr-kpi-value success">{totalProduction.toLocaleString("en-IN")}</div>
          </div>
          <div className="pr-kpi">
            <div className="pr-kpi-label">Total Wastage</div>
            <div className="pr-kpi-value danger">{totalWastage.toLocaleString("en-IN")}</div>
          </div>
          <div className="pr-kpi">
            <div className="pr-kpi-label">Avg Waste %</div>
            <div className="pr-kpi-value danger">{avgWaste}%</div>
          </div>
          <div className="pr-kpi">
            <div className="pr-kpi-label">Total Records</div>
            <div className="pr-kpi-value">{filteredRecords.length}</div>
          </div>
        </div>

        {/* ══ Jobwise Machine Production ══ */}
        {show("jobMachine") && (
          <>
            <SectionHead icon={Icons.Reel} color="blue" title="Jobwise Machine Production" />
            <div className="pr-table-card">
              <div className="pr-table-wrap">
                {jobMachinePerf.length === 0
                  ? <div className="pr-empty">No data</div>
                  : (
                    <table className="pr-table">
                      <thead>
                        <tr>
                          <th>#</th><th>WO No</th><th>Customer</th>
                          {usedMachineNames.map(m => (
                            <th key={m}>
                              <span title={m} style={{
                                cursor: "pointer", display: "inline-block",
                                maxWidth: expanded === m + "mh" ? 300 : 90,
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: expanded === m + "mh" ? "normal" : "nowrap",
                                verticalAlign: "bottom"
                              }}
                              onClick={() => setExpanded(expanded === m + "mh" ? null : m + "mh")}>
                                {m} (Prod)
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jobMachinePerf.map((j, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td><b>{j.workOrder}</b></td>
                            <td><TruncCell text={j.customer} id={"jmp" + i} expanded={expanded} setExpanded={setExpanded} /></td>
                            {usedMachineNames.map(m => (
                              <td key={m}>{(j.machines[m] || 0) > 0 ? Number(j.machines[m]).toLocaleString("en-IN") : <span style={{color:"#94a3b8"}}>—</span>}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
          </>
        )}

        {/* ══ Jobwise Wastage ══ */}
        {show("jobWaste") && (
          <>
            <SectionHead icon={Icons.Alert} color="amber" title="Jobwise Wastage" />
            <div className="pr-table-card">
              <div className="pr-table-wrap">
                {jobMachinePerf.length === 0
                  ? <div className="pr-empty">No data</div>
                  : (
                    <table className="pr-table">
                      <thead>
                        <tr>
                          <th>#</th><th>WO No</th><th>Customer</th>
                          {usedMachineNames.map(m => (
                            <th key={m}>
                              <span title={m} style={{
                                cursor: "pointer", display: "inline-block",
                                maxWidth: expanded === m + "wh" ? 300 : 90,
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: expanded === m + "wh" ? "normal" : "nowrap",
                                verticalAlign: "bottom"
                              }}
                              onClick={() => setExpanded(expanded === m + "wh" ? null : m + "wh")}>
                                {m} (Waste)
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jobMachinePerf.map((j, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td><b>{j.workOrder}</b></td>
                            <td><TruncCell text={j.customer} id={"jw" + i} expanded={expanded} setExpanded={setExpanded} /></td>
                            {usedMachineNames.map(m => (
                              <td key={m}>{(j.wastage[m] || 0) > 0 ? Number(j.wastage[m]).toLocaleString("en-IN") : <span style={{color:"#94a3b8"}}>—</span>}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
          </>
        )}

        {/* ══ WO Production ══ */}
        {show("woProduction") && (
          <>
            <SectionHead icon={Icons.Factory} color="green" title="Work Order Production" />
            <div className="pr-table-card">
              <div className="pr-table-wrap">
                {woProduction.length === 0
                  ? <div className="pr-empty">No data</div>
                  : (
                    <table className="pr-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Work Order</th><th>Customer</th>
                          <th>Production</th><th>Wastage</th><th>Wastage %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {woProduction.map((m, i) => {
                          const pct = m.production ? ((m.wastage / m.production) * 100).toFixed(2) : "0.00";
                          return (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td><b>{m.workOrder}</b></td>
                              <td><TruncCell text={m.customer} id={"wo" + i} expanded={expanded} setExpanded={setExpanded} /></td>
                              <td>{m.production.toLocaleString("en-IN")}</td>
                              <td>{m.wastage.toLocaleString("en-IN")}</td>
                              <td className={Number(pct) > 5 ? "waste-bad" : "waste-good"}>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
          </>
        )}

        {/* ══ Machine Production ══ */}
        {show("machineProd") && (
          <>
            <SectionHead icon={Icons.Reel} color="purple" title="Machine Production" />
            <div className="pr-table-card">
              <div className="pr-table-wrap">
                {machineProduction.length === 0
                  ? <div className="pr-empty">No data</div>
                  : (
                    <table className="pr-table">
                      <thead>
                        <tr><th>#</th><th>Machine</th><th>Printer</th><th>Production</th><th>Wastage</th><th>Wastage %</th></tr>
                      </thead>
                      <tbody>
                        {machineProduction.map((m, i) => {
                          const pct = m.production ? ((m.wastage / m.production) * 100).toFixed(2) : "0.00";
                          return (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td><b>{m.machine}</b></td>
                              <td>{m.printer || <span style={{color:"#94a3b8"}}>—</span>}</td>
                              <td>{m.production.toLocaleString("en-IN")}</td>
                              <td>{m.wastage.toLocaleString("en-IN")}</td>
                              <td className={Number(pct) > 5 ? "waste-bad" : "waste-good"}>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
          </>
        )}

        {/* ══ Machine Utilization ══ */}
        {show("machineUtil") && (
          <>
            <SectionHead icon={Icons.Gauge} color="green" title="Machine Utilization (Date-wise)" />
            <div className="pr-table-card">
              <div className="pr-table-wrap">
                {machineUtilization.length === 0
                  ? <div className="pr-empty">No data</div>
                  : (
                    <table className="pr-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Date</th><th>Machine</th><th>Printer</th>
                          {machineStatuses.map(s => <th key={s._id}>{s.statusName}</th>)}
                          <th>Utilization %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {machineUtilization.map((m, i) => {
                          const prodMins = m["PRODUCTION"] || 0;
                          const util = ((prodMins / 60 / 24) * 100).toFixed(2);
                          return (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{m.date}</td>
                              <td><b>{m.machine}</b></td>
                              <td>{m.printer || <span style={{color:"#94a3b8"}}>—</span>}</td>
                              {machineStatuses.map(s => (
                                <td key={s._id}>{fmtMinutes(m[s.statusName] || 0)}</td>
                              ))}
                              <td className={Number(util) > 50 ? "util-good" : "util-bad"}>{util}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
          </>
        )}

        {/* ══ All Records ══ */}
        {show("allRecords") && (
          <>
            <SectionHead icon={Icons.Search} color="purple" title={`All Records (${filteredRecords.length})`} />
            <div className="pr-table-card">
              <div className="pr-table-wrap">
                {filteredRecords.length === 0
                  ? <div className="pr-empty">No records match your filters</div>
                  : (
                    <table className="pr-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Date</th><th>WO No</th><th>Shift</th>
                          <th>Activity</th><th>Machine</th><th>Status</th>
                          <th>Customer</th><th>Item</th>
                          <th>From</th><th>To</th>
                          <th>Pages</th><th>Wastage</th><th>Waste %</th>
                          <th>Reason</th><th>Operator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((item, i) => (
                          <tr key={item._id || i}>
                            <td>{i + 1}</td>
                            <td>{fmtDate(item.productionDate)}</td>
                            <td><b>{item.woNumber || "—"}</b></td>
                            <td>
                              <span className={`pr-badge ${item.shift === "Night" ? "pr-shift-night" : "pr-shift-day"}`}>
                                {item.shift || "—"}
                              </span>
                            </td>
                            <td><TruncCell text={item.activityId?.activityName || item.activityName} id={"act" + i} expanded={expanded} setExpanded={setExpanded} /></td>
                            <td>{item.machineId?.machineName || item.machineName || "—"}</td>
                            <td><StatusBadge status={item.machineStatus} /></td>
                            <td><TruncCell text={item.customerName} id={"cust" + i} expanded={expanded} setExpanded={setExpanded} /></td>
                            <td><TruncCell text={item.materialType} id={"mat" + i} expanded={expanded} setExpanded={setExpanded} /></td>
                            <td>{fmtTime(item.fromTime)}</td>
                            <td>{fmtTime(item.toTime)}</td>
                            <td>{item.totalPages || "—"}</td>
                            <td>{item.wastageSheets || "—"}</td>
                            <td className={Number(item.wastePercentage) > 5 ? "waste-bad" : item.wastePercentage ? "waste-good" : ""}>
                              {item.wastePercentage ? `${item.wastePercentage}%` : "—"}
                            </td>
                            <td><TruncCell text={item.reason} id={"rsn" + i} expanded={expanded} setExpanded={setExpanded} /></td>
                            <td>{item.enteredBy || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}