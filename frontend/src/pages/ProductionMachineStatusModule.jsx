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

/* ──────────────────────────────────────────────────────────────
   Replace the ENTIRE `const CSS = \`...\`;` block in your NEW file
   with the block below. Nothing else in the file changes, so every
   feature (icons, summary report, pagination, toggle, exports,
   validation, API calls) works exactly as before.
   ────────────────────────────────────────────────────────────── */

const CSS = `
  .pms-root {
    --bg: #e4f5fd;
    --panel: #ffffff;
    --panel-soft: #f1faff;
    --line: #bfe0f2;
    --line-dark: #86c3e4;
    --text: #0b2f4f;
    --muted: #4a6f8c;
    --hint: #8fb0c8;
    --blue: #2a9be0;
    --blue-dark: #0a5f9e;
    --blue-soft: #d6effc;
    --green: #10b981;
    --green-soft: #dcfce7;
    --green-text: #065f46;
    --red: #dc2626;
    --red-soft: #fee2e2;
    --red-text: #991b1b;
    --slate: #3d5a73;
    --slate-soft: #e3eef6;
    --cyan-soft: #cffafe;
    --cyan-text: #155e75;
    --indigo-soft: #e0e7ff;
    --indigo-text: #3730a3;
    min-height: 100vh;
    background:
      radial-gradient(circle at 10% 6%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 30%),
      radial-gradient(circle at 90% 18%, rgba(160, 228, 255, 0.65) 0, rgba(160, 228, 255, 0) 32%),
      linear-gradient(165deg, #eaf8ff 0%, #cdeefc 42%, #a9ddf6 78%, #dcf3fd 100%);
    background-attachment: fixed;
    color: var(--text);
    font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    font-size: 14px;
  }

  .pms-root * { box-sizing: border-box; }

  /* ───────── Header ───────── */
  .pms-header {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(214, 240, 252, 0.9) 100%);
    color: #0a4f8c;
    padding: 16px 28px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.95);
    box-shadow: 0 10px 26px rgba(40, 120, 170, 0.18), inset 0 -8px 18px rgba(140, 210, 245, 0.2);
  }

  .pms-header-inner {
    max-width: 1580px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }

  .pms-title { font-size: 24px; font-weight: 800; margin: 0; color: #0a4f8c; letter-spacing: -0.3px; }
  .pms-subtitle { margin-top: 4px; color: var(--muted); font-size: 13px; font-weight: 600; }

  .pms-user-box {
    background: linear-gradient(180deg, #ffffff 0%, #dff4ff 100%);
    color: var(--text);
    border-radius: 14px;
    padding: 8px 16px;
    border: 1px solid #a9d9f2;
    box-shadow: 0 4px 12px rgba(40, 120, 170, 0.15), inset 0 1px 0 #fff;
    min-width: 190px;
  }
  .pms-user-label { color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .pms-user-name  { font-size: 15px; font-weight: 800; margin-top: 2px; color: #0a4f8c; }

  .pms-body { max-width: 1580px; margin: 0 auto; padding: 22px 28px 34px; }

  /* ───────── Cards ───────── */
  .pms-card {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(228, 246, 255, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.95);
    border-radius: 22px;
    box-shadow: 0 16px 36px rgba(40, 120, 170, 0.2), inset 0 1px 0 #fff;
    overflow: hidden;
    margin-bottom: 24px;
  }

  .pms-card-head {
    background: linear-gradient(180deg, #9adcf9 0%, #53bdf0 55%, #34a5e3 100%);
    color: #ffffff;
    padding: 13px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    text-shadow: 0 1px 3px rgba(0, 80, 140, 0.45);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .pms-card-title { font-size: 16px; font-weight: 800; }
  .pms-card-note  { color: #eaf7ff; font-size: 12px; font-weight: 600; margin-top: 2px; }

  .pms-edit-badge {
    background: linear-gradient(180deg, #fff7d6, #ffe9a3);
    color: #8a5a00;
    border: 1px solid #fde68a;
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 12px;
    font-weight: 900;
    text-shadow: none;
  }

  .pms-form-body { padding: 18px; background: rgba(241, 250, 255, 0.6); }

  /* ───────── Entry sections ───────── */
  .pms-section {
    background: linear-gradient(180deg, #ffffff 0%, #f4fbff 100%);
    border: 1px solid #cfe8f6;
    border-radius: 18px;
    padding: 16px 18px 18px;
    margin-bottom: 16px;
    box-shadow: 0 8px 20px rgba(40, 120, 170, 0.1), inset 0 1px 0 #fff;
  }

  .pms-section-title {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%);
    color: #0a4f8c;
    border: 1px solid #a9d9f2;
    border-radius: 999px;
    padding: 6px 16px 6px 12px;
    font-size: 13px;
    font-weight: 900;
    margin-bottom: 14px;
    box-shadow: 0 3px 8px rgba(40, 120, 170, 0.12), inset 0 1px 0 #fff;
  }
  .pms-section-title::before {
    content: "";
    width: 10px; height: 10px; border-radius: 50%;
    background: radial-gradient(circle at 30% 25%, #b6ecff, #2a9be0 70%);
    box-shadow: 0 0 0 3px rgba(42, 155, 224, 0.2);
  }

  .pms-grid   { display: grid; grid-template-columns: repeat(5, minmax(160px, 1fr)); gap: 14px 16px; }
  .pms-grid-4 { grid-template-columns: repeat(4, minmax(170px, 1fr)); }
  .pms-grid-remarks { grid-template-columns: 1fr 280px; }

  .pms-field { display: flex; flex-direction: column; gap: 6px; }
  .pms-label { color: var(--text); font-size: 12.5px; font-weight: 800; letter-spacing: 0.2px; }
  .pms-req   { color: #e11d48; }

  .pms-input,
  .pms-select,
  .pms-textarea {
    width: 100%;
    min-height: 42px;
    border: 1.5px solid #9ccbe6;
    border-radius: 12px;
    background: #ffffff;
    color: var(--text);
    padding: 8px 12px;
    font-size: 14px;
    font-weight: 700;
    outline: none;
    box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1), 0 1px 0 rgba(255, 255, 255, 0.9);
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }
  .pms-select { cursor: pointer; }
  .pms-textarea { resize: vertical; line-height: 1.4; }
  .pms-input::placeholder, .pms-textarea::placeholder { color: #8fb0c8; font-weight: 600; }

  .pms-input:hover, .pms-select:hover, .pms-textarea:hover { border-color: #5fb4de; }

  .pms-input:focus,  .pms-select:focus,  .pms-textarea:focus {
    border-color: #1b9be0;
    box-shadow: inset 0 1px 2px rgba(10, 80, 130, 0.06), 0 0 0 4px rgba(27, 155, 224, 0.2), 0 6px 14px rgba(27, 155, 224, 0.14);
  }
  .pms-input:disabled, .pms-select:disabled {
    background: linear-gradient(180deg, #f1f7fb 0%, #dfecf5 100%);
    color: var(--muted);
    border-color: #bcd5e6;
    opacity: 1;
    cursor: not-allowed;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  .pms-readonly {
    background: linear-gradient(180deg, #eaf7ff 0%, #d6effc 100%) !important;
    color: var(--blue-dark) !important;
    border-color: #6fb4dc !important;
    font-weight: 900 !important;
  }

  .pms-actions { display: flex; gap: 10px; justify-content: flex-end; align-items: end; }

  .pms-btn {
    min-height: 42px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 12px;
    padding: 0 22px;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0, 60, 100, 0.4);
  }
  .pms-btn:active { transform: translateY(2px); }
  .pms-btn-save   {
    background: linear-gradient(180deg, #8ae9bd 0%, #2fcf92 50%, #10b981 52%, #0a9d6c 100%);
    box-shadow: 0 4px 0 #087a55, 0 10px 18px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .pms-btn-save:hover   { transform: translateY(-1px); box-shadow: 0 5px 0 #087a55, 0 14px 22px rgba(16, 185, 129, 0.38); }
  .pms-btn-update {
    background: linear-gradient(180deg, #a8e6ff 0%, #4fb8ee 50%, #2a9be0 52%, #1a86cc 100%);
    box-shadow: 0 4px 0 #136aa5, 0 10px 18px rgba(42, 155, 224, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .pms-btn-update:hover { transform: translateY(-1px); box-shadow: 0 5px 0 #136aa5, 0 14px 22px rgba(42, 155, 224, 0.38); }
  .pms-btn-cancel {
    background: linear-gradient(180deg, #d5e3ee 0%, #9db8cc 52%, #7f9db3 100%);
    box-shadow: 0 4px 0 #5d7c93, 0 10px 18px rgba(93, 124, 147, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .pms-btn-cancel:hover { transform: translateY(-1px); }

  .pms-record-head {
    background: linear-gradient(180deg, #9adcf9 0%, #53bdf0 55%, #34a5e3 100%);
    color: #ffffff;
    padding: 13px 20px;
    display: flex; justify-content: space-between; align-items: center;
    text-shadow: 0 1px 3px rgba(0, 80, 140, 0.45);
  }
  .pms-count {
    background: #ffffff; color: #0a4f8c;
    border: 1px solid #a9d9f2;
    padding: 5px 14px; border-radius: 999px;
    font-size: 12px; font-weight: 900; text-shadow: none;
  }

  /* centered title in Summary Report / Records header */
  .pms-record-head { position: relative; justify-content: flex-end; min-height: 58px; }
  .pms-record-head > div:first-child {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    text-align: center; white-space: nowrap;
  }
  .pms-record-head .pms-card-title { justify-content: center; }
  .pms-record-head, .pms-record-head .pms-card-title, .pms-record-head .pms-card-note { color: #000000; text-shadow: none; }
  @media (max-width: 768px) {
    .pms-record-head { flex-direction: column; justify-content: center; gap: 8px; }
    .pms-record-head > div:first-child { position: static; transform: none; white-space: normal; }
  }

  /* ───────── Records table ───────── */
  .pms-table-wrap { max-height: 500px; overflow: auto; background: #ffffff; }
  .pms-table { width: 100%; border-collapse: collapse; white-space: nowrap; font-size: 13px; }
  .pms-table th {
    position: sticky; top: 0; z-index: 3;
    background: #2a8fd4;
    color: #ffffff;
    padding: 12px 10px; text-align: left;
    font-size: 12px; font-weight: 900;
    border: 1px solid #14639c;
    text-shadow: 0 1px 2px rgba(0, 80, 140, 0.5);
  }
  .pms-table td {
    padding: 10px; border: 1px solid #d3e8f4;
    vertical-align: middle; color: var(--text); font-weight: 600;
  }
  .pms-table tbody tr:nth-child(even) { background: #f3faff; }
  .pms-table tbody tr:hover { background: #d9f2fc; }

  .pms-status {
    display: inline-flex; align-items: center;
    min-width: 92px; justify-content: center;
    border-radius: 999px; padding: 5px 10px;
    font-size: 12px; font-weight: 900;
  }
  .pms-status-production { background: var(--green-soft); color: var(--green-text); border: 1px solid #86efac; }
  .pms-status-idle       { background: var(--cyan-soft);  color: var(--cyan-text);  border: 1px solid #67e8f9; }
  .pms-status-breakdown  { background: var(--red-soft);   color: var(--red-text);   border: 1px solid #fca5a5; }
  .pms-status-default    { background: var(--slate-soft); color: var(--slate);      border: 1px solid #94a3b8; }

  .pms-shift { display: inline-flex; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 900; }
  .pms-shift-day   { background: var(--cyan-soft);  color: var(--cyan-text);  border: 1px solid #67e8f9; }
  .pms-shift-night { background: var(--indigo-soft); color: var(--indigo-text); border: 1px solid #a5b4fc; }

  .pms-table-actions { display: flex; gap: 8px; }
  .pms-small-btn {
    border: none; border-radius: 8px;
    min-height: 30px; padding: 0 12px;
    font-size: 12px; font-weight: 900; cursor: pointer;
    transition: all 0.12s ease;
  }
  .pms-small-btn:hover { transform: translateY(-1px); }
  .pms-edit-btn   { background: linear-gradient(180deg, #ffffff, #d6effc); color: var(--blue-dark); border: 1px solid #86c3e4; }
  .pms-delete-btn { background: linear-gradient(180deg, #ffffff, #fee2e2); color: var(--red-text);  border: 1px solid #fca5a5; }

  .pms-muted    { color: var(--hint); }
  .pms-wrap-text { max-width: 180px; white-space: normal; color: var(--muted); font-size: 12px; }
  .pms-empty    { padding: 46px; text-align: center; color: var(--muted); font-weight: 800; }

  /* ───────── Time Slots Section ───────── */
  .ts-section {
    background: linear-gradient(180deg, #fffdf3 0%, #fff6dc 100%);
    border: 1px solid #fcd88a;
    border-radius: 18px;
    padding: 16px 18px;
    margin-bottom: 16px;
    box-shadow: 0 8px 20px rgba(217, 119, 6, 0.1), inset 0 1px 0 #fff;
  }
  .ts-section-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(180deg, #ffffff 0%, #ffedb8 100%);
    color: #92400e;
    border: 1px solid #fcd88a;
    border-radius: 999px;
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 900;
    margin-bottom: 14px;
    box-shadow: 0 3px 8px rgba(217, 119, 6, 0.12), inset 0 1px 0 #fff;
  }
  .ts-slot-row {
    display: grid;
    grid-template-columns: 180px 120px 120px 1fr 36px;
    gap: 10px;
    align-items: end;
    margin-bottom: 10px;
    background: #ffffff;
    border: 1px solid #fde8b0;
    border-radius: 14px;
    padding: 10px 12px;
    box-shadow: 0 3px 8px rgba(217, 119, 6, 0.06);
  }
  .ts-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(180deg, #ffd98a 0%, #f8b43c 52%, #f59e0b 100%);
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(120, 70, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 12px;
    padding: 8px 18px;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    margin-top: 4px;
    box-shadow: 0 3px 0 #c97a05, 0 8px 14px rgba(245, 158, 11, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.7);
    transition: .15s;
  }
  .ts-add-btn:hover { transform: translateY(-1px); }
  .ts-remove-btn {
    width: 36px; height: 36px;
    background: linear-gradient(180deg, #ffffff, #fee2e2);
    color: var(--red-text);
    border: 1px solid #fca5a5;
    border-radius: 10px;
    font-size: 18px;
    font-weight: 900;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .ts-slot-label {
    background: #fff1c4;
    color: #92400e;
    border-radius: 999px;
    padding: 2px 9px;
    font-size: 11px;
    font-weight: 900;
    margin-bottom: 6px;
    display: inline-block;
    width: fit-content;
  }
  .ts-empty-hint {
    color: #92400e;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 0 4px;
    opacity: .75;
  }

  /* ───────── Filters panel (compact + light) ───────── */
  .pms-root .card {
    background: linear-gradient(180deg, #ffffff 0%, #f1f9ff 100%) !important;
    border: 1px solid #d3eaf7 !important;
    border-radius: 14px !important;
    box-shadow: 0 4px 12px rgba(40, 120, 170, 0.08) !important;
    padding: 8px 12px 10px !important;
    margin: 12px 0 14px !important;
  }
  .pms-root .card h5 {
    font-size: 12.5px; font-weight: 800; color: #0a4f8c;
    margin: 0 0 6px !important; text-align: left !important;
  }
  .pms-root .card .row { --bs-gutter-x: 8px; --bs-gutter-y: 6px; }
  .pms-root .form-label {
    color: var(--muted) !important; font-size: 10.5px; font-weight: 700;
    margin-bottom: 2px !important;
  }
  .pms-root .form-control,
  .pms-root .form-select {
    min-height: 30px;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    background-color: #ffffff;
    border: 1px solid #bfe0f2 !important;
    border-radius: 8px;
    box-shadow: none;
  }
  .pms-root .form-control:focus,
  .pms-root .form-select:focus {
    border-color: #5fb4de !important;
    box-shadow: 0 0 0 3px rgba(27, 155, 224, 0.15);
  }
  .pms-root .btn {
    min-height: 30px;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 800;
    border-radius: 8px;
    box-shadow: none;
    transition: all .15s ease;
  }
  .pms-root .btn:hover { transform: translateY(-1px); }
  .pms-root .btn-danger  { background: #ffe9e9; color: #b91c1c; border: 1px solid #f8b4b4; }
  .pms-root .btn-success { background: #dff7ec; color: #047857; border: 1px solid #9be3c3; }
  .pms-root .btn-primary { background: #dff1fd; color: #0a5f9e; border: 1px solid #a9d9f2; }
  .pms-root .btn-danger:hover  { background: #ffd9d9; color: #b91c1c; }
  .pms-root .btn-success:hover { background: #c9f1e0; color: #047857; }
  .pms-root .btn-primary:hover { background: #cbe8fa; color: #0a5f9e; }
  @media (min-width: 768px) {
    .pms-root .card .row > [class*="col-md-"] { flex: 0 0 auto; width: 12.5%; }
  }

  /* ───────── Compact entry form ───────── */
  .pms-header { padding: 10px 28px; }
  .pms-title { font-size: 20px; }
  .pms-user-box { padding: 5px 14px; min-width: 160px; }
  .pms-user-name { font-size: 14px; margin-top: 0; }
  .pms-body { padding-top: 14px; }
  .pms-card { border-radius: 18px; margin-bottom: 16px; }
  .pms-card-head { padding: 8px 18px; }
  .pms-card-title { font-size: 14px; }
  .pms-edit-badge { padding: 3px 12px; font-size: 11px; }
  .pms-form-body { padding: 10px 12px; }
  .pms-section { padding: 9px 14px 12px; margin-bottom: 10px; border-radius: 14px; }
  .pms-section-title { padding: 3px 12px 3px 9px; font-size: 12px; margin-bottom: 8px; gap: 7px; }
  .pms-section-title::before { width: 8px; height: 8px; box-shadow: 0 0 0 2px rgba(42, 155, 224, 0.2); }
  .pms-grid { grid-template-columns: repeat(5, minmax(140px, 1fr)); gap: 8px 12px; }
  .pms-grid-4 { grid-template-columns: repeat(4, minmax(150px, 1fr)); }
  .pms-grid-remarks { grid-template-columns: 1fr 240px; }
  .pms-field { gap: 3px; }
  .pms-label { font-size: 11.5px; }
  .pms-input, .pms-select, .pms-textarea { min-height: 34px; padding: 5px 10px; font-size: 13px; border-radius: 10px; }
  .pms-textarea { min-height: 50px; }
  .pms-btn { min-height: 34px; padding: 0 18px; font-size: 13px; border-radius: 10px; }
  .ts-section { padding: 9px 14px 11px; margin-bottom: 10px; border-radius: 14px; }
  .ts-section-title { padding: 3px 12px; font-size: 12px; margin-bottom: 8px; }
  .ts-slot-row { padding: 6px 10px; margin-bottom: 6px; gap: 8px; border-radius: 10px; }
  .ts-add-btn { padding: 5px 14px; font-size: 12px; margin-top: 2px; }
  .ts-remove-btn { width: 30px; height: 30px; font-size: 16px; }
  .ts-slot-label { margin-bottom: 3px; padding: 1px 8px; font-size: 10px; }

  /* ───────── Centered page heading ───────── */
  .pms-header-inner { position: relative; justify-content: flex-end; min-height: 46px; }
  .pms-header-inner > div:first-child {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    text-align: center; white-space: nowrap;
  }

  /* ───────── Icons ───────── */
  .pms-ico { width: 15px; height: 15px; flex-shrink: 0; vertical-align: -2px; opacity: 0.95; }
  .pms-ico-lg { width: 22px; height: 22px; }
  .pms-title { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .pms-card-title { display: flex; align-items: center; gap: 8px; }
  .pms-label, .pms-root .form-label { display: flex; align-items: center; gap: 6px; }
  .pms-label .pms-ico, .pms-root .form-label .pms-ico { color: var(--blue); }
  .pms-req { margin-left: 1px; }
  .pms-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  .pms-small-btn { display: inline-flex; align-items: center; gap: 5px; }
  .pms-section-title .pms-ico { width: 16px; height: 16px; opacity: 1; color: var(--blue-dark); }
  .ts-add-btn .pms-ico { color: #ffffff; }

  /* ───────── 7-column row for Customer & Machine section ───────── */
  @media (min-width: 1400px) {
    .pms-grid-7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  }

  /* ───────── View toggle + summary table ───────── */
  .pms-toggle-wrap { display: flex; justify-content: center; margin: 0 0 14px; }
  .pms-toggle {
    display: inline-flex; gap: 8px; padding: 5px; border-radius: 16px;
    background: linear-gradient(180deg, #ffffff 0%, #e4f5ff 100%);
    border: 1px solid #a9d9f2;
    box-shadow: 0 6px 16px rgba(40, 120, 170, 0.15), inset 0 1px 0 #fff;
  }
  .pms-toggle .pms-btn { min-width: 170px; }
  .pms-summary-table { font-size: 13px; }
  .pms-summary-table thead th { text-align: center; white-space: normal; height: 38px; padding: 6px 8px; }
  .pms-summary-table thead tr:nth-child(2) th { top: 38px; }
  .pms-summary-table thead tr:nth-child(3) th { top: 76px; }
  .pms-summary-table td { padding: 8px; }
  .pms-sum-center { text-align: center; font-weight: 800; }
  .pms-sum-num { text-align: right; font-variant-numeric: tabular-nums; }
  .pms-sum-time { text-align: center; }
  .pms-sum-remarks { max-width: 150px; text-align: center; font-size: 12px; color: var(--muted); cursor: pointer; overflow: hidden; text-overflow: ellipsis; }

  /* ───────── Pagination bar ───────── */
  .pms-pager {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 16px;
    border-top: 1px solid #cfe8f6;
    background: linear-gradient(180deg, #f4fbff 0%, #e3f4fd 100%);
  }
  .pms-pager-info { color: var(--muted); font-size: 13px; font-weight: 800; }
  .pms-pager-nav, .pms-pager-extra, .pms-pager-jump { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .pms-pg-btn {
    min-width: 36px; min-height: 34px; padding: 0 10px;
    border: 1px solid #86c3e4; border-radius: 10px;
    background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%);
    color: var(--blue-dark);
    font-size: 13px; font-weight: 900; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(40, 120, 170, 0.12), inset 0 1px 0 #fff;
    transition: all 0.12s ease;
  }
  .pms-pg-btn:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--blue); background: linear-gradient(180deg, #ffffff 0%, #c4e8fa 100%); }
  .pms-pg-btn.active {
    background: linear-gradient(180deg, #a8e6ff 0%, #4fb8ee 50%, #2a9be0 52%, #1a86cc 100%);
    border-color: #1a86cc; color: #ffffff;
    text-shadow: 0 1px 2px rgba(0, 60, 100, 0.4);
    box-shadow: 0 3px 0 #136aa5, 0 6px 12px rgba(42, 155, 224, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .pms-pg-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .pms-pager-gap { color: var(--hint); font-weight: 900; padding: 0 4px; }
  .pms-pager .pms-input, .pms-pager .pms-select { min-height: 34px; width: auto; padding: 4px 8px; font-size: 13px; }
  .pms-pager .pms-input { width: 120px; }

  @media (max-width: 1200px) {
    .pms-grid, .pms-grid-4 { grid-template-columns: repeat(3, minmax(160px, 1fr)); }
    .pms-grid-remarks { grid-template-columns: 1fr; }
    .ts-slot-row { grid-template-columns: 1fr 1fr 1fr 1fr 36px; }
  }
  @media (max-width: 768px) {
    .pms-header, .pms-body { padding-left: 14px; padding-right: 14px; }
    .pms-grid, .pms-grid-4 { grid-template-columns: 1fr; }
    .pms-actions { justify-content: stretch; flex-direction: column; }
    .pms-btn { width: 100%; }
    .ts-slot-row { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .pms-header-inner { justify-content: center; flex-direction: column; min-height: 0; }
    .pms-header-inner > div:first-child { position: static; transform: none; white-space: normal; }
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
    const [allowedMachineIds, setAllowedMachineIds] = useState(null); // null = no restriction

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
    // keep the currently selected machine so editing an old entry never blanks the field
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
  // prefer one that has both "perso" and "print" in the name
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
      // keep these — persist across saves until page refresh
      productionDate: prev.productionDate,
      shift: prev.shift,
      activityId: prev.activityId,
      machineId: prev.machineId,
      printerName: prev.printerName,

      // clear everything else for the next entry
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

    /* Validate extra slots */
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
      // Equal from/to time means a full 24-hour span (e.g. 1:00 PM -> 1:00 PM next occurrence),
      // and any end time at/before start time means it rolled past midnight.
      if (end <= start) end.setDate(end.getDate() + 1);
      return (end - start) / (1000 * 60 * 60);
    };

    // hours from the main entry + any extra idle/breakdown slots being submitted now
    let totalHours = getEntryHours(form.productionDate, form.fromTime, form.toTime);
    extraSlots.forEach((slot) => {
      totalHours += getEntryHours(form.productionDate, slot.fromTime, slot.toTime);
    });

    // existing saved records for the same printer + same date (skip the one being edited)
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
        /* ── EDIT: update the main record + save any new extra slots ── */
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
        /* ── CREATE: save main record then each extra slot ── */
        await axios.post(`${BASE_URL}/api/production-machine-status`, basePayload, authHeaders);

        /* Save each extra slot as its own record, inheriting shared fields */
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
    setExtraSlots([]); // start fresh; user can add new slots if needed
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
    if (mins <= 0) mins += 24 * 60; // crossed midnight (or equal = 24h)

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

  /* only the rows of the current page are drawn */
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
          prodMins: 0, idleMins: 0, breakdownMins: 0, maintMins: 0,
          dayRemarks: new Set(), nightRemarks: new Set(),
        });
      }
      return g.rows.get(key);
    };

    // seed every machine / printer of the Perso activity with zero values
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

      // machine hours by status
      const durMins = getDurationMins(item.fromTime, item.toTime);
      if (isProd) row.prodMins += durMins;
      else if (statusKey === "idle" || statusKey === "idle time") row.idleMins += durMins;
      else if (statusKey.includes("break")) row.breakdownMins += durMins;
      else if (statusKey.includes("maint")) row.maintMins += durMins;

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
        totalMins: r.prodMins + r.idleMins + r.breakdownMins + r.maintMins,
      }));
      // keep each machine's printers together
      const order = [...new Set(rows.map((r) => r.machineName))];
      rows.sort((a, b) => order.indexOf(a.machineName) - order.indexOf(b.machineName));
      return { activityName: group.activityName, rows };
    });
  };

  // only computed while the Summary view is on screen
  const summaryRows = useMemo(
    () => (recordsView === "summary" ? buildSummary() : []),
    [recordsView, filteredRecords, activities, machines, printers, persoActivity]
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
    const dayEnd = 1 + n;                 // last Day column
    const nightStart = dayEnd + 1;
    const nightEnd = nightStart + n - 1;  // last Night column
    const dateEnd = nightEnd + 1;         // Grand Total column
    const hoursStart = dateEnd + 1;
    const hoursEnd = hoursStart + 4;
    const blank = (k) => Array(Math.max(k, 0)).fill("");

    const aoa = [
      ["Machine", "Printer", `Date ${getReportDateLabel()}`, ...blank(dateEnd - 2), "Machine Hours", ...blank(4)],
      ["", "", "Day Shift", ...blank(n - 1), "Night Shift", ...blank(n - 1), "Grand Total",
        "Production Time", "Idle Time", "Breakdown Time", "Maintenance Time", "Total Timings"],
      ["", "", ...sizes, ...sizes, ...blank(6)],
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
          formatHMS(row.idleMins),
          formatHMS(row.breakdownMins),
          formatHMS(row.maintMins),
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
      { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 14 },
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
          ...(isHeader ? { fill: { fgColor: { rgb: "9FC3E3" } } } : {}),
        };
        if (!isHeader && isNumberCol && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      }
    }
    return ws;
  };

  /* ── LAST USED: ACTIVITY > MACHINE > PRINTER (location-filter based) ── */
  const buildLastUsedGroups = () => {
    // use only the selected location's records (all records if none selected)
    const sourceList = locationFilter
      ? records.filter((r) => r.userLocations?.includes(locationFilter))
      : records;

    if (!sourceList.length) return null;

    const lastUsed = new Map();          // activity+machine+printer -> latest entry
    const seenPrinters = new Map();      // activity+machine -> printers found in records

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
          // printers from the master list + any printer seen in saved records
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
      headStyles: { fillColor: [6, 76, 115], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 70 },
        5: { cellWidth: 130 },
      },
      // highlight printers never used
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
          ...(isHeader ? { fill: { fgColor: { rgb: "9FC3E3" } } } : {}),
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
    // Summary view -> download ONLY the Summary Report
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

      {/* Header */}
      <div className="pms-header">
        <div className="pms-header-inner">
          <div><h1 className="pms-title"><FiPrinter className="pms-ico pms-ico-lg" /> Perso Production Entry</h1></div>
          <div className="pms-user-box">
            <div className="pms-user-label">Logged In</div>
            <div className="pms-user-name">{loggedInUser || "—"}</div>
          </div>
        </div>
      </div>

      <div className="pms-body">
        <div className="pms-card">
          <div className="pms-card-head">
            <div>
              <div className="pms-card-title">
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
                    ⏱ Idle / Breakdown Time Slots
                    <span style={{ fontWeight: 600, fontSize: 12, opacity: .8 }}>
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
          style={{ background: "#fbfbfb", boxShadow: "0 2px 6px rgba(0,0,0,0.69)", borderRadius: "10px" }}>
          <h5 className="mb-3 text-center fw-bold"><FiFilter className="pms-ico me-2" />Filters &amp; Excel Export</h5>
          <div className="row g-2">
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="WO Number" />WO Number</label>
              <input type="text" name="workOrder" placeholder="WO No"
                value={filters.workOrder} onChange={handleFilterChange} className="form-control border-dark" />
            </div>
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="From Date" />From Date</label>
              <input type="date" name="dateFrom" value={filters.dateFrom}
                onChange={handleFilterChange} className="form-control border-dark" />
            </div>
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="To Date" />To Date</label>
              <input type="date" name="dateTo" value={filters.dateTo}
                onChange={handleFilterChange} className="form-control border-dark" />
            </div>
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="Month" />Month</label>
              <input type="month" name="month" value={filters.month}
                onChange={handleFilterChange} className="form-control border-dark" />
            </div>
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="User Location" />User Location</label>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
                className="form-select border-dark">
                <option value="">All Locations</option>
                {locationOptions.map((loc, i) => <option key={i} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="Shift" />Shift</label>
              <select name="shift" value={filters.shift} onChange={handleFilterChange} className="form-select border-dark">
                <option value="">All Shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="Machine" />Machine</label>
              <select name="machine" value={filters.machine} onChange={handleFilterChange} className="form-select border-dark">
                <option value="">All Machines</option>
                {[...new Set(records.map((r) => r.machineId?.machineName || r.machineName))].filter(Boolean)
                  .map((machine, i) => <option key={i} value={machine}>{machine}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="Printer" />Printer</label>
              <select name="printer" value={filters.printer} onChange={handleFilterChange} className="form-select border-dark">
                <option value="">All Printers</option>
                {printerOptions.map((p, i) => <option key={i} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label text-black"><PIcon name="Machine Status" />Machine Status</label>
              <select name="machineStatus" value={filters.machineStatus} onChange={handleFilterChange} className="form-select border-dark">
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
                      <th colSpan="5">Machine Hours</th>
                    </tr>
                    <tr>
                      <th colSpan={summarySizes.length || 1}>Day Shift</th>
                      <th colSpan={summarySizes.length || 1}>Night Shift</th>
                      <th rowSpan="2">Grand Total</th>
                      <th rowSpan="2">Production Time</th>
                      <th rowSpan="2">Idle Time</th>
                      <th rowSpan="2">Breakdown Time</th>
                      <th rowSpan="2">Maintenance Time</th>
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
                        const dayKey = `sumday-${group.activityName}-${row.machineName}-${row.printerName}`;
                        const nightKey = `sumnight-${group.activityName}-${row.machineName}-${row.printerName}`;
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
                            <td className="pms-sum-time">{formatHMS(row.idleMins)}</td>
                            <td className="pms-sum-time">{formatHMS(row.breakdownMins)}</td>
                            <td className="pms-sum-time">{formatHMS(row.maintMins)}</td>
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
              <div className="pms-card-title"><FiList className="pms-ico" /> Machine Status Records</div>
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