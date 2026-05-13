import { useEffect, useRef, useState } from "react";
import "@fontsource/inter";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

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
   SCOPED STYLES  (injected once, removed on unmount)
───────────────────────────────────────────────────────── */
const STYLES = `

  .sch-root {
    --navy:   #0f1f3d;
    --navy2:  #1a3260;
    --blue:   #2563eb;
    --blue-l: #3b82f6;
    --teal:   #0d9488;
    --amber:  #d97706;
    --red:    #dc2626;
    --green:  #16a34a;
    --bg:     #f1f5f9;
    --surface:#ffffff;
    --border: #e2e8f0;
    --text:   #0f172a;
    --muted:  #64748b;
    font-family: 'Inter', sans-serif;
    background: var(--bg);
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
    gap: 14px;
    box-shadow: 0 4px 20px rgba(15,31,61,.35);
  }
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
    margin-left: auto;
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
    background: var(--surface);
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
  .sch-card-head.dark  { background: #1e293b;       color: #fff; }
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
  .wo-table thead tr { background: #f8fafc; }
  .wo-table th {
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .6px;
    color: var(--muted);
    border-bottom: 2px solid var(--border);
    white-space: nowrap;
  }
  .wo-table td {
    padding: 11px 14px;
    border-bottom: 1px solid #f1f5f9;
    color: var(--text);
    vertical-align: middle;
  }
  .wo-table tbody tr:hover { background: #f8faff; }
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
    padding: 40px;
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
  .form-field select {
    width: 100%;
    padding: 8px 11px;
    border: 1.5px solid var(--border);
    border-radius: 9px;
    font-size: 13.5px;
    font-family: 'Inter', sans-serif;
    color: var(--text);
    background: #f8fafc;
    transition: border .15s, background .15s;
    box-sizing: border-box;
  }
  .form-field input:focus,
  .form-field select:focus {
    outline: none;
    border-color: var(--blue);
    background: #fff;
  }
  .form-field input:disabled {
    background: #f1f5f9;
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
    background: #f1f5f9;
    color: var(--muted); border: 1.5px solid var(--border);
    padding: 9px 20px; border-radius: 9px;
    font-size: 13.5px; font-weight: 600;
    cursor: pointer; transition: background .15s;
  }
  .btn-cancel-form:hover { background: #e2e8f0; }

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
  .btn-clear-filter:hover { background: #f1f5f9; }

  /* ── GANTT SECTION ── */
  .gantt-header {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    padding: 14px 20px;
    display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
  .gantt-header-title {
    font-size: 15px; font-weight: 700; color: #fff;
  }
  .gantt-header-sub {
    font-size: 12px; color: rgba(255,255,255,.45); margin-left: 6px;
  }
  .gantt-legend {
    display: flex; align-items: center; gap: 18px;
    padding: 10px 20px;
    background: #f8fafc;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .legend-item {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--muted); font-weight: 500;
  }
  .legend-dot {
    width: 11px; height: 11px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .legend-sep {
    width: 1px; height: 16px;
    background: var(--border);
  }
  .gantt-hint-bar {
    background: #eff6ff;
    border-left: 3px solid var(--blue);
    padding: 8px 16px;
    font-size: 12.5px;
    color: #1d4ed8;
    display: flex; align-items: center; gap: 8px;
  }

  /* ── DHTMLX GANTT OVERRIDES ── */
  .gantt_task_line.normal-task {
    border-radius: 6px !important;
    border: none !important;
  }
  .gantt_task_line.block-task {
    background: #dc2626 !important;
    border-radius: 6px !important;
    border: none !important;
    opacity: .85;
  }
  .gantt_task_line .gantt_task_content {
    font-size: 12px !important;
    font-family: 'DM Sans', sans-serif !important;
    font-weight: 600 !important;
  }
  .gantt_grid_head_cell {
    font-size: 11.5px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: .4px !important;
    color: #475569 !important;
  }
  .gantt_row { border-bottom: 1px solid #f1f5f9 !important; }
  .gantt_row:hover { background: #f8faff !important; }
  .gantt_row.gantt_selected { background: #eff6ff !important; }
  .gantt_task_row { border-bottom: 1px solid #f1f5f9 !important; }
  .gantt_scale_cell { font-size: 12px !important; }
  .gantt_tooltip {
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,.15) !important;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 13px !important;
    border: none !important;
  }
`;

const Scheduler = () => {
  const ganttRef = useRef(null);

  const [workOrders, setWorkOrders] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [selectedWO, setSelectedWO] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [priority, setPriority] = useState("");
  const [machines, setMachines] =
  useState([]);
  const [capacity, setCapacity] = useState("");
  const [calculatedTime, setCalculatedTime] = useState("");
const [blockMachine, setBlockMachine] =
  useState("");

const [blockStart, setBlockStart] =
  useState("");

const [blockEnd, setBlockEnd] =
  useState("");

const [blockReason, setBlockReason] =
  useState("");
  /* inject / remove scoped CSS */
  useEffect(() => {
    const tag = document.createElement("style");
    tag.innerHTML = STYLES;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // =========================
  // INIT GANTT  (logic unchanged)
  // =========================
  useEffect(() => {
    if (!ganttRef.current) return;

    gantt.config.scale_unit = "day";
    gantt.config.subscales = [{ unit: "minute", step: 30, date: "%H:%i" }];
    gantt.config.date_scale = "%d %M";
    gantt.config.scale_height = 35;
    gantt.config.duration_unit = "minute";
    gantt.config.time_step = 1;
    gantt.config.round_dnd_dates = false;
    gantt.config.min_duration = 1 * 60 * 1000;
    gantt.config.row_height = 32;
    gantt.config.bar_height = 20;
    gantt.config.grid_width = 310;
    gantt.config.open_tree_initially = true;
    gantt.config.show_progress = false;
    gantt.config.drag_move = true;
    gantt.config.drag_resize = true;
    gantt.config.drag_progress = false;
    gantt.config.readonly = false;

    gantt.plugins({ tooltip: true });

    gantt.config.columns = [
      { name: "text", label: "Machine / Work Order", tree: true, width: 210, resize: true },
      {
        name: "scheduleDate", label: "Date", align: "center", width: 95,
        template: (task) => {
          if (task.isMachine) return "";
          if (!task.start_date) return "-";
          return gantt.date.date_to_str("%d-%m-%Y")(task.start_date);
        }
      },
      {
        name: "fromTime", label: "From", align: "center", width: 95,
        template: (task) => {
          if (task.isMachine) return "";
          if (!task.start_date) return "-";
          return gantt.date.date_to_str("%h:%i %A")(task.start_date);
        }
      },
      {
        name: "toTime", label: "To", align: "center", width: 95,
        template: (task) => {
          if (task.isMachine) return "";
          if (!task.end_date) return "-";
          return gantt.date.date_to_str("%h:%i %A")(task.end_date);
        }
      },
      {
        name: "duration", label: "Duration", align: "center", width: 100,
        template: (task) => {
          if (task.isMachine) return "";
          if (!task.start_date || !task.end_date) return "-";
          const totalMinutes = Math.round((new Date(task.end_date) - new Date(task.start_date)) / (1000 * 60));
          const hrs = Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          if (hrs === 0) return `${mins} min`;
          if (mins === 0) return `${hrs} hr`;
          return `${hrs} hr ${mins} min`;
        }
      }
    ];

    gantt.templates.tooltip_text = function (start, end, task) {
      const totalMinutes = Math.round((end - start) / (1000 * 60));
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      let dur = hrs === 0 ? `${mins} mins` : mins === 0 ? `${hrs} hrs` : `${hrs} hrs ${mins} mins`;
      return `
        <div style="padding:12px 14px;min-width:200px">
          <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#0f172a">${task.text}</div>
          <div style="font-size:12px;color:#475569;line-height:1.9">
            <b>Start:</b> ${gantt.date.date_to_str("%d %M %Y %h:%i %A")(start)}<br/>
            <b>End:</b> ${gantt.date.date_to_str("%d %M %Y %h:%i %A")(end)}<br/>
            <b>Duration:</b> ${dur}
          </div>
        </div>`;
    };

    gantt.templates.task_class = (start, end, task) => {
      if (task.isMachine) return "machine-row";
      if (task.color === "red") return "block-task";
      return "normal-task";
    };
gantt.detachAllEvents();
    gantt.init(ganttRef.current);
    gantt.config.smart_scales = false;
    

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
        if (String(t.parent) !== String(task.parent))
  return;

        const tStart = new Date(t.start_date);
        const tEnd = new Date(t.end_date);
        // 🚧 blocked machine conflict
if (
  t.color === "red" &&
  newStart < tEnd &&
  newEnd > tStart
) {
  hasConflict = true;
  return;
}

// normal WO conflict
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
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, Update"
      }).then((result) => {
        if (result.isConfirmed) updateScheduleTime(id, newStart, newEnd);
        else loadAllData();
      });
    });

    gantt.attachEvent("onTaskClick", (id) => {
      const task = gantt.getTask(id);
      if (task.isMachine) return true;
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

  // =========================
  // FILTER DATE EFFECTS  (logic unchanged)
  // =========================
  useEffect(() => { renderGantt(schedules); }, [filterDate]);

  useEffect(() => {
    const selectedDay = filterDate ? new Date(filterDate) : new Date();
    const start = new Date(selectedDay); start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDay); end.setHours(23, 59, 59, 999);
    gantt.config.start_date = start;
    gantt.config.end_date = end;
    gantt.render();
  }, [filterDate, schedules]);

  // =========================
  // LOAD ALL DATA  (logic unchanged)
  // =========================
  const loadAllData = async () => {
    try {
      const woRes = await axios.get(`${BASE_URL}/api/workorders`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const schRes = await axios.get(`${BASE_URL}/api/schedule`);
      const scheduledWOIds = (schRes.data || []).map((s) => s.workOrderId?._id);
      const plannedWO = (woRes.data || [])
        .filter((w) => w.status === "PLANNED" && !scheduledWOIds.includes(w._id))
        .map((wo) => ({
          ...wo,
          machineName: wo.machines?.[0]?.machineId?.machineName || wo.machines?.[0]?.machineName || "Machine Not Found",
          locationName: wo.location?.locationName || wo.location || "Location Not Found"
        }));
      setWorkOrders(plannedWO);
      setSchedules(schRes.data || []);
      renderGantt(schRes.data || []);
      const prRes = await axios.get(`${BASE_URL}/api/master/priorities`);
      setPriorities(prRes.data || []);
    } catch (err) { console.log(err); }
  };

  // =========================
  // RENDER GANTT  (logic unchanged)
  // =========================
  const renderGantt = (data) => {
    const tasks = [];
    const machineMap = {};
    filterSchedulesByDate(data).forEach((s) => {
      if (!s.startTime || !s.endTime) return;
      const machine = s.machineId?.machineName || "Machine";
      if (!machineMap[machine]) {
        machineMap[machine] = true;
        tasks.push({ id: `machine_${machine}`, text: machine, open: true, isMachine: true });
      }
      tasks.push({
        id: s._id,
        text: s.isBlocked ? `🚧 ${s.blockReason}` : `WO ${s.workOrderId?.efiWoNumber}`,
        start_date: new Date(s.startTime),
        end_date: new Date(s.endTime),
        duration: (new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60 * 60),
        parent: `machine_${machine}`,
        color: s.isBlocked ? "red" : s.priority === "HIGH" ? "#ff0000" : s.priority === "MEDIUM" ? "#ff9800" : "#28a745"
      });
    });
    gantt.clearAll();
    gantt.parse({ data: tasks });
  };

  // =========================
  // UPDATE SCHEDULE TIME  (logic unchanged)
  // =========================
  const updateScheduleTime = async (id, newStart, newEnd) => {
    try {
      await axios.put(
        `${BASE_URL}/api/schedule/${id}`,
        { startTime: newStart.toISOString(), endTime: newEnd.toISOString() },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      Swal.fire({ icon: "success", title: "Updated!", text: "Schedule time updated successfully.", confirmButtonColor: "#2563eb", timer: 2000, showConfirmButton: false });
      await loadAllData();
    } catch (err) {
      console.log(err);
      Swal.fire({ icon: "error", title: "Update Failed", text: err.response?.data?.message || "Could not update schedule.", confirmButtonColor: "#dc2626" });
      await loadAllData();
    }
  };

  // =========================
  // SELECT WO  (logic unchanged)
  // =========================
  const handleSelectWO = async (wo) => {
    setSelectedWO(wo);
    const machineId = wo.machines?.[0]?.machineId?._id || wo.machines?.[0]?.machineId;
    if (!machineId) { alert("Machine missing"); return; }
    try {
      const capRes = await axios.get(`${BASE_URL}/api/capacity/${machineId}`);
      const cap = capRes.data.capacityPerHour;
      setCapacity(cap);
      setCalculatedTime((wo.totalImp / cap).toFixed(2));
    } catch (err) {
      console.log(err);
      setCapacity("Not Set");
      setCalculatedTime("N/A");
    }
  };

  // =========================
  // CHECK CONFLICT  (logic unchanged)
  // =========================
  const checkConflict = async (machineId, startTime, durationHrs) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/schedule`);
      const start = new Date(startTime);
      const end = new Date(start.getTime() + durationHrs * 60 * 60 * 1000);
      return res.data.some((s) => {
        if (!s.startTime || !s.endTime) return false;
        return s.machineId?._id === machineId && start < new Date(s.endTime) && end > new Date(s.startTime);
      });
    } catch { return false; }
  };

  // =========================
  // FILTER BY DATE  (logic unchanged)
 const filterSchedulesByDate = (data) => {

  // ✅ selected date OR today
  const selected =
    filterDate
      ? new Date(filterDate)
      : new Date();

  const selectedDate =
    selected
      .toISOString()
      .split("T")[0];

  return data.filter((s) => {

    if (!s.startTime)
      return false;

    const schDate =
      new Date(s.startTime)
        .toISOString()
        .split("T")[0];

    return schDate === selectedDate;
  });
};

  // =========================
  // SAVE SCHEDULE  (logic unchanged)
  // =========================
  const saveSchedule = async () => {
    try {
      if (!selectedWO) return Swal.fire({ icon: "warning", title: "Missing Work Order", text: "Please select a work order" });
      if (!scheduleDate) return Swal.fire({ icon: "warning", title: "Missing Date", text: "Please select date and time" });
      if (!priority) return Swal.fire({ icon: "warning", title: "Missing Priority", text: "Please select priority" });
      const machineId = selectedWO.machines?.[0]?.machineId?._id || selectedWO.machines?.[0]?.machineId;
      const hasConflict = await checkConflict(machineId, scheduleDate, calculatedTime);
      if (hasConflict) return Swal.fire({ icon: "error", title: "Slot Occupied", text: "Selected time slot already occupied", confirmButtonColor: "#dc2626" });
      await axios.post(`${BASE_URL}/api/schedule/create`, { workOrderId: selectedWO._id, machineId, scheduleDate, priority });
      Swal.fire({ icon: "success", title: "Success", text: "Work Order Scheduled Successfully", confirmButtonColor: "#2563eb", timer: 2500, showConfirmButton: false });
      setWorkOrders((prev) => prev.filter((wo) => wo._id !== selectedWO._id));
      setSelectedWO(null); setScheduleDate(""); setPriority("");
      const schRes = await axios.get(`${BASE_URL}/api/schedule`);
      setSchedules(schRes.data || []);
      renderGantt(schRes.data || []);
    } catch (err) { console.log(err); alert(err.response?.data?.message || "Schedule failed"); }
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
      timer: 2000,
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
      text:
        err.response?.data?.message ||
        "Unable to block machine"
    });
  }
};

  // =========================
  // DELETE  (logic unchanged)
  // =========================
  const deleteSchedule = async (id) => {
    try {
      await axios.delete(`${BASE_URL}/api/schedule/${id}`);
      try { gantt.deleteTask(id); } catch (_) {}
      await loadAllData();
      Swal.fire({ icon: "success", title: "Deleted", timer: 1500, showConfirmButton: false });
    } catch (err) { console.log(err); alert(err.response?.data?.message || "Delete failed"); }
  };

  // =========================
  // FORMAT TIME
  // =========================
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
const downloadExcel = () => {

  const filtered =
    filterSchedulesByDate(schedules);

  const excelData =
    filtered.map((s) => ({

      "WO Number":
        s.workOrderId?.efiWoNumber,

      Machine:
        s.machineId?.machineName,

      Priority:
        s.priority,

      Start:
        new Date(
          s.startTime
        ).toLocaleString(),

      End:
        new Date(
          s.endTime
        ).toLocaleString(),

    Duration: (() => {

  const totalMinutes =
    Math.round(
      (
        new Date(s.endTime) -
        new Date(s.startTime)
      ) / (1000 * 60)
    );

  const hrs =
    Math.floor(totalMinutes / 60);

  const mins =
    totalMinutes % 60;

  if (hrs === 0)
    return `${mins} mins`;

  if (mins === 0)
    return `${hrs} hrs`;

  return `${hrs} hrs ${mins} mins`;

})(),
      Status:
        s.isBlocked
          ? "BLOCKED"
          : "SCHEDULED"
    }));

  const worksheet =
    XLSX.utils.json_to_sheet(
      excelData
    );

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Schedules"
  );

  const excelBuffer =
    XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array"
    });

  const fileData =
    new Blob(
      [excelBuffer],
      {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    );

  const fileName =
    `schedule_${
      filterDate || "today"
    }.xlsx`;

  saveAs(fileData, fileName);
};
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
          <p>Drag Gantt bars to reschedule · Click to delete</p>
        </div>
        <div className="sch-topbar-badge">
          <span></span>
          {workOrders.length} pending · {schedules.length} scheduled
        </div>
      </div>

      <div className="sch-body">

        {/* ── WORK ORDER TABLE ── */}
        <div className="sch-card">
          <div className="sch-card-head navy">
            <span>📋</span> Pending Work Orders
            <span className="head-count">{workOrders.length}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="wo-table">
              <thead>
                <tr>
                  <th>WO Number</th>
                  <th>Customer</th>
                  <th>Machine</th>
                  <th>Location</th>
                  <th>Total IMP</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>✅ All work orders are scheduled</td>
                  </tr>
                )}
                {workOrders.map((wo) => (
                  <tr key={wo._id}>
                    <td><span className="wo-num">{wo.efiWoNumber}</span></td>
                    <td>{wo.customer?.name || wo.customer}</td>
                    <td>{wo.machineName}</td>
                    <td>{wo.locationName}</td>
                    <td style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{wo.totalImp}</td>
                    <td>{priBadge(wo.priority)}</td>
                    <td>
                      <button
                        className="btn-sched"
                        onClick={() => {
                          handleSelectWO(wo);
                          setTimeout(() => {
                            document.getElementById("schedule-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 100);
                        }}
                      >
                         Schedule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SCHEDULE FORM ── */}
        {selectedWO && (
          <div id="schedule-form" className="sch-card" style={{ borderLeft: "4px solid #2563eb" }}>
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
                  <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={{ background: "#fff" }} />
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
       <div className="sch-card">

  <div className="sch-card-head teal">
    <span>🚧</span>
    Block Machine
  </div>

  <div className="sch-card-body">

    <div className="form-grid">

      <div className="form-field">
        <label>Machine</label>

        <select
          value={blockMachine}
          onChange={(e) =>
            setBlockMachine(e.target.value)
          }
        >
          <option value="">
            Select Machine
          </option>

        {Array.from(
  new Map(
    schedules.map((s) => [
      s.machineId?._id,
      s.machineId
    ])
  ).values()
).map((m) => (

  <option
    key={m._id}
    value={m._id}
  >
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
          onChange={(e) =>
            setBlockStart(e.target.value)
          }
        />
      </div>

      <div className="form-field">
        <label>Block End</label>

        <input
          type="datetime-local"
          value={blockEnd}
          onChange={(e) =>
            setBlockEnd(e.target.value)
          }
        />
      </div>

      <div className="form-field">
        <label>Reason</label>

        <input
          type="text"
          placeholder="Maintenance / Breakdown"
          value={blockReason}
          onChange={(e) =>
            setBlockReason(e.target.value)
          }
        />
      </div>

    </div>

    <div className="form-actions">

      <button
        className="btn-save"
        onClick={saveBlockMachine}
      >
        🚧 Block Machine
      </button>

    </div>

  </div>

</div>
      {/* ── GANTT CARD ── */}
<div
  className="sch-card"
  style={{
    overflow: "hidden",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px 0 rgba(30,41,59,0.07)",
    background: "#fff",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  }}
>

  {/* ── Header ── */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "16px 20px",
      borderBottom: "1px solid #e2e8f0",
      background: "#f8fafc",
    }}
  >
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: "#eff6ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="3" rx="1.5"/>
        <rect x="3" y="10.5" width="12" height="3" rx="1.5"/>
        <rect x="3" y="17" width="15" height="3" rx="1.5"/>
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em" }}>
          Production Gantt Chart
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#64748b",
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: 20,
            padding: "2px 9px",
            whiteSpace: "nowrap",
          }}
        >
          Drag · Resize · Delete
        </span>
      </div>
    </div>
  </div>

  {/* ── Filter row ── */}
  <div
    style={{
      padding: "11px 20px",
      borderBottom: "1px solid #e2e8f0",
      background: "#fff",
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

      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            gap: 5,
            whiteSpace: "nowrap",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Filter by date
        </span>

        <input
          type="date"
          className="filter-input border-dark"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{
            height: 32,
            padding: "0 10px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontSize: 12,
            color: "#0f172a",
            background: "#f8fafc",
            outline: "none",
            cursor: "pointer",
          }}
        />

        {filterDate ? (
          <button
            className="btn-clear-filter"
            onClick={() => setFilterDate("")}
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 12,
              color: "#ddcdca",
              background: "#da520f",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 500,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Clear
          </button>
        ) : (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            Showing today's schedules
          </span>
        )}
      </div>

      {/* Right */}
      <button
        onClick={downloadExcel}
        style={{
          height: 32,
          padding: "0 14px",
          background: "#16a34a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download Excel
      </button>

    </div>
  </div>

  {/* ── Legend ── */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "9px 20px",
      borderBottom: "1px solid #e2e8f0",
      background: "#f8fafc",
      flexWrap: "wrap",
    }}
  >
    {[
      { icon: "↔", label: "Drag to move" },
      { icon: "⇔", label: "Drag edge to resize" },
      { icon: "✕", label: "Click to delete" },
    ].map(({ icon, label }) => (
      <span
        key={label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          color: "#64748b",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 20,
          padding: "3px 10px",
          fontWeight: 500,
        }}
      >
        <span style={{ fontSize: 12, opacity: 0.7 }}>{icon}</span>
        {label}
      </span>
    ))}
  </div>

  {/* ── Info hint ── */}
  <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 9,
      padding: "10px 20px",
      background: "#eff6ff",
      borderBottom: "1px solid #bfdbfe",
    }}
  >
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "#3b82f6",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      i
    </div>
    <p
      style={{
        margin: 0,
        fontSize: 12,
        color: "#1e40af",
        lineHeight: 1.55,
      }}
    >
      Drag any bar left or right to change the scheduled time. Drag the right edge to extend or shorten duration. Changes are saved after confirmation.
    </p>
  </div>

  {/* ── Gantt canvas ── */}
  <div style={{ padding: "16px 20px 20px" }}>
    <div
      ref={ganttRef}
      style={{
        width: "100%",
        height: 650,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
      }}
    />
  </div>

</div>

      </div>
    </div>
  );
};

export default Scheduler;