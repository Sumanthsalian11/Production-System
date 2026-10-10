import { useEffect, useRef, useState, useCallback } from "react";
import { Chart } from "chart.js/auto";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";

const DASHBOARD_STYLES = `
.inv-dash {
  background-color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  min-height: 100vh;
  color: #0f172a;
}

/* Header */
.inv-dash .dashboard-header {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

/* Section Header Typography */
.inv-dash .section-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}
.inv-dash .section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

/* 1. Filter Grid */
.inv-dash .filter-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 10px 16px 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}
.inv-dash .filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px 12px;
}
.inv-dash .dropdown-menu-checkbox {
  position: absolute; top: calc(100% + 4px); left: 0; z-index: 100; max-height: 280px; overflow-y: auto;
  width: 100%; min-width: 240px; padding: 10px 12px; background: #ffffff;
  border: 1px solid #cbd5e1; border-radius: 10px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  display: none;
}
.inv-dash .dropdown-menu-checkbox.show { display: block; }
.inv-dash .dropdown-menu-checkbox::-webkit-scrollbar { width: 5px; }
.inv-dash .dropdown-menu-checkbox::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.inv-dash .upload-item:hover,
.inv-dash .upload-item:hover * { color: #ef4444 !important; }
.inv-dash .batch-toggle-btn:hover,
.inv-dash .batch-toggle-btn:focus,
.inv-dash .batch-toggle-btn:active {
  background-color: #ffffff !important;
  color: #0f172a !important;
  border-color: #94a3b8 !important;
}

/* 2. KPI Metric Grid */
.inv-dash .kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.inv-dash .card-kpi {
  border: 1px solid #e2e8f0;
  border-top: 4px solid;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  background: #ffffff;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.inv-dash .card-kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.05);
}
.inv-dash .kpi-total { border-top-color: #2563eb; }
.inv-dash .kpi-regular { border-top-color: #10b981; }
.inv-dash .kpi-slow { border-top-color: #f59e0b; }
.inv-dash .kpi-nonmoving { border-top-color: #ef4444; }

/* 3. Charts & Analytics Grid */
.inv-dash .analytics-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
}
@media (max-width: 992px) {
  .inv-dash .analytics-grid {
    grid-template-columns: 1fr;
  }
}
.inv-dash .chart-box {
  background: #ffffff;
  border-radius: 12px;
  padding: 18px 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.inv-dash .chart-container {
  position: relative;
  width: 100%;
  height: 250px;
  flex: 1;
}

/* 4. Watchlist Grid */
.inv-dash .watchlist-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 992px) {
  .inv-dash .watchlist-grid {
    grid-template-columns: 1fr;
  }
}
.inv-dash .table-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 18px 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

/* Ledger & Tables */
.inv-dash .table-responsive { width: 100%; -webkit-overflow-scrolling: touch; }
.inv-dash .table-responsive::-webkit-scrollbar { height: 6px; width: 6px; }
.inv-dash .table-responsive::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.inv-dash .sort-header { cursor: pointer; user-select: none; white-space: nowrap; transition: background 0.15s ease; }
.inv-dash .sort-header:hover { background-color: #f1f5f9; color: #2563eb; }

/* Utilities */
.inv-dash .extra-small { font-size: 0.75rem; }
.inv-dash .loading-spinner { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 70vh; }
.inv-dash .comment-bubble {
  background: #f8fafc; border-left: 4px solid #2563eb; padding: 10px 14px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e2e8f0;
}
.inv-dash .inv-modal-backdrop {
  display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 1050;
  align-items: center; justify-content: center; padding: 16px;
}
.inv-dash .inv-modal-backdrop.show-modal { display: flex; }
.inv-dash .inv-modal {
  background: #ffffff; border-radius: 16px; width: 100%; max-width: 440px; box-shadow: 0 20px 30px -10px rgba(0,0,0,0.25);
  overflow: hidden; border: 1px solid #cbd5e1;
}
.inv-dash .inv-modal-lg { max-width: 620px; }
.inv-dash .inv-modal .modal-header {
  display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;
}
.inv-dash .inv-modal .modal-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid #f1f5f9; background: #f8fafc;
}
.inv-dash .inv-modal .modal-body { padding: 20px; }
.inv-dash .table-card.is-loading { opacity: 0.55; pointer-events: none; }

/* ===== Aqua-glass theme (same as Reel Register) ===== */
.inv-dash {
  color: #0b2f4f;
  background:
    radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 30%),
    radial-gradient(circle at 88% 18%, rgba(160, 222, 250, 0.7) 0, rgba(160, 222, 250, 0) 32%),
    radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
    linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%);
  background-attachment: fixed;
}
.inv-dash .text-muted { color: #4a6f8c !important; }
.inv-dash .text-dark { color: #0b2f4f !important; }

/* glass cards */
.inv-dash .filter-card,
.inv-dash .card-kpi,
.inv-dash .chart-box,
.inv-dash .table-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(228, 246, 255, 0.9) 100%);
  border-radius: 22px;
  box-shadow: 0 14px 32px rgba(40, 120, 170, 0.16), inset 0 1px 0 #fff;
}
.inv-dash .filter-card,
.inv-dash .chart-box,
.inv-dash .table-card { border: 1px solid rgba(255, 255, 255, 0.95); }
.inv-dash .card-kpi { border-color: #cfe8f6; border-top-width: 4px; }
.inv-dash .card-kpi.kpi-total { border-top-color: #1b8fd6; }
.inv-dash .card-kpi.kpi-regular { border-top-color: #10b981; }
.inv-dash .card-kpi.kpi-slow { border-top-color: #f59e0b; }
.inv-dash .card-kpi.kpi-nonmoving { border-top-color: #ef4444; }

/* section headings */
.inv-dash .section-title-wrap { border-bottom-color: #a6d6ee; }
.inv-dash .section-title { color: #0a4f8c; }
.inv-dash .badge.text-bg-light {
  background: linear-gradient(180deg, #ffffff, #d4f0fd) !important;
  color: #0a4f8c !important;
  border-color: #a6d6ee !important;
}

/* tables: light aqua headers */
.inv-dash .table {
  --bs-table-bg: transparent;
  --bs-table-striped-bg: #f3faff;
  --bs-table-hover-bg: #d9f2fc;
  --bs-table-color: #0b2f4f;
  --bs-table-border-color: #dcecf6;
}
.inv-dash .table-light {
  --bs-table-bg: #e3f3fc;
  --bs-table-color: #0a4f8c;
  --bs-table-border-color: #bfe0f2;
}
.inv-dash .table thead th {
  background: linear-gradient(180deg, #f4fbff 0%, #d9eefb 100%) !important;
  color: #0a4f8c !important;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border-bottom: 2px solid #9ccbe6 !important;
}
.inv-dash .table-responsive.border { border-color: #a9d9f2 !important; background: #fff; }
.inv-dash .sort-header:hover { background: #e3f3fc !important; color: #0a5fa8 !important; }

/* filter dropdown buttons (the red "None Selected" border is kept) */
.inv-dash .filter-grid .dropdown > .btn:not([style*="ef4444"]) {
  border: 1.5px solid #9ccbe6 !important;
  border-radius: 12px !important;
  box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1);
}
.inv-dash .dropdown-menu-checkbox { border: 1.5px solid #a6d6ee; border-radius: 16px; background: linear-gradient(180deg, #ffffff 0%, #eaf8ff 100%); }
.inv-dash .dropdown-menu-checkbox::-webkit-scrollbar-thumb,
.inv-dash .table-responsive::-webkit-scrollbar-thumb { background: #84b5ce; }

/* inputs */
.inv-dash .form-control {
  border: 1.5px solid #9ccbe6;
  border-radius: 12px !important;
  color: #0b2f4f;
  font-weight: 600;
  box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1);
}
.inv-dash .form-control:focus { border-color: #1b9be0; box-shadow: 0 0 0 4px rgba(27, 155, 224, 0.2); }

/* buttons */
.inv-dash .btn { font-weight: 800; border-radius: 12px !important; transition: all 0.15s ease; }
.inv-dash .btn:not(.btn-link):not(.btn-close):hover { transform: translateY(-1px); }
.inv-dash .btn-primary {
  background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%); color: #08406b; border: 1px solid #7fc3e8;
  box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40, 120, 170, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
}
.inv-dash .btn-primary:hover, .inv-dash .btn-primary:focus, .inv-dash .btn-primary:active {
  background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%); color: #08406b; border-color: #7fc3e8; filter: brightness(1.04);
}
.inv-dash .btn-success {
  background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%); color: #07583b; border: 1px solid #7fd3ab;
  box-shadow: 0 3px 0 #84cba9, 0 7px 12px rgba(20, 168, 112, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
}
.inv-dash .btn-success:hover, .inv-dash .btn-success:focus, .inv-dash .btn-success:active {
  background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%); color: #07583b; border-color: #7fd3ab; filter: brightness(1.04);
}
.inv-dash .btn-danger {
  background: linear-gradient(180deg, #ffdcdc 0%, #f7a3a3 100%); color: #8f1414; border: 1px solid #ee8f8f;
  box-shadow: 0 3px 0 #e08a8a, inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.inv-dash .btn-light,
.inv-dash .btn-outline-secondary,
.inv-dash .btn-outline-primary {
  background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%) !important; color: #08406b; border: 1px solid #9fcfe9;
  box-shadow: 0 3px 0 #b3dcf0, inset 0 1px 0 #fff;
}
.inv-dash .btn:disabled { opacity: 0.5; }

/* modals */
.inv-dash .inv-modal { background: linear-gradient(180deg, #ffffff 0%, #e8f6fe 100%); border: 1px solid #fff; border-radius: 22px; }
.inv-dash .inv-modal .modal-header,
.inv-dash .inv-modal .modal-footer { background: rgba(214, 239, 252, 0.55); border-color: #cfe8f6; }
.inv-dash .comment-bubble { background: #f3faff; border-color: #cfe8f6; border-left-color: #1b8fd6; }
.inv-dash .progress { background: #dff1fb; }
`;

