import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import BASE_URL from "../config/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FiCalendar, FiSun, FiLayers, FiCpu, FiPrinter, FiHash, FiUser, FiBox,
  FiMaximize, FiClock, FiActivity, FiBookOpen, FiTrash2, FiPercent,
  FiAlertTriangle, FiMessageSquare, FiMapPin, FiSave, FiX, FiPlus, FiEdit2,
  FiEdit3, FiFilter, FiDownload, FiFileText, FiList, FiBarChart2,
  FiChevronsLeft, FiChevronLeft, FiChevronRight, FiChevronsRight
} from "react-icons/fi";

/* ── field icons (presentation only) ── */
const PMS_ICONS = {
  "Date": FiCalendar, "From Date": FiCalendar, "To Date": FiCalendar, "Month": FiCalendar,
  "Shift": FiSun, "Activity": FiLayers, "Machine": FiCpu,
  "Printer Name": FiPrinter, "Printer": FiPrinter,
  "WO Number": FiHash, "Customer": FiUser, "Item / Material": FiBox, "Paper Size": FiMaximize,
  "From Time": FiClock, "To Time": FiClock, "From": FiClock, "To": FiClock,
  "Machine Status": FiActivity, "Status": FiActivity,
  "Total Pages": FiBookOpen, "Wastage Sheets": FiTrash2, "Waste %": FiPercent,
  "Reason for Wastage": FiAlertTriangle, "Reason": FiMessageSquare, "Remarks": FiMessageSquare,
  "User Location": FiMapPin
};
const PIcon = ({ name }) => {
  const Icon = PMS_ICONS[name];
  return Icon ? <Icon className="pms-ico" aria-hidden="true" /> : null;
};

/* ── summary report helpers ── */
const getDurationMins = (from, to) => {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let mins = (th * 60 + tm) - (fh * 60 + fm);
  if (mins <= 0) mins += 24 * 60; // crosses midnight
  return mins;
};

const formatHMS = (m) => {
  const total = Math.round((m || 0) * 60);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/* ── dynamic machine-hours status helpers ── */
const normStatus = (s) => String(s || "").trim().toLowerCase();
const isProductionStatus = (s) => ["production", "working"].includes(normStatus(s));
const statusColLabel = (label) =>
  /time$/i.test(label.trim()) ? label.trim() : `${label.trim()} Time`;

const truncateText = (text, length = 25) => {
  if (!text) return "-";
  return text.length > length ? text.substring(0, length) + "..." : text;
};

/* ── table pagination bar (presentational) ── */
const PAGE_SIZES = [10, 25, 50, 100, 200, 500];
const Pagination = ({ page, totalPages, pageSize, total, onPage, onPageSize }) => {
  const [jump, setJump] = useState("");
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const nums = new Set([1, totalPages]);
  for (let n = page - 2; n <= page + 2; n++) if (n >= 1 && n <= totalPages) nums.add(n);
  const items = [];
  let prev = 0;
  [...nums].sort((a, b) => a - b).forEach((n) => {
    if (n - prev > 1) items.push("gap-" + n);
    items.push(n);
    prev = n;
  });

  const goJump = () => {
    onPage(Math.min(Math.max(parseInt(jump, 10) || 1, 1), totalPages));
    setJump("");
  };

  return (
    <div className="pms-pager">
      <div className="pms-pager-info">
        Showing {start.toLocaleString("en-IN")}–{end.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} records
      </div>

      <div className="pms-pager-nav">
        <button type="button" className="pms-pg-btn" disabled={page <= 1} onClick={() => onPage(1)} title="First page" aria-label="First page"><FiChevronsLeft /></button>
        <button type="button" className="pms-pg-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page" aria-label="Previous page"><FiChevronLeft /></button>
        {items.map((it) =>
          typeof it === "string" ? (
            <span key={it} className="pms-pager-gap">…</span>
          ) : (
            <button
              key={it}
              type="button"
              className={`pms-pg-btn ${it === page ? "active" : ""}`}
              onClick={() => onPage(it)}
              aria-current={it === page ? "page" : undefined}
            >
              {it.toLocaleString("en-IN")}
            </button>
          )
        )}
        <button type="button" className="pms-pg-btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)} title="Next page" aria-label="Next page"><FiChevronRight /></button>
        <button type="button" className="pms-pg-btn" disabled={page >= totalPages} onClick={() => onPage(totalPages)} title="Last page" aria-label="Last page"><FiChevronsRight /></button>
      </div>

      <div className="pms-pager-extra">
        <span className="pms-pager-jump">
          <input
            className="pms-input"
            type="number"
            min="1"
            max={totalPages}
            value={jump}
            placeholder={`Page / ${totalPages.toLocaleString("en-IN")}`}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goJump(); } }}
            aria-label="Jump to page"
          />
          <button type="button" className="pms-pg-btn" onClick={goJump}>Go</button>
        </span>
        <select
          className="pms-select"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      </div>
    </div>
  );
};

/* ── Professional Theme (with richer table header color & sharp field visibility) ── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  .pms-root {
    --bg: #f4f6f8;
    --panel: #ffffff;
    --panel-soft: #f8fafb;
    --line: #e2e8f0;
    --line-dark: #b8c3cd;
    --text: #111827;
    --muted: #334155;
    --hint: #64748b;
    --teal: #0f4c5c;
    --teal-dark: #0b3540;
    --teal-soft: #e7f1f3;
    --accent: #e0592a;
    --accent-dark: #c74a1f;
    --green-soft: #e8f6ef;
    --green-text: #1d6b47;
    --red: #d64545;
    --red-soft: #fdecec;
    --red-text: #a12d2d;
    --amber-soft: #fff4e0;
    --amber-text: #8a5a12;
    --blue-soft: #eaf1fb;
    --blue-text: #1f5f99;
    --slate-soft: #eef1f4;
    --slate: #4b5863;
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    font-size: 13.5px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  .pms-root * { box-sizing: border-box; }

  /* ───────── Header ───────── */
  .pms-header {
    background: var(--panel);
    color: var(--text);
    padding: 12px 24px;
    border-bottom: 1px solid var(--line);
  }
  .pms-header-inner {
    max-width: 1580px; margin: 0 auto;
    display: flex; justify-content: flex-end; align-items: center;
    gap: 18px; flex-wrap: wrap;
    position: relative; min-height: 44px;
  }
  .pms-header-inner > div:first-child {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    text-align: center; white-space: nowrap;
  }
  .pms-title {
    font-size: 20px; font-weight: 700; margin: 0; color: var(--text); letter-spacing: -0.2px;
    display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .pms-subtitle { margin-top: 2px; color: var(--muted); font-size: 13px; font-weight: 500; }

  .pms-body { max-width: 1580px; margin: 0 auto; padding: 18px 24px 32px; }

  /* ───────── Cards ───────── */
  .pms-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(16, 24, 40, 0.05);
    overflow: hidden;
    margin-bottom: 18px;
  }
  .pms-card-head {
    background: var(--panel);
    color: var(--text);
    padding: 14px 20px;
    border-bottom: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: center;
    gap: 12px; flex-wrap: wrap;
  }
  .pms-card-title { font-size: 16px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
  .pms-card-title .pms-ico { color: var(--teal); width: 17px; height: 17px; }
  .pms-card-note  { color: var(--muted); font-size: 12px; font-weight: 500; margin-top: 2px; }

  .pms-edit-badge {
    background: var(--amber-soft); color: var(--amber-text);
    border: 1px solid #f3d9a4; border-radius: 999px;
    padding: 3px 12px; font-size: 11.5px; font-weight: 600;
  }

  .pms-form-body { padding: 16px 20px; background: var(--panel); }

  /* ───────── Entry sections ───────── */
  .pms-section {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 12px 16px 14px;
    margin-bottom: 12px;
  }
  .pms-section-title {
    display: flex; align-items: center; gap: 8px;
    color: var(--text);
    font-size: 13.5px; font-weight: 700;
    padding-bottom: 10px; margin-bottom: 12px;
    border-bottom: 1px solid var(--line);
  }
  .pms-section-title .pms-ico { width: 16px; height: 16px; color: var(--teal); }

  .pms-grid   { display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)); gap: 12px 14px; }
  .pms-grid-4 { grid-template-columns: repeat(4, minmax(150px, 1fr)); }
  .pms-grid-remarks { grid-template-columns: 1fr 260px; }
  @media (min-width: 1400px) {
    .pms-grid-7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  }

  .pms-field { display: flex; flex-direction: column; gap: 5px; }
  
  /* ── Enhanced Field Labels ── */
  .pms-label {
    display: flex; align-items: center; gap: 6px;
    color: #1f2937;
    font-size: 11.5px; font-weight: 650;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .pms-label .pms-ico { width: 14px; height: 14px; color: var(--teal); flex-shrink: 0; }
  .pms-req { color: var(--red); margin-left: 2px; font-weight: 700; }

  /* ── Enhanced Input Field Visibility ── */
  .pms-input, .pms-select, .pms-textarea {
    width: 100%;
    min-height: 38px;
    border: 1px solid var(--line-dark);
    border-radius: 5px;
    background: #ffffff;
    color: #0f172a;
    padding: 6px 11px;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 550;
    outline: none;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .pms-select { cursor: pointer; }
  .pms-textarea { resize: vertical; line-height: 1.45; min-height: 56px; }
  .pms-input::placeholder, .pms-textarea::placeholder { color: #94a3b8; font-weight: 400; }
  .pms-input:hover, .pms-select:hover, .pms-textarea:hover { border-color: #64748b; }
  .pms-input:focus, .pms-select:focus, .pms-textarea:focus {
    border-color: var(--teal);
    box-shadow: 0 0 0 3px rgba(15, 76, 92, 0.16);
  }
  .pms-input:disabled, .pms-select:disabled {
    background: #f1f5f9; color: #475569; border-color: #cbd5e1;
    opacity: 1; cursor: not-allowed; font-weight: 600;
  }
  .pms-readonly {
    background: #f0f7f9 !important;
    color: var(--teal-dark) !important;
    border-color: #93c5cf !important;
    font-weight: 650 !important;
  }

  .pms-actions { display: flex; gap: 10px; justify-content: flex-end; align-items: end; }

  /* ───────── Buttons (Colors untouched) ───────── */
  .pms-btn {
    min-height: 36px;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 0 18px;
    font-family: inherit;
    font-size: 13.5px; font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .pms-btn-save   { background: var(--accent); color: #ffffff; }
  .pms-btn-save:hover   { background: var(--accent-dark); }
  .pms-btn-update { background: var(--teal); color: #ffffff; }
  .pms-btn-update:hover { background: var(--teal-dark); }
  .pms-btn-cancel { background: #ffffff; color: var(--text); border-color: var(--line-dark); }
  .pms-btn-cancel:hover { background: var(--panel-soft); border-color: #aab5be; }

  /* ───────── Record / summary header ───────── */
  .pms-record-head {
    background: var(--panel);
    color: var(--text);
    padding: 14px 20px;
    border-bottom: 1px solid var(--line);
    display: flex; justify-content: flex-end; align-items: center;
    position: relative; min-height: 58px;
  }
  .pms-record-head > div:first-child {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    text-align: center; white-space: nowrap;
  }
  .pms-record-head .pms-card-title { justify-content: center; }
  .pms-count {
    background: var(--teal-soft); color: var(--teal);
    padding: 4px 12px; border-radius: 999px;
    font-size: 12px; font-weight: 600;
  }
  @media (max-width: 768px) {
    .pms-record-head { flex-direction: column; justify-content: center; gap: 8px; }
    .pms-record-head > div:first-child { position: static; transform: none; white-space: normal; }
  }

  /* ───────── Moderately Increased Light Header Color ───────── */
  .pms-table-wrap { max-height: 540px; overflow: auto; background: #ffffff; border-radius: 0 0 6px 6px; }
  .pms-table { width: 100%; border-collapse: collapse; white-space: nowrap; font-size: 13px; }
  
  /* Increased color depth for crisp light header visibility */
  .pms-table th {
    position: sticky; top: 0; z-index: 3;
    background: #dbe5ed !important;
    color: #0f2238 !important;
    padding: 11px 12px; text-align: left;
    font-size: 11.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
    border: 1px solid #b2c4d4 !important;
    box-shadow: inset 0 -1px 0 #b2c4d4;
  }
  .pms-table td {
    padding: 9px 12px;
    border: 1px solid #e2e8f0;
    vertical-align: middle; color: #1e293b; font-weight: 500;
  }
  .pms-table tbody tr:nth-child(even) { background: #f8fafc; }
  .pms-table tbody tr:hover { background: #eef4f6; }

  .pms-status {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 88px; border-radius: 999px; padding: 3px 10px;
    font-size: 11.5px; font-weight: 600;
  }
  .pms-status-production { background: var(--green-soft); color: var(--green-text); }
  .pms-status-idle       { background: var(--amber-soft); color: var(--amber-text); }
  .pms-status-breakdown  { background: var(--red-soft);   color: var(--red-text); }
  .pms-status-default    { background: var(--slate-soft); color: var(--slate); }

  .pms-shift { display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; }
  .pms-shift-day   { background: var(--amber-soft); color: var(--amber-text); }
  .pms-shift-night { background: var(--blue-soft);  color: var(--blue-text); }

  .pms-table-actions { display: flex; gap: 6px; }
  .pms-small-btn {
    display: inline-flex; align-items: center; gap: 5px;
    background: #ffffff; border: 1px solid var(--line-dark); border-radius: 4px;
    min-height: 28px; padding: 0 10px;
    font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .pms-edit-btn   { color: var(--teal); }
  .pms-edit-btn:hover   { background: var(--teal-soft); border-color: #b9d3d9; }
  .pms-delete-btn { color: var(--red-text); }
  .pms-delete-btn:hover { background: var(--red-soft); border-color: #f1b8b8; }

  .pms-muted     { color: #94a3b8; }
  .pms-wrap-text { max-width: 180px; white-space: normal; color: #334155; font-size: 12px; }
  .pms-empty     { padding: 46px; text-align: center; color: #64748b; font-weight: 550; }

  /* ───────── Idle / Breakdown slots ───────── */
  .ts-section {
    background: #f8fafc;
    border: 1px dashed #94a3b8;
    border-radius: 6px;
    padding: 12px 16px 14px;
    margin-bottom: 12px;
  }
  .ts-section-title {
    display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
    color: var(--text);
    font-size: 13.5px; font-weight: 700;
    margin-bottom: 12px;
  }
  .ts-section-title .pms-ico { width: 16px; height: 16px; color: var(--teal); }
  .ts-section-title span { color: var(--muted); }
  .ts-slot-row {
    display: grid;
    grid-template-columns: 180px 120px 120px 1fr 32px;
    gap: 10px; align-items: end;
    margin-bottom: 8px;
    background: #ffffff;
    border: 1px solid var(--line-dark);
    border-radius: 6px;
    padding: 8px 12px;
  }
  .ts-add-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: #ffffff; color: var(--teal);
    border: 1px solid var(--teal); border-radius: 4px;
    padding: 6px 14px;
    font-family: inherit; font-size: 13px; font-weight: 600;
    cursor: pointer; margin-top: 2px;
    transition: background 0.15s ease;
  }
  .ts-add-btn:hover { background: var(--teal-soft); }
  .ts-add-btn .pms-ico { color: var(--teal); }
  .ts-remove-btn {
    width: 32px; height: 32px;
    background: #ffffff; color: var(--red-text);
    border: 1px solid var(--line-dark); border-radius: 4px;
    font-size: 17px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .ts-remove-btn:hover { background: var(--red-soft); border-color: #f1b8b8; }
  .ts-slot-label {
    background: var(--teal-soft); color: var(--teal);
    border-radius: 999px; padding: 1px 8px;
    font-size: 10.5px; font-weight: 600;
    margin-bottom: 3px; display: inline-block; width: fit-content;
  }
  .ts-empty-hint { color: var(--muted); font-size: 12.5px; font-weight: 500; padding: 4px 0 6px; }

  /* ───────── Filters panel ───────── */
  .pms-root .card {
    background: var(--panel) !important;
    border: 1px solid var(--line) !important;
    border-radius: 8px !important;
    box-shadow: 0 1px 3px rgba(16, 24, 40, 0.05) !important;
    padding: 14px 16px 16px !important;
    margin: 16px 0 18px !important;
  }
  .pms-root .card h5 {
    display: flex; align-items: center; gap: 8px;
    font-size: 15px; font-weight: 700; color: var(--text);
    margin: 0 0 12px !important; padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
    text-align: left !important;
  }
  .pms-root .card h5 .pms-ico { color: var(--teal); width: 16px; height: 16px; }
  .pms-root .card .row { --bs-gutter-x: 12px; --bs-gutter-y: 10px; }
  .pms-root .form-label {
    display: flex; align-items: center; gap: 6px;
    color: #1f2937 !important;
    font-size: 11px; font-weight: 650;
    text-transform: uppercase; letter-spacing: 0.04em;
    margin-bottom: 4px !important;
  }
  .pms-root .form-label .pms-ico { width: 13px; height: 13px; color: var(--teal); }
  .pms-root .form-control,
  .pms-root .form-select {
    min-height: 36px;
    padding: 6px 10px;
    font-family: inherit;
    font-size: 13px; font-weight: 550;
    color: #0f172a;
    background-color: #ffffff;
    border: 1px solid var(--line-dark) !important;
    border-radius: 4px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }
  .pms-root .form-select { padding-right: 28px; }
  .pms-root .form-control:focus,
  .pms-root .form-select:focus {
    border-color: var(--teal) !important;
    box-shadow: 0 0 0 3px rgba(15, 76, 92, 0.16);
  }

  /* Buttons remain untouched */
  .pms-root .btn {
    min-height: 36px;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 5px 10px;
    font-family: inherit;
    font-size: 12.5px; font-weight: 600;
    border-radius: 4px;
    box-shadow: none;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .pms-root .btn-danger  { background: #ffffff; color: var(--red-text); border: 1px solid var(--line-dark); }
  .pms-root .btn-danger:hover  { background: var(--red-soft); color: var(--red-text); border-color: #f1b8b8; }
  .pms-root .btn-success { background: var(--teal); color: #ffffff; border: 1px solid var(--teal); }
  .pms-root .btn-success:hover { background: var(--teal-dark); color: #ffffff; border-color: var(--teal-dark); }
  .pms-root .btn-primary { background: var(--accent); color: #ffffff; border: 1px solid var(--accent); }
  .pms-root .btn-primary:hover { background: var(--accent-dark); color: #ffffff; border-color: var(--accent-dark); }
  @media (min-width: 768px) {
    .pms-root .card .row > [class*="col-md-"] { flex: 0 0 auto; width: 12.5%; }
  }

  /* ───────── Icons ───────── */
  .pms-ico { width: 15px; height: 15px; flex-shrink: 0; vertical-align: -2px; }

  /* ───────── View toggle ───────── */
  .pms-toggle-wrap { display: flex; justify-content: center; margin: 0 0 16px; }
  .pms-toggle {
    display: inline-flex; gap: 4px; padding: 4px;
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
  }
  .pms-toggle .pms-btn { min-width: 170px; }
  .pms-toggle .pms-btn-cancel { background: transparent; border-color: transparent; color: var(--muted); }
  .pms-toggle .pms-btn-cancel:hover { background: var(--panel-soft); color: var(--text); }

  /* ───────── Summary Table (Moderately Increased Header Tone) ───────── */
  .pms-summary-table { font-size: 13px; }
  .pms-summary-table thead th {
    background: #dbe5ed !important;
    color: #0f2238 !important;
    text-align: center; white-space: normal; height: 38px; padding: 6px 8px;
    border: 1px solid #b2c4d4 !important;
  }
  .pms-summary-table thead tr:nth-child(2) th { top: 38px; background: #cbdbe6 !important; }
  .pms-summary-table thead tr:nth-child(3) th { top: 76px; background: #c0d2df !important; }
  .pms-summary-table td { padding: 8px; border: 1px solid #e2e8f0; }
  .pms-sum-center { text-align: center; font-weight: 600; }
  .pms-sum-num { text-align: right; font-variant-numeric: tabular-nums; }
  .pms-sum-time { text-align: center; font-variant-numeric: tabular-nums; }
  .pms-sum-remarks { max-width: 150px; text-align: center; font-size: 12px; color: var(--muted); cursor: pointer; overflow: hidden; text-overflow: ellipsis; }

  /* ───────── Pagination ───────── */
  .pms-pager {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 16px;
    border-top: 1px solid var(--line);
    background: var(--panel);
  }
  .pms-pager-info { color: var(--muted); font-size: 12.5px; font-weight: 550; }
  .pms-pager-nav, .pms-pager-extra, .pms-pager-jump { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
  .pms-pg-btn {
    min-width: 32px; min-height: 32px; padding: 0 9px;
    border: 1px solid var(--line-dark); border-radius: 4px;
    background: #ffffff; color: var(--text);
    font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .pms-pg-btn:hover:not(:disabled) { background: var(--teal-soft); border-color: #b9d3d9; color: var(--teal); }
  .pms-pg-btn.active { background: var(--teal); border-color: var(--teal); color: #ffffff; }
  .pms-pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .pms-pager-gap { color: var(--hint); font-weight: 600; padding: 0 4px; }
  .pms-pager .pms-input, .pms-pager .pms-select { min-height: 32px; width: auto; padding: 4px 8px; font-size: 12.5px; }
  .pms-pager .pms-input { width: 120px; }

  /* ───────── Responsive ───────── */
  @media (max-width: 1200px) {
    .pms-grid, .pms-grid-4 { grid-template-columns: repeat(3, minmax(160px, 1fr)); }
    .pms-grid-remarks { grid-template-columns: 1fr; }
    .ts-slot-row { grid-template-columns: 1fr 1fr 1fr 1fr 32px; }
  }
  @media (max-width: 768px) {
    .pms-header, .pms-body { padding-left: 14px; padding-right: 14px; }
    .pms-grid, .pms-grid-4 { grid-template-columns: 1fr; }
    .pms-actions { justify-content: stretch; flex-direction: column; }
    .pms-btn { width: 100%; }
    .ts-slot-row { grid-template-columns: 1fr; }
    .pms-header-inner { justify-content: center; flex-direction: column; min-height: 0; }
    .pms-header-inner > div:first-child { position: static; transform: none; white-space: normal; }
  }

  /* =====================================================================
     page entrance animation (appended, css only)
     ===================================================================== */
  @keyframes pgfadeup {
    from { opacity: 0; transform: translatey(18px); }
    to   { opacity: 1; transform: translatey(0); }
  }
  @keyframes pgfadedown {
    from { opacity: 0; transform: translatey(-14px); }
    to   { opacity: 1; transform: translatey(0); }
  }
  @keyframes pgfade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pgrow {
    from { opacity: 0; transform: translatey(8px); }
    to   { opacity: 1; transform: translatey(0); }
  }

  /* page container (fade only) */
  .pms-root { animation: pgfade 0.45s ease-out backwards; }

  /* entry form card */
  .pms-root .pms-body > .pms-card:first-child {
    animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
  }

  /* form sections: staggered (also plays when production sections appear) */
  .pms-root .pms-section,
  .pms-root .ts-section { animation: pgfadeup 0.45s ease-out backwards; }
  .pms-root .pms-form-body > .pms-section:nth-child(1) { animation-delay: 0.25s; }
  .pms-root .pms-form-body > .pms-section:nth-child(2) { animation-delay: 0.33s; }
  .pms-root .pms-form-body > .pms-section:nth-child(3) { animation-delay: 0.41s; }
  .pms-root .ts-slot-row { animation: pgrow 0.3s ease-out backwards; }

  /* filters card */
  .pms-root .card {
    animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.3s backwards;
  }

  /* view toggle */
  .pms-root .pms-toggle-wrap {
    animation: pgfadedown 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.4s backwards;
  }

  /* records / summary card */
  .pms-root .pms-body > .pms-card:not(:first-child) {
    animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.5s backwards;
  }

  /* table rows: quick stagger on the first rows (also replays when you change page) */
  .pms-root .pms-table tbody tr { animation: pgrow 0.35s ease-out backwards; }
  .pms-root .pms-table tbody tr:nth-child(1)  { animation-delay: 0.65s; }
  .pms-root .pms-table tbody tr:nth-child(2)  { animation-delay: 0.70s; }
  .pms-root .pms-table tbody tr:nth-child(3)  { animation-delay: 0.75s; }
  .pms-root .pms-table tbody tr:nth-child(4)  { animation-delay: 0.80s; }
  .pms-root .pms-table tbody tr:nth-child(5)  { animation-delay: 0.85s; }
  .pms-root .pms-table tbody tr:nth-child(6)  { animation-delay: 0.90s; }
  .pms-root .pms-table tbody tr:nth-child(7)  { animation-delay: 0.95s; }
  .pms-root .pms-table tbody tr:nth-child(8)  { animation-delay: 1s; }
  .pms-root .pms-table tbody tr:nth-child(n+9) { animation-delay: 1.05s; }

  /* respect users who disable motion */
  @media (prefers-reduced-motion: reduce) {
    .pms-root,
    .pms-root * {
      animation: none !important;
    }
  }
`;

/* ── Helpers ── */
function StatusBadge({ status }) {
  const v = (status || "").toLowerCase();
  let cls = "pms-status-default";
  if (v === "production" || v === "working") cls = "pms-status-production";
  else if (v === "idle") cls = "pms-status-idle";
  else if (v === "breakdown" || v.includes("break")) cls = "pms-status-breakdown";
  return <span className={`pms-status ${cls}`}>{status || "—"}</span>;
}

function ShiftBadge({ shift }) {
  return (
    <span className={`pms-shift ${shift === "Night" ? "pms-shift-night" : "pms-shift-day"}`}>
      {shift}
    </span>
  );
}

/* ── Default slot ── */
const newSlot = () => ({ id: Date.now() + Math.random(), machineStatus: "", fromTime: "", toTime: "", reason: "" });

export default function ProductionMachineStatusModule() {
  const token = localStorage.getItem("token");

  const [loggedInUser, setLoggedInUser]     = useState("");
  const [activities, setActivities]         = useState([]);
  const [machines, setMachines]             = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [customers, setCustomers]           = useState([]);
  const [items, setItems]                   = useState([]);
  const [records, setRecords]               = useState([]);
  const [paperSizes, setPaperSizes]         = useState([]);
  const [printers, setPrinters]             = useState([]);
  const [editingId, setEditingId]           = useState(null);
  const [userLocations, setUserLocations]   = useState([]);
  const [allowedMachineIds, setAllowedMachineIds] = useState(null);

  /* Extra time slots (idle / breakdown alongside a production entry) */
  const [extraSlots, setExtraSlots] = useState([]);

  const [filters, setFilters] = useState({
    dateFrom: "", dateTo: "", month: "", shift: "", machine: "", machineStatus: "", woNumber: "", location: "", customer: "", printer: "",
  });
  const [locationFilter, setLocationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [recordsView, setRecordsView] = useState("details");
  const [expandedCell, setExpandedCell] = useState(null);

  /* back to page 1 whenever the filters or page size change */
  useEffect(() => {
    setPage(1);
  }, [filters, locationFilter, pageSize]);

  const [form, setForm] = useState({
    productionDate: "", shift: "", activityId: "",
    machineId: "", machineStatus: "", customerName: "",
    materialType: "", fromTime: "", toTime: "", remarks: "",
    woNumber: "", totalPages: "", wastageSheets: "",
    wastePercentage: "", reason: "", userLocations: [],
    paperSize: "", printerName: "",
  });

  /* ── Alert ── */
  const showAlert = (message, icon = "warning") => {
    const bg = { success: "#f0fdf4", error: "#fef2f2", warning: "#fffbeb", info: "#eff6ff" };
    Swal.fire({
      toast: true, position: "top", icon, title: message,
      width: "420px", showConfirmButton: false, timer: 4000,
      timerProgressBar: true, background: bg[icon] || bg.warning,
      color: "#111827", didOpen: (t) => { t.style.marginLeft = "100px"; },
    });
  };

  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  /* ── Decode token ── */
  useEffect(() => {
    const tok = localStorage.getItem("token");
    if (!tok) return;
    const decoded = jwtDecode(tok);
    setLoggedInUser(decoded.name || "");
    const locations = decoded.locations || [];
    setUserLocations(locations);
    setForm((prev) => ({ ...prev, userLocations: locations }));
  }, []);

  /* ── Machines allowed for the user's location(s) ── */
  useEffect(() => {
    if (!userLocations.length) {
      setAllowedMachineIds(null);
      return;
    }
    axios
      .get(`${BASE_URL}/api/master/locations`, authHeaders)
      .then((res) => {
        const ids = new Set();
        (res.data || [])
          .filter((l) => userLocations.includes(l.locationName))
          .forEach((l) => (l.machines || []).forEach((m) => ids.add(String(m._id || m))));
        setAllowedMachineIds(ids.size ? ids : null);
      })
      .catch((err) => console.error("Error fetching location machines:", err));
  }, [userLocations, authHeaders]);

  /* ── Fetch masters ── */
  const fetchAll = async () => {
    await Promise.allSettled([
      axios.get(`${BASE_URL}/api/master/activities`, authHeaders).then((r) => setActivities(r.data || [])),
      axios.get(`${BASE_URL}/api/master/machines`, authHeaders).then((r) => setMachines(r.data || [])),
      axios.get(`${BASE_URL}/api/master/machine-status`, authHeaders).then((r) => setMachineStatuses(r.data || [])),
      axios.get(`${BASE_URL}/api/master/paper-sizes`, authHeaders).then((r) => setPaperSizes(r.data || [])),
      axios.get(`${BASE_URL}/api/master/printers`, authHeaders).then((r) => setPrinters(r.data || [])),
      axios.get(`${BASE_URL}/api/master/items`, authHeaders).then((r) => {
        const d = r.data || [];
        setItems(d);
        setCustomers(
          [...new Set(d.map((i) => i.customerName).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
          )
        );
      }),
    ]);
  };

  const fetchRecords = async () => {
    const res = await axios.get(`${BASE_URL}/api/production-machine-status`, authHeaders);
    setRecords((res.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  };

  useEffect(() => {
    if (!token) return;
    fetchAll().catch(console.error);
    fetchRecords().catch(console.error);
  }, [token]);

  /* ── Derived lists ── */
  const filteredMachines = useMemo(() => {
    const allowed = (m) =>
      !allowedMachineIds ||
      allowedMachineIds.has(String(m._id)) ||
      String(m._id) === String(form.machineId);

    let list = machines;
    if (form.activityId) {
      const act = activities.find((a) => a._id === form.activityId);
      if (act?.machines?.length) {
        list = machines.filter((m) => act.machines.map(String).includes(String(m._id)));
      }
    }
    return list.filter(allowed);
  }, [activities, machines, form.activityId, allowedMachineIds, form.machineId]);

  /* ── Frozen activity: always "Perso Printing" ── */
  const persoActivity = useMemo(() => {
    const list = activities.filter((a) =>
      (a.activityName || "").toLowerCase().includes("perso")
    );
    return (
      list.find((a) => (a.activityName || "").toLowerCase().includes("print")) ||
      list[0] ||
      null
    );
  }, [activities]);

  useEffect(() => {
    if (!persoActivity || editingId) return;
    setForm((prev) =>
      prev.activityId === persoActivity._id
        ? prev
        : { ...prev, activityId: persoActivity._id, machineId: "", printerName: "" }
    );
  }, [persoActivity, editingId]);

  const filteredPrinters = useMemo(() => {
    if (!form.machineId) return [];
    const sel = machines.find((m) => m._id === form.machineId);
    if (!sel) return [];
    const rec = printers.find((p) => p.machineName === sel.machineName);
    return rec?.printerNames || [];
  }, [printers, machines, form.machineId]);

  const customerBasedItems = useMemo(() => {
    if (!form.customerName) return [];
    return [...new Set(
      items.filter((i) => i.customerName === form.customerName).map((i) => i.materialType).filter(Boolean)
    )];
  }, [items, form.customerName]);

  /* ── Form change ── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "remarks" && !/^[a-zA-Z0-9 ]*$/.test(value)) {
      showAlert("Special characters are not allowed", "error");
      return;
    }
    let upd = { ...form, [name]: value };
    if (name === "activityId") { upd.machineId = ""; upd.printerName = ""; }
    if (name === "machineId")  upd.printerName = "";
    if (name === "customerName") upd.materialType = "";
    const tp = Number(name === "totalPages"    ? value : upd.totalPages)    || 0;
    const ws = Number(name === "wastageSheets" ? value : upd.wastageSheets) || 0;
    upd.wastePercentage = tp > 0 && ws >= 0 ? ((ws / tp) * 100).toFixed(2) : "";
    setForm(upd);
  };

  /* ── Extra slot handlers ── */
  const handleSlotChange = (id, field, value) => {
    setExtraSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };
  const addSlot    = () => setExtraSlots((prev) => [...prev, newSlot()]);
  const removeSlot = (id) => setExtraSlots((prev) => prev.filter((s) => s.id !== id));

  /* ── Reset ── */
  const resetForm = () => {
    setForm((prev) => ({
      productionDate: prev.productionDate,
      shift: prev.shift,
      activityId: prev.activityId,
      machineId: prev.machineId,
      printerName: prev.printerName,
      machineStatus: "",
      customerName: "",
      materialType: "",
      fromTime: "",
      toTime: "",
      remarks: "",
      woNumber: "",
      totalPages: "",
      wastageSheets: "",
      wastePercentage: "",
      reason: "",
      paperSize: "",
      userLocations: prev.userLocations || [],
    }));
    setExtraSlots([]);
    setEditingId(null);
  };

  const isProduction = (form.machineStatus || "").toLowerCase() === "production";

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.activityId) return showAlert("Select activity", "warning");
    if (!form.machineId)  return showAlert("Select machine", "warning");
    if (filteredPrinters.length > 0 && !form.printerName) return showAlert("Select printer name", "warning");

    if (isProduction) {
      if (!form.customerName)  return showAlert("Select customer", "warning");
      if (!form.materialType)  return showAlert("Select material type", "warning");
      if (!form.woNumber)      return showAlert("Enter WO Number", "warning");
      if (!form.totalPages)    return showAlert("Enter Total Pages", "warning");
      if (!form.wastageSheets && form.wastageSheets !== 0)
        return showAlert("Enter Wastage Sheets", "warning");
    }

    for (const s of extraSlots) {
      if (!s.machineStatus) return showAlert("Select status for all time slots", "warning");
      if (!s.fromTime)      return showAlert("Enter From Time for all time slots", "warning");
      if (!s.toTime)        return showAlert("Enter To Time for all time slots", "warning");
    }

    /* ── 24-hour machine time validation ── */
    const getEntryHours = (dateStr, fromTime, toTime) => {
      if (!dateStr || !fromTime || !toTime) return 0;
      const start = new Date(`${dateStr}T${fromTime}`);
      const end = new Date(`${dateStr}T${toTime}`);
      if (end <= start) end.setDate(end.getDate() + 1);
      return (end - start) / (1000 * 60 * 60);
    };

    let totalHours = getEntryHours(form.productionDate, form.fromTime, form.toTime);
    extraSlots.forEach((slot) => {
      totalHours += getEntryHours(form.productionDate, slot.fromTime, slot.toTime);
    });

    const sameMachineEntries = records.filter((item) => {
      if (editingId && item._id === editingId) return false;
      const sameMachine =
        String(item.machineId?._id || item.machineId) === String(form.machineId);
      if (!sameMachine) return false;
      if (form.printerName && item.printerName !== form.printerName) return false;
      const itemDate = item.productionDate
        ? new Date(item.productionDate).toISOString().split("T")[0]
        : "";
      return itemDate === form.productionDate;
    });

    sameMachineEntries.forEach((item) => {
      totalHours += getEntryHours(form.productionDate, item.fromTime, item.toTime);
    });

    if (totalHours > 24) {
      const machineName =
        machines.find((m) => m._id === form.machineId)?.machineName || "Machine";
      return showAlert(`${form.printerName || machineName} exceeds 24 hours`, "warning");
    }

    const basePayload = { ...form, enteredBy: loggedInUser, userLocations };

    try {
      if (editingId) {
        await axios.put(
          `${BASE_URL}/api/production-machine-status/${editingId}`,
          basePayload,
          authHeaders
        );

        for (const slot of extraSlots) {
          const slotPayload = {
            productionDate: form.productionDate,
            shift:          form.shift,
            activityId:     form.activityId,
            machineId:      form.machineId,
            machineStatus:  slot.machineStatus,
            paperSize:      form.paperSize,
            printerName:    form.printerName,
            fromTime:       slot.fromTime,
            toTime:         slot.toTime,
            reason:         slot.reason || "",
            customerName:   form.customerName   || "",
            materialType:   form.materialType   || "",
            woNumber:       form.woNumber       || "",
            totalPages:     "",
            wastageSheets:  "",
            wastePercentage:"",
            remarks:        "",
            enteredBy:      loggedInUser,
            userLocations,
          };
          await axios.post(`${BASE_URL}/api/production-machine-status`, slotPayload, authHeaders);
        }

        showAlert(
          extraSlots.length > 0
            ? `Entry updated (+ ${extraSlots.length} new slot${extraSlots.length > 1 ? "s" : ""})`
            : "Entry updated",
          "success"
        );
      } else {
        await axios.post(`${BASE_URL}/api/production-machine-status`, basePayload, authHeaders);

        for (const slot of extraSlots) {
          const slotPayload = {
            productionDate: form.productionDate,
            shift:          form.shift,
            activityId:     form.activityId,
            machineId:      form.machineId,
            machineStatus:  slot.machineStatus,
            paperSize:      form.paperSize,
            printerName:    form.printerName,
            fromTime:       slot.fromTime,
            toTime:         slot.toTime,
            reason:         slot.reason || "",
            customerName:   form.customerName   || "",
            materialType:   form.materialType   || "",
            woNumber:       form.woNumber       || "",
            totalPages:     "",
            wastageSheets:  "",
            wastePercentage:"",
            remarks:        "",
            enteredBy:      loggedInUser,
            userLocations,
          };
          await axios.post(`${BASE_URL}/api/production-machine-status`, slotPayload, authHeaders);
        }

        const slotCount = extraSlots.length;
        showAlert(
          slotCount > 0
            ? `Entry saved (+ ${slotCount} time slot${slotCount > 1 ? "s" : ""})`
            : "Entry saved",
          "success"
        );
      }

      resetForm();
      fetchRecords();
    } catch {
      showAlert("Error saving data", "error");
    }
  };

  /* ── Edit ── */
  const handleEdit = (item) => {
    setEditingId(item._id);
    setExtraSlots([]);
    setForm({
      productionDate:  item.productionDate?.split("T")[0] || "",
      shift:           item.shift || "",
      activityId:      item.activityId?._id || item.activityId || "",
      machineId:       item.machineId?._id  || item.machineId  || "",
      machineStatus:   item.machineStatus   || "",
      customerName:    item.customerName    || "",
      materialType:    item.materialType    || "",
      fromTime:        item.fromTime        || "",
      toTime:          item.toTime          || "",
      remarks:         item.remarks         || "",
      woNumber:        item.woNumber        || "",
      totalPages:      item.totalPages      || "",
      wastageSheets:   item.wastageSheets   || "",
      wastePercentage: item.wastePercentage || "",
      reason:          item.reason          || "",
      userLocations:   item.userLocations   || [],
      paperSize:       item.paperSize       || "",
      printerName:     item.printerName     || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── Delete ── */
  const handleDelete = async (id) => {
    const c = await Swal.fire({
      title: "Delete this entry?", text: "This action cannot be undone.",
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#dc2626", cancelButtonColor: "#475569",
      confirmButtonText: "Delete", cancelButtonText: "Cancel",
    });
    if (!c.isConfirmed) return;
    try {
      await axios.delete(`${BASE_URL}/api/production-machine-status/${id}`, authHeaders);
      showAlert("Deleted", "success");
      fetchRecords();
    } catch { showAlert("Delete failed", "error"); }
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
  const fmtTime = (t) => {
    if (!t) return "—";
    const [h, m] = t.split(":");
    let hr = Number(h);
    const ap = hr >= 12 ? "PM" : "AM";
    hr = hr % 12 || 12;
    return `${hr}:${m} ${ap}`;
  };
  const getTotalTime = (from, to) => {
    if (!from || !to) return "";
    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);

    let mins = th * 60 + tm - (fh * 60 + fm);
    if (mins <= 0) mins += 24 * 60;

    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };

  /* ── Filters ── */
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ workOrder: "", dateFrom: "", dateTo: "", month: "", shift: "", machine: "", machineStatus: "", printer: "" });
    setLocationFilter("");
  };

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const pd = item.productionDate ? new Date(item.productionDate) : null;
      const itemMonth = pd
        ? `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}`
        : "";
      const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
      const toDate   = filters.dateTo   ? new Date(filters.dateTo)   : null;

      if (filters.workOrder && !item.woNumber?.toLowerCase().includes(filters.workOrder.toLowerCase())) return false;
      if (filters.shift && item.shift !== filters.shift) return false;
      if (filters.machine && item.machineId?.machineName !== filters.machine) return false;
      if (filters.machineStatus && item.machineStatus !== filters.machineStatus) return false;
      if (filters.printer && item.printerName !== filters.printer) return false;
      if (filters.month && itemMonth !== filters.month) return false;
      if (fromDate && pd && pd < fromDate) return false;
      if (toDate   && pd && pd > new Date(toDate.setHours(23, 59, 59, 999))) return false;
      if (locationFilter && item.userLocations && !item.userLocations.includes(locationFilter)) return false;
      return true;
    });
  }, [records, filters, locationFilter]);

  const locationOptions = [...new Set(records.flatMap((r) => r.userLocations || []))];
  const printerOptions  = [...new Set(records.map((r) => r.printerName).filter(Boolean))];

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);
  const goToPage = (n) => setPage(Math.min(Math.max(n, 1), totalPages));

  /* ── Production Summary Report ── */
  const getReportDateLabel = () => {
    if (filters.dateFrom && filters.dateTo) {
      return `${new Date(filters.dateFrom).toLocaleDateString("en-IN")} to ${new Date(filters.dateTo).toLocaleDateString("en-IN")}`;
    }
    if (filters.dateFrom) return `From ${new Date(filters.dateFrom).toLocaleDateString("en-IN")}`;
    if (filters.dateTo) return `To ${new Date(filters.dateTo).toLocaleDateString("en-IN")}`;
    if (filters.month) {
      const [year, month] = filters.month.split("-");
      return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }
    return "All Dates";
  };

  const fmtReportNum = (value, hasEntry = false) => {
    const n = Number(value) || 0;
    if (n === 0) return hasEntry ? "0" : "-";
    return n.toLocaleString("en-IN");
  };

  /* dynamic Machine Hours columns = every status in the master (except Production) + any extra found in records */
  const statusColumns = useMemo(() => {
    const seen = new Map();
    machineStatuses.forEach((s) => {
      const k = normStatus(s.statusName);
      if (k && !isProductionStatus(k) && !seen.has(k)) seen.set(k, s.statusName.trim());
    });
    records.forEach((item) => {
      const k = normStatus(item.machineStatus);
      if (k && !isProductionStatus(k) && !seen.has(k)) seen.set(k, String(item.machineStatus).trim());
    });
    return [...seen].map(([key, label]) => ({ key, label: statusColLabel(label) }));
  }, [machineStatuses, records]);

  const buildSummary = () => {
    const groupMap = new Map();

    const ensureRow = (activityName, machineName, printerName) => {
      if (!groupMap.has(activityName)) groupMap.set(activityName, { activityName, rows: new Map() });
      const g = groupMap.get(activityName);
      const key = `${machineName}__${printerName}`;
      if (!g.rows.has(key)) {
        g.rows.set(key, {
          machineName, printerName,
          dayQty: 0, nightQty: 0, dayEntered: false, nightEntered: false,
          dayBySize: {}, nightBySize: {},
          prodMins: 0, statusMins: {},
          dayRemarks: new Set(), nightRemarks: new Set(),
        });
      }
      return g.rows.get(key);
    };

    (persoActivity ? [persoActivity] : activities).forEach((act) => {
      const ids = (act.machines || []).map(String);
      machines
        .filter((m) => ids.includes(String(m._id)))
        .forEach((m) => {
          const names = printers.find((pr) => pr.machineName === m.machineName)?.printerNames || [];
          if (names.length) names.forEach((n) => ensureRow(act.activityName || "-", m.machineName || "-", n));
          else ensureRow(act.activityName || "-", m.machineName || "-", "-");
        });
    });

    filteredRecords.forEach((item) => {
      const row = ensureRow(
        item.activityId?.activityName || item.activityName || "-",
        item.machineId?.machineName || item.machineName || "-",
        item.printerName || "-"
      );

      const statusKey = String(item.machineStatus || "").toLowerCase();
      const isProd = statusKey === "production" || statusKey === "working";
      const shift = String(item.shift || "").toLowerCase();
      const remarks = item.remarks?.trim();
      const sizeKey = item.paperSize?.trim() || "Not Set";
      const qty = isProd ? Number(item.totalPages) || 0 : 0;

      const durMins = getDurationMins(item.fromTime, item.toTime);
      if (isProd) row.prodMins += durMins;
      else {
        const k = normStatus(item.machineStatus);
        if (k) row.statusMins[k] = (row.statusMins[k] || 0) + durMins;
      }

      if (shift === "day") {
        if (isProd) { row.dayQty += qty; row.dayEntered = true; row.dayBySize[sizeKey] = (row.dayBySize[sizeKey] || 0) + qty; }
        if (remarks) row.dayRemarks.add(remarks);
      } else if (shift === "night") {
        if (isProd) { row.nightQty += qty; row.nightEntered = true; row.nightBySize[sizeKey] = (row.nightBySize[sizeKey] || 0) + qty; }
        if (remarks) row.nightRemarks.add(remarks);
      }
    });

    return Array.from(groupMap.values()).map((group) => {
      const rows = Array.from(group.rows.values()).map((r) => ({
        ...r,
        dayRemarks: Array.from(r.dayRemarks).join(", ") || "-",
        nightRemarks: Array.from(r.nightRemarks).join(", ") || "-",
        grandTotal: r.dayQty + r.nightQty,
        totalMins:
          r.prodMins +
          Object.values(r.statusMins).reduce((a, b) => a + b, 0),
      }));
      const order = [...new Set(rows.map((r) => r.machineName))];
      rows.sort((a, b) => order.indexOf(a.machineName) - order.indexOf(b.machineName));
      return { activityName: group.activityName, rows };
    });
  };

  const summaryRows = useMemo(
    () => (recordsView === "summary" ? buildSummary() : []),
    [recordsView, filteredRecords, activities, machines, printers, persoActivity, statusColumns]
  );

  const summarySizes = useMemo(
    () => [...new Set(summaryRows.flatMap((g) => g.rows.flatMap((r) => [...Object.keys(r.dayBySize), ...Object.keys(r.nightBySize)])))].sort(),
    [summaryRows]
  );

  const buildSummarySheet = () => {
    const summary = buildSummary();
    if (!summary.length) return null;

    const sizes = [...new Set(summary.flatMap((g) => g.rows.flatMap((r) => [...Object.keys(r.dayBySize), ...Object.keys(r.nightBySize)])))].sort();
    const n = sizes.length;
    const dayEnd = 1 + n;
    const nightStart = dayEnd + 1;
    const nightEnd = nightStart + n - 1;
    const dateEnd = nightEnd + 1;
    const hoursStart = dateEnd + 1;
    const hoursCount = statusColumns.length + 2; // Production + dynamic + Total
    const hoursEnd = hoursStart + hoursCount - 1;
    const blank = (k) => Array(Math.max(k, 0)).fill("");

    const aoa = [
      ["Machine", "Printer", `Date ${getReportDateLabel()}`, ...blank(dateEnd - 2), "Machine Hours", ...blank(hoursCount - 1)],
      ["", "", "Day Shift", ...blank(n - 1), "Night Shift", ...blank(n - 1), "Grand Total",
        "Production Time", ...statusColumns.map((s) => s.label), "Total Timings"],
      ["", "", ...sizes, ...sizes, ...blank(1 + hoursCount)],
    ];
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 0, c: dateEnd } },
      { s: { r: 0, c: hoursStart }, e: { r: 0, c: hoursEnd } },
    ];
    if (n > 1) {
      merges.push({ s: { r: 1, c: 2 }, e: { r: 1, c: dayEnd } });
      merges.push({ s: { r: 1, c: nightStart }, e: { r: 1, c: nightEnd } });
    }
    for (let c = dateEnd; c <= hoursEnd; c++) {
      merges.push({ s: { r: 1, c }, e: { r: 2, c } });
    }

    summary.forEach((group) => {
      const start = aoa.length;
      group.rows.forEach((row, idx) => {
        const firstOfMachine = idx === 0 || group.rows[idx - 1].machineName !== row.machineName;
        aoa.push([
          firstOfMachine ? row.machineName : "",
          row.printerName,
          ...sizes.map((s) => (row.dayBySize[s] !== undefined ? row.dayBySize[s] : "-")),
          ...sizes.map((s) => (row.nightBySize[s] !== undefined ? row.nightBySize[s] : "-")),
          (row.dayEntered || row.nightEntered) ? row.grandTotal : "-",
          formatHMS(row.prodMins),
          ...statusColumns.map((s) => formatHMS(row.statusMins[s.key] || 0)),
          formatHMS(row.totalMins),
        ]);
      });

      let runStart = 0;
      for (let i = 1; i <= group.rows.length; i++) {
        if (i === group.rows.length || group.rows[i].machineName !== group.rows[runStart].machineName) {
          if (i - runStart > 1) {
            merges.push({ s: { r: start + runStart, c: 0 }, e: { r: start + i - 1, c: 0 } });
          }
          runStart = i;
        }
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = merges;
    ws["!cols"] = [
      { wch: 24 }, { wch: 22 },
      ...sizes.map(() => ({ wch: 12 })),
      ...sizes.map(() => ({ wch: 12 })),
      { wch: 14 }, { wch: 16 }, ...statusColumns.map(() => ({ wch: 18 })), { wch: 14 },
    ];

    const side = { style: "thin", color: { rgb: "000000" } };
    const border = { top: side, bottom: side, left: side, right: side };
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };
        const isHeader = r < 3;
        const isNumberCol = c >= 2 && c <= dateEnd;
        ws[addr].s = {
          border,
          alignment: { vertical: "center", horizontal: isHeader ? "center" : isNumberCol ? "right" : "center", wrapText: true },
          font: { bold: isHeader || c <= 1 },
          ...(isHeader ? { fill: { fgColor: { rgb: "DBE5ED" } } } : {}),
        };
        if (!isHeader && isNumberCol && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      }
    }
    return ws;
  };

  /* ── LAST USED: ACTIVITY > MACHINE > PRINTER ── */
  const buildLastUsedGroups = () => {
    const sourceList = locationFilter
      ? records.filter((r) => r.userLocations?.includes(locationFilter))
      : records;

    if (!sourceList.length) return null;

    const lastUsed = new Map();
    const seenPrinters = new Map();

    for (const item of sourceList) {
      const actId = String(item.activityId?._id || item.activityId || "");
      const macId = String(item.machineId?._id || item.machineId || "");
      if (!macId) continue;

      const printer = item.printerName || "";
      const dateTs = new Date(item.productionDate).getTime() || 0;
      const savedTs = new Date(item.createdAt).getTime() || 0;

      const pmKey = `${actId}__${macId}`;
      if (!seenPrinters.has(pmKey)) seenPrinters.set(pmKey, new Set());
      if (printer) seenPrinters.get(pmKey).add(printer);

      const key = `${actId}__${macId}__${printer}`;
      const prev = lastUsed.get(key);
      const isNewer =
        !prev ||
        dateTs > prev.dateTs ||
        (dateTs === prev.dateTs && savedTs > prev.savedTs);

      if (isNewer) {
        lastUsed.set(key, {
          dateTs,
          savedTs,
          woNumber: item.woNumber || "-",
          customerName: item.customerName || "-",
          shift: item.shift || "-",
          enteredBy: item.enteredBy || "-",
          locations: item.userLocations || [],
        });
      }
    }

    const activityList = persoActivity ? [persoActivity] : activities;

    return activityList
      .map((activity) => {
        const ids = (activity.machines || []).map(String);
        const actMachines = machines.filter((m) => ids.includes(String(m._id)));

        const machineGroups = actMachines.map((m) => {
          const names = new Set(
            printers.find((p) => p.machineName === m.machineName)?.printerNames || []
          );
          (seenPrinters.get(`${activity._id}__${m._id}`) || new Set()).forEach((n) => names.add(n));

          const printerList = names.size ? [...names] : [""];

          return {
            machineName: m.machineName || "-",
            rows: printerList.map((pn) => ({
              printerName: pn || "-",
              info: lastUsed.get(`${activity._id}__${m._id}__${pn}`),
            })),
          };
        });

        return { activityName: activity.activityName || "-", machineGroups };
      })
      .filter((g) => g.machineGroups.length);
  };

  const lastUsedCells = (info) => [
    info ? fmtDate(info.dateTs) : "Never used",
    info ? info.woNumber : "-",
    info?.customerName || "-",
    info?.shift || "-",
    info?.enteredBy || "-",
    info ? new Date(info.savedTs).toLocaleString("en-IN") : "-",
    info?.locations?.join(", ") || "-",
  ];

  const exportLastUsedPdf = () => {
    const groups = buildLastUsedGroups();
    if (!groups) {
      showAlert(`No production records found${locationFilter ? ` for ${locationFilter}` : ""}`, "warning");
      return;
    }
    if (!groups.length) {
      showAlert("No machines to export", "warning");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text(
      `Machine & Printer - Last Used Report (${locationFilter || "All Locations"})`,
      40,
      36
    );
    doc.setFontSize(9);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-IN")}   |   Location: ${locationFilter || "All Locations"}`,
      40,
      52
    );

    const body = [];
    groups.forEach((group) => {
      const activityRowCount = group.machineGroups.reduce((n, mg) => n + mg.rows.length, 0);

      group.machineGroups.forEach((mg, mIdx) => {
        mg.rows.forEach((r, pIdx) => {
          const row = [];
          if (mIdx === 0 && pIdx === 0) {
            row.push({
              content: group.activityName,
              rowSpan: activityRowCount,
              styles: { fontStyle: "bold", valign: "middle", halign: "center" },
            });
          }
          if (pIdx === 0) {
            row.push({
              content: mg.machineName,
              rowSpan: mg.rows.length,
              styles: { fontStyle: "bold", valign: "middle", halign: "center" },
            });
          }
          row.push(r.printerName, ...lastUsedCells(r.info));
          body.push(row);
        });
      });
    });

    autoTable(doc, {
      startY: 64,
      head: [[
        "Activity", "Machine", "Printer", "Production Date", "WO Number",
        "Customer", "Shift", "Entered By", "Last Used On", "Location",
      ]],
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, valign: "middle", textColor: [0, 0, 0] },
      headStyles: { fillColor: [219, 229, 237], textColor: [15, 34, 56], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 70 },
        5: { cellWidth: 130 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.cell.text[0] === "Never used") {
          data.cell.styles.textColor = [200, 0, 0];
        }
      },
    });

    doc.save(
      locationFilter
        ? `Machine_Printer_Last_Used_${locationFilter.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
        : "Machine_Printer_Last_Used.pdf"
    );
  };

  const exportLastUsedExcel = () => {
    const groups = buildLastUsedGroups();
    if (!groups) {
      showAlert(`No production records found${locationFilter ? ` for ${locationFilter}` : ""}`, "warning");
      return;
    }
    if (!groups.length) {
      showAlert("No machines to export", "warning");
      return;
    }

    const aoa = [[
      "Activity", "Machine", "Printer", "Production Date", "WO Number",
      "Customer", "Shift", "Entered By", "Last Used On", "Location",
    ]];
    const merges = [];

    groups.forEach((group) => {
      const activityStart = aoa.length;
      group.machineGroups.forEach((mg, mIdx) => {
        const machineStart = aoa.length;
        mg.rows.forEach((r, pIdx) => {
          aoa.push([
            mIdx === 0 && pIdx === 0 ? group.activityName : "",
            pIdx === 0 ? mg.machineName : "",
            r.printerName,
            ...lastUsedCells(r.info),
          ]);
        });

        if (mg.rows.length > 1) {
          merges.push({
            s: { r: machineStart, c: 1 },
            e: { r: machineStart + mg.rows.length - 1, c: 1 },
          });
        }
      });

      const activityEnd = aoa.length - 1;
      if (activityEnd > activityStart) {
        merges.push({ s: { r: activityStart, c: 0 }, e: { r: activityEnd, c: 0 } });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = merges;
    ws["!cols"] = [
      { wch: 18 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 14 },
      { wch: 34 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    ];

    const side = { style: "thin", color: { rgb: "000000" } };
    const border = { top: side, bottom: side, left: side, right: side };
    const range = XLSX.utils.decode_range(ws["!ref"]);

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };

        const isHeader = r === 0;
        const neverUsed = !isHeader && c === 3 && ws[addr].v === "Never used";

        ws[addr].s = {
          border,
          alignment: {
            vertical: "center",
            horizontal: isHeader || c <= 1 ? "center" : "left",
            wrapText: true,
          },
          font: {
            bold: isHeader || c <= 1,
            ...(neverUsed ? { color: { rgb: "C80000" } } : {}),
          },
          ...(isHeader ? { fill: { fgColor: { rgb: "DBE5ED" } } } : {}),
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Machine Printer Last Used");

    XLSX.writeFile(
      wb,
      locationFilter
        ? `Machine_Printer_Last_Used_${locationFilter.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`
        : "Machine_Printer_Last_Used.xlsx"
    );
  };

  /* ── Excel export ── */
  const exportToExcel = () => {
    if (recordsView === "summary") {
      const sheet = buildSummarySheet();
      if (!sheet) { showAlert("No summary data to export", "warning"); return; }
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Summary Report");
      XLSX.writeFile(book, `Production_Summary_${new Date().toISOString().split("T")[0]}.xlsx`);
      return;
    }
    if (!filteredRecords.length) { showAlert("No data available for export", "warning"); return; }
    const excelData = filteredRecords.map((item, index) => ({
      "Sl No": index + 1,
      Date: fmtDate(item.productionDate),
      "WO Number": item.woNumber || "",
      Shift: item.shift || "",
      "Printer": item.printerName || "",
      Activity: item.activityId?.activityName || item.activityName || "",
      Machine:  item.machineId?.machineName   || item.machineName  || "",
      Status: item.machineStatus || "",
      Customer: item.customerName || "",
      Item: item.materialType || "",
      "From Time": fmtTime(item.fromTime),
      "To Time":   fmtTime(item.toTime),
      "Total Time": getTotalTime(item.fromTime, item.toTime),
      "Total Pages":    item.totalPages    || "",
      "Wastage Sheets": item.wastageSheets || "",
      "Waste %": item.wastePercentage || "",
      Reason:    item.reason    || "",
      "Paper Size":  item.paperSize   || "",
      User:  item.enteredBy || "",
      Remarks:   item.remarks   || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Production Records");
    XLSX.writeFile(workbook, `Production_Records_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  /* ════════════════════════════════ RENDER ════════════════════════════════ */
  return (
    <div className="pms-root">
      <style>{CSS}</style>

      <div className="pms-body">
        <div className="pms-card">
          <div className="pms-card-head">
            <div>
              <div className="pms-card-title" style={{ justifyContent: "center", textAlign: "center" }}>
                <FiEdit3 className="pms-ico" /> 
                {editingId ? "Edit Production Entry" : "New Production Entry"}
              </div>
            </div>
            {editingId && <span className="pms-edit-badge">Editing Mode</span>}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="pms-form-body">

              {/* ── Section 1: Order & Time ── */}
              <div className="pms-section">
                <div className="pms-section-title"><FiCalendar className="pms-ico" /> Order & Time Details</div>
                <div className="pms-grid">
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Date" />Date <span className="pms-req">*</span></label>
                    <input className="pms-input" type="date" name="productionDate"
                      value={form.productionDate} onChange={handleChange} required />
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Shift" />Shift <span className="pms-req">*</span></label>
                    <select className="pms-select" name="shift" value={form.shift} onChange={handleChange} required>
                      <option value="">Select shift</option>
                      <option value="Day">Day</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Activity" />Activity <span className="pms-req">*</span></label>
                    <select className="pms-select pms-readonly" name="activityId" value={form.activityId}
                      onChange={handleChange} disabled>
                      <option value="">Select activity</option>
                      {activities.map((a) => <option key={a._id} value={a._id}>{a.activityName}</option>)}
                    </select>
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Machine" />Machine <span className="pms-req">*</span></label>
                    <select className="pms-select" name="machineId" value={form.machineId}
                      onChange={handleChange} required disabled={!form.activityId}>
                      <option value="">Select machine</option>
                      {filteredMachines.map((m) => <option key={m._id} value={m._id}>{m.machineName}</option>)}
                    </select>
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Printer Name" />Printer Name</label>
                    <select className="pms-select" name="printerName" value={form.printerName}
                      onChange={handleChange} disabled={!form.machineId}>
                      <option value="">Select printer</option>
                      {filteredPrinters.map((name, i) => <option key={i} value={name}>{name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Section 2: Customer & Machine ── */}
              <div className="pms-section">
                <div className="pms-section-title"><FiCpu className="pms-ico" /> Customer & Machine Details</div>
                <div className="pms-grid pms-grid-7">
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="WO Number" />WO Number {isProduction && <span className="pms-req">*</span>}</label>
                    <input className="pms-input" type="text" name="woNumber"
                      value={form.woNumber} onChange={handleChange}
                      placeholder="Enter WO number" required={isProduction} />
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Customer" />Customer {isProduction && <span className="pms-req">*</span>}</label>
                    <select className="pms-select" name="customerName" value={form.customerName}
                      onChange={handleChange} required={isProduction}>
                      <option value="">Select customer</option>
                      {customers.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Item / Material" />Item / Material {isProduction && <span className="pms-req">*</span>}</label>
                    <select className="pms-select" name="materialType" value={form.materialType}
                      onChange={handleChange} required={isProduction} disabled={!form.customerName}>
                      <option value="">Select item</option>
                      {customerBasedItems.map((m, i) => <option key={i} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Paper Size" />Paper Size</label>
                    <select className="pms-select" name="paperSize" value={form.paperSize} onChange={handleChange}>
                      <option value="">Select paper size</option>
                      {paperSizes.map((ps) => <option key={ps._id} value={ps.name}>{ps.name}</option>)}
                    </select>
                  </div>
                
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="From Time" />From Time <span className="pms-req">*</span></label>
                    <input className="pms-input" type="time" name="fromTime"
                      value={form.fromTime} onChange={handleChange} required />
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="To Time" />To Time <span className="pms-req">*</span></label>
                    <input className="pms-input" type="time" name="toTime"
                      value={form.toTime} onChange={handleChange} required />
                  </div>
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Machine Status" />Machine Status <span className="pms-req">*</span></label>
                    <select className="pms-select" name="machineStatus" value={form.machineStatus} onChange={handleChange} required>
                      <option value="">Select status</option>
                      {machineStatuses.map((s) => <option key={s._id} value={s.statusName}>{s.statusName}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Section 3: Wastage (production only) ── */}
              {isProduction && (
                <div className="pms-section">
                  <div className="pms-section-title"><FiTrash2 className="pms-ico" /> Production Wastage Details</div>
                  <div className="pms-grid pms-grid-4">
                    <div className="pms-field">
                      <label className="pms-label"><PIcon name="Total Pages" />Total Pages <span className="pms-req">*</span></label>
                      <input className="pms-input" type="number" name="totalPages"
                        value={form.totalPages} onChange={handleChange} placeholder="0" />
                    </div>
                    <div className="pms-field">
                      <label className="pms-label"><PIcon name="Wastage Sheets" />Wastage Sheets <span className="pms-req">*</span></label>
                      <input className="pms-input" type="number" name="wastageSheets"
                        value={form.wastageSheets} onChange={handleChange} placeholder="0" />
                    </div>
                    <div className="pms-field">
                      <label className="pms-label"><PIcon name="Waste %" />Waste %</label>
                      <input className="pms-input pms-readonly" type="number" name="wastePercentage"
                        value={form.wastePercentage} readOnly placeholder="Auto" />
                    </div>
                    <div className="pms-field">
                      <label className="pms-label"><PIcon name="Reason for Wastage" />Reason for Wastage</label>
                      <input className="pms-input" type="text" name="reason"
                        value={form.reason} onChange={handleChange} placeholder="Enter reason" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 4: Extra Time Slots (production only) ── */}
              {isProduction && (
                <div className="ts-section">
                  <div className="ts-section-title">
                    <FiClock className="pms-ico" /> Idle / Breakdown Time Slots
                    <span style={{ fontWeight: 500, fontSize: 12 }}>
                      — add all idle &amp; breakdown periods that happened during this shift
                    </span>
                  </div>

                  {extraSlots.length === 0 && (
                    <div className="ts-empty-hint">No extra time slots added yet. Click "+ Add Time Slot" to log idle or breakdown time.</div>
                  )}

                  {extraSlots.map((slot, idx) => (
                    <div key={slot.id} className="ts-slot-row">
                      <div className="pms-field">
                        <span className="ts-slot-label">Slot {idx + 1}</span>
                        <label className="pms-label"><PIcon name="Status" />Status <span className="pms-req">*</span></label>
                        <select className="pms-select" value={slot.machineStatus}
                          onChange={(e) => handleSlotChange(slot.id, "machineStatus", e.target.value)}>
                          <option value="">Select status</option>
                          {machineStatuses
                            .filter((s) => (s.statusName || "").toLowerCase() !== "production")
                            .map((s) => (
                              <option key={s._id} value={s.statusName}>{s.statusName}</option>
                            ))}
                        </select>
                      </div>
                      <div className="pms-field">
                        <label className="pms-label"><PIcon name="From" />From <span className="pms-req">*</span></label>
                        <input className="pms-input" type="time" value={slot.fromTime}
                          onChange={(e) => handleSlotChange(slot.id, "fromTime", e.target.value)} />
                      </div>
                      <div className="pms-field">
                        <label className="pms-label"><PIcon name="To" />To <span className="pms-req">*</span></label>
                        <input className="pms-input" type="time" value={slot.toTime}
                          onChange={(e) => handleSlotChange(slot.id, "toTime", e.target.value)} />
                      </div>
                      <div className="pms-field">
                        <label className="pms-label"><PIcon name="Reason" />Reason</label>
                        <input className="pms-input" type="text" value={slot.reason}
                          placeholder="Reason / remarks"
                          onChange={(e) => handleSlotChange(slot.id, "reason", e.target.value)} />
                      </div>
                      <button type="button" className="ts-remove-btn" onClick={() => removeSlot(slot.id)}
                        title="Remove slot">×</button>
                    </div>
                  ))}

                  <button type="button" className="ts-add-btn" onClick={addSlot}>
                    <FiPlus className="pms-ico" /> Add Time Slot
                  </button>
                </div>
              )}

              {/* ── Remarks + Submit ── */}
              <div className="pms-section">
                <div className="pms-grid pms-grid-remarks">
                  <div className="pms-field">
                    <label className="pms-label"><PIcon name="Remarks" />Remarks</label>
                    <textarea className="pms-textarea" name="remarks"
                      value={form.remarks} onChange={handleChange}
                      rows={2} placeholder="Additional notes" />
                  </div>
                  <div className="pms-actions">
                    <button type="submit"
                      className={`pms-btn ${editingId ? "pms-btn-update" : "pms-btn-save"}`}>
                      <FiSave className="pms-ico" />
                      {editingId
                        ? (extraSlots.length > 0 ? `Update + Save ${extraSlots.length} Slot${extraSlots.length > 1 ? "s" : ""}` : "Update Entry")
                        : (extraSlots.length > 0 ? `Save All (${1 + extraSlots.length} entries)` : "Save Entry")}
                    </button>
                    {editingId && (
                      <button type="button" className="pms-btn pms-btn-cancel" onClick={resetForm}>
                        <FiX className="pms-ico" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </form>
        </div>

        {/* ── Filters ── */}
        <div className="card mt-4 p-3"
          style={{ background: "#fbfbfb", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", borderRadius: "10px" }}>
          <h5 className="mb-3 text-center fw-bold"><FiFilter className="pms-ico me-2" />Filters &amp; Excel Export</h5>
          <div className="row g-2">
            <div className="col-md-2">
              <label className="form-label"><PIcon name="WO Number" />WO Number</label>
              <input type="text" name="workOrder" placeholder="WO No"
                value={filters.workOrder} onChange={handleFilterChange} className="form-control" />
            </div>
            <div className="col-md-2">
              <label className="form-label"><PIcon name="From Date" />From Date</label>
              <input type="date" name="dateFrom" value={filters.dateFrom}
                onChange={handleFilterChange} className="form-control" />
            </div>
            <div className="col-md-2">
              <label className="form-label"><PIcon name="To Date" />To Date</label>
              <input type="date" name="dateTo" value={filters.dateTo}
                onChange={handleFilterChange} className="form-control" />
            </div>
            <div className="col-md-2">
              <label className="form-label"><PIcon name="Month" />Month</label>
              <input type="month" name="month" value={filters.month}
                onChange={handleFilterChange} className="form-control" />
            </div>
            <div className="col-md-2">
              <label className="form-label"><PIcon name="User Location" />User Location</label>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
                className="form-select">
                <option value="">All Locations</option>
                {locationOptions.map((loc, i) => <option key={i} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label"><PIcon name="Shift" />Shift</label>
              <select name="shift" value={filters.shift} onChange={handleFilterChange} className="form-select">
                <option value="">All Shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label"><PIcon name="Machine" />Machine</label>
              <select name="machine" value={filters.machine} onChange={handleFilterChange} className="form-select">
                <option value="">All Machines</option>
                {[...new Set(records.map((r) => r.machineId?.machineName || r.machineName))].filter(Boolean)
                  .map((machine, i) => <option key={i} value={machine}>{machine}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label"><PIcon name="Printer" />Printer</label>
              <select name="printer" value={filters.printer} onChange={handleFilterChange} className="form-select">
                <option value="">All Printers</option>
                {printerOptions.map((p, i) => <option key={i} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label"><PIcon name="Machine Status" />Machine Status</label>
              <select name="machineStatus" value={filters.machineStatus} onChange={handleFilterChange} className="form-select">
                <option value="">All Status</option>
                {machineStatuses.map((s) => <option key={s._id} value={s.statusName}>{s.statusName}</option>)}
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-danger w-100" onClick={clearFilters}><FiX className="pms-ico me-1" />Clear</button>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-success w-100" onClick={exportToExcel}><FiDownload className="pms-ico me-1" />Export Excel</button>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-primary w-100" onClick={exportLastUsedPdf}>
                <FiFileText className="pms-ico me-1" />Last Used PDF
              </button>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-success w-100" onClick={exportLastUsedExcel}>
                <FiDownload className="pms-ico me-1" />Last Used Excel
              </button>
            </div>
          </div>
        </div>

        {/* ── View toggle ── */}
        <div className="pms-toggle-wrap">
          <div className="pms-toggle">
            <button type="button"
              className={`pms-btn ${recordsView === "summary" ? "pms-btn-update" : "pms-btn-cancel"}`}
              onClick={() => setRecordsView("summary")}>
              <FiBarChart2 className="pms-ico" /> Summary Report
            </button>
            <button type="button"
              className={`pms-btn ${recordsView === "details" ? "pms-btn-update" : "pms-btn-cancel"}`}
              onClick={() => setRecordsView("details")}>
              <FiList className="pms-ico" /> Detailed Records
            </button>
          </div>
        </div>

        {/* ── Production Summary Report ── */}
        {recordsView === "summary" && (
          <div className="pms-card">
            <div className="pms-record-head">
              <div>
                <div className="pms-card-title"><FiBarChart2 className="pms-ico" /> Perso Production Summary Report</div>
                <div className="pms-card-note">{getReportDateLabel()}{locationFilter ? ` · ${locationFilter}` : ""}</div>
              </div>
              <span className="pms-count">Total: {filteredRecords.length}</span>
            </div>

            <div className="pms-table-wrap">
              {summaryRows.length === 0 ? (
                <div className="pms-empty">No production found for selected filters</div>
              ) : (
                <table className="pms-table pms-summary-table">
                  <thead>
                    <tr>
                      <th rowSpan="3">Machine</th>
                      <th rowSpan="3">Printer</th>
                      <th colSpan={1 + 2 * summarySizes.length}>Date {getReportDateLabel()}</th>
                      <th colSpan={statusColumns.length + 2}>Machine Hours</th>
                    </tr>
                    <tr>
                      <th colSpan={summarySizes.length || 1}>Day Shift</th>
                      <th colSpan={summarySizes.length || 1}>Night Shift</th>
                      <th rowSpan="2">Grand Total</th>
                      <th rowSpan="2">Production Time</th>
                      {statusColumns.map((s) => (
                        <th key={s.key} rowSpan="2">{s.label}</th>
                      ))}
                      <th rowSpan="2">Total Timings</th>
                    </tr>
                    <tr>
                      {summarySizes.map((s) => <th key={`dh-${s}`}>{s}</th>)}
                      {summarySizes.map((s) => <th key={`nh-${s}`}>{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((group) => {
                      const machineCount = {};
                      group.rows.forEach((r) => { machineCount[r.machineName] = (machineCount[r.machineName] || 0) + 1; });
                      const seen = {};
                      return group.rows.map((row, idx) => {
                        const firstOfMachine = !seen[row.machineName];
                        seen[row.machineName] = true;
                        return (
                          <tr key={`${group.activityName}-${row.machineName}-${row.printerName}`}>
                            {firstOfMachine && (
                              <td rowSpan={machineCount[row.machineName]} className="pms-sum-center">{row.machineName}</td>
                            )}
                            <td className="pms-sum-center">{row.printerName}</td>

                            {summarySizes.map((s) => (
                              <td key={`d-${s}`} className="pms-sum-num">
                                {fmtReportNum(row.dayBySize[s], row.dayBySize[s] !== undefined)}
                              </td>
                            ))}

                            {summarySizes.map((s) => (
                              <td key={`n-${s}`} className="pms-sum-num">
                                {fmtReportNum(row.nightBySize[s], row.nightBySize[s] !== undefined)}
                              </td>
                            ))}
                            <td className="pms-sum-num">{fmtReportNum(row.grandTotal, row.dayEntered || row.nightEntered)}</td>
                            <td className="pms-sum-time">{formatHMS(row.prodMins)}</td>
                            {statusColumns.map((s) => (
                              <td key={s.key} className="pms-sum-time">
                                {formatHMS(row.statusMins[s.key] || 0)}
                              </td>
                            ))}
                            <td className="pms-sum-time" style={{ fontWeight: 800 }}>{formatHMS(row.totalMins)}</td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Records Table ── */}
        {recordsView === "details" && (
        <div className="pms-card">
          <div className="pms-record-head">
            <div>
              <div className="pms-card-title" style={{ justifyContent: "center", textAlign: "center" }}><FiList className="pms-ico" /> Machine Status Records</div>
              <div className="pms-card-note">Latest entries first</div>
            </div>
            <span className="pms-count">Total: {filteredRecords.length}</span>
          </div>

          <div className="pms-table-wrap">
            {records.length === 0 ? (
              <div className="pms-empty">No records found</div>
            ) : (
              <table className="pms-table">
                <thead>
                  <tr>
                    <th>#</th><th>Date</th><th>WO No.</th><th>Shift</th>
                    <th>Activity</th><th>Machine</th><th>Status</th>
                    <th>Customer</th><th>Item</th><th>From</th><th>To</th><th>Total Time</th>
                    <th>Pages</th><th>Wastage</th><th>Waste %</th><th>Reason</th>
                    <th>Paper Size</th><th>Printer</th><th>User</th>
                    <th>Remarks</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((item, i) => (
                    <tr key={item._id}>
                      <td>{(safePage - 1) * pageSize + i + 1}</td>
                      <td>{fmtDate(item.productionDate)}</td>
                      <td>{item.woNumber || <span className="pms-muted">—</span>}</td>
                      <td>{item.shift ? <ShiftBadge shift={item.shift} /> : "—"}</td>
                      <td>{item.activityId?.activityName || item.activityName || <span className="pms-muted">—</span>}</td>
                      <td>{item.machineId?.machineName   || item.machineName  || <span className="pms-muted">—</span>}</td>
                      <td><StatusBadge status={item.machineStatus} /></td>
                      <td>{item.customerName || <span className="pms-muted">—</span>}</td>
                      <td>{item.materialType || <span className="pms-muted">—</span>}</td>
                      <td>{fmtTime(item.fromTime)}</td>
                      <td>{fmtTime(item.toTime)}</td>
                      <td style={{ fontWeight: 800 }}>
                        {getTotalTime(item.fromTime, item.toTime) || <span className="pms-muted">—</span>}
                      </td>
                      <td>{item.totalPages    || <span className="pms-muted">—</span>}</td>
                      <td>{item.wastageSheets || <span className="pms-muted">—</span>}</td>
                      <td>{item.wastePercentage ? `${item.wastePercentage}%` : <span className="pms-muted">—</span>}</td>
                      <td className="pms-wrap-text">{item.reason  || <span className="pms-muted">—</span>}</td>
                      <td>{item.paperSize   || <span className="pms-muted">—</span>}</td>
                      <td>{item.printerName || <span className="pms-muted">—</span>}</td>
                      <td>{item.enteredBy}</td>
                      <td className="pms-wrap-text">{item.remarks || <span className="pms-muted">—</span>}</td>
                      <td>
                        {item.enteredBy === loggedInUser ? (
                          <div className="pms-table-actions">
                            <button className="pms-small-btn pms-edit-btn" type="button"
                              onClick={() => handleEdit(item)}><FiEdit2 className="pms-ico" /> Edit</button>
                            <button className="pms-small-btn pms-delete-btn" type="button"
                              onClick={() => handleDelete(item._id)}><FiTrash2 className="pms-ico" /> Delete</button>
                          </div>
                        ) : (
                          <span className="pms-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {records.length > 0 && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              total={filteredRecords.length}
              onPage={goToPage}
              onPageSize={setPageSize}
            />
          )}
        </div>
        )}
      </div>
    </div>
  );
}