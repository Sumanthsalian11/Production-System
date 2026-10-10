import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Chart from "chart.js/auto";
import BASE_URL from "../config/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

// 🎨 presentation only: round blue emblem icon used in the header strip
const FactoryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" />
  </svg>
);

function ReceivingInspectionDashboard() {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("dashboard"); // dashboard | view
  const [viewData, setViewData] = useState({ summary: null, items: [] });

  const decisionRef = useRef(null);
  const materialRef = useRef(null);
  const locationRef = useRef(null);
  const supplierRef = useRef(null);
  const chartInstances = useRef({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/rir/consolidated`);
      setRawData(res.data.records || []);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    }
  };

  const locations = useMemo(
    () => [...new Set(rawData.map((r) => r.location).filter(Boolean))],
    [rawData]
  );
  const suppliers = useMemo(
    () => [...new Set(rawData.map((r) => r.supplierName).filter(Boolean))],
    [rawData]
  );

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rawData.filter((r) => {
      const matchesSearch =
        r.itemCode?.toString().toLowerCase().includes(s) ||
        r.supplierName?.toString().toLowerCase().includes(s) ||
        r.rirNo?.toString().toLowerCase().includes(s) ||
        r.materialDesc?.toString().toLowerCase().includes(s);
      const matchesStatus = statusFilter === "ALL" || r.lotStatus.includes(statusFilter);
      const matchesLocation = locationFilter === "ALL" || r.location === locationFilter;
      const matchesSupplier = supplierFilter === "ALL" || r.supplierName === supplierFilter;
      return matchesSearch && matchesStatus && matchesLocation && matchesSupplier;
    });
  }, [rawData, search, statusFilter, locationFilter, supplierFilter]);

  const approved = filtered.filter((r) => r.lotStatus.includes("LA")).length;
  const rejected = filtered.filter((r) => r.lotStatus.includes("LR")).length;

  useEffect(() => {
    if (viewMode !== "dashboard") return;

    // Decision chart (Left, Row 1)
    if (chartInstances.current.decision) chartInstances.current.decision.destroy();
    if (decisionRef.current) {
      chartInstances.current.decision = new Chart(decisionRef.current.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: ["Lot Accepted (LA)", "Lot Rejected (LR)"],
          datasets: [{ data: [approved, rejected], backgroundColor: ["#16a34a", "#dc2626"], borderWidth: 2 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
      });
    }

    // Material chart (Right, Row 1)
    const matMap = {};
    filtered.forEach((r) => {
      const type = r.materialType || "General";
      if (!matMap[type]) matMap[type] = { accepted: 0, rejected: 0 };
      if (r.lotStatus.includes("LA")) matMap[type].accepted++;
      if (r.lotStatus.includes("LR")) matMap[type].rejected++;
    });
    const matLabels = Object.keys(matMap);
    if (chartInstances.current.material) chartInstances.current.material.destroy();
    if (materialRef.current) {
      chartInstances.current.material = new Chart(materialRef.current.getContext("2d"), {
        type: "bar",
        data: {
          labels: matLabels,
          datasets: [
            { label: "Accepted", data: matLabels.map((m) => matMap[m].accepted), backgroundColor: "#16a34a" },
            { label: "Rejected", data: matLabels.map((m) => matMap[m].rejected), backgroundColor: "#dc2626" },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
          plugins: { legend: { position: "bottom" } },
        },
      });
    }

    // Location chart (Left, Row 2)
    const locMap = {};
    filtered.forEach((r) => {
      const loc = r.location || "Manipal HO";
      if (!locMap[loc]) locMap[loc] = { accepted: 0, rejected: 0, total: 0 };
      if (r.lotStatus.includes("LA")) locMap[loc].accepted++;
      if (r.lotStatus.includes("LR")) locMap[loc].rejected++;
      locMap[loc].total++;
    });
    const locLabels = Object.keys(locMap);
    if (chartInstances.current.location) chartInstances.current.location.destroy();
    if (locationRef.current) {
      chartInstances.current.location = new Chart(locationRef.current.getContext("2d"), {
        type: "bar",
        data: {
          labels: locLabels,
          datasets: [
            { label: "LOT ACCEPTED", data: locLabels.map((l) => locMap[l].accepted), backgroundColor: "#5b9bd5" },
            { label: "LOT REJECTED", data: locLabels.map((l) => locMap[l].rejected), backgroundColor: "#ed7d31" },
            { label: "GRAND TOTAL", data: locLabels.map((l) => locMap[l].total), backgroundColor: "#a5a5a5" },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } },
          plugins: { legend: { position: "bottom" } },
        },
      });
    }

    // Supplier volume chart (Right, Row 2)
    const supplierLabels = [...new Set(filtered.map((r) => r.supplierName || "Unspecified"))];
    const locGroups = ["Chennai", "Kolkata", "Manipal", "Noida", "Mumbai"];
    const locationColors = {
      Chennai: "#5b9bd5",
      Kolkata: "#ed7d31",
      Manipal: "#a5a5a5",
      Noida: "#ffc000",
      Mumbai: "#70ad47",
    };
    const supplierDatasets = locGroups.map((loc) => ({
      label: loc,
      backgroundColor: locationColors[loc],
      data: supplierLabels.map(
        (sup) =>
          filtered.filter(
            (r) =>
              (r.supplierName || "Unspecified") === sup &&
              (r.location || "").toLowerCase().includes(loc.toLowerCase())
          ).length
      ),
    }));
    if (chartInstances.current.supplier) chartInstances.current.supplier.destroy();
    if (supplierRef.current) {
      chartInstances.current.supplier = new Chart(supplierRef.current.getContext("2d"), {
        type: "bar",
        data: { labels: supplierLabels, datasets: supplierDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
          plugins: { legend: { position: "bottom" } },
        },
      });
    }
  }, [filtered, viewMode, approved, rejected]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setLocationFilter("ALL");
    setSupplierFilter("ALL");
  };

  const viewDetailedReport = async (rirNo) => {
    setViewMode("view");
    setViewData({ summary: null, items: [] });
    try {
      const res = await axios.get(`${BASE_URL}/api/rir/full-report/${rirNo}`);
      setViewData(res.data);
    } catch (err) {
      console.error("Failed to load report", err);
    }
  };

  const s = viewData.summary;
  const items = viewData.items || [];
  let maxSamples = 1;
  items.forEach((item) => {
    const parts = (item.readings || "").toString().split(",");
    if (parts.length > maxSamples) maxSamples = parts.length;
  });
  const first = items[0];
  const accClass = (s?.lotStatus || "").includes("LA") ? "badge-la" : "badge-lr";
  const defClass = (first?.defectCriteria || "").includes("Minor")
    ? "badge-minor"
    : (first?.defectCriteria || "").includes("Major")
    ? "badge-major"
    : "badge-critical";

  return (
    <div className="dashboard-container">
      <style>{`
        @keyframes riGlowPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }

        /* ---------- Aqua glass backdrop ---------- */
        .dashboard-container {
          min-height: 100vh;
          padding: 16px 20px 28px;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #0b2f4f;
          background:
            radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.85) 0, rgba(255, 255, 255, 0) 30%),
            radial-gradient(circle at 88% 18%, rgba(160, 228, 255, 0.7) 0, rgba(160, 228, 255, 0) 32%),
            radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
            linear-gradient(165deg, #eaf8ff 0%, #c9ecfb 38%, #a6dcf5 72%, #d9f2fd 100%);
          background-attachment: fixed;
        }

        /* ---------- Glossy hero header ---------- */
        .company-header {
          padding: 10px 20px;
          border-radius: 20px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(222, 244, 254, 0.8) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 14px 30px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140, 210, 245, 0.2);
        }
        .hero-left { display: flex; align-items: center; gap: 14px; }
        .hero-emblem-3d {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; color: #fff;
          background: radial-gradient(circle at 30% 25%, #b6ecff 0%, #34b6f0 40%, #0a6fb8 100%);
          box-shadow: 0 8px 18px rgba(2, 60, 110, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.8), inset 0 -4px 8px rgba(0, 60, 120, 0.35);
        }
        .company-title { font-weight: 800; font-size: 1.3rem; color: #0a4f8c; letter-spacing: -0.3px; }
        .doc-info { font-size: 0.76rem; color: #4a7391; font-weight: 600; margin-top: 2px; }

        /* ---------- KPI cards ---------- */
        .kpi-grid-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 16px;
          width: 100%;
        }
        .kpi-card {
          position: relative; overflow: hidden; min-width: 0;
          padding: 16px 20px; border-radius: 22px;
          background: linear-gradient(180deg, #ffffff 0%, #eaf7fe 100%);
          border: 1px solid #cfe8f6;
          box-shadow: 0 12px 24px rgba(10, 100, 160, 0.14), inset 0 1px 0 #fff;
          transition: all 0.25s ease;
        }
        .kpi-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; }
        .kpi-card-primary::before { background: linear-gradient(90deg, #2ea4e6, #8fd8f8); }
        .kpi-card-success::before { background: linear-gradient(90deg, #16a34a, #4ade80); }
        .kpi-card-danger::before { background: linear-gradient(90deg, #dc2626, #f87171); }
        .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 16px 28px rgba(10, 100, 160, 0.2), inset 0 1px 0 #fff; }
        .kpi-icon-box {
          width: 50px; height: 50px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #fff;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.18), inset 0 2px 2px rgba(255, 255, 255, 0.7);
        }
        .kpi-icon-primary { background: radial-gradient(circle at 30% 25%, #b6ecff, #34b6f0 45%, #0a6fb8); }
        .kpi-icon-success { background: radial-gradient(circle at 30% 25%, #b4f5d0, #10b981 50%, #047857); }
        .kpi-icon-danger  { background: radial-gradient(circle at 30% 25%, #ffc2c2, #ef4444 50%, #b91c1c); }

        /* ---------- Filter card + inset inputs ---------- */
        .filter-card {
          padding: 12px 16px; margin-bottom: 18px; border-radius: 22px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(226, 246, 255, 0.86) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 14px 32px rgba(40, 120, 170, 0.16), inset 0 1px 0 #fff, inset 0 -12px 26px rgba(140, 210, 245, 0.2);
        }
        .form-control-3d, .form-select-3d {
          border: 1.5px solid #9ccbe6 !important;
          border-radius: 12px !important;
          background-color: #ffffff !important;
          color: #0b2f4f;
          box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.12), 0 1px 0 rgba(255, 255, 255, 0.9) !important;
          font-size: 0.83rem; padding: 7px 12px; font-weight: 700;
        }
        .form-control-3d::placeholder { color: #7b9db5; font-weight: 600; }
        .form-control-3d:focus, .form-select-3d:focus {
          border-color: #1b9be0 !important;
          box-shadow: inset 0 1px 2px rgba(10, 80, 130, 0.08), 0 0 0 4px rgba(27, 155, 224, 0.22) !important;
        }
        .filter-card .input-group-text { border: 1.5px solid #9ccbe6 !important; background: #fff !important; }

        /* ---------- Glossy 3D buttons ---------- */
        .btn-3d-primary {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 18px; border-radius: 12px; font-weight: 800; color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.6);
          text-shadow: 0 1px 2px rgba(0, 60, 110, 0.35);
          background: linear-gradient(180deg, #b4ecff 0%, #5cc4f2 48%, #2ea4e6 52%, #1b8fd6 100%);
          box-shadow: 0 3px 0 #1479b8, 0 8px 14px rgba(30, 130, 190, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.85);
          transition: all 0.12s ease;
        }
        .btn-3d-primary:hover { transform: translateY(-1px); filter: brightness(1.05); color: #fff; }
        .btn-3d-primary:active { transform: translateY(2px); }
        .btn-3d-secondary {
          padding: 7px 14px; border-radius: 12px; font-weight: 800; font-size: 0.83rem; color: #0a4f8c;
          border: 1.5px solid #9ccbe6;
          background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
          box-shadow: 0 3px 8px rgba(10, 80, 130, 0.12), inset 0 1px 0 #fff;
          transition: all 0.15s ease;
        }
        .btn-3d-secondary:hover { transform: translateY(-1px); color: #0a5fa8; border-color: #1b9be0; background: linear-gradient(180deg, #ffffff 0%, #d4f0fd 100%); }

        /* ---------- Chart grid + glass chart cards ---------- */
        .charts-row-pair {
          display: grid; grid-template-columns: 1fr 1fr; gap: 18px;
          margin-bottom: 18px; width: 100%;
        }
        .chart-card-wrapper { min-width: 0; width: 100%; }
        .chart-card {
          height: 100%; min-width: 0; padding: 16px 18px;
          display: flex; flex-direction: column; justify-content: space-between;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(226, 246, 255, 0.88) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 14px 32px rgba(40, 120, 170, 0.16), inset 0 1px 0 #fff;
          transition: all 0.25s ease;
        }
        .chart-card:hover { transform: translateY(-3px); box-shadow: 0 18px 34px rgba(40, 120, 170, 0.24), inset 0 1px 0 #fff; }
        .chart-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #cfe6f5;
        }
        .chart-title { font-size: 0.92rem; font-weight: 800; color: #0b2f4f; display: flex; align-items: center; gap: 10px; margin: 0; }
        .chart-badge-icon {
          width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
          color: #fff; font-size: 0.9rem;
          background: radial-gradient(circle at 30% 25%, #b6ecff, #34b6f0 45%, #0a6fb8);
          box-shadow: 0 5px 12px rgba(2, 60, 110, 0.3), inset 0 2px 2px rgba(255, 255, 255, 0.7);
        }
        .chart-card .badge.bg-light {
          background: linear-gradient(180deg, #ffffff, #d4f0fd) !important;
          color: #0a4f8c !important; border: 1px solid #a6d6ee !important; font-weight: 800;
        }
        .chart-canvas-box { position: relative; height: 260px; width: 100%; min-width: 0; }

        /* ---------- Table card + colorful table ---------- */
        .table-card {
          padding: 18px 20px; border-radius: 22px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(226, 246, 255, 0.88) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 14px 32px rgba(40, 120, 170, 0.16), inset 0 1px 0 #fff;
        }
        .table-card .badge.bg-light {
          background: linear-gradient(180deg, #ffffff, #d4f0fd) !important;
          color: #0a4f8c !important; border: 1px solid #a6d6ee !important; font-weight: 800;
        }
        .table-consolidated {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          border-radius: 14px !important;
          overflow: hidden !important;
          border: 1px solid #a6d6ee !important;
        }
        .table-consolidated th {
          background: linear-gradient(180deg, #f4fbff 0%, #d9eefb 100%) !important;
          color: #0a4f8c !important;
          font-size: 0.74rem !important;
          font-weight: 800 !important;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          text-align: center;
          vertical-align: middle;
          padding: 11px 8px !important;
          border: 0 !important;
          border-bottom: 2px solid #9ccbe6 !important;
          border-right: 1px solid #e1f0f9 !important;
        }
        .table-consolidated td {
          font-size: 0.78rem !important;
          vertical-align: middle !important;
          text-align: center;
          padding: 9px 8px !important;
          background-color: #ffffff;
          color: #0b2f4f;
          font-weight: 600;
          border: 0 !important;
          border-bottom: 1px solid #dcecf6 !important;
          border-right: 1px solid #f1f8fc !important;
          transition: background-color 0.15s ease;
        }
        .table-consolidated tbody tr:nth-of-type(even) td { background-color: #f3faff; }
        .table-consolidated tbody tr:hover td { background-color: #d9f2fc !important; }
        .btn-action-view {
          display: inline-flex; align-items: center;
          padding: 4px 12px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.6);
          text-shadow: 0 1px 2px rgba(0, 60, 110, 0.35);
          background: linear-gradient(180deg, #a8e6ff 0%, #4fb8ee 55%, #2a9be0 100%);
          box-shadow: 0 2px 0 #1479b8, 0 4px 6px rgba(30, 130, 190, 0.25);
          transition: all 0.12s ease;
        }
        .btn-action-view:hover { transform: translateY(-1px); color: #fff; filter: brightness(1.05); }

        /* ---------- Status badges ---------- */
        .badge-la {
          background: linear-gradient(135deg, #22c55e, #15803d); color: #ffffff;
          padding: 5px 14px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; display: inline-block;
          box-shadow: 0 2px 6px rgba(22, 163, 74, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        .badge-lr {
          background: linear-gradient(135deg, #ef4444, #b91c1c); color: #ffffff;
          padding: 5px 14px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; display: inline-block;
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        .badge-minor { background: linear-gradient(135deg, #22c55e, #15803d); color: white; padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .badge-major { background: linear-gradient(135deg, #f97316, #c2410c); color: white; padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .badge-critical { background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }

        /* ---------- Detailed report (view mode) ---------- */
        .report-card {
          padding: 26px; border-radius: 22px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(240, 250, 255, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 18px 40px rgba(40, 120, 170, 0.2), inset 0 1px 0 #fff;
        }
        .banner-header {
          padding: 11px; text-align: center; text-transform: uppercase; font-weight: 800; letter-spacing: 0.8px;
          border-radius: 12px; color: #0a4f8c;
          background: linear-gradient(180deg, #f4fbff 0%, #d9eefb 100%);
          border: 1px solid #a6d6ee;
          box-shadow: 0 4px 10px rgba(40, 120, 170, 0.12), inset 0 1px 0 #fff;
        }
        .note-box {
          font-size: 0.78rem; line-height: 1.45; padding: 12px 16px; border-radius: 10px;
          border: 1px solid #a6d6ee; border-left: 4px solid #1b8fd6;
          background: linear-gradient(145deg, #eaf8ff, #f4fbff);
        }
        .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .grid-table td, .grid-table th { border: 1px solid #b8d8ec; padding: 7px 12px; font-size: 0.82rem; vertical-align: middle; }
        .grid-label { background: linear-gradient(180deg, #f4fbff 0%, #e3f3fc 100%); font-weight: 800; width: 15%; color: #0a4f8c; }
        .table-iqc th { background: linear-gradient(180deg, #f4fbff 0%, #d9eefb 100%); color: #0a4f8c; font-size: 0.76rem; font-weight: 800; text-align: center; vertical-align: middle; border: 1px solid #000; }
        .table-iqc td { border: 1px solid #000; font-size: 0.8rem; padding: 5px; vertical-align: middle; }
        .report-card .bg-light { background: linear-gradient(180deg, #f4fbff 0%, #e9f7fe 100%) !important; border-color: #a6d6ee !important; }

        @media (max-width: 768px) {
          .kpi-grid-container { grid-template-columns: 1fr; }
          .charts-row-pair { grid-template-columns: 1fr; }
        }

        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none;
            border: none;
          }
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      {/* Header */}
      <div className="company-header d-flex justify-content-between align-items-center mb-4">
        <div className="hero-left">
          <div className="hero-emblem-3d">
            <FactoryIcon />
          </div>
          <div>
            <div className="company-title">
            <span style={{ fontSize: "1.55rem", fontWeight: 700, color: "#4a7391" }}>Receiving Inspection Analysis</span>
            </div>
          </div>
        </div>
        <div>
          {viewMode === "dashboard" ? (
            <select
              className="form-select form-select-3d fw-bold"
              style={{ width: "210px" }}
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === "new-inspection") navigate("/new-inspection");
                else if (val === "calibration") navigate("/calibration");
                e.target.value = "";
              }}
            >
              <option value="" disabled>-- Quick Actions --</option>
              <option value="new-inspection">➕ Receiving Inspection</option>
              <option value="calibration">🛠 Calibration</option>
            </select>
          ) : (
            <button className="btn btn-3d-secondary d-flex align-items-center gap-2" onClick={() => setViewMode("dashboard")}>
              <i className="bi bi-arrow-left-circle-fill"></i> Back to Dashboard
            </button>
          )}
        </div>
      </div>

      {viewMode === "dashboard" && (
        <div id="dashboardView">
          {/* ======================================================== */}
          {/* 1. KPI CARDS: STRICT 3-COLUMN GRID (Always in One Line) */}
          {/* ======================================================== */}
          <div className="kpi-grid-container">
            <div className="kpi-card kpi-card-primary">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase small fw-bold text-muted" style={{ letterSpacing: "0.5px" }}>Total Inspection</div>
                  <div className="fs-2 fw-bolder text-dark mt-1">{filtered.length}</div>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill small px-2 py-1">
                    <i className="bi bi-graph-up me-1"></i>Active Records
                  </span>
                </div>
                <div className="kpi-icon-box kpi-icon-primary">
                  <i className="bi bi-clipboard-data-fill"></i>
                </div>
              </div>
            </div>

            <div className="kpi-card kpi-card-success">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase small fw-bold text-muted" style={{ letterSpacing: "0.5px" }}>Lot Accepted (LA)</div>
                  <div className="fs-2 fw-bolder text-success mt-1">{approved}</div>
                  <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill small px-2 py-1">
                    <i className="bi bi-check2-all me-1"></i>Quality Compliant
                  </span>
                </div>
                <div className="kpi-icon-box kpi-icon-success">
                  <i className="bi bi-check-circle-fill"></i>
                </div>
              </div>
            </div>

            <div className="kpi-card kpi-card-danger">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase small fw-bold text-muted" style={{ letterSpacing: "0.5px" }}>Lot Rejected (LR)</div>
                  <div className="fs-2 fw-bolder text-danger mt-1">{rejected}</div>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill small px-2 py-1">
                    <i className="bi bi-exclamation-triangle me-1"></i>Requires Action
                  </span>
                </div>
                <div className="kpi-icon-box kpi-icon-danger">
                  <i className="bi bi-x-octagon-fill"></i>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-card">
            <div className="row g-2 align-items-center">
              <div className="col-lg-3 col-md-6">
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0" style={{ borderRadius: "12px 0 0 12px", borderColor: "#9ccbe6" }}>
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control form-control-3d border-start-0 ps-0"
                    placeholder="Search Item Code, RIR, Supplier..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ borderRadius: "0 12px 12px 0" }}
                  />
                </div>
              </div>
              <div className="col-lg-2 col-md-6">
                <select className="form-select form-select-3d" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Statuses (LA & LR)</option>
                  <option value="LA">Lot Accepted (LA)</option>
                  <option value="LR">Lot Rejected (LR)</option>
                </select>
              </div>
              <div className="col-lg-2 col-md-4">
                <select className="form-select form-select-3d" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                  <option value="ALL">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-3 col-md-4">
                <select className="form-select form-select-3d" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((sup) => (
                    <option key={sup} value={sup}>{sup}</option>
                  ))}
                </select>
              </div>
              <div className="col-lg-2 col-md-4 text-end">
                <button className="btn btn-3d-secondary w-100" onClick={resetFilters}>
                  <i className="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 2. CHARTS ROW 1: Strictly LEFT (Decision) & RIGHT (Material) */}
          {/* ======================================================== */}
          <div className="charts-row-pair">
            <div className="chart-card-wrapper">
              <div className="chart-card">
                <div className="chart-header">
                  <h6 className="chart-title">
                    <span className="chart-badge-icon"><i className="bi bi-pie-chart-fill"></i></span>
                    Decision Breakdown
                  </h6>
                  <span className="badge bg-light text-secondary border px-2 py-1 small">Ratio</span>
                </div>
                <div className="chart-canvas-box d-flex justify-content-center align-items-center">
                  <canvas ref={decisionRef}></canvas>
                </div>
              </div>
            </div>

            <div className="chart-card-wrapper">
              <div className="chart-card">
                <div className="chart-header">
                  <h6 className="chart-title">
                    <span className="chart-badge-icon"><i className="bi bi-box-seam-fill"></i></span>
                    Material Type Analysis
                  </h6>
                  <span className="badge bg-light text-secondary border px-2 py-1 small">Classification</span>
                </div>
                <div className="chart-canvas-box">
                  <canvas ref={materialRef}></canvas>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. CHARTS ROW 2: Strictly LEFT (Location) & RIGHT (Supplier) */}
          {/* ======================================================== */}
          <div className="charts-row-pair">
            <div className="chart-card-wrapper">
              <div className="chart-card">
                <div className="chart-header">
                  <h6 className="chart-title">
                    <span className="chart-badge-icon"><i className="bi bi-geo-alt-fill"></i></span>
                    Receiving Inspection by Location
                  </h6>
                  <span className="badge bg-light text-secondary border px-2 py-1 small">Regional</span>
                </div>
                <div className="chart-canvas-box">
                  <canvas ref={locationRef}></canvas>
                </div>
              </div>
            </div>

            <div className="chart-card-wrapper">
              <div className="chart-card">
                <div className="chart-header">
                  <h6 className="chart-title">
                    <span className="chart-badge-icon"><i className="bi bi-diagram-3-fill"></i></span>
                    Consolidated Supplier Inspection Volume
                  </h6>
                  <span className="badge bg-light text-secondary border px-2 py-1 small">Suppliers</span>
                </div>
                <div className="chart-canvas-box">
                  <canvas ref={supplierRef}></canvas>
                </div>
              </div>
            </div>
          </div>

          {/* Consolidated Table Section */}
          <div className="table-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold m-0 d-flex align-items-center gap-2" style={{ color: "#0b2f4f" }}>
                <span className="chart-badge-icon"><i className="bi bi-table"></i></span> Consolidated Receiving Inspection Report
              </h6>
              <span className="badge bg-light text-muted border px-2 py-1 small">
                Showing {filtered.length} entries
              </span>
            </div>

            <div className="table-responsive">
              <table className="table table-hover table-consolidated">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Sl. No</th>
                    <th>Item Code</th>
                    <th>Tested Date</th>
                    <th>RIR No.</th>
                    <th>Supplier Name</th>
                    <th>Material Description</th>
                    <th>Invoice No. & Date</th>
                    <th>Rec</th>
                    <th>Received Quantity</th>
                    <th>PO No.</th>
                    <th>GIR No.</th>
                    <th>Lot Received Status</th>
                    <th>QC Remarks</th>
                    <th>Material Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-4 text-muted">
                        <i className="bi bi-inbox fs-3 d-block mb-1 text-secondary"></i>
                        No matching inspection records found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, idx) => {
                      const badgeClass = r.lotStatus.includes("LA") ? "badge-la" : "badge-lr";
                      return (
                        <tr key={idx}>
                          <td>
                            <button className="btn btn-action-view" onClick={() => viewDetailedReport(r.rirNo)}>
                              <i className="bi bi-eye-fill me-1"></i>View
                            </button>
                          </td>
                          <td className="fw-semibold">{r.slNo}</td>
                          <td className="fw-bold text-primary">{r.itemCode}</td>
                          <td>{r.testedDate}</td>
                          <td className="font-monospace fw-semibold">{r.rirNo}</td>
                          <td className="fw-medium">{r.supplierName}</td>
                          <td className="text-start">{r.materialDesc}</td>
                          <td>{r.invoiceDetails}</td>
                          <td>{r.recDate}</td>
                          <td className="fw-semibold">{r.receivedQty}</td>
                          <td>{r.poNo}</td>
                          <td>{r.girNo}</td>
                          <td>
                            <span className={badgeClass}>{r.lotStatus}</span>
                          </td>
                          <td className="text-muted small">{r.qcRemarks}</td>
                          <td><span className="badge bg-secondary-subtle text-dark border px-2 py-1">{r.materialType}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Report View Mode */}
      {viewMode === "view" && (
        <div id="reportViewMode">
          <div className="report-card print-area">
            <div className="d-flex justify-content-between align-items-center mb-3 no-print">
              <div className="banner-header w-100 me-2" style={{ marginBottom: 0 }}>
                RECEIVING INSPECTION REPORT (VIEW MODE)
              </div>
              <button className="btn btn-3d-primary fw-bold text-nowrap d-flex align-items-center gap-1" onClick={() => window.print()}>
                <i className="bi bi-printer-fill"></i> Print / PDF
              </button>
            </div>
            <div className="banner-header mb-3 d-none d-print-block">RECEIVING INSPECTION REPORT</div>

            <table className="grid-table">
              <tbody>
                <tr>
                  <td className="grid-label">RIR No. :</td>
                  <td style={{ width: "35%" }} className="fw-bold text-primary">{s?.rirNo || "-"}</td>
                  <td className="grid-label" style={{ width: "15%" }}>Item Code</td>
                  <td className="fw-bold">{s?.itemCode || "-"}</td>
                </tr>
                <tr>
                  <td className="grid-label">Material Type</td>
                  <td>{s?.materialType || "-"}</td>
                  <td className="grid-label">Tested Date</td>
                  <td>{s?.testedDate || "-"}</td>
                </tr>
                <tr>
                  <td className="grid-label">Supplier Name</td>
                  <td>{s?.supplierName || "-"}</td>
                  <td className="grid-label">PO No.</td>
                  <td>{s?.poNo || "-"}</td>
                </tr>
                <tr>
                  <td className="grid-label">Material Description</td>
                  <td>{s?.materialDesc || "-"}</td>
                  <td className="grid-label">GIR No.</td>
                  <td>{s?.girNo || "-"}</td>
                </tr>
                <tr>
                  <td className="grid-label">Invoice No. & Date</td>
                  <td>{s?.invoiceDetails || "-"}</td>
                  <td className="grid-label">Received Quantity</td>
                  <td>{s?.receivedQty || "-"}</td>
                </tr>
                <tr>
                  <td className="grid-label">Received Date (Rec)</td>
                  <td>{s?.recDate || "-"}</td>
                  <td className="grid-label">Location / Unit</td>
                  <td>{s?.location || "Manipal HO"}</td>
                </tr>
              </tbody>
            </table>

            <div className="table-responsive">
              <table className="table table-bordered table-iqc mb-3 align-middle">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: 40 }}>S #</th>
                    <th rowSpan={2} style={{ width: 200 }}>PARAMETERS</th>
                    <th rowSpan={2}>SPECIFICATION</th>
                    <th rowSpan={2} style={{ width: 90 }}>TOL. LIMIT</th>
                    <th rowSpan={2} style={{ width: 70 }}>UOM</th>
                    <th colSpan={maxSamples}>TESTED RESULTS</th>
                    <th rowSpan={2} style={{ width: 80 }}>REMARKS</th>
                  </tr>
                  <tr>
                    {Array.from({ length: maxSamples }, (_, i) => (
                      <th key={i} className="text-center" style={{ minWidth: 45 }}>{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-danger py-3">No parameter logs found for this report.</td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const readingsArr = (item.readings || "").toString().split(",").map((r) => r.trim());
                      return (
                        <tr key={idx}>
                          <td className="text-center font-monospace">{idx + 1}</td>
                          <td className="fw-medium">{item.parameter || "-"}</td>
                          <td>{item.specification || "-"}</td>
                          <td className="text-center">{item.tolLimit || "-"}</td>
                          <td className="text-center">{item.uom || "-"}</td>
                          {Array.from({ length: maxSamples }, (_, s2) => (
                            <td key={s2} className="text-center font-monospace text-primary fw-bold">
                              {readingsArr[s2] !== undefined && readingsArr[s2] !== "" ? readingsArr[s2] : "-"}
                            </td>
                          ))}
                          <td className="text-center fw-semibold">{item.remarks || "OK"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border p-3 mb-3 rounded-3 bg-light">
              <div className="row align-items-center mb-2">
                <div className="col-md-3 fw-bold small text-secondary">Acceptance Criteria:</div>
                <div className="col-md-9">
                  {s ? <span className={accClass}>● {s.lotStatus}</span> : "-"}
                </div>
              </div>
              <div className="row align-items-center">
                <div className="col-md-3 fw-bold small text-secondary">Defect Criteria:</div>
                <div className="col-md-9">
                  {first ? <span className={defClass}>● {first.defectCriteria || "Minor Defect"}</span> : "-"}
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="fw-bold small mb-1 text-secondary">QC Remarks:</label>
              <div className="p-3 border rounded-3 bg-white text-dark small" style={{ minHeight: "60px" }}>
                {s?.qcRemarks || "-"}
              </div>
            </div>

            <div className="row small fw-bold mb-2">
              <div className="col-6">
                QC Done By: <span className="text-primary">{first?.qcDoneBy || "-"}</span>
              </div>
              <div className="col-6 text-end">
                Checked By: <span className="text-primary">{first?.checkedBy || "-"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceivingInspectionDashboard;