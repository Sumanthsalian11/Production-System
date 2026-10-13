import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

const CSS = `
  /* ---------- Production Report style (white page, light-blue cards) ---------- */
  .rpt-root {
    --ink: #08283d; --muted: #475569; --hint: #94a3b8;
    --accent: #06324d; --line: rgba(20, 93, 130, 0.28); --line-strong: rgba(20, 111, 156, 0.42);
    --mono: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    min-height: 100vh;
    padding: 18px;
    font-family: var(--sans); font-size: 14px; color: var(--ink);
    background: #ffffff;
    border: 1px solid rgba(12, 90, 130, 0.38);
  }
  .rpt-root * { box-sizing: border-box; margin: 0; padding: 0; }

  /* ---------- Header (unused in markup, kept for parity) ---------- */
  .rpt-header {
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 12px;
    padding: 12px 22px; margin: 0 auto 16px; max-width: 100%;
    border-radius: 12px;
    background: rgba(221, 243, 252, 0.94);
    border: 1px solid rgba(20, 111, 156, 0.42);
    box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22);
  }
  .rpt-brand { display: flex; align-items: center; gap: 14px; }
  .rpt-emblem {
    width: 48px; height: 48px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #0a6fb8;
    background: #ffffff;
    border: 1px solid rgba(20, 111, 156, 0.42);
  }
  .rpt-header-title { font-size: 28px; font-weight: 800; letter-spacing: 0; color: #06324d; }
  .rpt-header-sub { color: var(--muted); font-size: 12px; font-weight: 600; margin-top: 2px; }
  .rpt-user-box {
    display: flex; align-items: center; gap: 9px;
    padding: 7px 16px; border-radius: 8px; min-width: 160px;
    background: #ffffff;
    border: 1px solid rgba(20, 111, 156, 0.42); color: var(--muted); font-size: 12px; font-weight: 700;
  }
  .rpt-user-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; flex-shrink: 0; }
  .rpt-user-box strong { display: block; font-size: 14px; font-weight: 800; color: #06324d; }

  .rpt-body { max-width: 100%; margin: 0; padding: 0; }

  /* ---------- Filters ---------- */
  .rpt-filter-card {
    background: rgba(221, 243, 252, 0.94);
    border: 1px solid rgba(20, 111, 156, 0.42);
    border-radius: 12px; padding: 16px; margin-bottom: 24px;
    box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22);
  }
  .rpt-filter-title, .rpt-section-label {
    display: block;
    font-size: 18px; font-weight: 800; color: #062b42;
    padding: 6px 0; margin-bottom: 8px;
    background: none; border: 0; border-radius: 0; box-shadow: none;
    text-transform: none; letter-spacing: 0;
  }
  .rpt-filter-title::before, .rpt-section-label::before {
    display: none;
  }
  .rpt-filter-grid { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: flex-end; }
  .rpt-filter-field { display: flex; flex-direction: column; gap: 4px; min-width: 160px; flex: 1; }
  .rpt-filter-label { font-size: 14px; font-weight: 700; color: #092f47; }
  .rpt-filter-input, .rpt-filter-select {
    height: 38px; border: 1px solid rgba(14, 94, 135, 0.62); border-radius: 8px;
    background: rgba(255, 255, 255, 0.98); color: #071f31; padding: 0 12px;
    font-size: 14px; font-weight: 600; outline: none; font-family: var(--sans);
    box-shadow: inset 0 1px 2px rgba(8, 55, 83, 0.08);
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .rpt-filter-input:hover, .rpt-filter-select:hover { border-color: #087fb5; }
  .rpt-filter-input:focus, .rpt-filter-select:focus {
    border-color: #087fb5; box-shadow: 0 0 0 3px rgba(8, 127, 181, 0.22);
  }
  .rpt-btn {
    height: 38px; border: 0; border-radius: 8px; padding: 0 18px;
    font-size: 14px; font-weight: 700; cursor: pointer; color: #ffffff;
    font-family: var(--sans); letter-spacing: 0;
    box-shadow: 0 7px 15px rgba(10, 78, 115, 0.24);
    transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
  }
  .rpt-btn:hover { filter: brightness(1.05); }
  .rpt-btn:active { transform: translateY(2px); box-shadow: 0 2px 6px rgba(10, 78, 115, 0.2); }
  .rpt-btn-clear  { background: linear-gradient(135deg, #e05252, #ff7b7b); }
  .rpt-btn-export { background: linear-gradient(135deg, #0877ad, #16a4dc); }
  .rpt-btn-print  { background: linear-gradient(135deg, #0877ad, #16a4dc); }

  /* ---------- Meta bar ---------- */
  .rpt-meta-bar {
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(20, 111, 156, 0.35); border-radius: 14px;
    padding: 12px 18px; margin-bottom: 24px;
    display: flex; flex-wrap: wrap; gap: 8px 26px;
    font-size: 14px; font-weight: 700; color: var(--muted);
    box-shadow: 0 8px 18px rgba(14, 86, 122, 0.15), inset 0 1px 0 #ffffff;
  }
  .rpt-meta-item span { color: #06324d; font-weight: 900; font-family: var(--mono); }

  /* ---------- Tables ---------- */
  .rpt-table-wrap {
    overflow-x: auto; border-radius: 12px;
    border: 1px solid rgba(20, 111, 156, 0.42);
    margin-bottom: 24px; box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22); max-height: 400px;
    background: rgba(221, 243, 252, 0.94);
  }
  .rpt-table {
    width: 100%; border-collapse: collapse; white-space: nowrap;
    font-size: 13px; background: #fff;
  }
  .rpt-table th {
    background: #bfe6f8; color: #06324d;
    padding: 10px 12px; text-align: center; font-size: 13px; font-weight: 800;
    letter-spacing: 0; border: 1px solid rgba(20, 111, 156, 0.25); vertical-align: middle;
  }
  .rpt-table td {
    padding: 8px 12px; border: 1px solid rgba(20, 93, 130, 0.28); vertical-align: middle;
    text-align: center; color: #09283d; font-weight: 500; background: #fff;
  }
  .rpt-table tbody tr:nth-child(even) td { background: #f3faff; }
  .rpt-table tbody tr:hover td { background: #d9f2fc; }
  .rpt-table td.left { text-align: left; }
  .rpt-table td.mono { font-family: var(--mono); font-size: 13px; }
  .rpt-table tfoot td {
    background: #bfe6f8; color: #06324d; font-weight: 800;
    font-family: var(--mono); font-size: 13px; border: 1px solid rgba(20, 111, 156, 0.25);
  }
  .rpt-thead-group { background: #a9dcf3 !important; font-size: 13px !important; letter-spacing: 0 !important; }
  .rpt-con-machine { font-weight: 800; color: var(--ink); text-align: left; font-size: 13px; }
  .rpt-con-num { font-family: var(--mono); font-size: 13px; text-align: right; }
  .rpt-con-time { font-family: var(--mono); font-size: 13px; }
  .rpt-con-total { font-family: var(--mono); font-weight: 800; color: var(--accent); }

  .rpt-empty {
    padding: 36px; text-align: center; color: var(--muted);
    font-weight: 700; font-size: 14px; background: #fff;
  }
  .rpt-muted { color: var(--hint); }

  /* ---------- PAGE ANIMATIONS ---------- */
  @keyframes rptFadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes rptRowIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes rptMetaPop {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Filter card, then meta bar slide in */
  .rpt-filter-card {
    animation: rptFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) backwards;
  }
  .rpt-meta-bar {
    animation: rptMetaPop 0.5s cubic-bezier(0.22, 0.8, 0.3, 1) 0.15s backwards;
  }

  /* Section labels and table cards slide up one after the other */
  .rpt-section-label {
    animation: rptFadeUp 0.5s cubic-bezier(0.22, 0.8, 0.3, 1) 0.25s backwards;
  }
  .rpt-table-wrap {
    animation: rptFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.3s backwards;
  }
  .rpt-body > .rpt-section-label:nth-of-type(2),
  .rpt-body > .rpt-section-label:nth-of-type(2) + .rpt-table-wrap {
    animation-delay: 0.4s;
  }
  .rpt-body > .rpt-section-label:nth-of-type(3),
  .rpt-body > .rpt-section-label:nth-of-type(3) + .rpt-table-wrap {
    animation-delay: 0.5s;
  }

  /* Table rows fade in with a short stagger (body rows only, totals stay put) */
  .rpt-table tbody tr {
    animation: rptRowIn 0.4s ease-out backwards;
  }
  .rpt-table tbody tr:nth-child(1)  { animation-delay: 0.35s; }
  .rpt-table tbody tr:nth-child(2)  { animation-delay: 0.39s; }
  .rpt-table tbody tr:nth-child(3)  { animation-delay: 0.43s; }
  .rpt-table tbody tr:nth-child(4)  { animation-delay: 0.47s; }
  .rpt-table tbody tr:nth-child(5)  { animation-delay: 0.51s; }
  .rpt-table tbody tr:nth-child(6)  { animation-delay: 0.55s; }
  .rpt-table tbody tr:nth-child(7)  { animation-delay: 0.59s; }
  .rpt-table tbody tr:nth-child(8)  { animation-delay: 0.63s; }
  .rpt-table tbody tr:nth-child(9)  { animation-delay: 0.67s; }
  .rpt-table tbody tr:nth-child(10) { animation-delay: 0.71s; }
  .rpt-table tbody tr:nth-child(n+11) { animation-delay: 0.75s; }

  /* Respect users who prefer no motion, and keep print clean */
  @media (prefers-reduced-motion: reduce) {
    .rpt-filter-card,
    .rpt-meta-bar,
    .rpt-section-label,
    .rpt-table-wrap,
    .rpt-table tbody tr {
      animation: none !important;
    }
  }
  @media print {
    .rpt-filter-card,
    .rpt-meta-bar,
    .rpt-section-label,
    .rpt-table-wrap,
    .rpt-table tbody tr {
      animation: none !important;
    }
  }

  @media (max-width: 768px) {
    .rpt-root { padding: 12px; }
    .rpt-header { border-radius: 12px; }
    .rpt-filter-title, .rpt-section-label { font-size: 16px; }
  }
  @media print {
    .rpt-filter-card, .rpt-btn { display: none !important; }
    .rpt-root { background: #fff; padding: 0; border: 0; }
    .rpt-body { padding: 0; }
  }
`;

const toMins = (hms) => {
  if (!hms) return 0;
  const parts = hms.split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0) + (parts[2] || 0) / 60;
};

const fromMins = (m) => {
  if (!m && m !== 0) return "0:00:00";
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  const sec = Math.round((m * 60) % 60);
  return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const elapsed = (from, to) => {
  if (!from || !to) return "0:00:00";
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let mins = (th * 60 + tm) - (fh * 60 + fm);
  if (mins <= 0) mins += 24 * 60;
  return fromMins(mins);
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");
const rawDate = (d) => (d ? String(d).split("T")[0] : "");
const getId = (v) => v?._id || v || "";
const getMachineName = (r) => r.machineId?.machineName || r.machineName || "";
const getActivityName = (r) => r.activityId?.activityName || r.activityName || "";
const joinValues = (values) => [...new Set(values.filter(Boolean))].join(", ");
const addTime = (slot, r, dur) => {
  slot.from.push(r.fromTime || "");
  slot.to.push(r.toTime || "");
  slot.mins += toMins(dur);
};

export default function PersoReport() {
  const token = localStorage.getItem("token");

  const [loggedInUser, setLoggedInUser] = useState("");
  const [records, setRecords] = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

const [filters, setFilters] = useState({
  dateFrom: "", dateTo: "", month: "", shift: "", machine: "", machineStatus: "", woNumber: "", location: "", customer: "",
});

  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    if (!token) return;
    try { const decoded = jwtDecode(token); setLoggedInUser(decoded.name || ""); } catch {}
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      try {
        const [recRes, statusRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/production-machine-status`, authHeaders),
          axios.get(`${BASE_URL}/api/master/machine-status`, authHeaders),
        ]);
        setRecords((recRes.data || []).sort((a, b) => {
          const bDate = new Date(b.createdAt || b.productionDate || 0);
          const aDate = new Date(a.createdAt || a.productionDate || 0);
          return bDate - aDate;
        }));
        setMachineStatuses(statusRes.data || []);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    load();
  }, [token]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const d = r.productionDate ? new Date(r.productionDate) : null;
      const itemMonth = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "";
      if (filters.dateFrom && d && d < new Date(filters.dateFrom)) return false;
      if (
  filters.location &&
  !(r.userLocations || []).includes(filters.location)
) return false;
      if (filters.dateTo && d && d > new Date(new Date(filters.dateTo).setHours(23, 59, 59))) return false;
      if (filters.month && itemMonth !== filters.month) return false;
      if (filters.shift && r.shift !== filters.shift) return false;
      if (filters.machine && (r.machineId?.machineName || r.machineName) !== filters.machine) return false;
      if (filters.machineStatus && r.machineStatus !== filters.machineStatus) return false;
      if (filters.woNumber && !(r.woNumber || "").toLowerCase().includes(filters.woNumber.toLowerCase())) return false;
      if (filters.customer && r.customerName !== filters.customer) return false;
      return true;
    });
  }, [records, filters]);

  /* CONSOLIDATED */
const consolidated = useMemo(() => {
  const map = {};
  filtered.forEach((r) => {
    const mName = r.machineId?.machineName || r.machineName || "Unknown";
    const printer = r.printerName || "";
    const key = `${mName}||${printer}`;
    if (!map[key]) map[key] = { machineName: mName, printerName: printer, counts: {}, printingMins: 0, idleMins: 0, breakdownMins: 0, maintenanceMins: 0 };
    const e = map[key];
    const sz = (r.paperSize || "Unknown").toUpperCase();
    const pages = Number(r.totalPages) || 0;
    e.counts[sz] = (e.counts[sz] || 0) + pages;
    const dur = toMins(elapsed(r.fromTime, r.toTime));
    const status = r.machineStatus?.toLowerCase();
    if (status === "production" || status === "working") e.printingMins += dur;
  else if (
  status === "idle" ||
  status === "idle time"
)e.idleMins += dur;
    else if (status?.includes("break")) e.breakdownMins += dur;
    else if (status?.includes("maint")) e.maintenanceMins += dur;
  });
  return Object.values(map);
}, [filtered]);

const paperSizeColumns = useMemo(() => {
    const sizes = new Set();
    consolidated.forEach((c) => Object.keys(c.counts).forEach((sz) => sizes.add(sz)));
    return [...sizes].sort();
  }, [consolidated]);

  const paperSizeTotals = useMemo(() => {
    const totals = {};
    filtered.forEach((r) => {
      const size = (r.paperSize || "").trim();
      if (!size) return;
      const key = size.toUpperCase();
      totals[key] = (totals[key] || 0) + (Number(r.totalPages) || 0);
    });
    return Object.entries(totals)
      .map(([paperSize, totalCount]) => ({ paperSize, totalCount }))
      .sort((a, b) => a.paperSize.localeCompare(b.paperSize));
  }, [filtered]);

  const conTotals = useMemo(() => ({
    counts: paperSizeColumns.reduce((acc, sz) => {
      acc[sz] = consolidated.reduce((s, c) => s + (c.counts[sz] || 0), 0);
      return acc;
    }, {}),
    printingMins: consolidated.reduce((s, c) => s + c.printingMins, 0),
    idleMins: consolidated.reduce((s, c) => s + c.idleMins, 0),
    breakdownMins: consolidated.reduce((s, c) => s + c.breakdownMins, 0),
    maintenanceMins: consolidated.reduce((s, c) => s + c.maintenanceMins, 0),
  }), [consolidated, paperSizeColumns]);

  /* DETAIL ROWS — grouped by job so production/idle/breakdown show in one row */
  const detailRows = useMemo(() => {
    const map = {};

    filtered.forEach((r) => {
      const key = [
        rawDate(r.productionDate),
        r.woNumber || "",
        r.shift || "",
        getId(r.activityId),
        getId(r.machineId),
        getMachineName(r),
        r.printerName || "",
        r.customerName || "",
        r.materialType || "",
        r.paperSize || "",
        r.enteredBy || r.operator || "",
      ].join("||");

      if (!map[key]) {
        map[key] = {
          ...r,
          activityName: getActivityName(r),
          machineName: getMachineName(r),
          totalPages: 0,
          wastageSheets: 0,
          print: { from: [], to: [], mins: 0 },
          idle: { from: [], to: [], mins: 0 },
          brk: { from: [], to: [], mins: 0 },
          maint: { from: [], to: [], mins: 0 },
          reasons: [],
          remarksList: [],
        };
      }

      const row = map[key];
      const dur = elapsed(r.fromTime, r.toTime);
      const st = r.machineStatus?.toLowerCase();
      const pages = Number(r.totalPages) || 0;
      const waste = Number(r.wastageSheets) || 0;

      if (pages > 0) row.totalPages += pages;
      if (waste > 0) row.wastageSheets += waste;
      if (r.reason) row.reasons.push(r.reason);
      if (r.remarks) row.remarksList.push(r.remarks);

      if (st === "production" || st === "working") addTime(row.print, r, dur);
     else if (
  st === "idle" ||
  st === "idle time"
) addTime(row.idle, r, dur);
      else if (st?.includes("break")) addTime(row.brk, r, dur);
      else if (st?.includes("maint")) addTime(row.maint, r, dur);
    });

    return Object.values(map).map((r) => ({
      ...r,
      printFrom: joinValues(r.print.from),
      printTo: joinValues(r.print.to),
      printTotal: fromMins(r.print.mins),
      idleFrom: joinValues(r.idle.from),
      idleTo: joinValues(r.idle.to),
      idleTotal: fromMins(r.idle.mins),
      brkFrom: joinValues(r.brk.from),
      brkTo: joinValues(r.brk.to),
      brkTotal: fromMins(r.brk.mins),
      maintFrom: joinValues(r.maint.from),
      maintTo: joinValues(r.maint.to),
      maintTotal: fromMins(r.maint.mins),
      reason: joinValues(r.reasons),
      remarks: joinValues(r.remarksList),
      dur: fromMins(r.print.mins + r.idle.mins + r.brk.mins + r.maint.mins),
      printMins: r.print.mins,
      idleMins: r.idle.mins,
      brkMins: r.brk.mins,
      maintMins: r.maint.mins,
    }));
  }, [filtered]);

  const detTotals = useMemo(() => ({
    pages: detailRows.reduce((s, r) => s + (Number(r.totalPages) || 0), 0),
    waste: detailRows.reduce((s, r) => s + (Number(r.wastageSheets) || 0), 0),
    printMins: detailRows.reduce((s, r) => s + (r.printMins || 0), 0),
    idleMins:  detailRows.reduce((s, r) => s + (r.idleMins || 0), 0),
    brkMins:   detailRows.reduce((s, r) => s + (r.brkMins || 0), 0),
    maintMins: detailRows.reduce((s, r) => s + (r.maintMins || 0), 0),
    allMins:   detailRows.reduce((s, r) => s + toMins(r.dur), 0),
  }), [detailRows]);

  const machineOptions = useMemo(() =>
    [...new Set(records.map((r) => r.machineId?.machineName || r.machineName).filter(Boolean))],
  [records]);
  const customerOptions = useMemo(() =>
  [...new Set(records.map((r) => r.customerName).filter(Boolean))].sort(),
[records]);
const locationOptions = useMemo(() =>
  [...new Set(records.flatMap((r) => r.userLocations || []).filter(Boolean))],
[records]);
  const dateRange = useMemo(() => {
    if (!filtered.length) return { from: "—", to: "—" };
    const dates = filtered.map((r) => new Date(r.productionDate)).filter((d) => !isNaN(d));
    if (!dates.length) return { from: "—", to: "—" };
    return { from: fmtDate(new Date(Math.min(...dates))), to: fmtDate(new Date(Math.max(...dates))) };
  }, [filtered]);

const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Consolidated ──
    const conGroupRow = [
      "", "", "",
      ...paperSizeColumns.map((_, i) => i === 0 ? "PRODUCTION COUNT" : ""),
      "PRINTING TIME", "IDLE TIME", "BREAKDOWN TIME", "MAINTENANCE TIME", "TOTAL TIMINGS",
    ];
    const conSubRow = [
      "#", "Machine Name", "Printer Name",
      ...paperSizeColumns,
      "Printing Time", "Idle Time", "Breakdown Time", "Maintenance Time", "Total Time",
    ];
    const conDataRows = consolidated.map((c, i) => [
      i + 1,
      c.machineName,
      c.printerName || "",
      ...paperSizeColumns.map((sz) => c.counts[sz] || 0),
      fromMins(c.printingMins),
      fromMins(c.idleMins),
      fromMins(c.breakdownMins),
      fromMins(c.maintenanceMins),
      fromMins(c.printingMins + c.idleMins + c.breakdownMins + c.maintenanceMins),
    ]);
    const conTotalRow = [
      "TOTAL", "", "",
      ...paperSizeColumns.map((sz) => conTotals.counts[sz] || 0),
      fromMins(conTotals.printingMins),
      fromMins(conTotals.idleMins),
      fromMins(conTotals.breakdownMins),
      fromMins(conTotals.maintenanceMins),
      fromMins(conTotals.printingMins + conTotals.idleMins + conTotals.breakdownMins + conTotals.maintenanceMins),
    ];
    const conSheet = XLSX.utils.aoa_to_sheet([conGroupRow, conSubRow, ...conDataRows, conTotalRow]);
    if (paperSizeColumns.length > 1) {
      conSheet["!merges"] = [{
        s: { r: 0, c: 3 },
        e: { r: 0, c: 3 + paperSizeColumns.length - 1 },
      }];
    }
    conSheet["!cols"] = [
      { wch: 4 }, { wch: 22 }, { wch: 20 },
      ...paperSizeColumns.map(() => ({ wch: 12 })),
      { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, conSheet, "Consolidated");

    // ── Sheet 2: Detail ──
    const detGroupRow = [
      "", "", "", "", "", "", "", "", "", "", "",
      "PRINTING TIME", "", "",
      "IDLE TIME", "", "",
      "BREAKDOWN TIME", "", "",
      "MAINTENANCE TIME", "", "",
      "", "", "", "",
    ];
    const detSubRow = [
      "#", "Date", "WO No.", "Shift", "Machine", "Printer", "Customer",
      "Item", "Page Size", "Total Pages", "Wastage",
      "From", "To", "Total",
      "From", "To", "Total",
      "From", "To", "Total",
      "From", "To", "Total",
      "Reason", "Remarks", "GT", "Operator"
    ];
    const detDataRows = detailRows.map((r, i) => [
      i + 1,
      fmtDate(r.productionDate),
      r.woNumber || "",
      r.shift || "",
      r.machineName || "",
      r.printerName || "",
      r.customerName || "",
      r.materialType || "",
      r.paperSize || "",
      Number(r.totalPages) || 0,
      Number(r.wastageSheets) || 0,
      r.printFrom || "",
      r.printTo || "",
      r.printMins ? r.printTotal : "",
      r.idleFrom || "",
      r.idleTo || "",
      r.idleMins ? r.idleTotal : "",
      r.brkFrom || "",
      r.brkTo || "",
      r.brkMins ? r.brkTotal : "",
      r.maintFrom || "",
      r.maintTo || "",
      r.maintMins ? r.maintTotal : "",
      r.reason || "",
      r.remarks || "",
      r.dur,
      r.enteredBy || r.operator || "",
    ]);
    const detTotalRow = [
      "TOTAL", "", "", "", "", "", "", "", "",
      detTotals.pages,
      detTotals.waste,
      "", "", fromMins(detTotals.printMins),
      "", "", fromMins(detTotals.idleMins),
      "", "", fromMins(detTotals.brkMins),
      "", "", fromMins(detTotals.maintMins),
      "", "",
      fromMins(detTotals.allMins), "",
    ];
    const detSheet = XLSX.utils.aoa_to_sheet([detGroupRow, detSubRow, ...detDataRows, detTotalRow]);
    // Merge group headers
    detSheet["!merges"] = [
      { s: { r: 0, c: 11 }, e: { r: 0, c: 13 } }, // PRINTING TIME
      { s: { r: 0, c: 14 }, e: { r: 0, c: 16 } }, // IDLE TIME
      { s: { r: 0, c: 17 }, e: { r: 0, c: 19 } }, // BREAKDOWN TIME
      { s: { r: 0, c: 20 }, e: { r: 0, c: 22 } }, // MAINTENANCE TIME
    ];
    detSheet["!cols"] = [
      { wch: 4 },  { wch: 12 }, { wch: 8 },  { wch: 20 }, { wch: 18 },
      { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 11 },
      { wch: 9 },  { wch: 8 },  { wch: 8 },  { wch: 10 },
      { wch: 8 },  { wch: 8 },  { wch: 10 },
      { wch: 8 },  { wch: 8 },  { wch: 10 },
      { wch: 8 },  { wch: 8 },  { wch: 10 },
      { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, detSheet, "Detail");

    // ── Sheet 3: Paper Size Summary ──
    const psRows = [
      ["Page Size", "Total Count"],
      ...paperSizeTotals.map((r) => [r.paperSize, r.totalCount]),
    ];
    const psSheet = XLSX.utils.aoa_to_sheet(psRows);
    psSheet["!cols"] = [{ wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, psSheet, "Paper Size");

    XLSX.writeFile(wb, `Perso_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((p) => ({ ...p, [name]: value }));
  };
const clearFilters = () => setFilters({ dateFrom: "", dateTo: "", month: "", shift: "", machine: "", machineStatus: "", woNumber: "", location: "", customer: "" });

  return (
    <div className="rpt-root">
      <style>{CSS}</style>
      <div className="rpt-body">

        {/* FILTERS */}
        <div className="rpt-filter-card">
          <div className="rpt-filter-title">Filters & Export</div>
          <div className="rpt-filter-grid">
            <div className="rpt-filter-field">
              <label className="rpt-filter-label">From Date</label>
              <input className="rpt-filter-input" type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} />
            </div>
            <div className="rpt-filter-field">
              <label className="rpt-filter-label">To Date</label>
              <input className="rpt-filter-input" type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} />
            </div>
            <div className="rpt-filter-field">
              <label className="rpt-filter-label">Month</label>
              <input className="rpt-filter-input" type="month" name="month" value={filters.month} onChange={handleFilterChange} />
            </div>
            <div className="rpt-filter-field">
              <label className="rpt-filter-label">WO Number</label>
              <input className="rpt-filter-input" type="text" name="woNumber" placeholder="Search WO" value={filters.woNumber} onChange={handleFilterChange} />
            </div>
            <div className="rpt-filter-field">
  <label className="rpt-filter-label">Customer</label>
  <select className="rpt-filter-select" name="customer" value={filters.customer} onChange={handleFilterChange}>
    <option value="">All Customers</option>
    {customerOptions.map((c, i) => <option key={i} value={c}>{c}</option>)}
  </select>
</div>
            <div className="rpt-filter-field">
              <label className="rpt-filter-label">Shift</label>
              <select className="rpt-filter-select" name="shift" value={filters.shift} onChange={handleFilterChange}>
                <option value="">All Shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <div className="rpt-filter-field">
              <label className="rpt-filter-label">Machine</label>
              <select className="rpt-filter-select" name="machine" value={filters.machine} onChange={handleFilterChange}>
                <option value="">All Machines</option>
                {machineOptions.map((m, i) => <option key={i} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="rpt-filter-field">
              <label className="rpt-filter-label">Status</label>
              <select className="rpt-filter-select" name="machineStatus" value={filters.machineStatus} onChange={handleFilterChange}>
                <option value="">All Status</option>
                {machineStatuses.map((s) => <option key={s._id} value={s.statusName}>{s.statusName}</option>)}
              </select>
            </div>
            <div className="rpt-filter-field">
  <label className="rpt-filter-label">Location</label>
  <select
    className="rpt-filter-select"
    name="location"
    value={filters.location}
    onChange={handleFilterChange}
  >
    <option value="">All Locations</option>
    {locationOptions.map((loc, i) => (
      <option key={i} value={loc}>
        {loc}
      </option>
    ))}
  </select>
</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <button className="rpt-btn rpt-btn-clear" onClick={clearFilters}>Clear</button>
              <button className="rpt-btn rpt-btn-export" onClick={exportExcel}>Export Excel</button>
              {/* <button className="rpt-btn rpt-btn-print" onClick={() => window.print()}>Print</button> */}
            </div>
          </div>
        </div>

        {/* META BAR */}
        <div className="rpt-meta-bar">
          <div className="rpt-meta-item">From Date: <span>{dateRange.from}</span></div>
          <div className="rpt-meta-item">To Date: <span>{dateRange.to}</span></div>
          <div className="rpt-meta-item">Total Records: <span>{filtered.length}</span></div>
          <div className="rpt-meta-item">Machines: <span>{consolidated.length}</span></div>
        </div>

        {/* ── CONSOLIDATED TABLE ── */}
        <div className="rpt-section-label">CONSOLIDATED</div>
        <div className="rpt-table-wrap">
          {loading ? <div className="rpt-empty">Loading…</div>
          : consolidated.length === 0 ? <div className="rpt-empty">No data for selected filters</div>
          : (
            <table className="rpt-table">
              <thead>
          <tr>
                  <th rowSpan={2}>#</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>MACHINE NAME</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>PRINTER NAME</th>
                  <th colSpan={paperSizeColumns.length} className="rpt-thead-group">PRODUCTION COUNT</th>
                  <th rowSpan={2}>PRINTING TIME</th>
                  <th rowSpan={2}>IDLE TIME</th>
                  <th rowSpan={2}>BREAKDOWN TIME</th>
                  <th rowSpan={2}>MAINTENANCE TIME</th>
                  <th rowSpan={2}>TOTAL TIMINGS</th>
                </tr>
                <tr>
                  {paperSizeColumns.map((sz) => (
                    <th key={sz} className="rpt-thead-group">{sz}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consolidated.slice(0,30).map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="left rpt-con-machine">{c.machineName}</td>
                    <td className="left rpt-con-machine">{c.printerName || <span className="rpt-muted">—</span>}</td>
                  {paperSizeColumns.map((sz) => (
                      <td key={sz} className="rpt-con-num">{(c.counts[sz] || 0).toLocaleString()}</td>
                    ))}
                    <td className="rpt-con-time">{fromMins(c.printingMins)}</td>
                    <td className="rpt-con-time">{fromMins(c.idleMins)}</td>
                    <td className="rpt-con-time">{fromMins(c.breakdownMins)}</td>
                    <td className="rpt-con-time">{fromMins(c.maintenanceMins)}</td>
                    <td className="rpt-con-total">{fromMins(c.printingMins + c.idleMins + c.breakdownMins + c.maintenanceMins)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right" }}>TOTAL</td>
                {paperSizeColumns.map((sz) => (
                    <td key={sz}>{(conTotals.counts[sz] || 0).toLocaleString()}</td>
                  ))}
                  <td>{fromMins(conTotals.printingMins)}</td>
                  <td>{fromMins(conTotals.idleMins)}</td>
                  <td>{fromMins(conTotals.breakdownMins)}</td>
                  <td>{fromMins(conTotals.maintenanceMins)}</td>
                  <td>{fromMins(conTotals.printingMins + conTotals.idleMins + conTotals.breakdownMins + conTotals.maintenanceMins)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── PAPER SIZE SUMMARY ── */}
        <div className="rpt-section-label" style={{ marginTop: 8 }}>PAPER SIZE SUMMARY</div>
        <div className="rpt-table-wrap">
          {loading ? <div className="rpt-empty">Loading…</div>
          : paperSizeTotals.length === 0 ? <div className="rpt-empty">No paper size data for selected filters</div>
          : (
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>Page Size</th>
                  <th>Total Count</th>
                </tr>
              </thead>
              <tbody>
                {paperSizeTotals.slice(0, 30).map((r) => (
                  <tr key={r.paperSize}>
                    <td>{r.paperSize}</td>
                    <td className="mono">{r.totalCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── DETAIL TABLE (single flat table, all records) ── */}
        <div className="rpt-section-label" style={{ marginTop: 8 }}>DETAIL</div>
        <div className="rpt-table-wrap">
          {loading ? <div className="rpt-empty">Loading…</div>
          : detailRows.length === 0 ? <div className="rpt-empty">No records for selected filters</div>
          : (
            <table className="rpt-table">
              <thead>
                <tr>
                  <th rowSpan={2}>#</th>
                  <th rowSpan={2}>Date</th>
                   <th rowSpan={2}>WO No.</th>
                  <th rowSpan={2}>Shift</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Machine</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Printer</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Customer</th>
                 
                  <th rowSpan={2} style={{ textAlign: "left" }}>Item</th>
                  <th rowSpan={2}>Page Size</th>
                  <th rowSpan={2}>Total Pages</th>
                  <th rowSpan={2}>Wastage</th>
                  <th colSpan={3} className="rpt-thead-group">PRINTING TIME</th>
                  <th colSpan={3} className="rpt-thead-group">IDLE TIME</th>
                  <th colSpan={3} className="rpt-thead-group">BREAKDOWN TIME</th>
                  <th colSpan={3} className="rpt-thead-group">MAINTENANCE TIME</th>
                  <th rowSpan={2}>Reason</th>
                  <th rowSpan={2}>Remarks</th>
                  <th rowSpan={2}>Grand Total</th>
                </tr>
                <tr>
                  <th className="rpt-thead-group">FROM</th>
                  <th className="rpt-thead-group">TO</th>
                  <th className="rpt-thead-group">TOTAL</th>
                  <th className="rpt-thead-group">FROM</th>
                  <th className="rpt-thead-group">TO</th>
                  <th className="rpt-thead-group">TOTAL</th>
                  <th className="rpt-thead-group">FROM</th>
                  <th className="rpt-thead-group">TO</th>
                  <th className="rpt-thead-group">TOTAL</th>
                  <th className="rpt-thead-group">FROM</th>
                  <th className="rpt-thead-group">TO</th>
                  <th className="rpt-thead-group">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="mono">{fmtDate(r.productionDate)}</td>
                    <td className="mono">{r.woNumber || <span className="rpt-muted">—</span>}</td>
                    <td>{r.shift || "—"}</td>
                    <td className="left">{r.machineName || <span className="rpt-muted">—</span>}</td>
                    <td className="left">{r.printerName || <span className="rpt-muted">—</span>}</td>
                    <td className="left">{r.customerName || <span className="rpt-muted">—</span>}</td>
                    
                    <td className="left">{r.materialType || <span className="rpt-muted">—</span>}</td>
                    <td>{r.paperSize || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.totalPages || 0}</td>
                    <td className="mono">{r.wastageSheets || 0}</td>
                    {/* PRINTING TIME */}
                    <td className="mono">{r.printFrom || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.printTo || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.printMins ? r.printTotal : <span className="rpt-muted">—</span>}</td>
                    {/* IDLE TIME */}
                    <td className="mono">{r.idleFrom || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.idleTo || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.idleMins ? r.idleTotal : <span className="rpt-muted">—</span>}</td>
                    {/* BREAKDOWN TIME */}
                    <td className="mono">{r.brkFrom || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.brkTo || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.brkMins ? r.brkTotal : <span className="rpt-muted">—</span>}</td>
                    {/* MAINTENANCE TIME */}
                    <td className="mono">{r.maintFrom || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.maintTo || <span className="rpt-muted">—</span>}</td>
                    <td className="mono">{r.maintMins ? r.maintTotal : <span className="rpt-muted">—</span>}</td>
                    <td className="left" style={{ maxWidth: 160, whiteSpace: "normal", fontSize: 11 }}>
                      {r.reason|| <span className="rpt-muted">—</span>}
                    </td>
                    <td className="left" style={{ maxWidth: 160, whiteSpace: "normal", fontSize: 11 }}>
                      {r.remarks || <span className="rpt-muted">—</span>}
                    </td>
                    <td className="mono">{r.dur}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} style={{ textAlign: "right" }}>TOTAL</td>
                  <td>{detTotals.pages.toLocaleString()}</td>
                  <td>{detTotals.waste.toLocaleString()}</td>
                  <td>—</td><td>—</td><td>{fromMins(detTotals.printMins)}</td>
                  <td>—</td><td>—</td><td>{fromMins(detTotals.idleMins)}</td>
                  <td>—</td><td>—</td><td>{fromMins(detTotals.brkMins)}</td>
                  <td>—</td><td>—</td><td>{fromMins(detTotals.maintMins)}</td>
                  <td>—</td>
                  <td>—</td>
                  <td>{fromMins(detTotals.allMins)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}