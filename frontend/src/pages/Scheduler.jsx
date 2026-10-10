import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/inter";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { jwtDecode } from "jwt-decode";
import "@fontsource/jetbrains-mono";
import "@fontsource/jetbrains-mono/600.css";
import axios from "axios";
import { gantt } from "dhtmlx-gantt";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";
import Swal from "sweetalert2";
import "../styles/schduler.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import BASE_URL from "../config/api";

/* ─────────────────────────────────────────────────────────
   SCOPED STYLES
───────────────────────────────────────────────────────── */
const STYLES = `
  .sch-root {
    --navy:   #0284c7;
    --navy2:  #0284c7;
    --blue:   #3b6fa8;
    --blue-l: #4b83b8;
    --teal:   #0284c7;
    --amber:  #d97706;
    --red:    #dc2626;
    --green:  #16a34a;
    --bg:     #e3f3fa;
    --surface:#ffffff;
    --border: #cfe6f0;
    --text:   #0f172a;
    --muted:  #5f7487;
    font-family: 'Inter', sans-serif;
    background: radial-gradient(circle at 10% 20%, #d8f1fb 0%, #edf9fe 90.2%);
    min-height: 100vh;
    padding: 0;
    color: var(--text);
  }

  /* ── TOP BAR ── */
  .sch-topbar {
    background: linear-gradient(135deg, var(--navy) 0%, var(--navy2) 100%);
    padding: 18px 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    gap: 14px;
    box-shadow: 0 4px 20px rgba(15,31,61,.35);
  }
  .sch-topbar > div:nth-child(2) { text-align: center; }
  .sch-topbar-icon {
    width: 44px; height: 44px;
    background: rgba(255,255,255,.12);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
  }
  .sch-topbar h1 {
    font-size: 22px; font-weight: 700; color: #fff; margin: 0;
    letter-spacing: -.3px;
  }
  .sch-topbar p {
    margin: 0; font-size: 13px; color: rgba(255,255,255,.55);
  }
  .sch-topbar-badge {
    position: absolute;
    right: 32px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255,255,255,.1);
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 12px;
    color: rgba(255,255,255,.8);
    display: flex; align-items: center; gap: 6px;
  }
  .sch-topbar-badge span {
    width: 8px; height: 8px; border-radius: 50%;
    background: #4ade80;
    display: inline-block;
    box-shadow: 0 0 6px #4ade80;
    animation: blink 1.8s infinite;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

  /* ── PAGE BODY ── */
  .sch-body {
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── CARD ── */
  .sch-card {
    background: rgba(255,255,255,0.6); backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%);
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: 0 2px 12px rgba(0,0,0,.05);
    overflow: hidden;
  }
  .sch-card-head {
    padding: 13px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 1px solid var(--border);
  }
  .sch-card-head.navy  { background: var(--navy);  color: #fff; }
  .sch-card-head.blue  { background: var(--blue);  color: #fff; }
  .sch-card-head.teal  { background: var(--teal);  color: #fff; }
  .sch-card-head.dark  { background: #0284c7;       color: #fff; }
  .sch-card-head .head-count {
    margin-left: auto;
    background: rgba(255,255,255,.18);
    border-radius: 20px;
    padding: 2px 12px;
    font-size: 12px;
    font-weight: 500;
  }
  .sch-card-body { padding: 16px 20px; }

  /* ── WO TABLE ── */
  .wo-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .wo-table thead tr { background: #0284c7; }
  .wo-table th { color: #fff !important;
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .6px;
    color: var(--blue);
    border-bottom: 2px solid var(--border);
    white-space: nowrap;
  }
  .wo-table td {
    padding: 11px 14px;
    border-bottom: 1px solid #e3f3fa;
    color: var(--text);
    vertical-align: middle;
  }
  .wo-table tbody tr:hover { background: #d9f2fc; }
  .wo-table tbody tr:last-child td { border-bottom: none; }
  .wo-num {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    font-size: 13px;
    color: var(--blue);
  }
  .badge-pri {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 600;
  }
  .badge-pri.high   { background: #fee2e2; color: #dc2626; }
  .badge-pri.medium { background: #fef3c7; color: #d97706; }
  .badge-pri.low    { background: #dcfce7; color: #16a34a; }
  .badge-pri::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .btn-sched {
    background: var(--blue);
    color: #fff;
    border: none;
    padding: 6px 16px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: background .15s, transform .1s;
  }
  .btn-sched:hover { background: var(--blue-l); transform: translateY(-1px); }
  .btn-sched:active { transform: translateY(0); }
  .empty-row td {
    text-align: center;
    padding: 35px;
    color: var(--muted);
    font-size: 14px;
  }

  /* ── SCHEDULE FORM ── */
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }
  .form-field label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .6px;
    color: var(--muted);
    margin-bottom: 5px;
  }
  .form-field input,
  .form-field select,
  .form-field textarea {
    width: 100%;
    padding: 8px 11px;
    border: 1.5px solid var(--border);
    border-radius: 9px;
    font-size: 13.5px;
    font-family: 'Inter', sans-serif;
    color: var(--text);
    background: #eef9fe;
    transition: border .15s, background .15s;
    box-sizing: border-box;
  }
  .form-field input:focus,
  .form-field select:focus,
  .form-field textarea:focus {
    outline: none;
    border-color: var(--blue);
    background: #fff;
  }
  .form-field input:disabled {
    background: #e3f3fa;
    color: var(--muted);
    cursor: default;
  }
  .form-actions { display: flex; gap: 10px; }
  .btn-save {
    background: var(--green);
    color: #fff; border: none;
    padding: 9px 22px; border-radius: 9px;
    font-size: 13.5px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; gap: 7px;
    transition: background .15s;
  }
  .btn-save:hover { background: #15803d; }
  .btn-cancel-form {
    background: #e3f3fa;
    color: var(--muted); border: 1.5px solid var(--border);
    padding: 9px 20px; border-radius: 9px;
    font-size: 13.5px; font-weight: 600;
    cursor: pointer; transition: background .15s;
  }
  .btn-cancel-form:hover { background: #cfe6f0; }

  /* ── FILTER ROW ── */
  .filter-row {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  .filter-label {
    font-size: 12px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .5px;
    color: var(--muted);
  }
  .filter-input {
    border: 1.5px solid var(--border);
    border-radius: 9px;
    padding: 7px 12px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    background: #fff;
    color: var(--text);
    cursor: pointer;
  }
  .filter-input:focus { outline: none; border-color: var(--blue); }
  .btn-clear-filter {
    background: #fff;
    border: 1.5px solid var(--border);
    border-radius: 9px;
    padding: 7px 14px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
    display: flex; align-items: center; gap: 5px;
    transition: background .15s;
  }
  .btn-clear-filter:hover { background: #e3f3fa; }

  /* ── USER FRIENDLY GANTT BAR GRAPH OVERRIDES ── */
  .gantt_container {
    border: none !important;
    font-family: 'Inter', sans-serif !important;
  }
  .gantt_grid_scale,
  .gantt_task_scale {
    background: linear-gradient(180deg, #0284c7 0%, #0284c7 100%) !important;
    border-bottom: 2px solid #334155 !important;
  }
  .gantt_grid_head_cell {
    font-size: 11.5px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: .5px !important;
    color: #cfe6f0 !important;
    border-right: 1px solid rgba(255,255,255,0.08) !important;
  }
  .gantt_scale_cell {
    font-size: 11.5px !important;
    font-weight: 600 !important;
    color: #b9d4e3 !important;
    border-right: 1px solid rgba(255,255,255,0.08) !important;
  }
  .gantt_scale_line:nth-child(1) .gantt_scale_cell {
    font-weight: 700 !important;
    color: #eef9fe !important;
    background: rgba(255,255,255,0.03) !important;
    border-bottom: 1px solid rgba(255,255,255,0.08) !important;
  }
  .gantt_grid_data .gantt_row {
    border-bottom: 1px solid #e3f3fa !important;
    transition: background 0.12s ease;
  }
  .gantt_grid_data .gantt_row:hover { background: #d9f2fc !important; }
  .gantt_grid_data .gantt_row.gantt_selected { background: #e0f2fe !important; }
  .gantt_cell {
    border-right: 1px solid #e3f3fa !important;
    font-size: 12.5px !important;
    color: #0f172a !important;
  }
  .machine-grid-row {
    background: #eef9fe !important;
    font-weight: 700 !important;
    border-top: 1px solid #cfe6f0 !important;
    border-bottom: 1px solid #cfe6f0 !important;
  }
  .machine-task-row {
    background: #eef9fe !important;
    border-top: 1px solid #cfe6f0 !important;
    border-bottom: 1px solid #cfe6f0 !important;
  }
  .gantt_task_row { border-bottom: 1px solid #e3f3fa !important; }
  .gantt_task_row:hover { background: #d9f2fc !important; }

  /* Friendly Bar Graph Task styling */
  .gantt_task_line {
    border-radius: 8px !important;
    border: none !important;
    box-shadow: 0 3px 8px rgba(15, 23, 42, 0.16), 0 1px 3px rgba(15, 23, 42, 0.1) !important;
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
  }
  .gantt_task_line:hover {
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25) !important;
    filter: brightness(1.06);
    transform: translateY(-1px);
  }
  .gantt_task_line.normal-task {
    border-radius: 8px !important;
    border: none !important;
  }
  .gantt_task_line.block-task {
    background: repeating-linear-gradient(
      -45deg,
      #dc2626,
      #dc2626 10px,
      #b91c1c 10px,
      #b91c1c 20px
    ) !important;
    border-radius: 8px !important;
    border: none !important;
    opacity: 0.95;
  }
  .gantt_task_line .gantt_task_content {
    font-size: 11.5px !important;
    font-family: 'Inter', sans-serif !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    padding: 0 10px !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.35);
    letter-spacing: 0.2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gantt_task_drag {
    background: rgba(255, 255, 255, 0.3) !important;
    border-radius: 4px;
  }
  .gantt_layout_cell_resizer,
  .gantt_resizer {
    background: #b9d4e3 !important;
    width: 4px !important;
    cursor: col-resize !important;
    transition: background 0.2s;
  }
  .gantt_layout_cell_resizer:hover,
  .gantt_resizer:hover { background: #3b6fa8 !important; }

  .gantt_layout_cell::-webkit-scrollbar,
  .gantt_data_area::-webkit-scrollbar,
  .gantt_grid_data::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }
  .gantt_layout_cell::-webkit-scrollbar-track,
  .gantt_data_area::-webkit-scrollbar-track,
  .gantt_grid_data::-webkit-scrollbar-track { background: #e3f3fa; }
  .gantt_layout_cell::-webkit-scrollbar-thumb,
  .gantt_data_area::-webkit-scrollbar-thumb,
  .gantt_grid_data::-webkit-scrollbar-thumb {
    background: #b9d4e3;
    border-radius: 4px;
  }
  .gantt_layout_cell::-webkit-scrollbar-thumb:hover,
  .gantt_data_area::-webkit-scrollbar-thumb:hover,
  .gantt_grid_data::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .gantt_tree_icon.gantt_file { display: none !important; }

  .gantt_tooltip {
    border-radius: 12px !important;
    box-shadow: 0 12px 30px -4px rgba(15, 23, 42, 0.25), 0 4px 10px -2px rgba(15, 23, 42, 0.1) !important;
    font-family: 'Inter', sans-serif !important;
    border: 1px solid rgba(226, 232, 240, 0.9) !important;
    background: #ffffff !important;
    padding: 0 !important;
    overflow: hidden;
  }
      /* ══ AQUA GLASS THEME (same as Purchase Order page) ══ */
  .sch-root {
    background:
      radial-gradient(circle at 12% 6%, rgba(255,255,255,.9) 0, rgba(255,255,255,0) 30%),
      radial-gradient(circle at 88% 18%, rgba(160,222,250,.7) 0, rgba(160,222,250,0) 32%),
      linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%);
    background-attachment: fixed;
    color: #0b2f4f;
  }

  /* top bar */
  .sch-topbar {
    background: linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(222,244,254,.8) 100%);
    border-bottom: 1px solid #fff;
    box-shadow: 0 14px 30px rgba(40,120,170,.18), inset 0 1px 0 #fff;
  }
  .sch-topbar-icon {
    background: radial-gradient(circle at 30% 25%, #fff 0%, #bfe5f8 50%, #8fd0f0 100%);
    border: 1px solid #86c6e8;
  }
  .sch-topbar h1 { color: #0a4f8c; }
  .sch-topbar p { color: #4a6f8c; }
  .sch-topbar-badge {
    background: linear-gradient(180deg, #fff 0%, #dff6ff 100%);
    border: 1px solid #a9d9f2;
    color: #0b2f4f;
  }

  /* glass cards */
  .sch-card {
    background: linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(228,246,255,.9) 100%);
    border: 1px solid rgba(255,255,255,.95);
    border-radius: 22px;
    box-shadow: 0 12px 28px rgba(40,120,170,.12), inset 0 1px 0 #fff;
  }
  .sch-card-head.navy,
  .sch-card-head.blue,
  .sch-card-head.teal,
  .sch-card-head.dark {
    background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%);
    color: #08406b;
    border-bottom: 1px solid #86c6e8;
    box-shadow: inset 0 1px 0 #fff;
  }
  .sch-card-head .head-count {
    background: linear-gradient(180deg, #fff, #d6effc);
    color: #0a4f8c;
    border: 1px solid #a9d9f2;
  }

  /* pending table */
  .wo-table thead th {
    background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%);
    border-bottom: 2px solid #7fbfe4;
  }
  .wo-table th { color: #08406b !important; }
  .wo-table td { color: #0b2f4f; font-weight: 600; border-bottom: 1px solid #d3e8f4; }
  .wo-table tbody tr:nth-child(even) td { background: #f3faff; }
  .wo-table tbody tr:hover td { background: #d9f2fc; }
  .wo-num { color: #0a6fb8; }

  /* glossy blue buttons */
  .btn-sched,
  button[title="Auto-schedule every pending row onto the Gantt"]:not(:disabled) {
    background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%) !important;
    color: #08406b !important;
    border: 1px solid #7fc3e8 !important;
    box-shadow: 0 2px 0 #7fbbe0, 0 6px 12px rgba(40,120,170,.14), inset 0 1px 0 #fff;
  }
  .btn-sched:hover { background: linear-gradient(180deg, #e3f5fe 0%, #b0e0f8 100%); }

  /* form fields */
  .form-field label { color: #0b2f4f; }
  .form-field input,
  .form-field select,
  .form-field textarea {
    border: 1.5px solid #9ccbe6;
    border-radius: 12px;
    background: #fff;
    color: #0b2f4f;
    font-weight: 600;
    box-shadow: inset 0 2px 5px rgba(10,80,130,.1);
  }
  .form-field input:focus,
  .form-field select:focus,
  .form-field textarea:focus {
    border-color: #1b9be0;
    box-shadow: 0 0 0 4px rgba(27,155,224,.2);
  }
  .form-field input:disabled { background: #eef7fc; color: #4a6f8c; }

  /* gantt header */
  .gantt_grid_scale,
  .gantt_task_scale {
    background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%) !important;
    border-bottom: 2px solid #86c6e8 !important;
  }
  .gantt_grid_head_cell,
  .gantt_scale_cell {
    color: #08406b !important;
    border-right: 1px solid rgba(8,64,107,.15) !important;
  }
  .gantt_scale_line:nth-child(1) .gantt_scale_cell {
    color: #08406b !important;
    background: rgba(255,255,255,.3) !important;
    border-bottom: 1px solid rgba(8,64,107,.15) !important;
  }
`;