const API_BASE = `${BASE_URL}/api/inventory-dashboard`;
const MOVEMENT_OPTIONS = ["Regular Moving", "Slow Moving", "Non Moving"];
const PAGE_SIZE = 50;
const DEBOUNCE_MS = 350;

function formatVal(num) {
  return "\u20B9" + Number(num || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function InventoryDashboard() {
  const token = localStorage.getItem("token");
  const [loggedInUser, setLoggedInUser] = useState("");

  const [loading, setLoading] = useState(true); // initial shell load only
  const [loaderText, setLoaderText] = useState("Loading Inventory Data...");

  const [plantOptions, setPlantOptions] = useState([]);
  const [reqOptions, setReqOptions] = useState([]);
  const [matTypeOptions, setMatTypeOptions] = useState([]);
  const [matGrpOptions, setMatGrpOptions] = useState([]);

  const [selPlants, setSelPlants] = useState([]);
  const [selReqs, setSelReqs] = useState([]);
  const [selTypes, setSelTypes] = useState([]);
  const [selGrps, setSelGrps] = useState([]);
  const [selMovements, setSelMovements] = useState(MOVEMENT_OPTIONS);

  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState("totalVal");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  const [kpi, setKpi] = useState({ total: 0, reg: 0, slow: 0, non: 0, count: 0 });
  const [byRequisitioner, setByRequisitioner] = useState([]);
  const [byMatType, setByMatType] = useState([]);
  const [ageing, setAgeing] = useState({ a0: 0, a1: 0, a2: 0, a3: 0 });
  const [topNonMoving, setTopNonMoving] = useState([]);
  const [topSlowMoving, setTopSlowMoving] = useState([]);

  const [tableRows, setTableRows] = useState([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);

  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null); // null = All Uploads
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [activeCode, setActiveCode] = useState("");
  const [newCommentText, setNewCommentText] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null); // { id, filename } | null

  const [openDropdown, setOpenDropdown] = useState(null);

  const reqChartRef = useRef(null);
  const matTypeChartRef = useRef(null);
  const ageingChartRef = useRef(null);
  const movementChartRef = useRef(null);
  const chartInstances = useRef({});

  const aggregateAbortRef = useRef(null);
  const tableAbortRef = useRef(null);
  const aggDebounceRef = useRef(null);
  const tableDebounceRef = useRef(null);

  // ---------- Initial load: filter options only, never the full dataset ----------
  const loadBatches = useCallback(() => {
    fetch(`${API_BASE}/uploads`, { cache: "no-store" })
      .then((res) => res.json())
      .then((res) => setBatches(res.batches || []))
      .catch((err) => console.error(err));
  }, []);

  const loadFilterOptions = useCallback(() => {
    setLoaderText("Loading Inventory Data...");
    setLoading(true);
    const qs = selectedBatch ? `?batchId=${selectedBatch}` : "";
    fetch(`${API_BASE}/filter-options${qs}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load filter options");
        return res.json();
      })
      .then((res) => {
        setPlantOptions(res.plants);
        setReqOptions(res.reqs);
        setMatTypeOptions(res.types);
        setMatGrpOptions(res.grps);
        setSelPlants(res.plants);
        setSelReqs(res.reqs);
        setSelTypes(res.types);
        setSelGrps(res.grps);
        setSelMovements(MOVEMENT_OPTIONS);
        setPage(1);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        alert("Error loading data: " + err.message);
        setLoading(false);
      });
  }, [selectedBatch]);

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name);
    }
  }, [token]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // ---------- Shared filter payload ----------
  function buildFilterBody() {
    const body = {};
    if (selectedBatch) body.batchId = selectedBatch;
    if (selPlants.length !== plantOptions.length) body.plants = selPlants;
    if (selReqs.length !== reqOptions.length) body.reqs = selReqs;
    if (selTypes.length !== matTypeOptions.length) body.types = selTypes;
    if (selGrps.length !== matGrpOptions.length) body.grps = selGrps;
    if (selMovements.length !== MOVEMENT_OPTIONS.length) body.movements = selMovements;
    return body;
  }

  function resetAllFilters() {
    setSelPlants(plantOptions);
    setSelReqs(reqOptions);
    setSelTypes(matTypeOptions);
    setSelGrps(matGrpOptions);
    setSelMovements(MOVEMENT_OPTIONS);
    setSearch("");
    setSortColumn("totalVal");
    setSortAsc(false);
  }

  function toggleValue(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function deleteBatch(id, filename) {
    setDeleteTarget({ id, filename });
  }

  function confirmDeleteBatch() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    fetch(`${API_BASE}/uploads/${id}`, { method: "DELETE" })
      .then((res) => res.json())
      .then((res) => {
        setDeleteTarget(null);
        if (res.success) {
          if (selectedBatch === id) setSelectedBatch(null);
          loadBatches();
          loadFilterOptions();
        } else {
          alert("Error deleting file: " + res.message);
        }
      })
      .catch((err) => {
        setDeleteTarget(null);
        alert("Error deleting file: " + err.message);
      });
  }

  function labelFor(selected, allCount, allText) {
    if (selected.length === 0) return "None Selected";
    if (selected.length === allCount) return allText;
    if (selected.length <= 2) return selected.join(", ");
    return `${selected.length} Selected`;
  }

  // Any filter/search/sort change snaps back to page 1
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch, selPlants, selReqs, selTypes, selGrps, selMovements, search, sortColumn, sortAsc]);

  // ---------- KPIs + charts + leaderboards: debounced aggregate call ----------
  useEffect(() => {
    if (loading) return;
    if (aggDebounceRef.current) clearTimeout(aggDebounceRef.current);
    aggDebounceRef.current = setTimeout(() => {
      if (aggregateAbortRef.current) aggregateAbortRef.current.abort();
      const controller = new AbortController();
      aggregateAbortRef.current = controller;

      fetch(`${API_BASE}/aggregate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildFilterBody()),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((res) => {
          setKpi(res.kpi);
          setByRequisitioner(res.byRequisitioner);
          setByMatType(res.byMatType);
          setAgeing(res.ageing);
          setTopNonMoving(res.topNonMoving);
          setTopSlowMoving(res.topSlowMoving);
        })
        .catch((err) => {
          if (err.name !== "AbortError") console.error(err);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(aggDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, selectedBatch, selPlants, selReqs, selTypes, selGrps, selMovements]);

  // ---------- Ledger table: server-side filter + search + sort + page ----------
  useEffect(() => {
    if (loading) return;
    if (tableDebounceRef.current) clearTimeout(tableDebounceRef.current);
    tableDebounceRef.current = setTimeout(() => {
      if (tableAbortRef.current) tableAbortRef.current.abort();
      const controller = new AbortController();
      tableAbortRef.current = controller;
      setTableLoading(true);

      fetch(`${API_BASE}/table`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildFilterBody(), search, sortColumn, sortAsc, page, pageSize: PAGE_SIZE }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((res) => {
          setTableRows(res.rows);
          setTableTotal(res.total);
          setTableLoading(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setTableLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(tableDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, selectedBatch, selPlants, selReqs, selTypes, selGrps, selMovements, search, sortColumn, sortAsc, page]);

  const baseVal = kpi.total || 1;
  const totalPages = Math.max(1, Math.ceil(tableTotal / PAGE_SIZE));

  // ---------- Charts (Built from small aggregate payload) ----------
  useEffect(() => {
    if (loading) return;
    const destroy = (key) => { if (chartInstances.current[key]) chartInstances.current[key].destroy(); };
    const make = (key, canvasRef, type, data, extraOpts = {}) => {
      destroy(key);
      if (!canvasRef.current) return;
      chartInstances.current[key] = new Chart(canvasRef.current.getContext("2d"), {
        type, data,
        options: Object.assign(
          {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: "bottom",
                labels: { boxWidth: 12, padding: 12, font: { size: 11, family: "inherit" } }
              }
            }
          },
          extraOpts
        ),
      });
    };

    make("req", reqChartRef, "bar", {
      labels: byRequisitioner.map((x) => x.label),
      datasets: [{
        label: "Value (\u20B9)",
        data: byRequisitioner.map((x) => x.val),
        backgroundColor: "#2563eb",
        borderRadius: 4
      }],
    }, { indexAxis: "y" });

    make("matType", matTypeChartRef, "doughnut", {
      labels: byMatType.map((x) => x.label),
      datasets: [{
        data: byMatType.map((x) => x.val),
        backgroundColor: ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"],
        borderWidth: 2,
        borderColor: "#ffffff"
      }],
    });

    make("ageing", ageingChartRef, "bar", {
      labels: ["0-90D", "90-180D", "180-365D", ">365D"],
      datasets: [{
        label: "Valuation",
        data: [ageing.a0, ageing.a1, ageing.a2, ageing.a3],
        backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
        borderRadius: 4
      }],
    });

    make("movement", movementChartRef, "pie", {
      labels: ["Regular", "Slow", "Non Moving"],
      datasets: [{
        data: [kpi.reg, kpi.slow, kpi.non],
        backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
        borderWidth: 2,
        borderColor: "#ffffff"
      }],
    });

    return () => { Object.values(chartInstances.current).forEach((c) => c && c.destroy()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, byRequisitioner, byMatType, ageing, kpi.reg, kpi.slow, kpi.non]);

  // ---------- Upload ----------
  function processFileUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadStatus({ type: "danger", text: "Select an Excel file first." });
      return;
    }
    setUploading(true);
    setUploadStatus({ type: "primary", text: "Uploading report..." });

    const formData = new FormData();
    formData.append("file", file);

    fetch(`${API_BASE}/upload`, { method: "POST", body: formData })
      .then(async (res) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`Server returned ${res.status} ${res.statusText}. ${text.replace(/<[^>]*>/g, " ").trim().slice(0, 150)}`);
        }
      })
      .then((res) => {
        if (res.success) {
          setUploadStatus({ type: "success", text: "Reloading..." });
          setTimeout(() => {
            setUploading(false);
            setUploadStatus(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedBatch(String(res.batchId));
            loadBatches();
          }, 800);
        } else {
          setUploading(false);
          setUploadStatus({ type: "danger", text: "Error: " + res.message });
        }
      })
      .catch((err) => {
        setUploading(false);
        setUploadStatus({ type: "danger", text: "Failed: " + err.message });
      });
  }

  // ---------- Comments ----------
  function openCommentModal(row) {
    setActiveId(row.id);
    setActiveCode(row.code);
    setNewCommentText("");
    setCommentModalOpen(true);
  }

  function submitComment() {
    const text = newCommentText.trim();
    if (!text) return;
    fetch(`${API_BASE}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeId, text, user: loggedInUser || "Dashboard User" }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setTableRows((prev) =>
            prev.map((r) => (r.code === activeCode ? { ...r, comments: [...(r.comments || []), res.comment] } : r))
          );
          setNewCommentText("");
        } else {
          alert("Error saving comment: " + res.message);
        }
      })
      .catch((err) => alert("Error saving comment: " + err.message));
  }

  const activeItem = tableRows.find((r) => r.id === activeId);

  function sortLedger(col) {
    if (sortColumn === col) setSortAsc((v) => !v);
    else { setSortColumn(col); setSortAsc(true); }
  }
  const sortIcon = (col) => (col === sortColumn ? (sortAsc ? "\u25B2" : "\u25BC") : "\u2195");

  function badgeClass(status) {
    if (status === "Non Moving") return "bg-danger-subtle text-danger border border-danger-subtle";
    if (status === "Slow Moving") return "bg-warning-subtle text-warning border border-warning-subtle";
    return "bg-success-subtle text-success border border-success-subtle";
  }

  return (
    <div className="inv-dash">
      <style>{DASHBOARD_STYLES}</style>


      {/* BODY CONTENT */}
      <div className="container-fluid px-3 px-md-4 pt-3 pb-4">
        {loading && (
          <div className="loading-spinner">
            <div className="spinner-border text-primary" role="status" style={{ width: "3.2rem", height: "3.2rem", borderWidth: 3 }}></div>
            <p className="text-muted mt-3 fw-semibold small">{loaderText}</p>
          </div>
        )}

        {/* UPLOAD MODAL */}
        <div id="invUploadModal" className="inv-modal-backdrop">
          <div className="inv-modal">
            <div className="modal-header">
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-cloud-arrow-up text-primary fs-6"></i>
                <h6 className="fw-bold mb-0 text-dark">Upload Report (.xlsx / .xls)</h6>
              </div>
              <button type="button" className="btn-close" onClick={() => document.getElementById("invUploadModal").classList.remove("show-modal")}></button>
            </div>
            <div className="modal-body">
              <label className="form-label extra-small fw-bold text-secondary text-uppercase mb-2">Select Spreadsheet</label>
              <input ref={fileInputRef} className="form-control form-control-sm" type="file" accept=".xlsx,.xls" style={{ borderRadius: 8 }} />
              {uploadStatus && (
                <div className={`extra-small fw-semibold mt-3 p-2 rounded text-${uploadStatus.type} bg-${uploadStatus.type}-subtle border border-${uploadStatus.type}-subtle`}>
                  {uploadStatus.text}
                </div>
              )}
            </div>
            <div className="modal-footer py-2">
              <button className="btn btn-light btn-sm border px-3" style={{ borderRadius: 6 }} onClick={() => document.getElementById("invUploadModal").classList.remove("show-modal")}>Cancel</button>
              <button className="btn btn-primary btn-sm px-3 fw-semibold" style={{ borderRadius: 6 }} onClick={processFileUpload} disabled={uploading}>
                <i className="fa-solid fa-upload me-1"></i> {uploading ? "Processing..." : "Upload & Process"}
              </button>
            </div>
          </div>
        </div>

        {/* COMMENT MODAL */}
        {commentModalOpen && (
          <div className="inv-modal-backdrop show-modal">
            <div className="inv-modal inv-modal-lg">
              <div className="modal-header">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-comments text-primary fs-6"></i>
                  <h6 className="fw-bold mb-0 text-dark">Material Audit Trail & Comments</h6>
                </div>
                <button type="button" className="btn-close" onClick={() => setCommentModalOpen(false)}></button>
              </div>
              <div className="modal-body">
                <div className="p-2 mb-3 rounded bg-light border d-flex align-items-center gap-2">
                  <span className="badge bg-primary px-2 py-1 font-monospace">{activeItem?.code}</span>
                  <span className="fw-semibold text-dark extra-small text-truncate">{activeItem?.desc}</span>
                </div>
                <div className="mb-3">
                  <label className="form-label extra-small fw-bold text-secondary text-uppercase mb-1">Add Status Update or Note</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows="2"
                    placeholder="Enter action note, disposition, or review status..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    style={{ borderRadius: 8 }}
                  ></textarea>
                  <div className="text-end mt-2">
                    <button className="btn btn-primary btn-sm px-3 fw-semibold" style={{ borderRadius: 6 }} onClick={submitComment}>
                      <i className="fa-solid fa-paper-plane me-1"></i> Save Comment
                    </button>
                  </div>
                </div>
                <hr className="text-secondary opacity-25 my-3" />
                <h6 className="fw-bold extra-small text-secondary text-uppercase mb-2">Comment History</h6>
                <div style={{ maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                  {!(activeItem?.comments || []).length && (
                    <div className="text-center text-muted extra-small py-3 border rounded bg-light">
                      No comments recorded yet for this material.
                    </div>
                  )}
                  {(activeItem?.comments || []).slice().reverse().map((c, i) => (
                    <div className="comment-bubble" key={i}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-bold extra-small text-primary d-inline-flex align-items-center gap-1">
                          👤 {c.user || "User"}
                        </span>
                        <span className="text-muted extra-small font-monospace">
                          <i className="fa-regular fa-clock me-1"></i>{c.timestamp}
                        </span>
                      </div>
                      <div className="extra-small text-dark" style={{ lineHeight: 1.5 }}>{c.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DELETE CONFIRM MODAL */}
        {deleteTarget && (
          <div className="inv-modal-backdrop show-modal">
            <div className="inv-modal">
              <div className="modal-header">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation text-danger fs-6"></i>
                  <h6 className="fw-bold text-dark mb-0">Delete Uploaded Batch</h6>
                </div>
                <button type="button" className="btn-close" onClick={() => setDeleteTarget(null)}></button>
              </div>
              <div className="modal-body">
                <p className="mb-1 small text-dark">
                  Are you sure you want to delete all records associated with:
                </p>
                <div className="p-2 my-2 rounded bg-danger-subtle border border-danger-subtle font-monospace extra-small fw-bold text-danger text-truncate">
                  {deleteTarget.filename}
                </div>
                <p className="extra-small text-muted mb-0">
                  This action cannot be undone and will recalculate all KPI metrics.
                </p>
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-light btn-sm border px-3" style={{ borderRadius: 6 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger btn-sm px-3 fw-semibold" style={{ borderRadius: 6 }} onClick={confirmDeleteBatch}>
                  <i className="fa-solid fa-trash me-1"></i> Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <div id="dashboard-content">
            {/* ================= SECTION 0: FILTERS DOCK ================= */}
            <div className="filter-card mb-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-filter text-primary"></i>
                  <span className="fw-bold text-dark small">Multi-Dimension Filters</span>
                </div>

                <div className="d-flex flex-wrap gap-2 align-items-center">
                  {/* Uploads Dropdown */}
                  <div className="dropdown">
                    <button
                      className="btn btn-outline-secondary btn-sm px-3 d-inline-flex align-items-center gap-2 fw-medium batch-toggle-btn"
                      type="button"
                      style={{ borderRadius: 8, background: "#ffffff" }}
                      onClick={() => setBatchDropdownOpen((v) => !v)}
                    >
                      <i className="fa-solid fa-folder-open text-primary"></i>
                      <span className="text-truncate" style={{ maxWidth: 160 }}>
                        {selectedBatch
                          ? batches.find((b) => b.id === selectedBatch)?.filename || "Selected File"
                          : "All Uploads"}
                      </span>
                      <i className="fa-solid fa-chevron-down extra-small text-muted"></i>
                    </button>

                    {batchDropdownOpen && (
                      <div className="dropdown-menu-checkbox shadow show" style={{ minWidth: 280, right: 0, left: "auto" }}>
                        <div
                          className="extra-small py-2 px-2 fw-bold text-primary d-flex align-items-center gap-2 rounded upload-item"
                          style={{ cursor: "pointer", background: selectedBatch === null ? "#eff6ff" : "transparent" }}
                          onClick={() => { setSelectedBatch(null); setBatchDropdownOpen(false); }}
                        >
                          <i className="fa-solid fa-layer-group"></i> All Uploaded Datasets
                        </div>
                        <hr className="my-1 text-secondary opacity-25" />
                        {batches.map((b) => (
                          <div
                            key={b.id}
                            className="d-flex align-items-center justify-content-between py-1 px-2 extra-small rounded"
                            style={{
                              background: selectedBatch === b.id ? "#eff6ff" : "transparent",
                              transition: "background 0.1s ease"
                            }}
                          >
                            <span
                              className="text-truncate upload-item"
                              style={{ cursor: "pointer", maxWidth: 200, fontWeight: selectedBatch === b.id ? 700 : 500 }}
                              onClick={() => { setSelectedBatch(b.id); setBatchDropdownOpen(false); }}
                              title={b.filename}
                            >
                              📄 {b.filename}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-danger p-0 d-flex align-items-center justify-content-center opacity-75"
                              title="Delete this file's data"
                              style={{ minWidth: 20, minHeight: 20, fontSize: "0.85rem", textDecoration: "none" }}
                              onClick={(e) => { e.stopPropagation(); deleteBatch(b.id, b.filename); }}
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                        {!batches.length && <div className="extra-small text-muted px-2 py-2">No files uploaded yet.</div>}
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-success btn-sm px-3 d-inline-flex align-items-center gap-2 fw-semibold"
                    style={{ borderRadius: 8, boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)" }}
                    onClick={() => document.getElementById("invUploadModal").classList.add("show-modal")}
                  >
                    <i className="fa-solid fa-file-excel"></i> Upload Excel
                  </button>

                  <button
                    className="btn btn-primary btn-sm px-3 d-inline-flex align-items-center gap-2 fw-semibold"
                    style={{ borderRadius: 8, boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)" }}
                    onClick={loadFilterOptions}
                  >
                    <i className="fa-solid fa-rotate"></i> Refresh
                  </button>
                </div>
              </div>

              <div className="filter-grid">
                <FilterDropdown label="Plant" id="plant" options={plantOptions} selected={selPlants} setSelected={setSelPlants}
                  open={openDropdown === "plant"} setOpen={setOpenDropdown} toggleValue={toggleValue}
                  labelText={labelFor(selPlants, plantOptions.length, "All Plants")} />
                <FilterDropdown label="PR Requisitioner" id="req" options={reqOptions} selected={selReqs} setSelected={setSelReqs}
                  open={openDropdown === "req"} setOpen={setOpenDropdown} toggleValue={toggleValue}
                  labelText={labelFor(selReqs, reqOptions.length, "All Requisitioners")} />
                <FilterDropdown label="Material Type" id="matType" options={matTypeOptions} selected={selTypes} setSelected={setSelTypes}
                  open={openDropdown === "matType"} setOpen={setOpenDropdown} toggleValue={toggleValue}
                  labelText={labelFor(selTypes, matTypeOptions.length, "All Material Types")} />
                <FilterDropdown label="Material Group" id="matGrp" options={matGrpOptions} selected={selGrps} setSelected={setSelGrps}
                  open={openDropdown === "matGrp"} setOpen={setOpenDropdown} toggleValue={toggleValue}
                  labelText={labelFor(selGrps, matGrpOptions.length, "All Material Groups")} />
                <FilterDropdown label="Movement Classification" id="movement" options={MOVEMENT_OPTIONS} selected={selMovements} setSelected={setSelMovements}
                  open={openDropdown === "movement"} setOpen={setOpenDropdown} toggleValue={toggleValue}
                  labelText={labelFor(selMovements, MOVEMENT_OPTIONS.length, "All Movement Types")} />
              </div>
            </div>

            {/* ================= SECTION 1: EXECUTIVE KPIS ================= */}
            <div className="section-title-wrap">
              <h6 className="section-title">
                <i className="fa-solid fa-chart-line text-primary"></i> Overview Metrics
              </h6>
              <span className="badge text-bg-light border extra-small">Portfolio Summary</span>
            </div>

            <div className="kpi-grid mb-4">
              {/* Total Stock */}
              <div className="card-kpi kpi-total">
                <div className="d-flex justify-content-between align-items-start">
                  <span className="text-muted extra-small fw-bold text-uppercase">Total Valuation</span>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle extra-small">100%</span>
                </div>
                <h4 className="fw-bold text-dark mt-3 mb-1" style={{ letterSpacing: "-0.02em" }}>{formatVal(kpi.total)}</h4>
                <div className="d-flex align-items-center gap-1 text-muted extra-small pt-1">
                  <i className="fa-solid fa-cubes text-secondary"></i>
                  <span><strong>{kpi.count.toLocaleString()}</strong> Total Line Items</span>
                </div>
              </div>

              {/* Regular Moving */}
              <div className="card-kpi kpi-regular">
                <div className="d-flex justify-content-between align-items-start">
                  <span className="text-muted extra-small fw-bold text-uppercase">Regular Moving</span>
                  <span className="badge bg-success-subtle text-success border border-success-subtle extra-small">
                    {((kpi.reg / baseVal) * 100).toFixed(1)}%
                  </span>
                </div>
                <h4 className="fw-bold text-success mt-3 mb-1" style={{ letterSpacing: "-0.02em" }}>{formatVal(kpi.reg)}</h4>
                <div className="progress mt-2" style={{ height: 5 }}>
                  <div className="progress-bar bg-success" style={{ width: `${Math.min(100, (kpi.reg / baseVal) * 100)}%` }} />
                </div>
              </div>

              {/* Slow Moving */}
              <div className="card-kpi kpi-slow">
                <div className="d-flex justify-content-between align-items-start">
                  <span className="text-muted extra-small fw-bold text-uppercase">Slow Moving</span>
                  <span className="badge bg-warning-subtle text-warning border border-warning-subtle extra-small">
                    {((kpi.slow / baseVal) * 100).toFixed(1)}%
                  </span>
                </div>
                <h4 className="fw-bold text-warning mt-3 mb-1" style={{ letterSpacing: "-0.02em" }}>{formatVal(kpi.slow)}</h4>
                <div className="progress mt-2" style={{ height: 5 }}>
                  <div className="progress-bar bg-warning" style={{ width: `${Math.min(100, (kpi.slow / baseVal) * 100)}%` }} />
                </div>
              </div>

              {/* Non Moving */}
              <div className="card-kpi kpi-nonmoving">
                <div className="d-flex justify-content-between align-items-start">
                  <span className="text-muted extra-small fw-bold text-uppercase">Non Moving</span>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle extra-small">
                    {((kpi.non / baseVal) * 100).toFixed(1)}%
                  </span>
                </div>
                <h4 className="fw-bold text-danger mt-3 mb-1" style={{ letterSpacing: "-0.02em" }}>{formatVal(kpi.non)}</h4>
                <div className="progress mt-2" style={{ height: 5 }}>
                  <div className="progress-bar bg-danger" style={{ width: `${Math.min(100, (kpi.non / baseVal) * 100)}%` }} />
                </div>
              </div>
            </div>

            {/* ================= SECTION 2: CHARTS & ANALYTICS ================= */}
            <div className="section-title-wrap">
              <h6 className="section-title">
                <i className="fa-solid fa-chart-pie text-primary"></i> Valuation & Risk Analytics
              </h6>
              <span className="badge text-bg-light border extra-small">Visual Drilldowns</span>
            </div>

            {/* Charts Row 1: Requisitioners & Material Types */}
            <div className="analytics-grid mb-3">
              <div className="chart-box">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-dark mb-0 small">
                    <i className="fa-solid fa-user-check text-primary me-2"></i>PR Requisitioner Breakdown
                  </h6>
                  <span className="extra-small text-muted">Ranked by Value</span>
                </div>
                <div className="chart-container"><canvas ref={reqChartRef}></canvas></div>
              </div>

              <div className="chart-box">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-dark mb-0 small">
                    <i className="fa-solid fa-layer-group text-primary me-2"></i>Material Type Valuation
                  </h6>
                  <span className="extra-small text-muted">Category Share</span>
                </div>
                <div className="chart-container"><canvas ref={matTypeChartRef}></canvas></div>
              </div>
            </div>

            {/* Charts Row 2: Ageing Buckets & Movement Share */}
            <div className="analytics-grid mb-4">
              <div className="chart-box">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-dark mb-0 small">
                    <i className="fa-solid fa-clock-rotate-left text-primary me-2"></i>Ageing Buckets (Days)
                  </h6>
                  <span className="extra-small text-muted">Valuation by Vintage</span>
                </div>
                <div className="chart-container"><canvas ref={ageingChartRef}></canvas></div>
              </div>

              <div className="chart-box">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-dark mb-0 small">
                    <i className="fa-solid fa-chart-pie text-primary me-2"></i>Movement Status Share
                  </h6>
                  <span className="extra-small text-muted">Velocity Mix</span>
                </div>
                <div className="chart-container"><canvas ref={movementChartRef}></canvas></div>
              </div>
            </div>

            {/* ================= SECTION 3: WATCHLIST LEADERBOARDS ================= */}
            <div className="section-title-wrap">
              <h6 className="section-title">
                <i className="fa-solid fa-triangle-exclamation text-danger"></i> High-Risk Material Watchlists
              </h6>
              <span className="badge text-bg-light border extra-small">Action Required</span>
            </div>

            <div className="watchlist-grid mb-4">
              {/* Top 10 Non-Moving */}
              <div className="table-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-danger mb-0 small d-flex align-items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i> Top 10 Non-Moving Materials
                  </h6>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle extra-small">Critical</span>
                </div>
                <div className="table-responsive" style={{ height: 320, overflowY: "auto" }}>
                  <table className="table table-hover table-sm align-middle extra-small mb-0">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th style={{ width: 45 }}>#</th>
                        <th style={{ width: 110 }}>Code</th>
                        <th>Description</th>
                        <th style={{ width: 85 }}>Days</th>
                        <th className="text-end" style={{ width: 120 }}>Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topNonMoving.map((r, idx) => (
                        <tr key={r.id}>
                          <td className="text-muted fw-bold">{idx + 1}</td>
                          <td className="fw-bold font-monospace text-dark">{r.code}</td>
                          <td className="text-truncate" style={{ maxWidth: 160 }} title={r.desc}>{r.desc}</td>
                          <td><span className="badge text-bg-light border text-secondary">{r.nonMovingDays} d</span></td>
                          <td className="text-end fw-bold text-danger">{formatVal(r.nonVal)}</td>
                        </tr>
                      ))}
                      {!topNonMoving.length && (
                        <tr><td colSpan={5} className="text-center text-muted py-4">No non-moving stock matching filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top 10 Slow-Moving */}
              <div className="table-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-warning mb-0 small d-flex align-items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation"></i> Top 10 Slow-Moving Materials
                  </h6>
                  <span className="badge bg-warning-subtle text-warning border border-warning-subtle extra-small">Attention</span>
                </div>
                <div className="table-responsive" style={{ height: 320, overflowY: "auto" }}>
                  <table className="table table-hover table-sm align-middle extra-small mb-0">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th style={{ width: 45 }}>#</th>
                        <th style={{ width: 110 }}>Code</th>
                        <th>Description</th>
                        <th style={{ width: 85 }}>Days</th>
                        <th className="text-end" style={{ width: 120 }}>Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSlowMoving.map((r, idx) => (
                        <tr key={r.id}>
                          <td className="text-muted fw-bold">{idx + 1}</td>
                          <td className="fw-bold font-monospace text-dark">{r.code}</td>
                          <td className="text-truncate" style={{ maxWidth: 160 }} title={r.desc}>{r.desc}</td>
                          <td><span className="badge text-bg-light border text-secondary">{r.nonMovingDays} d</span></td>
                          <td className="text-end fw-bold text-warning">{formatVal(r.slowVal)}</td>
                        </tr>
                      ))}
                      {!topSlowMoving.length && (
                        <tr><td colSpan={5} className="text-center text-muted py-4">No slow-moving stock matching filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ================= SECTION 4: DETAIL LEDGER ================= */}
            <div className="section-title-wrap">
              <h6 className="section-title">
                <i className="fa-solid fa-table-list text-primary"></i> Master Inventory Ledger
              </h6>
              <span className="badge text-bg-light border extra-small">
                {tableTotal.toLocaleString()} Total Records
              </span>
            </div>

            <div className={`table-card${tableLoading ? " is-loading" : ""}`}>
              <div className="row align-items-center g-2 mb-3">
                <div className="col-12 col-md-6">
                  <span className="text-muted extra-small">
                    Click any column header to sort ascending or descending &bull; Instant multi-field querying
                  </span>
                </div>
                <div className="col-12 col-md-6 text-md-end">
                  <div className="position-relative d-inline-block w-100" style={{ maxWidth: 340 }}>
                    <input
                      type="text"
                      className="form-control form-control-sm ps-4"
                      placeholder="Search Code or Description..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ borderRadius: 8, fontSize: "0.8rem" }}
                    />
                    <i className="fa-solid fa-magnifying-glass text-muted position-absolute" style={{ left: 10, top: 9, fontSize: 12 }}></i>
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="btn btn-sm btn-link text-muted position-absolute p-0"
                        style={{ right: 8, top: 4, textDecoration: "none", fontSize: 13 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="table-responsive border rounded" style={{ maxHeight: 440, overflowY: "auto" }}>
                <table className="table table-hover table-striped align-middle extra-small mb-0">
                  <thead className="table-light sticky-top" style={{ zIndex: 2 }}>
                    <tr>
                      <th className="sort-header py-2" onClick={() => sortLedger("code")}>Code <span className="text-primary">{sortIcon("code")}</span></th>
                      <th className="sort-header py-2" onClick={() => sortLedger("desc")}>Description <span className="text-primary">{sortIcon("desc")}</span></th>
                      <th className="sort-header py-2" onClick={() => sortLedger("plant")}>Plant <span className="text-primary">{sortIcon("plant")}</span></th>
                      <th className="sort-header py-2" onClick={() => sortLedger("requisitioner")}>Requisitioner <span className="text-primary">{sortIcon("requisitioner")}</span></th>
                      <th className="sort-header py-2" onClick={() => sortLedger("matType")}>Type <span className="text-primary">{sortIcon("matType")}</span></th>
                      <th className="sort-header py-2" onClick={() => sortLedger("movementStatus")}>Status <span className="text-primary">{sortIcon("movementStatus")}</span></th>
                      <th className="sort-header py-2 text-center" onClick={() => sortLedger("nonMovingDays")}>Days <span className="text-primary">{sortIcon("nonMovingDays")}</span></th>
                      <th className="sort-header py-2 text-end" onClick={() => sortLedger("totalVal")}>Total Value (₹) <span className="text-primary">{sortIcon("totalVal")}</span></th>
                      <th className="text-center py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => {
                      const commentCount = (r.comments || []).length;
                      return (
                        <tr key={r.id}>
                          <td className="fw-bold font-monospace text-dark">{r.code}</td>
                          <td className="text-truncate" style={{ maxWidth: 200 }} title={r.desc}>{r.desc}</td>
                          <td><span className="badge text-bg-light border text-secondary">{r.plant}</span></td>
                          <td className="text-truncate" style={{ maxWidth: 130 }} title={r.requisitioner}>{r.requisitioner}</td>
                          <td><span className="badge text-bg-light border text-secondary">{r.matType}</span></td>
                          <td><span className={`badge ${badgeClass(r.movementStatus)}`}>{r.movementStatus}</span></td>
                          <td className="text-center font-monospace">{r.nonMovingDays}</td>
                          <td className="text-end fw-bold text-dark font-monospace">{formatVal(r.totalVal)}</td>
                          <td className="text-center">
                            <button
                              className={`btn btn-sm p-1 position-relative ${commentCount > 0 ? "btn-outline-primary" : "btn-light border"}`}
                              style={{ width: 28, height: 28, borderRadius: 6 }}
                              onClick={() => openCommentModal(r)}
                              title="View/Add Comments"
                            >
                              💬
                              {commentCount > 0 && (
                                <span
                                  className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-primary"
                                  style={{ fontSize: 9, padding: "2px 4px" }}
                                >
                                  {commentCount}
                                </span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!tableRows.length && (
                      <tr><td colSpan={9} className="text-center text-muted py-4">No records matching selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="d-flex justify-content-between align-items-center mt-3 pt-1 flex-wrap gap-2">
                <span className="text-muted extra-small">
                  Showing <strong className="text-dark">{tableRows.length}</strong> of <strong className="text-dark">{tableTotal.toLocaleString()}</strong> items matched &bull; Page {page} of {totalPages}
                </span>
                <div className="btn-group btn-group-sm" style={{ borderRadius: 6, overflow: "hidden" }}>
                  <button
                    className="btn btn-outline-secondary px-3"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    &laquo; Prev
                  </button>
                  <button
                    className="btn btn-outline-secondary px-3"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next &raquo;
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------
// REUSABLE MULTI-SELECT DROPDOWN
// --------------------------------------------------
function FilterDropdown({ label, id, options, selected, setSelected, open, setOpen, toggleValue, labelText }) {
  const isAllSelected = selected.length === options.length;
  const countSelected = selected.length;

  return (
    <div className="d-flex flex-column">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <label className="form-label extra-small fw-bold text-secondary text-uppercase mb-0" style={{ letterSpacing: "0.03em" }}>{label}</label>
        {countSelected > 0 && !isAllSelected && (
          <span className="badge text-bg-primary extra-small px-1 py-0" style={{ fontSize: 9 }}>{countSelected}</span>
        )}
      </div>

      <div className="dropdown position-relative">
        <button
          className="btn btn-sm w-100 dropdown-toggle text-start d-flex justify-content-between align-items-center"
          type="button"
          style={{
            borderRadius: 8,
            border: countSelected === 0 ? "1px solid #ef4444" : "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            padding: "6px 12px",
            fontSize: "0.8rem",
          }}
          onClick={() => setOpen(open ? null : id)}
        >
          <span className="text-truncate fw-medium">{labelText}</span>
        </button>

        {open && (
          <div className="dropdown-menu-checkbox shadow show">
            <div className="d-flex justify-content-between pb-1 mb-2 border-bottom extra-small">
              <button
                className="btn btn-link btn-sm p-0 text-decoration-none text-primary fw-semibold extra-small"
                onClick={() => setSelected(options)}
              >
                Select All
              </button>
              <button
                className="btn btn-link btn-sm p-0 text-decoration-none text-danger fw-semibold extra-small"
                onClick={() => setSelected([])}
              >
                Clear
              </button>
            </div>

            {options.map((item) => {
              const isChecked = selected.includes(item);
              return (
                <div
                  className="form-check extra-small py-1 mb-0 d-flex align-items-center gap-2 rounded px-1"
                  key={item}
                  style={{ cursor: "pointer", background: isChecked ? "#f0fdf4" : "transparent" }}
                  onClick={() => toggleValue(selected, setSelected, item)}
                >
                  <input
                    className="form-check-input mt-0"
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    id={`${id}_${item}`}
                    style={{ cursor: "pointer" }}
                  />
                  <label
                    className="form-check-label text-truncate w-100"
                    htmlFor={`${id}_${item}`}
                    style={{ cursor: "pointer", color: isChecked ? "#0f172a" : "#64748b", fontWeight: isChecked ? 600 : 400 }}
                  >
                    {item}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}