const Scheduler = () => {
  const ganttRef = useRef(null);
  const [userLocations, setUserLocations] = useState([]);
  const [userRole, setUserRole] = useState("");
  const [workOrders, setWorkOrders] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [woSearch, setWoSearch] = useState("");
  const [pendingWoSearch, setPendingWoSearch] = useState("");

  // View Switcher: "timeline" (Gantt) vs "bargraph" (Machine Workload Bar Chart)
  const [chartMode, setChartMode] = useState("timeline");

  // Bar Graph Metric Mode: "hours" | "imp" | "jobs"
  const [barMetric, setBarMetric] = useState("hours");

  // Quick Zoom scale for Timeline
  const [zoomLevel, setZoomLevel] = useState("auto"); // "auto" | "30m" | "1h" | "day"

  // Pagination for pending table so hundreds of rows don't freeze the DOM
  const [pendingPage, setPendingPage] = useState(1);
  const pendingPageSize = 25;

  // Debounced searches for instant 60fps input response
  const [debouncedWoSearch, setDebouncedWoSearch] = useState("");
  const [debouncedPendingWoSearch, setDebouncedPendingWoSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWoSearch(woSearch);
    }, 200);
    return () => clearTimeout(timer);
  }, [woSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPendingWoSearch(pendingWoSearch);
      setPendingPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [pendingWoSearch]);

  const [selectedWO, setSelectedWO] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [priority, setPriority] = useState("");
  const [capacity, setCapacity] = useState("");
  const [calculatedTime, setCalculatedTime] = useState("");
  const [blockMachine, setBlockMachine] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [dedupingSchedules, setDedupingSchedules] = useState(false);

  /* inject / remove scoped CSS */
  useEffect(() => {
    const tag = document.createElement("style");
    tag.innerHTML = STYLES;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      const decoded = jwtDecode(token);
      setUserLocations(decoded.locations || []);
      setUserRole(decoded.role || "");
    }
  }, []);

  // =========================
  // INIT GANTT CONFIG (USER-FRIENDLY BAR GRAPH STYLING)
  // =========================
  useEffect(() => {
    if (!ganttRef.current) return;

    gantt.config.smart_scales = true;
    gantt.config.smart_rendering = true;
    gantt.config.static_background = true;
    gantt.config.show_task_cells = false;
    gantt.config.show_links = false;
    gantt.config.details_on_dblclick = false;

    gantt.config.scales = [
      { unit: "day", step: 1, format: "%d %M" },
      { unit: "minute", step: 30, format: "%G:%i" }
    ];
    gantt.config.scale_height = 60;
    gantt.config.min_column_width = 44;
    gantt.config.duration_unit = "minute";
    gantt.config.time_step = 1;
    gantt.config.round_dnd_dates = false;
    gantt.config.min_duration = 1 * 60 * 1000;

    // Friendly thick bar height for clear reading like a bar graph
    gantt.config.row_height = 42;
    gantt.config.bar_height = 28;

    gantt.config.grid_width = 500;
    gantt.config.grid_resize = true;
    gantt.config.open_tree_initially = true;
    gantt.config.show_progress = false;
    gantt.config.drag_move = true;
    gantt.config.drag_resize = true;
    gantt.config.drag_progress = false;
    gantt.config.readonly = false;

    gantt.plugins({ tooltip: true });

    gantt.config.columns = [
      {
        name: "text",
        label: "Machine / Work Order",
        tree: true,
        width: 185,
        resize: true,
        template: (task) => {
          if (task.isMachine) {
            return `<span style="font-weight:700;color:#0f172a;letter-spacing:-0.2px;">⚙️ ${task.text}</span>`;
          }
          return `<span style="font-weight:600;color:#3b6fa8;font-family:'JetBrains Mono',monospace;">${task.text}</span>`;
        }
      },
      {
        name: "scheduleDate",
        label: "Date",
        align: "center",
        width: 85,
        resize: true,
        template: (task) => {
          if (task.isMachine) return "";
          if (!task.start_date) return "-";
          return `<span style="font-size:11.5px;color:#475569;font-weight:500;">${gantt.date.date_to_str("%d-%m-%Y")(task.start_date)}</span>`;
        }
      },
      {
        name: "fromTime",
        label: "From",
        align: "center",
        width: 78,
        resize: true,
        template: (task) => {
          if (task.isMachine) return "";
          if (!task.start_date) return "-";
          return `<span style="font-size:11.5px;color:#0f172a;font-weight:600;">${gantt.date.date_to_str("%h:%i %A")(task.start_date)}</span>`;
        }
      },
      {
        name: "toTime",
        label: "To",
        align: "center",
        width: 78,
        resize: true,
        template: (task) => {
          if (task.isMachine) return "";
          if (!task.end_date) return "-";
          return `<span style="font-size:11.5px;color:#0f172a;font-weight:600;">${gantt.date.date_to_str("%h:%i %A")(task.end_date)}</span>`;
        }
      },
      {
        name: "duration",
        label: "Duration",
        align: "center",
        width: 74,
        resize: true,
        template: (task) => {
          if (task.isMachine) return "";
          if (!task.start_date || !task.end_date) return "-";
          const totalMinutes = Math.round((new Date(task.end_date) - new Date(task.start_date)) / (1000 * 60));
          const hrs = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const text = hrs === 0 ? `${mins}m` : mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
          return `<span style="display:inline-block;padding:2px 7px;border-radius:12px;background:#e3f3fa;color:#334155;font-size:11px;font-weight:600;">${text}</span>`;
        }
      }
    ];

    gantt.templates.tooltip_text = function (start, end, task) {
      const totalMinutes = Math.round((end - start) / (1000 * 60));
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      let dur = hrs === 0 ? `${mins} mins` : mins === 0 ? `${hrs} hrs` : `${hrs} hrs ${mins} mins`;
      const activityLine = task.activityName
        ? `<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:4px;">
            <span style="color:#5f7487;">Activity:</span>
            <span style="font-weight:600;color:#0f172a;">${task.activityName}</span>
           </div>`
        : "";
      const isBlocked = task.color === "red";
      const badgeBg = isBlocked ? "#fee2e2" : "#e0f2fe";
      const badgeColor = isBlocked ? "#dc2626" : "#3b6fa8";
      const statusText = isBlocked ? "BLOCKED" : "SCHEDULED";

      return `
        <div style="min-width:230px;font-family:'Inter',sans-serif;">
          <div style="padding:10px 14px;background:#eef9fe;border-bottom:1px solid #cfe6f0;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-size:13px;font-weight:700;color:#0f172a;font-family:'JetBrains Mono',monospace;">${task.text}</span>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:${badgeBg};color:${badgeColor};letter-spacing:0.4px;">${statusText}</span>
          </div>
          <div style="padding:12px 14px;font-size:12px;color:#475569;line-height:1.65;">
            ${activityLine}
            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:4px;">
              <span style="color:#5f7487;">Start:</span>
              <span style="font-weight:600;color:#0f172a;">${gantt.date.date_to_str("%d %b %Y, %h:%i %A")(start)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:4px;">
              <span style="color:#5f7487;">End:</span>
              <span style="font-weight:600;color:#0f172a;">${gantt.date.date_to_str("%d %b %Y, %h:%i %A")(end)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;padding-top:6px;border-top:1px dashed #cfe6f0;margin-top:6px;">
              <span style="color:#5f7487;">Duration:</span>
              <span style="font-weight:700;color:#3b6fa8;">${dur}</span>
            </div>
          </div>
        </div>`;
    };

    gantt.templates.task_class = (start, end, task) => {
      if (task.isMachine) return "machine-row";
      if (task.color === "red") return "block-task";
      return "normal-task";
    };

    gantt.templates.grid_row_class = (start, end, task) => {
      if (task.isMachine) return "machine-grid-row";
      return "";
    };

    gantt.templates.task_row_class = (start, end, task) => {
      if (task.isMachine) return "machine-task-row";
      return "";
    };

    gantt.templates.task_text = function (start, end, task) {
      if (task.isMachine) return "";
      return task.text;
    };

    gantt.detachAllEvents();
    gantt.init(ganttRef.current);

    gantt.attachEvent("onTaskDrag", (id, mode, task) => {
      if (task.end_date <= task.start_date) {
        task.end_date = new Date(task.start_date.getTime() + 60 * 60 * 1000);
      }
      return true;
    });

    gantt.attachEvent("onBeforeTaskDrag", (id) => {
      const task = gantt.getTask(id);
      if (task.isMachine) return false;
      return true;
    });

    gantt.attachEvent("onAfterTaskDrag", (id, mode) => {
      const task = gantt.getTask(id);
      if (task.isMachine) return;

      const newStart = new Date(task.start_date);
      let newEnd = new Date(task.end_date);

      if (!newEnd || isNaN(newEnd.getTime())) {
        newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
      }
      if (newEnd <= newStart) {
        newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
        task.end_date = newEnd;
        gantt.updateTask(id);
      }

      let hasConflict = false;
      gantt.eachTask((t) => {
        if (String(t.id) === String(id) || t.isMachine) return;
        if (String(t.parent) !== String(task.parent)) return;

        const tStart = new Date(t.start_date);
        const tEnd = new Date(t.end_date);

        if (
          t.color === "red" &&
          newStart < tEnd &&
          newEnd > tStart
        ) {
          hasConflict = true;
          return;
        }

        if (
          newStart < tEnd &&
          newEnd > tStart
        ) {
          hasConflict = true;
        }
      });

      if (hasConflict) {
        Swal.fire({ icon: "error", title: "Slot Occupied", text: "This time slot overlaps with another scheduled work order.", confirmButtonColor: "#dc2626" });
        loadAllData();
        return;
      }

      Swal.fire({
        title: "Update Schedule?",
        html: `<div style="font-size:14px;line-height:1.8">
          <b>New Start:</b> ${gantt.date.date_to_str("%d %M %Y %h:%i %A")(newStart)}<br/>
          <b>New End:</b> ${gantt.date.date_to_str("%d %M %Y %h:%i %A")(newEnd)}
        </div>`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#3b6fa8",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, Update"
      }).then((result) => {
        if (result.isConfirmed) updateScheduleTime(id, newStart, newEnd);
        else loadAllData();
      });
    });

    // Single click does not delete
    gantt.attachEvent("onTaskClick", () => true);

    // Double-click deletes
    gantt.attachEvent("onTaskDblClick", (id) => {
      const task = gantt.getTask(id);
      if (task.isMachine) return false;

      Swal.fire({
        title: "Delete Schedule?",
        text: "This action cannot be undone",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, Delete"
      }).then((result) => {
        if (result.isConfirmed) deleteSchedule(id);
      });
      return false;
    });

    loadAllData();
    return () => { gantt.clearAll(); };
  }, []);

  // Re-render gantt when switching back to timeline mode
  useEffect(() => {
    if (chartMode === "timeline" && ganttRef.current) {
      setTimeout(() => {
        try { gantt.render(); } catch (_) {}
      }, 50);
    }
  }, [chartMode]);

  // =========================
  // SINGLE BATCHED RENDER FOR TIMELINE
  // =========================
  useEffect(() => {
    if (!ganttRef.current) return;

    const filteredData = filterSchedulesByDate(schedules, debouncedWoSearch);

    let start;
    let end;
    const hasOtherFilters = !!(customerFilter || machineFilter || debouncedWoSearch.trim());

    if (fromDate && toDate) {
      start = new Date(`${fromDate}T00:00:00`);
      end = new Date(`${toDate}T23:59:59.999`);
    } else if (fromDate) {
      start = new Date(`${fromDate}T00:00:00`);
      end = new Date(`${fromDate}T23:59:59.999`);
    } else if (hasOtherFilters) {
      let minTime = Infinity;
      let maxTime = -Infinity;

      for (let i = 0; i < filteredData.length; i++) {
        const s = filteredData[i];
        if (s._startTimeMs) {
          if (s._startTimeMs < minTime) minTime = s._startTimeMs;
          if (s._endTimeMs > maxTime) maxTime = s._endTimeMs;
        }
      }

      if (minTime !== Infinity && maxTime !== -Infinity) {
        start = new Date(minTime);
        start.setHours(0, 0, 0, 0);
        end = new Date(maxTime);
        end.setHours(23, 59, 59, 999);
      } else {
        const today = new Date();
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
      }
    } else {
      const today = new Date();
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
    }

    if (!start || isNaN(start.getTime())) {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    }
    if (!end || isNaN(end.getTime()) || end <= start) {
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    }

    // Set scale based on zoomLevel or adaptive days span
    const daysSpan = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (zoomLevel === "30m" || (zoomLevel === "auto" && daysSpan <= 2)) {
      gantt.config.scales = [
        { unit: "day", step: 1, format: "%d %M" },
        { unit: "minute", step: 30, format: "%G:%i" }
      ];
      gantt.config.min_column_width = 44;
    } else if (zoomLevel === "1h" || (zoomLevel === "auto" && daysSpan <= 7)) {
      gantt.config.scales = [
        { unit: "day", step: 1, format: "%d %M" },
        { unit: "hour", step: 1, format: "%H:00" }
      ];
      gantt.config.min_column_width = 42;
    } else if (zoomLevel === "day" || (zoomLevel === "auto" && daysSpan <= 31)) {
      gantt.config.scales = [
        { unit: "month", step: 1, format: "%F %Y" },
        { unit: "day", step: 1, format: "%d %M" }
      ];
      gantt.config.min_column_width = 38;
    } else {
      gantt.config.scales = [
        { unit: "month", step: 1, format: "%F %Y" },
        { unit: "week", step: 1, format: "W%W" },
        { unit: "day", step: 1, format: "%d" }
      ];
      gantt.config.min_column_width = 30;
    }

    gantt.config.start_date = start;
    gantt.config.end_date = end;

    const tasks = [];
    const machineMap = {};

    for (let i = 0; i < filteredData.length; i++) {
      const s = filteredData[i];
      if (!s.startTime || !s.endTime) continue;
      const machine = s.machineId?.machineName || "Machine";
      if (!machineMap[machine]) {
        machineMap[machine] = true;
        tasks.push({ id: `machine_${machine}`, text: machine, open: true, isMachine: true });
      }

      const activityName =
        s.activityId?.activityName ||
        (s.machinesDetail || [])
          .map((m) => m.activityId?.activityName)
          .filter(Boolean)
          .join(", ");

      const totalMinutes = Math.round((s._endTimeMs - s._startTimeMs) / (1000 * 60));
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const durLabel = hrs === 0 ? `${mins}m` : mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;

      // Clear, readable bar title styled like a friendly bar graph
      const barTitle = s.isBlocked
        ? `🚧 ${s.blockReason || "Blocked"}`
        : `WO ${s.workOrderId?.efiWoNumber || ""}${activityName ? " · " + activityName : ""} (${durLabel})`;

      tasks.push({
        id: s._id,
        text: barTitle,
        start_date: new Date(s.startTime),
        end_date: new Date(s.endTime),
        duration: (s._endTimeMs - s._startTimeMs) / (1000 * 60 * 60),
        parent: `machine_${machine}`,
        color: s.isBlocked ? "red" : s.priority === "HIGH" ? "#ff0000" : s.priority === "MEDIUM" ? "#ff9800" : "#28a745",
        activityName
      });
    }

    gantt.batchUpdate(() => {
      gantt.clearAll();
      gantt.parse({ data: tasks });
    });

  }, [
    schedules,
    fromDate,
    toDate,
    customerFilter,
    machineFilter,
    debouncedWoSearch,
    zoomLevel
  ]);

  // =========================
  // LOAD ALL DATA (PARALLEL PROMISE.ALL)
  // =========================
  const loadAllData = async () => {
    try {
      const [woRes, schRes, prRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/workorders`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }).catch((err) => {
          console.log("Work order fetch failed:", err);
          return { data: [] };
        }),
        axios.get(`${BASE_URL}/api/schedule`).catch((err) => {
          console.log("Schedule fetch failed:", err);
          return { data: [] };
        }),
        axios.get(`${BASE_URL}/api/master/priorities`).catch((err) => {
          console.log("Priorities fetch failed:", err);
          return { data: [] };
        })
      ]);

      const plannedWO = (woRes.data || []).filter(
        (w) => w.status === "PLANNED" && w.schedulerHidden !== true
      );

      const enrichedSchedules = (schRes.data || []).map((s) => ({
        ...s,
        _startTimeMs: s.startTime ? new Date(s.startTime).getTime() : 0,
        _endTimeMs: s.endTime ? new Date(s.endTime).getTime() : 0,
        _customerLower: String(s.workOrderId?.customer?.name || s.workOrderId?.customer || "").toLowerCase().trim(),
        _woNumberLower: String(s.workOrderId?.efiWoNumber || "").toLowerCase().trim(),
        _machineIdStr: String(s.machineId?._id || s.machineId || "")
      }));

      setWorkOrders(plannedWO);
      setSchedules(enrichedSchedules);
      setPriorities(prRes.data || []);
    } catch (err) {
      console.log("Load all data failed:", err);
    }
  };

  // =========================
  // UPDATE SCHEDULE TIME
  // =========================
  const updateScheduleTime = async (id, newStart, newEnd) => {
    try {
      await axios.put(
        `${BASE_URL}/api/schedule/${id}`,
        { startTime: newStart.toISOString(), endTime: newEnd.toISOString() },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      Swal.fire({ icon: "success", title: "Updated!", text: "Schedule time updated successfully.", confirmButtonColor: "#3b6fa8", timer: 1800, showConfirmButton: false });
      await loadAllData();
    } catch (err) {
      console.log(err);
      Swal.fire({ icon: "error", title: "Update Failed", text: err.response?.data?.message || "Could not update schedule.", confirmButtonColor: "#dc2626" });
      await loadAllData();
    }
  };

  const getScheduleMachineId = (schedule) =>
    schedule.machineId?._id || schedule.machineId;

  const isSameLocalDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const toDateTimeLocalValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getNextAvailableStart = (
    machineId,
    requestedStart,
    durationHrs,
    scheduleList = schedules
  ) => {
    const durationMs = Number(durationHrs) * 60 * 60 * 1000;
    let candidate = new Date(requestedStart);

    if (!machineId || isNaN(candidate.getTime()) || !durationMs) {
      return candidate;
    }

    const requestedDay = new Date(candidate);
    requestedDay.setHours(0, 0, 0, 0);

    const intervals = scheduleList
      .filter((s) => {
        if (!s.startTime || !s.endTime) return false;
        if (String(getScheduleMachineId(s)) !== String(machineId)) return false;

        const start = new Date(s.startTime);
        const end = new Date(s.endTime);

        return isSameLocalDate(start, requestedDay) && end > candidate;
      })
      .map((s) => ({
        start: new Date(s.startTime),
        end: new Date(s.endTime)
      }))
      .sort((a, b) => a.start - b.start);

    let moved = true;

    while (moved) {
      moved = false;
      const candidateEnd = new Date(candidate.getTime() + durationMs);

      for (const interval of intervals) {
        const overlaps =
          candidate < interval.end &&
          candidateEnd > interval.start;

        if (overlaps) {
          candidate = new Date(
            interval.end.getTime() + 60 * 1000
          );
          moved = true;
          break;
        }
      }
    }

    return candidate;
  };

  // =========================
  // SELECT A PENDING ROW
  // =========================
  const handleSelectRow = async (item) => {
    setSelectedWO(item);

    setScheduleDate("");
    setPriority("");

    const machineId = item.machineId;

    if (!machineId) {
      alert("Machine missing");
      return;
    }

    try {
      const capRes = await axios.get(`${BASE_URL}/api/capacity/${machineId}`);

      const cap = capRes.data.capacityPerHour;

      const totalImp = Number(item.totalImp) || 0;
      const durationHrs = cap ? (totalImp / cap).toFixed(2) : "N/A";

      setCapacity(cap);
      setCalculatedTime(durationHrs);

      const woDate = item.wo?.woDate ? new Date(item.wo.woDate) : null;

      if (woDate && !isNaN(woDate.getTime())) {
        setScheduleDate(toDateTimeLocalValue(woDate));
      } else {
        setScheduleDate("");
      }
    } catch (err) {
      console.log(err);
      setCapacity("Not Set");
      setCalculatedTime("N/A");
      setScheduleDate("");
    }
  };

  const handleScheduleDateChange = (value) => {
    if (!selectedWO) {
      setScheduleDate(value);
      return;
    }

    const machineId = selectedWO.machineId;

    if (!machineId || !value || !calculatedTime || calculatedTime === "N/A") {
      setScheduleDate(value);
      return;
    }

    const nextStart = getNextAvailableStart(
      machineId,
      value,
      calculatedTime,
      schedules
    );

    setScheduleDate(toDateTimeLocalValue(nextStart));
  };

  // =========================
  // FILTER BY DATE (FAST INTEGER MATCHING)
  // =========================
  const getCustomerName = (s) => {
    const customer = s.workOrderId?.customer;
    return typeof customer === "object" ? (customer?.name || "") : (customer || "");
  };

  const customerOptions = useMemo(() => {
    const set = new Set();
    schedules.forEach((s) => {
      const cName = s.workOrderId?.customer?.name || s.workOrderId?.customer;
      if (cName) set.add(cName);
    });
    return Array.from(set).sort();
  }, [schedules]);

  const machineOptions = useMemo(() => {
    const map = new Map();
    schedules.forEach((s) => {
      if (s.machineId?._id) {
        map.set(String(s.machineId._id), s.machineId);
      }
    });
    return Array.from(map.values());
  }, [schedules]);

  const filterSchedulesByDate = (data, searchOverride) => {
    let filtered = data;
    const activeWoSearch = (searchOverride !== undefined ? searchOverride : debouncedWoSearch).trim().toLowerCase();
    const hasOtherFilters = !!(customerFilter || machineFilter || activeWoSearch);

    if (!fromDate && !toDate && !hasOtherFilters) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const startMs = todayStart.getTime();

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const endMs = todayEnd.getTime();

      filtered = filtered.filter((s) => s._startTimeMs && s._startTimeMs >= startMs && s._startTimeMs <= endMs);
    } else {
      if (fromDate) {
        const startMs = new Date(`${fromDate}T00:00:00`).getTime();
        filtered = filtered.filter((s) => s._startTimeMs && s._startTimeMs >= startMs);
      }

      if (toDate) {
        const endMs = new Date(`${toDate}T23:59:59.999`).getTime();
        filtered = filtered.filter((s) => s._startTimeMs && s._startTimeMs <= endMs);
      }
    }

    if (customerFilter) {
      const lowerCust = customerFilter.toLowerCase().trim();
      filtered = filtered.filter((s) => s._customerLower === lowerCust);
    }

    if (machineFilter) {
      filtered = filtered.filter((s) => s._machineIdStr === String(machineFilter));
    }

    if (activeWoSearch) {
      filtered = filtered.filter((s) => s._woNumberLower.includes(activeWoSearch));
    }

    return filtered;
  };

  // =========================
  // WORKLOAD BAR GRAPH DATA COMPUTATION
  // =========================
  const machineWorkloads = useMemo(() => {
    const filtered = filterSchedulesByDate(schedules, debouncedWoSearch);
    const map = new Map();

    machineOptions.forEach((m) => {
      map.set(String(m._id), {
        machineId: String(m._id),
        machineName: m.machineName,
        jobsCount: 0,
        totalHours: 0,
        totalImp: 0,
        highCount: 0,
        medCount: 0,
        lowCount: 0,
        blockedHours: 0,
        jobsList: []
      });
    });

    filtered.forEach((s) => {
      const mId = String(s.machineId?._id || s.machineId || "unknown");
      const mName = s.machineId?.machineName || "Other Machine";

      if (!map.has(mId)) {
        map.set(mId, {
          machineId: mId,
          machineName: mName,
          jobsCount: 0,
          totalHours: 0,
          totalImp: 0,
          highCount: 0,
          medCount: 0,
          lowCount: 0,
          blockedHours: 0,
          jobsList: []
        });
      }

      const item = map.get(mId);
      const hrs = Math.max(0, (s._endTimeMs - s._startTimeMs) / (1000 * 60 * 60));

      if (s.isBlocked) {
        item.blockedHours += hrs;
      } else {
        item.jobsCount += 1;
        item.totalHours += hrs;
        item.totalImp += Number(s.totalImp) || 0;
        if (s.priority === "HIGH") item.highCount += 1;
        else if (s.priority === "MEDIUM") item.medCount += 1;
        else item.lowCount += 1;
      }
      item.jobsList.push(s);
    });

    const list = Array.from(map.values());

    if (machineFilter) {
      return list.filter((i) => i.machineId === String(machineFilter));
    }
    return list.sort((a, b) => b.totalHours - a.totalHours);
  }, [schedules, debouncedWoSearch, fromDate, toDate, customerFilter, machineFilter, machineOptions]);

  const maxWorkloadValue = useMemo(() => {
    if (!machineWorkloads.length) return 1;
    if (barMetric === "hours") {
      return Math.max(...machineWorkloads.map((m) => m.totalHours + m.blockedHours), 1);
    }
    if (barMetric === "imp") {
      return Math.max(...machineWorkloads.map((m) => m.totalImp), 1);
    }
    return Math.max(...machineWorkloads.map((m) => m.jobsCount), 1);
  }, [machineWorkloads, barMetric]);

  const totalFilteredSummary = useMemo(() => {
    return machineWorkloads.reduce(
      (acc, m) => {
        acc.jobs += m.jobsCount;
        acc.hours += m.totalHours;
        acc.imp += m.totalImp;
        acc.blocked += m.blockedHours;
        return acc;
      },
      { jobs: 0, hours: 0, imp: 0, blocked: 0 }
    );
  }, [machineWorkloads]);

  // =========================
  // SAVE SCHEDULE
  // =========================
  const saveSchedule = async () => {
    try {
      if (!selectedWO) return Swal.fire({ icon: "warning", title: "Missing Work Order", text: "Please select a work order" });
      if (!scheduleDate) return Swal.fire({ icon: "warning", title: "Missing Date", text: "Please select date and time" });
      if (!priority) return Swal.fire({ icon: "warning", title: "Missing Priority", text: "Please select priority" });

      const machineId = selectedWO.machineId;

      const schRes = await axios.get(`${BASE_URL}/api/schedule`);
      const latestSchedules = schRes.data || [];
      const nextStart = getNextAvailableStart(
        machineId,
        scheduleDate,
        calculatedTime,
        latestSchedules
      );
      const finalScheduleDate = toDateTimeLocalValue(nextStart);
      const wasMoved = finalScheduleDate !== scheduleDate;

      await axios.post(`${BASE_URL}/api/schedule/create`, {
        workOrderId: selectedWO.workOrderId,
        machineId,
        activityId: selectedWO.activityId,
        rowIndex: selectedWO.rowIndex,
        scheduleDate: finalScheduleDate,
        priority
      });

      Swal.fire({
        icon: "success",
        title: "Success",
        text: wasMoved
          ? `Selected slot was occupied. Scheduled at next available time: ${nextStart.toLocaleString()}`
          : "Work Order Scheduled Successfully",
        confirmButtonColor: "#3b6fa8",
        timer: 2200,
        showConfirmButton: false
      });

      setSelectedWO(null);
      setScheduleDate("");
      setPriority("");

      await loadAllData();
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Schedule failed");
    }
  };

  // =========================
  // AUTO-SCHEDULE ALL PENDING
  // =========================
  const handleAutoScheduleAllPending = async () => {
    const confirmResult = await Swal.fire({
      title: "Auto-Schedule All Pending?",
      text: "Every pending Activity/Machine row will be placed on the Gantt at the next free slot on its machine. You can drag any of them afterwards.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b6fa8",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, Auto-Schedule"
    });

    if (!confirmResult.isConfirmed) return;

    setAutoScheduling(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/schedule/auto-pending`);
      const { totalScheduled, workOrdersChecked, details } = res.data;

      const skippedCount = (details || []).reduce(
        (sum, d) => sum + (d.skipped?.length || 0),
        0
      );

      const skipLines = (details || [])
        .flatMap((d) => (d.skipped || []).map((s) => `WO ${d.efiWoNumber}: ${s}`));

      Swal.fire({
        icon: "success",
        title: "Auto-Scheduled",
        html: `<div style="font-size:13px;line-height:1.7;text-align:left;max-height:300px;overflow-y:auto">
          <b>${totalScheduled}</b> row(s) scheduled across <b>${workOrdersChecked}</b> Work Order(s) checked.
          ${
            skippedCount
              ? `<br/><br/><span style="color:#b45309;font-weight:700">${skippedCount} row(s) skipped:</span><br/>${skipLines
                  .map((l) => `• ${l}`)
                  .join("<br/>")}`
              : ""
          }
        </div>`,
        confirmButtonColor: "#3b6fa8"
      });

      await loadAllData();
    } catch (err) {
      console.log(err);
      Swal.fire({
        icon: "error",
        title: "Auto-Schedule Failed",
        text: err.response?.data?.message || "Something went wrong"
      });
    } finally {
      setAutoScheduling(false);
    }
  };

  // =========================
  // DEDUPE SCHEDULES
  // =========================
  const handleDedupeSchedules = async () => {
    const confirmResult = await Swal.fire({
      title: "Remove Duplicate Schedules?",
      text: "This removes extra schedule entries that were accidentally created for rows that were already scheduled, keeping the oldest one for each. It never touches blocked machine slots.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, Clean Up"
    });

    if (!confirmResult.isConfirmed) return;

    setDedupingSchedules(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/schedule/dedupe`);
      Swal.fire({
        icon: "success",
        title: "Cleaned Up",
        text: res.data.message,
        confirmButtonColor: "#3b6fa8"
      });
      await loadAllData();
    } catch (err) {
      console.log(err);
      Swal.fire({
        icon: "error",
        title: "Cleanup Failed",
        text: err.response?.data?.message || "Something went wrong"
      });
    } finally {
      setDedupingSchedules(false);
    }
  };

  const saveBlockMachine = async () => {
    try {
      if (!blockMachine) {
        return Swal.fire({
          icon: "warning",
          title: "Select Machine"
        });
      }

      if (!blockStart || !blockEnd) {
        return Swal.fire({
          icon: "warning",
          title: "Select Start & End Time"
        });
      }

      await axios.post(
        `${BASE_URL}/api/schedule/block`,
        {
          machineId: blockMachine,
          startTime: blockStart,
          endTime: blockEnd,
          reason: blockReason
        }
      );

      Swal.fire({
        icon: "success",
        title: "Machine Blocked 🚧",
        timer: 1800,
        showConfirmButton: false
      });

      setBlockMachine("");
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");

      await loadAllData();
    } catch (err) {
      console.log(err);
      Swal.fire({
        icon: "error",
        title: "Block Failed",
        text: err.response?.data?.message || "Unable to block machine"
      });
    }
  };

  // =========================
  // DELETE SCHEDULE (WITH OPTIMISTIC UI)
  // =========================
  const deleteSchedule = async (id) => {
    try {
      try { gantt.deleteTask(id); } catch (_) {}
      setSchedules((prev) => prev.filter((s) => s._id !== id));

      await axios.delete(`${BASE_URL}/api/schedule/${id}`);
      Swal.fire({ icon: "success", title: "Deleted", timer: 1200, showConfirmButton: false });
      loadAllData();
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Delete failed");
      loadAllData();
    }
  };

  const hidePendingWorkOrder = async (wo) => {
    const result = await Swal.fire({
      title: "Remove from Scheduler?",
      text: `WO ${wo.efiWoNumber} and ALL of its pending Activity/Machine rows will be removed from the pending scheduler list. The Work Order itself will not be deleted.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d97706",
      cancelButtonColor: "#5f7487",
      confirmButtonText: "Yes, Remove",
      cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) return;

    try {
      await axios.patch(
        `${BASE_URL}/api/workorders/${wo._id}/scheduler-hide`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      setWorkOrders((prev) =>
        prev.filter((item) => item._id !== wo._id)
      );

      if (selectedWO?.workOrderId === wo._id) {
        setSelectedWO(null);
        setScheduleDate("");
        setPriority("");
        setCapacity("");
        setCalculatedTime("");
      }

      Swal.fire({
        icon: "success",
        title: "Removed",
        text: `WO ${wo.efiWoNumber} removed from scheduler.`,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.log(err);
      Swal.fire({
        icon: "error",
        title: "Remove Failed",
        text: err.response?.data?.message || "Unable to remove Work Order."
      });
    }
  };

  const formatTime = (hrs) => {
    if (!hrs || isNaN(hrs)) return "-";
    const totalMinutes = Math.round(hrs * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h} hr ${m} mins`;
  };

  const priBadge = (p) => {
    const cls = p === "HIGH" ? "high" : p === "MEDIUM" ? "medium" : "low";
    return <span className={`badge-pri ${cls}`}>{p || "—"}</span>;
  };

  // =========================
  // DOWNLOAD EXCEL
  // =========================
  const downloadExcel = () => {
    const filtered = filterSchedulesByDate(schedules);
    let sumImp = 0;
    let sumMinutes = 0;

    const excelData = filtered.map((s) => {
      const totalMinutes = Math.round(
        (new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60)
      );
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const duration =
        hrs === 0 ? `${mins} mins`
        : mins === 0 ? `${hrs} hrs`
        : `${hrs} hrs ${mins} mins`;

      if (!s.isBlocked) {
        sumImp += Number(s.totalImp) || 0;
        sumMinutes += totalMinutes || 0;
      }

      const activityNames =
        s.activityId?.activityName ||
        (s.machinesDetail || [])
          .map((m) => m.activityId?.activityName || "-")
          .join(", ");

      const machineNames = s.machineId?.machineName
        || (s.machinesDetail || []).map((m) => m.machineId?.machineName || "-").join(", ")
        || "-";

      const inchesList = s.inches || (s.machinesDetail || [])
        .map((m) => m.inches)
        .filter(Boolean)
        .join(", ") || "-";

      const slitList = s.slitNumber || (s.machinesDetail || [])
        .map((m) => m.slitNumber)
        .filter(Boolean)
        .join(", ") || "-";

      const materials = s.materials || [];
      const materialDescriptions = materials.map((m) => m.materialDescription).filter(Boolean).join(", ") || "-";
      const materialGroups = materials.map((m) => m.materialGroupDescription).filter(Boolean).join(", ") || "-";
      const mills = materials.map((m) => m.mill).filter(Boolean).join(", ") || "-";
      const gsms = materials.map((m) => m.gsm).filter(Boolean).join(", ") || "-";
      const paperSizes = materials.map((m) => m.paperSize).filter(Boolean).join(", ") || "-";
      const paperQtys = materials.map((m) => m.paperQty).filter((v) => v !== undefined && v !== null).join(", ") || "-";

      return {
        "SL No": s.slNo ?? "-",
        "Priority": s.priority ?? "-",
        "WO Number": s.workOrderId?.efiWoNumber ?? "-",
        "WO Date": s.workOrderId?.woDate
          ? gantt.date.date_to_str("%d-%m-%Y")(new Date(s.workOrderId.woDate))
          : "-",
        "Customer": getCustomerName(s),
        "Product Type": s.productType ?? "-",
        "Job Description": s.productName ?? "-",
        "Request Location": s.location ?? "-",
        "Activity": activityNames || "-",
        "Machine": machineNames,
        "Color Front": s.colorFront ?? "-",
        "Color Back": s.colorBack ?? "-",
        "Inches": inchesList,
        "Paper Slit": slitList,
        "Paper Description": materialDescriptions,
        "Paper Group Description": materialGroups,
        "Mill": mills,
        "GSM": gsms,
        "Paper Size": paperSizes,
        "Paper Qty": paperQtys,
        "Order Qty": s.orderQty ?? "-",
        "Waste %": s.wasteQty ?? "-",
        "Job Size": s.jobSize ?? "-",
        "IMP Front": s.impFront ?? "-",
        "IMP Back": s.impBack ?? "-",
        "Total IMP": s.totalImp ?? "-",
        "Remarks": s.remarks ?? "-",
        "Planning User": s.planningUser ?? "-",
        "Printing Locations": (s.userLocations || []).join(", ") || "-",
        "Schedule Start": s.startTime ? new Date(s.startTime).toLocaleString() : "-",
        "Schedule End": s.endTime ? new Date(s.endTime).toLocaleString() : "-",
        "Duration": duration,
        "Status": s.isBlocked ? "BLOCKED" : "SCHEDULED",
        "Block Reason": s.blockReason ?? "-"
      };
    });

    const fmtDuration = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h === 0) return `${m} mins`;
      if (m === 0) return `${h} hrs`;
      return `${h} hrs ${m} mins`;
    };

    if (excelData.length > 0) {
      const totalRow = {};
      Object.keys(excelData[0]).forEach((key) => {
        totalRow[key] = "";
      });
      totalRow["Total IMP"] = sumImp;
      totalRow["Duration"] = fmtDuration(sumMinutes);
      excelData.push(totalRow);
    }

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedules");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array"
    });

    const fileData = new Blob(
      [excelBuffer],
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    );

    const fileName =
      fromDate && toDate
        ? `schedule_${fromDate}_to_${toDate}.xlsx`
        : fromDate
          ? `schedule_from_${fromDate}.xlsx`
          : toDate
            ? `schedule_to_${toDate}.xlsx`
            : `schedule_today.xlsx`;
    saveAs(fileData, fileName);
  };

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) =>
      wo.userLocations?.some((loc) => userLocations.includes(loc))
    );
  }, [workOrders, userLocations]);

  // =========================
  // PENDING ITEMS (FAST O(N) MAP LOOKUP)
  // =========================
  const pendingItems = useMemo(() => {
    const items = [];
    if (!filteredWorkOrders.length) return items;

    const schedulesByWoId = new Map();
    for (let i = 0; i < schedules.length; i++) {
      const s = schedules[i];
      const sWoId = String(s.workOrderId?._id || s.workOrderId || "");
      if (!sWoId) continue;
      let list = schedulesByWoId.get(sWoId);
      if (!list) {
        list = [];
        schedulesByWoId.set(sWoId, list);
      }
      list.push(s);
    }

    for (let i = 0; i < filteredWorkOrders.length; i++) {
      const wo = filteredWorkOrders[i];
      const woIdStr = String(wo._id);
      const woSchedules = schedulesByWoId.get(woIdStr) || [];
      const hasRows = wo.machines && wo.machines.length > 0;
      const rows = hasRows ? wo.machines : [null];

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const machineIdVal = row?.machineId?._id || row?.machineId || null;
        const activityIdVal = row?.activityId?._id || row?.activityId || null;
        if (!machineIdVal) continue;

        const alreadyScheduled = woSchedules.some((s) => {
          if (s.rowIndex !== undefined && s.rowIndex !== null) {
            return Number(s.rowIndex) === idx;
          }
          return idx === 0;
        });

        if (alreadyScheduled) continue;

        items.push({
          key: `${wo._id}_${idx}`,
          wo,
          workOrderId: wo._id,
          rowIndex: hasRows ? idx : null,
          machineId: machineIdVal,
          activityId: activityIdVal,
          machineName: row?.machineId?.machineName || "Machine Not Found",
          activityName: row?.activityId?.activityName || "-",
          inches: row?.inches || "",
          slitNumber: row?.slitNumber || "",
          isBooklet: row?.isBooklet || false,
          pages: row?.pages || 0,
          component: row?.component || "",
          impFront: row?.impFront ?? wo.impFront ?? 0,
          impBack: row?.impBack ?? wo.impBack ?? 0,
          totalImp: row?.totalImp ?? wo.totalImp ?? 0,
          efiWoNumber: wo.efiWoNumber,
          customer: wo.customer,
          priority: wo.priority,
          location: wo.location,
          locationName: wo.location?.locationName || wo.location || "Location Not Found"
        });
      }
    }

    return items;
  }, [filteredWorkOrders, schedules]);

  const pendingFilteredItems = useMemo(() => {
    const query = debouncedPendingWoSearch.trim().toLowerCase();
    if (!query) return pendingItems;
    return pendingItems.filter((item) =>
      String(item.efiWoNumber || "")
        .toLowerCase()
        .includes(query)
    );
  }, [pendingItems, debouncedPendingWoSearch]);

  const totalPendingPages = Math.ceil(pendingFilteredItems.length / pendingPageSize) || 1;

  const paginatedPendingItems = useMemo(() => {
    const start = (pendingPage - 1) * pendingPageSize;
    return pendingFilteredItems.slice(start, start + pendingPageSize);
  }, [pendingFilteredItems, pendingPage]);

  // =========================
  // RENDER
  // =========================
  return (
    <div className="sch-root">

      {/* ── TOP BAR ── */}
      <div className="sch-topbar">
        <div className="sch-topbar-icon">📅</div>
        <div>
          <h1>Production Scheduler</h1>
          <p>Drag Gantt bars to reschedule · Double-click to delete</p>
        </div>
        <div className="sch-topbar-badge">
          <span></span>
          {pendingItems.length} pending · {schedules.length} scheduled
        </div>
      </div>

      <div className="sch-body">

        {/* ── WORK ORDER TABLE ── */}
        {filteredWorkOrders.length > 0 && (
          <div className="sch-card">
            <div className="sch-card-head navy">
              <span>📋</span> Pending Work Orders
              <span className="head-count">
                {pendingFilteredItems.length}
              </span>
            </div>

            <div
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid #cfe6f0",
                background: "#eef9fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                placeholder="Search WO Number..."
                value={pendingWoSearch}
                onChange={(e) => setPendingWoSearch(e.target.value)}
                style={{
                  width: 240,
                  height: 34,
                  padding: "0 12px",
                  border: "1px solid #b9d4e3",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#0f172a",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={handleAutoScheduleAllPending}
                  disabled={autoScheduling || pendingItems.length === 0}
                  style={{
                    height: 34,
                    padding: "0 16px",
                    background: autoScheduling || pendingItems.length === 0 ? "#94a3b8" : "#3b6fa8",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: autoScheduling || pendingItems.length === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                  title="Auto-schedule every pending row onto the Gantt"
                >
                  ⚡ {autoScheduling ? "Scheduling..." : "Auto-Schedule All Pending"}
                </button>

                <button
                  onClick={handleDedupeSchedules}
                  disabled={dedupingSchedules}
                  style={{
                    height: 34,
                    padding: "0 16px",
                    background: dedupingSchedules ? "#94a3b8" : "#dc2626",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: dedupingSchedules ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title="Remove duplicate schedule entries"
                >
                  🧹 {dedupingSchedules ? "Cleaning..." : "Clean Up Duplicates"}
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="wo-table">
                <thead>
                  <tr>
                    <th>WO Number</th>
                    <th>Customer</th>
                    <th>Activity</th>
                    <th>Machine</th>
                    <th>Location</th>
                    <th>Total IMP</th>
                    <th>Priority</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedPendingItems.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan="8">
                        No pending work orders found
                      </td>
                    </tr>
                  ) : paginatedPendingItems.map((item) => (
                    <tr key={item.key}>
                      <td>
                        <span className="wo-num">
                          {item.efiWoNumber}
                        </span>
                      </td>

                      <td>
                        {item.customer?.name || item.customer}
                      </td>

                      <td>{item.activityName}</td>
                      <td>{item.machineName}</td>

                      <td>{item.locationName}</td>

                      <td
                        style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontWeight: 600
                        }}
                      >
                        {item.totalImp}
                      </td>

                      <td>
                        {priBadge(item.priority)}
                      </td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                          }}
                        >
                          <button
                            className="btn-sched"
                            onClick={() => {
                              handleSelectRow(item);

                              setTimeout(() => {
                                document
                                  .getElementById("schedule-form")
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start"
                                  });
                              }, 100);
                            }}
                          >
                            Schedule
                          </button>

                          {userRole === "ADMIN" && (
                            <button
                              onClick={() =>
                                hidePendingWorkOrder(item.wo)
                              }
                              style={{
                                background: "#d97706",
                                color: "#fff",
                                border: "none",
                                padding: "6px 14px",
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 600,
                                cursor: "pointer"
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPendingPages > 1 && (
              <div
                style={{
                  padding: "10px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#eef9fe",
                  borderTop: "1px solid #cfe6f0",
                  fontSize: 12.5,
                  color: "#5f7487",
                }}
              >
                <span>
                  Showing {(pendingPage - 1) * pendingPageSize + 1}–{Math.min(pendingPage * pendingPageSize, pendingFilteredItems.length)} of {pendingFilteredItems.length}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    disabled={pendingPage <= 1}
                    onClick={() => setPendingPage((p) => Math.max(p - 1, 1))}
                    style={{
                      padding: "4px 12px",
                      background: pendingPage <= 1 ? "#e3f3fa" : "#fff",
                      border: "1px solid #b9d4e3",
                      borderRadius: 6,
                      cursor: pendingPage <= 1 ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Prev
                  </button>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>
                    {pendingPage} / {totalPendingPages}
                  </span>
                  <button
                    disabled={pendingPage >= totalPendingPages}
                    onClick={() => setPendingPage((p) => Math.min(p + 1, totalPendingPages))}
                    style={{
                      padding: "4px 12px",
                      background: pendingPage >= totalPendingPages ? "#e3f3fa" : "#fff",
                      border: "1px solid #b9d4e3",
                      borderRadius: 6,
                      cursor: pendingPage >= totalPendingPages ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULE FORM ── */}
        {selectedWO && (
          <div id="schedule-form" className="sch-card" style={{ borderLeft: "4px solid #3b6fa8" }}>
            <div className="sch-card-head blue">
              <span>🗓</span> Schedule — <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{selectedWO.efiWoNumber}</span>
            </div>
            <div className="sch-card-body">
              <div className="form-grid">
                <div className="form-field">
                  <label>WO Number</label>
                  <input value={selectedWO.efiWoNumber} disabled />
                </div>

                <div className="form-field">
                  <label>Activity</label>
                  <input value={selectedWO.activityName} disabled />
                </div>

                <div className="form-field">
                  <label>Machine</label>
                  <input value={selectedWO.machineName} disabled />
                </div>

                <div className="form-field">
                  <label>Location</label>
                  <input value={selectedWO.locationName} disabled />
                </div>
                <div className="form-field">
                  <label>Total IMP</label>
                  <input value={selectedWO.totalImp} disabled />
                </div>
                <div className="form-field">
                  <label>Capacity / hr</label>
                  <input value={capacity} disabled />
                </div>
                <div className="form-field">
                  <label>Total Time</label>
                  <input value={formatTime(calculatedTime)} disabled />
                </div>
                <div className="form-field">
                  <label>Start Date &amp; Time</label>
                  <input type="datetime-local" value={scheduleDate} onChange={(e) => handleScheduleDateChange(e.target.value)} style={{ background: "#fff" }} />
                </div>
                <div className="form-field">
                  <label>Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ background: "#fff" }}>
                    <option value="">Select priority</option>
                    {priorities.map((p) => <option key={p._id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-save" onClick={saveSchedule}>✓ Save Schedule</button>
                <button className="btn-cancel-form" onClick={() => { setSelectedWO(null); setScheduleDate(""); setPriority(""); setCapacity(""); setCalculatedTime(""); }}>
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BLOCK MACHINE CARD ── */}
        <div className="sch-card">
          <div className="sch-card-head teal">
            <span>🚧</span> Block Machine
          </div>
          <div className="sch-card-body">
            <div className="form-grid">
              <div className="form-field">
                <label>Machine</label>
                <select
                  value={blockMachine}
                  onChange={(e) => setBlockMachine(e.target.value)}
                >
                  <option value="">Select Machine</option>
                  {machineOptions.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.machineName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Block Start</label>
                <input
                  type="datetime-local"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Block End</label>
                <input
                  type="datetime-local"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Reason</label>
                <textarea
                  placeholder="Maintenance / Breakdown"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-save" onClick={saveBlockMachine}>
                🚧 Block Machine
              </button>
            </div>
          </div>
        </div>

        {/* ── GANTT / BAR GRAPH CARD ── */}
        <div
          className="sch-card"
          style={{
            overflow: "hidden",
            borderRadius: "16px",
            border: "1px solid #cfe6f0",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.08)",
            background: "#fff",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* ── Header with View Switcher ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "16px 22px",
              borderBottom: "1px solid #cfe6f0",
              background: "linear-gradient(180deg, #eef9fe 0%, #ffffff 100%)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "#e0f2fe",
                  border: "1px solid #bae6fd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 22 }}>
                  {chartMode === "timeline" ? "📊" : "📈"}
                </span>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" }}>
                    Production Scheduler
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#5f7487", marginTop: 2 }}>
                  {chartMode === "timeline"
                    ? "Interactive Gantt bar graph · Drag to move · Drag edges to resize · Double-click to delete"
                    : "Visual machine workload distribution & capacity breakdown"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={downloadExcel}
                style={{
                  height: 34,
                  padding: "0 16px",
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 6px rgba(22, 163, 74, 0.2)",
                  transition: "background 0.15s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#15803d")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#16a34a")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Excel
              </button>
            </div>
          </div>

          {/* ── Filter row ── */}
          <div
            style={{
              padding: "12px 22px",
              borderBottom: "1px solid #cfe6f0",
              background: "#eef9fe",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {/* CUSTOMER FILTER */}
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  style={{
                    height: 34,
                    padding: "0 10px",
                    border: "1.5px solid #b9d4e3",
                    borderRadius: 8,
                    fontSize: 12.5,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                    cursor: "pointer",
                    width: 145
                  }}
                >
                  <option value="">All Customers</option>
                  {customerOptions.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>

                {/* MACHINE FILTER */}
                <select
                  value={machineFilter}
                  onChange={(e) => setMachineFilter(e.target.value)}
                  style={{
                    height: 34,
                    padding: "0 10px",
                    border: "1.5px solid #b9d4e3",
                    borderRadius: 8,
                    fontSize: 12.5,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                    cursor: "pointer",
                    width: 140
                  }}
                >
                  <option value="">All Machines</option>
                  {machineOptions.map((machine) => (
                    <option key={machine._id} value={machine._id}>
                      {machine.machineName}
                    </option>
                  ))}
                </select>

                {/* WO SEARCH */}
                <input
                  type="text"
                  placeholder="Search WO Number..."
                  value={woSearch}
                  onChange={(e) => setWoSearch(e.target.value)}
                  style={{
                    height: 34,
                    padding: "0 12px",
                    border: "1.5px solid #b9d4e3",
                    borderRadius: 8,
                    fontSize: 12.5,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                    width: 160,
                    boxSizing: "border-box"
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#5f7487" }}>
                    From
                  </span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      if (toDate && e.target.value > toDate) {
                        setToDate("");
                      }
                    }}
                    style={{
                      height: 34,
                      padding: "0 10px",
                      border: "1.5px solid #b9d4e3",
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: "#0f172a",
                      background: "#fff",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#5f7487" }}>
                    To
                  </span>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                    style={{
                      height: 34,
                      padding: "0 10px",
                      border: "1.5px solid #b9d4e3",
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: "#0f172a",
                      background: "#fff",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  />
                </div>

                {(fromDate || toDate || customerFilter || machineFilter || woSearch) ? (
                  <button
                    className="btn-clear-filter"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setCustomerFilter("");
                      setMachineFilter("");
                      setWoSearch("");
                    }}
                    style={{
                      height: 34,
                      padding: "0 12px",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#fff",
                      background: "#ea580c",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontWeight: 600,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Clear Filters
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: "#5f7487", fontStyle: "italic", marginLeft: 4 }}>
                    Showing today's schedules
                  </span>
                )}
              </div>

              {/* Timeline Zoom Controls */}
              {chartMode === "timeline" && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", padding: "3px 6px", borderRadius: 8, border: "1px solid #b9d4e3" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#5f7487", marginRight: 4, textTransform: "uppercase" }}>
                    Zoom:
                  </span>
                  {[
                    { id: "auto", label: "Auto" },
                    { id: "30m", label: "30 Min" },
                    { id: "1h", label: "1 Hour" },
                    { id: "day", label: "1 Day" },
                  ].map((z) => (
                    <button
                      key={z.id}
                      onClick={() => setZoomLevel(z.id)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 5,
                        border: "none",
                        background: zoomLevel === z.id ? "#3b6fa8" : "transparent",
                        color: zoomLevel === z.id ? "#fff" : "#5f7487",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Legend ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 22px",
              borderBottom: "1px solid #cfe6f0",
              background: "#ffffff",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5f7487", textTransform: "uppercase", letterSpacing: ".5px" }}>
                Status:
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff0000", display: "inline-block", boxShadow: "0 0 5px rgba(255,0,0,0.5)" }} />
                High Priority
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff9800", display: "inline-block", boxShadow: "0 0 5px rgba(255,152,0,0.5)" }} />
                Medium Priority
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28a745", display: "inline-block", boxShadow: "0 0 5px rgba(40,167,69,0.5)" }} />
                Low Priority
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                <span style={{ width: 12, height: 10, borderRadius: 2, background: "repeating-linear-gradient(-45deg, #dc2626, #dc2626 3px, #b91c1c 3px, #b91c1c 6px)", display: "inline-block" }} />
                Blocked Machine
              </span>
            </div>

            {chartMode === "timeline" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {[
                  { icon: "↔", label: "Drag to move" },
                  { icon: "⇔", label: "Drag edge to resize" },
                  { icon: "✕", label: "Double-click to delete" },
                ].map(({ icon, label }) => (
                  <span
                    key={label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      color: "#475569",
                      background: "#e3f3fa",
                      border: "1px solid #cfe6f0",
                      borderRadius: 16,
                      padding: "3px 10px",
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 700 }}>{icon}</span>
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── VIEW 1: TIMELINE GANTT (USER-FRIENDLY THICK BARS) ── */}
          <div
            style={{
              padding: "16px 20px 22px",
              background: "#eef9fe",
              display: chartMode === "timeline" ? "block" : "none",
            }}
          >
            <div
              ref={ganttRef}
              style={{
                width: "100%",
                height: 680,
                background: "#fff",
                border: "1px solid #cfe6f0",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
              }}
            />
          </div>

          {/* ── VIEW 2: MACHINE WORKLOAD (INTERACTIVE BAR GRAPH VIEW) ── */}
          {chartMode === "bargraph" && (
            <div style={{ padding: "20px 24px", background: "#eef9fe" }}>
              {/* Summary KPIs */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: "#fff", padding: "14px 18px", borderRadius: 12, border: "1px solid #cfe6f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#5f7487" }}>
                    Total Scheduled Jobs
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                    {totalFilteredSummary.jobs} WO
                  </div>
                </div>

                <div style={{ background: "#fff", padding: "14px 18px", borderRadius: 12, border: "1px solid #cfe6f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#5f7487" }}>
                    Total Machine Hours
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#3b6fa8", marginTop: 4 }}>
                    {totalFilteredSummary.hours.toFixed(1)} hrs
                  </div>
                </div>

                <div style={{ background: "#fff", padding: "14px 18px", borderRadius: 12, border: "1px solid #cfe6f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#5f7487" }}>
                    Total Production IMP
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                    {totalFilteredSummary.imp.toLocaleString()}
                  </div>
                </div>

                <div style={{ background: "#fff", padding: "14px 18px", borderRadius: 12, border: "1px solid #cfe6f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#5f7487" }}>
                    Active Machines
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                    {machineWorkloads.filter((m) => m.jobsCount > 0 || m.blockedHours > 0).length} / {machineWorkloads.length}
                  </div>
                </div>
              </div>

              {/* Bar Metric Selection Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                  Machine Workload Distribution
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", padding: 3, borderRadius: 8, border: "1px solid #b9d4e3" }}>
                  <button
                    onClick={() => setBarMetric("hours")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: barMetric === "hours" ? "#3b6fa8" : "transparent",
                      color: barMetric === "hours" ? "#fff" : "#5f7487",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    By Scheduled Hours
                  </button>
                  <button
                    onClick={() => setBarMetric("imp")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: barMetric === "imp" ? "#3b6fa8" : "transparent",
                      color: barMetric === "imp" ? "#fff" : "#5f7487",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    By Total Impressions
                  </button>
                  <button
                    onClick={() => setBarMetric("jobs")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: barMetric === "jobs" ? "#3b6fa8" : "transparent",
                      color: barMetric === "jobs" ? "#fff" : "#5f7487",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    By Job Count
                  </button>
                </div>
              </div>

              {/* The Visual Bar Graph Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {machineWorkloads.length === 0 ? (
                  <div style={{ background: "#fff", padding: 30, borderRadius: 12, textAlign: "center", color: "#5f7487" }}>
                    No machine workload matching the selected filters.
                  </div>
                ) : machineWorkloads.map((m) => {
                  const currentValue =
                    barMetric === "hours"
                      ? m.totalHours
                      : barMetric === "imp"
                        ? m.totalImp
                        : m.jobsCount;

                  const percent = Math.min(100, Math.round((currentValue / maxWorkloadValue) * 100));

                  return (
                    <div
                      key={m.machineId}
                      style={{
                        background: "#fff",
                        borderRadius: 12,
                        border: "1px solid #cfe6f0",
                        padding: "16px 20px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>⚙️</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                            {m.machineName}
                          </span>
                          {m.blockedHours > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: "#fee2e2",
                                color: "#dc2626",
                                fontWeight: 700,
                              }}
                            >
                              🚧 {m.blockedHours.toFixed(1)}h Blocked
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 12, color: "#5f7487" }}>
                            <b>{m.jobsCount}</b> Jobs · <b>{m.totalHours.toFixed(1)}</b> hrs · <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{m.totalImp.toLocaleString()} IMP</span>
                          </span>

                          <button
                            onClick={() => {
                              setMachineFilter(m.machineId);
                              setChartMode("timeline");
                            }}
                            style={{
                              padding: "4px 10px",
                              border: "1px solid #b9d4e3",
                              background: "#eef9fe",
                              borderRadius: 6,
                              fontSize: 11.5,
                              color: "#3b6fa8",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            title="Filter and open timeline for this machine"
                          >
                            Open Timeline ↗
                          </button>
                        </div>
                      </div>

                      {/* Bar Track & Progress Bar */}
                      <div
                        style={{
                          width: "100%",
                          height: 24,
                          background: "#e3f3fa",
                          borderRadius: 8,
                          overflow: "hidden",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${percent}%`,
                            background: "linear-gradient(90deg, #4b83b8 0%, #0284c7 100%)",
                            borderRadius: 8,
                            transition: "width 0.4s ease",
                          }}
                        />

                        {/* Value tag inside/over bar */}
                        <div
                          style={{
                            position: "absolute",
                            left: 12,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: percent > 18 ? "#fff" : "#334155",
                            textShadow: percent > 18 ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                          }}
                        >
                          {barMetric === "hours"
                            ? `${m.totalHours.toFixed(1)} hrs (${percent}%)`
                            : barMetric === "imp"
                              ? `${m.totalImp.toLocaleString()} IMP`
                              : `${m.jobsCount} Work Orders`}
                        </div>
                      </div>

                      {/* Bottom details & priority chips */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, color: "#5f7487" }}>Jobs priority breakdown:</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#fee2e2", color: "#dc2626", fontWeight: 700 }}>
                          🔴 {m.highCount} High
                        </span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#fef3c7", color: "#d97706", fontWeight: 700 }}>
                          🟠 {m.medCount} Med
                        </span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#dcfce7", color: "#16a34a", fontWeight: 700 }}>
                          🟢 {m.lowCount} Low
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default Scheduler;