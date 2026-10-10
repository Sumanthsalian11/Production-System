import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";
import * as XLSX from "xlsx";
import { Plus } from "lucide-react";
import PrepressArtworkDashboard from "./Prepressartworkdashboard";

// ============================================================================
// 🎨 Embedded vector icons (same set as the Reel Register page – no extra deps)
// ============================================================================
const Icons = {
  Factory: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" />
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
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

// 🎨 presentation helper: round icon badge + heading + small pill
const SectionHead = ({ icon: Icon, color = "blue", title, pill }) => (
  <div className="card-heading-row">
    <div className="heading-with-icon">
      <div className={`heading-icon-badge ${color}`}>
        <Icon />
      </div>
      <h2>{title}</h2>
    </div>
    {pill ? <span className="section-pill-tag">{pill}</span> : null}
  </div>
);

const preprocessStyles = `
  @keyframes pulseNotification {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    50% { transform: scale(1.03); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
  @keyframes glowPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }

  /* ---------- Aqua glass backdrop ---------- */
  .dashboard-container{position:relative;width:100%!important;max-width:none!important;box-sizing:border-box;min-height:100%;margin:0!important;padding:14px 18px 28px;overflow:hidden;border:0;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#0b2f4f;background:radial-gradient(circle at 12% 6%,rgba(255,255,255,.85) 0,rgba(255,255,255,0) 30%),radial-gradient(circle at 88% 18%,rgba(160,228,255,.7) 0,rgba(160,228,255,0) 32%),radial-gradient(circle at 50% 100%,rgba(255,255,255,.7) 0,rgba(255,255,255,0) 45%),linear-gradient(165deg,#eaf8ff 0%,#c9ecfb 38%,#a6dcf5 72%,#d9f2fd 100%)}
  .dashboard-container>*{position:relative}

  /* ---------- Glossy hero header ---------- */
  .dashboard-heading{position:relative;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 12px;padding:9px 18px;border-radius:20px;color:#0b2f4f;background:linear-gradient(180deg,rgba(255,255,255,.92) 0%,rgba(222,244,254,.8) 100%);border:1px solid rgba(255,255,255,.95);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 14px 30px rgba(40,120,170,.18),inset 0 1px 0 #fff,inset 0 -10px 22px rgba(140,210,245,.2)}
  .hero-left-branding{display:flex;align-items:center;gap:14px}
  .hero-emblem-3d{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background:radial-gradient(circle at 30% 25%,#b6ecff 0%,#34b6f0 40%,#0a6fb8 100%);box-shadow:0 8px 18px rgba(2,60,110,.45),inset 0 2px 3px rgba(255,255,255,.8),inset 0 -4px 8px rgba(0,60,120,.35);flex-shrink:0}
  .dashboard-heading h3{margin:0;font-size:21px;font-weight:800;letter-spacing:-.4px;color:#0a4f8c}
  .dashboard-heading p{margin:1px 0 0;font-size:11.5px;font-weight:600;color:#4a7391}
  .operator-pill-3d{display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:30px;font-size:12px;font-weight:700;color:#0b2f4f;background:linear-gradient(180deg,#fff 0%,#dff6ff 100%);border:1px solid rgba(255,255,255,.9);box-shadow:0 4px 12px rgba(2,60,110,.25),inset 0 1px 0 #fff}
  .operator-pulse-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;animation:glowPulse 2s infinite}

  /* ---------- Section headings ---------- */
  .card-heading-row{display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px}
  .heading-with-icon{display:flex;align-items:center;gap:10px}
  .heading-icon-badge{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 5px 12px rgba(2,60,110,.3),inset 0 2px 2px rgba(255,255,255,.7)}
  .heading-icon-badge svg{width:16px;height:16px}
  .heading-icon-badge.blue{background:radial-gradient(circle at 30% 25%,#b6ecff,#34b6f0 45%,#0a6fb8)}
  .heading-icon-badge.purple{background:radial-gradient(circle at 30% 25%,#d9ccff,#8b5cf6 50%,#5b21b6)}
  .heading-icon-badge.amber{background:radial-gradient(circle at 30% 25%,#ffe6a8,#f59e0b 50%,#b45309)}
  .heading-icon-badge.green{background:radial-gradient(circle at 30% 25%,#b4f5d0,#10b981 50%,#047857)}
  .card-heading-row h2{font-size:15px;font-weight:800;margin:0;color:#0b2f4f}
  .section-pill-tag{font-size:11px;font-weight:800;padding:4px 11px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px;background:linear-gradient(180deg,#fff,#d4f0fd);color:#0a4f8c;border:1px solid #a6d6ee}

  /* ---------- Glass filter bar + inset inputs ---------- */
  .filter-bar{display:flex;justify-content:flex-start;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.92) 0%,rgba(226,246,255,.86) 100%);border:1px solid rgba(255,255,255,.95);box-shadow:0 10px 24px rgba(40,120,170,.16),inset 0 1px 0 #fff,inset 0 -8px 18px rgba(140,210,245,.18)}
  .filter-bar .form-control,.filter-bar .form-select{min-height:36px;padding:6px 12px;border:1.5px solid #9ccbe6;border-radius:12px;color:#0b2f4f;background:#fff;font-size:13px;font-weight:700;box-shadow:inset 0 2px 5px rgba(10,80,130,.12),0 1px 0 rgba(255,255,255,.9);flex:1 1 150px;min-width:110px;max-width:230px;transition:all .2s cubic-bezier(.4,0,.2,1)}
  .filter-bar .form-control::placeholder{color:#7b9db5;font-weight:600;opacity:1}
  .filter-bar .form-control:focus,.filter-bar .form-select:focus{border-color:#1b9be0;outline:none;box-shadow:inset 0 1px 2px rgba(10,80,130,.08),0 0 0 4px rgba(27,155,224,.22)}
  .filter-bar .btn,.filter-bar span{flex:0 0 auto;white-space:nowrap}

  /* ---------- Glossy 3D aqua buttons ---------- */
  .dashboard-container .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid rgba(255,255,255,.6);border-radius:12px;font-weight:800;color:#fff;text-decoration:none;text-shadow:0 1px 2px rgba(0,60,110,.35);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,filter .12s ease}
  .dashboard-container .btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.04);color:#fff}
  .dashboard-container .btn:active:not(:disabled){transform:translateY(2px)}
  .dashboard-container .btn:disabled{opacity:.5;cursor:not-allowed}
  .dashboard-container .btn-primary{background:linear-gradient(180deg,#b4ecff 0%,#5cc4f2 48%,#2ea4e6 52%,#1b8fd6 100%);box-shadow:0 3px 0 #1479b8,0 8px 14px rgba(30,130,190,.28),inset 0 1px 0 rgba(255,255,255,.85)}
  .dashboard-container .btn-info{background:linear-gradient(180deg,#a8e6ff 0%,#4fb8ee 55%,#2a9be0 100%);box-shadow:0 3px 0 #1479b8,0 6px 10px rgba(30,130,190,.25),inset 0 1px 0 rgba(255,255,255,.8)}
  .dashboard-container .btn-success{background:linear-gradient(180deg,#b9f5d6 0%,#5fdda6 48%,#2cc58a 52%,#14a870 100%);box-shadow:0 3px 0 #0d8a5a,0 8px 14px rgba(20,168,112,.26),inset 0 1px 0 rgba(255,255,255,.85)}
  .dashboard-container .btn-danger{background:linear-gradient(180deg,#ff9d9d 0%,#ef4444 50%,#b91c1c 100%);box-shadow:0 3px 0 #991b1b,0 6px 10px rgba(185,28,28,.25),inset 0 1px 0 rgba(255,255,255,.6)}
  .dashboard-container .btn-secondary{background:linear-gradient(180deg,#d3e2ee 0%,#9bb6ca 50%,#6f8fa6 100%);box-shadow:0 3px 0 #587588,0 6px 10px rgba(80,110,135,.25),inset 0 1px 0 rgba(255,255,255,.8)}

  /* ---------- Colorful 3D tables ---------- */
  .scrollable-table-container{width:100%;overflow:auto;border-radius:18px;background:#fff}
  .production-real-table-wrap{background:#fff;border:1px solid #a6d6ee;border-radius:18px;box-shadow:0 8px 20px rgba(10,100,160,.14),inset 0 1px 0 rgba(255,255,255,.9)}
  .production-real-table-wrap::-webkit-scrollbar{width:8px;height:8px}
  .production-real-table-wrap::-webkit-scrollbar-track{background:#e8f4fa;border-radius:8px}
  .production-real-table-wrap::-webkit-scrollbar-thumb{background:#84b5ce;border-radius:8px}
  .production-real-table-wrap::-webkit-scrollbar-thumb:hover{background:#5a9bbd}
  .production-real-table{width:100%;min-width:0;margin:0;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:.81rem;color:#0b2f4f;background:#fff}
  .production-real-table th,.production-real-table td{overflow-wrap:anywhere;word-break:break-word;vertical-align:middle}
  .production-real-table thead th{position:sticky;top:0;z-index:1;padding:11px 10px;background:linear-gradient(180deg,#f4fbff 0%,#d9eefb 100%)!important;color:#0a4f8c!important;border:0!important;border-bottom:2px solid #9ccbe6!important;font-size:.68rem;font-weight:800;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap}
  .production-real-table tbody td{padding:9px 10px;border:0!important;border-bottom:1px solid #dcecf6!important;border-right:1px solid #f1f8fc!important;font-weight:600;color:#0b2f4f;background:#fff}
  .production-real-table tbody tr:nth-child(even) td{background:#f3faff}
  .production-real-table tbody tr:hover td{background:#d9f2fc!important}
  .production-real-table .empty-state{padding:42px!important;color:#4a7391!important;font-weight:700;text-align:center}
  .planned-workorders-table th,.planned-workorders-table td{overflow-wrap:anywhere;word-break:break-word}
  .empty-state{padding:42px!important;color:#4a7391!important;font-weight:700;text-align:center}

  /* ---------- Status pills ---------- */
  .status-pill{display:inline-block;padding:3px 10px;border-radius:10px;font-size:.7rem;font-weight:800;letter-spacing:.03em;text-transform:uppercase}
  .status-pending{background:#fef3c7;color:#b45309;border:1px solid #fde68a}
  .status-approved{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
  .status-rejected{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}

  /* ---------- Floating "+" button ---------- */
  .pt-fab{position:fixed;bottom:28px;right:28px;width:54px;height:54px;border-radius:50%;color:#fff;border:1px solid rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:100;background:linear-gradient(180deg,#b4ecff 0%,#5cc4f2 48%,#2ea4e6 52%,#1b8fd6 100%);box-shadow:0 4px 0 #1479b8,0 12px 22px rgba(30,130,190,.35),inset 0 1px 0 rgba(255,255,255,.85);transition:transform .12s ease}
  .pt-fab:hover{transform:translateY(-2px)}
  .pt-fab:active{transform:translateY(2px)}

  @media(max-width:768px){.dashboard-container{padding:12px}.dashboard-heading{flex-direction:column;align-items:flex-start;padding:14px}.dashboard-heading>div:last-child{width:100%;justify-content:flex-start;flex-wrap:wrap}.filter-bar{justify-content:stretch}.filter-bar .form-control,.filter-bar .form-select{width:100%!important}}
`;

const emptyProductionForm = {
  date: new Date().toISOString().slice(0, 10),
  woNumber: "",
  customerName: "",
  jobName: "",
  machine: [],
  producedQty: "",
  wastageQty: "",
  reason: "",
  remark: "",
};

function PreprocessDashboard() {
  const token = localStorage.getItem("token");

  const [loggedInUser, setLoggedInUser] = useState("");
  const [userLocations, setUserLocations] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [completedRecords, setCompletedRecords] = useState([]);
  const [completedLoading, setCompletedLoading] = useState(false);

  // Row hidden the moment "Done" succeeds
  const [hiddenOrders, setHiddenOrders] = useState([]);

  // Plate Requests (separate approval queue)
  const [plateRequests, setPlateRequests] = useState([]);
  const [plateRequestsLoading, setPlateRequestsLoading] = useState(false);
  const [hiddenPlateRequests, setHiddenPlateRequests] = useState([]);

  // Full Plate Request history ("My Plate Requests" style table)
  const [allPlateRequests, setAllPlateRequests] = useState([]);
  const [allPlateRequestsLoading, setAllPlateRequestsLoading] = useState(false);
  const [prFilterWoNo, setPrFilterWoNo] = useState("");
  const [prFilterCustomer, setPrFilterCustomer] = useState("");
  const [prFilterProductType, setPrFilterProductType] = useState("");
  const [prFilterStatus, setPrFilterStatus] = useState("");
  const [prFilterFromDate, setPrFilterFromDate] = useState("");
  const [prFilterToDate, setPrFilterToDate] = useState("");

  // Which view is showing: "workorders" | "platerequests" | "production"
  const [activeView, setActiveView] = useState("workorders");

  // Production Log
  const [productionEntries, setProductionEntries] = useState([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [showProductionForm, setShowProductionForm] = useState(false);
  const [productionForm, setProductionForm] = useState(emptyProductionForm);
  const [productionWoMatched, setProductionWoMatched] = useState(null);
  const [productionSearch, setProductionSearch] = useState("");
  const [productionMachineFilter, setProductionMachineFilter] = useState("all");
  const [productionFilterFromDate, setProductionFilterFromDate] = useState("");
  const [productionFilterToDate, setProductionFilterToDate] = useState("");
  const [editingProductionId, setEditingProductionId] = useState(null);
  const [expandedCellKey, setExpandedCellKey] = useState(null); // "<rowId>-<field>" | null

  // Filters
  const [filterWoNo, setFilterWoNo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterMachine, setFilterMachine] = useState("");

  const showAlert = (title, text = "", icon = "warning") => {
    Swal.fire({
      title,
      text,
      icon,
      confirmButtonColor: "#3085d6",
      width: "350px"
    });
  };

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name);
      setUserLocations(decoded.locations || []);
    }
    fetchPending();
    fetchMachines();
    fetchCompleted();
    fetchPlateRequests();
    fetchAllPlateRequests();
    fetchProduction();

    // Auto-polling every 20 seconds to keep Plate Request notifications updated
    const interval = setInterval(() => {
      fetchPlateRequests();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const fetchCompleted = async () => {
    setCompletedLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/preprocess`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompletedRecords(res.data || []);
    } catch (err) {
      console.error("Error fetching completed records:", err);
      setCompletedRecords([]);
    }
    setCompletedLoading(false);
  };

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/preprocess/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkOrders(res.data || []);
    } catch (err) {
      console.error("Error fetching pending work orders:", err);
      setWorkOrders([]);
    }
    setLoading(false);
  };

  const fetchMachines = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/machines`);
      setMachines(res.data || []);
    } catch (err) {
      console.error("Error fetching machines:", err);
    }
  };

  const fetchProduction = async () => {
    setProductionLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/production-log`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductionEntries(res.data || []);
    } catch (err) {
      console.error("Error fetching production log:", err);
      setProductionEntries([]);
    }
    setProductionLoading(false);
  };

  const handleProductionWoInput = (val) => {
    setProductionForm(f => ({ ...f, woNumber: val }));
    if (!val.trim()) setProductionWoMatched(null);
  };

  const lookupProductionWo = async () => {
    const woNo = productionForm.woNumber.trim();
    if (!woNo) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/production-log/wo-lookup/${woNo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductionWoMatched(true);
      setProductionForm(f => ({
        ...f,
        customerName: res.data.customerName,
        jobName: res.data.jobName,
        machine: res.data.machine || [],
      }));
    } catch (err) {
      setProductionWoMatched(false);
      setProductionForm(f => ({ ...f, customerName: "", jobName: "", machine: [] }));
    }
  };

  const resetProductionForm = () => {
    setProductionForm(emptyProductionForm);
    setProductionWoMatched(null);
    setEditingProductionId(null);
  };

  const startEditProduction = (entry) => {
    setEditingProductionId(entry._id);
    setProductionForm({
      date: entry.date ? new Date(entry.date).toISOString().slice(0, 10) : "",
      woNumber: entry.woNumber || "",
      customerName: entry.customerName || "",
      jobName: entry.jobName || "",
      machine: entry.machine || [],
      producedQty: entry.producedQty ?? "",
      wastageQty: entry.wastageQty ?? "",
      reason: entry.reason || "",
      remark: entry.remark || "",
    });
    setProductionWoMatched(true);
    setShowProductionForm(true);
  };

  const deleteProductionEntry = async (entry) => {
    const result = await Swal.fire({
      title: "Delete this entry?",
      text: `WO ${entry.woNumber} — this cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete",
      width: "350px"
    });
    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${BASE_URL}/api/production-log/${entry._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProduction();
      showAlert("Success", "Entry deleted successfully", "success");
    } catch (err) {
      console.error("Error deleting production entry:", err.response?.data || err);
      showAlert("Error", err.response?.data?.message || "Error deleting entry", "error");
    }
  };

  const addProductionEntry = async () => {
    if (
      !productionForm.date ||
      !productionForm.woNumber.trim() ||
      !productionForm.customerName.trim() ||
      !productionForm.jobName.trim() ||
      !productionForm.machine.length ||
      productionForm.producedQty === ""
    ) return;
    const payload = {
      date: productionForm.date,
      woNumber: productionForm.woNumber.trim(),
      customerName: productionForm.customerName.trim(),
      jobName: productionForm.jobName.trim(),
      machine: productionForm.machine,
      producedQty: Number(productionForm.producedQty) || 0,
      wastageQty: Number(productionForm.wastageQty) || 0,
      reason: productionForm.reason.trim(),
      remark: productionForm.remark.trim(),
    };

    const isEdit = Boolean(editingProductionId);
    try {
      if (isEdit) {
        await axios.put(`${BASE_URL}/api/production-log/${editingProductionId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${BASE_URL}/api/production-log`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      resetProductionForm();
      setShowProductionForm(false);
      fetchProduction();
      showAlert("Success", isEdit ? "Entry updated successfully" : "Entry saved successfully", "success");
    } catch (err) {
      console.error("Error saving production entry:", err.response?.data || err);
      showAlert("Error", err.response?.data?.message || "Error saving production entry", "error");
    }
  };

  const exportProductionToExcel = () => {
    const data = displayedProduction.map((e, i) => ({
      "Sl No": displayedProduction.length - i,
      "Date": new Date(e.date).toLocaleDateString("en-IN"),
      "WO No": e.woNumber,
      "Customer": e.customerName || "-",
      "Job Name": e.jobName || "-",
      "Machine": e.machine?.length ? e.machine.join(", ") : "-",
      "Produced": e.producedQty ?? "-",
      "Wastage": e.wastageQty || "-",
      "Reason": e.reason || "-",
      "Remark": e.remark || "-",
      "Logged By": e.loggedBy || "-",
      "Logged At": e.createdAt ? new Date(e.createdAt).toLocaleString("en-IN") : "-",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production Log");
    XLSX.writeFile(wb, `Production_Log_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const fetchPlateRequests = async () => {
    setPlateRequestsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/platerequest/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlateRequests(res.data || []);
    } catch (err) {
      console.error("Error fetching plate requests:", err);
      setPlateRequests([]);
    }
    setPlateRequestsLoading(false);
  };

  const fetchAllPlateRequests = async () => {
    setAllPlateRequestsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/platerequest`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllPlateRequests(res.data || []);
    } catch (err) {
      console.error("Error fetching plate request history:", err);
      setAllPlateRequests([]);
    }
    setAllPlateRequestsLoading(false);
  };

  // ===== "Done" clicked on a row -> saves snapshot to Preprocess table =====
  const handleDone = async (wo) => {
    const result = await Swal.fire({
      title: "Mark as done?",
      text: `Work Order ${wo.efiWoNumber} will be saved to the Prepress record.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, done",
      width: "350px"
    });

    if (!result.isConfirmed) return;

    setHiddenOrders(prev => [...prev, wo._id]);

    try {
      await axios.post(
        `${BASE_URL}/api/preprocess/complete`,
        { workOrderId: wo._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert("Success", `Work Order ${wo.efiWoNumber} marked done`, "success");
      fetchPending();
      fetchCompleted();
    } catch (err) {
      console.error("Error completing work order:", err.response?.data || err);
      setHiddenOrders(prev => prev.filter(id => id !== wo._id));
      showAlert(
        "Error",
        err.response?.data?.message || "Error marking work order done",
        "error"
      );
    }
  };

  // ===== Approve / Reject a Plate Request =====
  const handlePlateRequestDecision = async (request, decision) => {
    const isApprove = decision === "approve";

    const result = await Swal.fire({
      title: isApprove ? "Approve plate request?" : "Reject plate request?",
      text: `Job "${request.jobName}" for WO ${request.efiWoNumber}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: isApprove ? "#16a34a" : "#dc2626",
      cancelButtonColor: "#6c757d",
      confirmButtonText: isApprove ? "Yes, approve" : "Yes, reject",
      input: "text",
      inputPlaceholder: "Optional remarks",
      width: "360px"
    });

    if (!result.isConfirmed) return;

    setHiddenPlateRequests(prev => [...prev, request._id]);

    try {
      await axios.post(
        `${BASE_URL}/api/platerequest/${request._id}/${decision}`,
        { reviewRemarks: result.value || "" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert(
        "Success",
        `Plate request ${isApprove ? "approved" : "rejected"}`,
        "success"
      );
      fetchPlateRequests();
      fetchAllPlateRequests();
    } catch (err) {
      console.error("Error updating plate request:", err.response?.data || err);
      setHiddenPlateRequests(prev => prev.filter(id => id !== request._id));
      showAlert(
        "Error",
        err.response?.data?.message || "Error updating plate request",
        "error"
      );
    }
  };

  // Combined customer options from both Pending and Completed records
  const customerOptions = [
    ...new Set([
      ...workOrders.map(wo => wo.customer?.name || wo.customer),
      ...completedRecords.map(rec => rec.customer)
    ].filter(Boolean))
  ].sort((a, b) => String(a).localeCompare(String(b)));

  // Filtered Pending Work Orders
  const displayedWorkOrders = workOrders
    .filter(wo => !hiddenOrders.includes(wo._id))
    .filter(wo => filterWoNo === "" || String(wo.efiWoNumber).toLowerCase().includes(filterWoNo.trim().toLowerCase()))
    .filter(wo => {
      const customerName = wo.customer?.name || wo.customer || "";
      return filterCustomer === "" || customerName === filterCustomer;
    })
    .filter(wo => {
      if (filterMachine === "") return true;
      return wo.machines?.some(
        m => String(m.machineId?._id || m.machineId) === String(filterMachine)
      );
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Filtered Completed Prepress Records
  const displayedCompletedRecords = completedRecords
    .filter(rec => filterWoNo === "" || String(rec.efiWoNumber).toLowerCase().includes(filterWoNo.trim().toLowerCase()))
    .filter(rec => {
      const customerName = rec.customer || "";
      return filterCustomer === "" || customerName === filterCustomer;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const displayedPlateRequests = plateRequests
    .filter(r => !hiddenPlateRequests.includes(r._id))
    .filter(r => r.userLocations?.some(loc => userLocations.includes(loc)));

  const pendingPlateCount = displayedPlateRequests.length;

  const productionMachineOptions = [
    ...new Set(productionEntries.flatMap(e => e.machine || []).filter(Boolean))
  ];

  const truncCellStyle = (key) =>
    expandedCellKey === key
      ? { maxWidth: 260, whiteSpace: "normal", wordBreak: "break-word", cursor: "pointer" }
      : { maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" };

  const prCustomerOptions = [
    ...new Set(allPlateRequests.map(r => r.customerName).filter(Boolean))
  ];
  const prProductTypeOptions = [
    ...new Set(allPlateRequests.map(r => r.productType).filter(Boolean))
  ];

  const displayedAllPlateRequests = allPlateRequests
    .filter(r => r.userLocations?.some(loc => userLocations.includes(loc)))
    .filter(r => {
    const matchWo = prFilterWoNo === "" || String(r.efiWoNumber).toLowerCase().includes(prFilterWoNo.trim().toLowerCase());
    const matchCustomer = prFilterCustomer === "" || r.customerName === prFilterCustomer;
    const matchProductType = prFilterProductType === "" || r.productType === prFilterProductType;
    const matchStatus = prFilterStatus === "" || r.status === prFilterStatus;

    let matchDate = true;
    if (r.createdAt && (prFilterFromDate || prFilterToDate)) {
      const created = new Date(r.createdAt);
      if (prFilterFromDate) {
        const from = new Date(prFilterFromDate);
        from.setHours(0, 0, 0, 0);
        if (created < from) matchDate = false;
      }
      if (prFilterToDate) {
        const to = new Date(prFilterToDate);
        to.setHours(23, 59, 59, 999);
        if (created > to) matchDate = false;
      }
    }

    return matchWo && matchCustomer && matchProductType && matchStatus && matchDate;
  });

  const exportPlateRequestsToExcel = () => {
    const data = displayedAllPlateRequests.map((r, i) => ({
      "Sl No": i + 1,
      "WO No": r.efiWoNumber,
      "Customer": r.customerName || "-",
      "Job Description": r.jobDescription || r.jobName || "-",
      "Product Type": r.productType || "-",
      "Activity": r.activities?.length ? r.activities.join(", ") : "-",
      "Machine": r.machineNames?.length ? r.machineNames.join(", ") : "-",
      "Remarks": r.remarks || "-",
      "Status": r.status,
      "Requested By": r.requestedBy || "-",
      "Requested At": r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN") : "-",
      "Reviewed By": r.reviewedBy || "-",
      "Review Remarks": r.reviewRemarks || "-",
      "Reviewed At": r.reviewedAt ? new Date(r.reviewedAt).toLocaleString("en-IN") : "-"
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plate Requests");
    XLSX.writeFile(wb, `Plate_Requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const displayedProduction = productionEntries.filter(e => {
    if (productionMachineFilter !== "all" && !(e.machine || []).includes(productionMachineFilter)) return false;

    if (e.date && (productionFilterFromDate || productionFilterToDate)) {
      const entryDate = new Date(e.date);
      if (productionFilterFromDate) {
        const from = new Date(productionFilterFromDate);
        from.setHours(0, 0, 0, 0);
        if (entryDate < from) return false;
      }
      if (productionFilterToDate) {
        const to = new Date(productionFilterToDate);
        to.setHours(23, 59, 59, 999);
        if (entryDate > to) return false;
      }
    }

    if (!productionSearch.trim()) return true;
    const q = productionSearch.trim().toLowerCase();
    return (
      String(e.woNumber).toLowerCase().includes(q) ||
      (e.customerName || "").toLowerCase().includes(q) ||
      (e.jobName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ width: "100%", padding: 0, margin: 0 }}>
      <style>{preprocessStyles}</style>
      <div className="dashboard-container">
        
        {/* ===== GLOSSY HERO HEADER WITH VISIBLE PLATE NOTIFICATION SYSTEM ===== */}
        <div className="dashboard-heading">
          <div className="hero-left-branding">
            <div className="hero-emblem-3d">
              <Icons.Factory />
            </div>
            <div>
              <h3>Switch Pages👉🏼</h3>
              <p>
                {activeView === "workorders" && "Work orders pending prepress completion."}
                {activeView === "platerequests" && "Plate requests pending approval."}
                {activeView === "production" && "Production log for completed work orders."}
                {activeView === "prepressartwork" && "Artwork docket for prepress."}
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            {/* Header Notification Badge for Plate Requests */}
            {pendingPlateCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveView("platerequests")}
                className="d-flex align-items-center gap-2 border-0 shadow-sm"
                style={{
                  background: activeView === "platerequests"
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  color: "#fff",
                  borderRadius: "30px",
                  padding: "8px 16px",
                  fontWeight: "700",
                  fontSize: ".82rem",
                  cursor: "pointer",
                  animation: activeView === "platerequests" ? "none" : "pulseNotification 2s infinite",
                  transition: "transform .15s ease"
                }}
                title="Click to view pending plate requests"
              >
                <span style={{ fontSize: "14px" }}>🔔</span>
                <span>Plate Requests</span>
                <span
                  className="badge rounded-pill bg-white"
                  style={{
                    color: activeView === "platerequests" ? "#059669" : "#dc2626",
                    fontWeight: "800",
                    fontSize: "11px",
                    padding: "3px 8px"
                  }}
                >
                  {pendingPlateCount}
                </span>
              </button>
            )}

            {/* View Selector with Corner Notification Badge */}
            <div style={{ position: "relative" }}>
              <select
                value={activeView}
                onChange={(e) => setActiveView(e.target.value)}
                style={{
                  border: "1.5px solid #9ccbe6",
                  borderRadius: 12,
                  padding: "8px 14px",
                  paddingRight: "34px",
                  fontSize: ".85rem",
                  fontWeight: 800,
                  color: "#0b2f4f",
                  background: "linear-gradient(180deg, #ffffff 0%, #dff6ff 100%)",
                  boxShadow: "0 4px 12px rgba(2, 60, 110, 0.2), inset 0 1px 0 #fff",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                <option value="workorders" style={{ color: "#172238" }}>Work Orders</option>
                <option value="platerequests" style={{ color: "#172238" }}>
                  Plate Requests {pendingPlateCount > 0 ? `(${pendingPlateCount})` : ""}
                </option>
                <option value="production" style={{ color: "#172238" }}>Plate Tracker</option>
                <option value="prepressartwork" style={{ color: "#172238" }}>Prepress Artwork</option>
              </select>

              {/* Floating Alert Pill on Dropdown when viewing other tabs */}
              {pendingPlateCount > 0 && activeView !== "platerequests" && (
                <span
                  onClick={() => setActiveView("platerequests")}
                  className="badge rounded-pill bg-danger text-white position-absolute"
                  style={{
                    top: "-8px",
                    right: "-6px",
                    padding: "4px 7px",
                    fontSize: "10.5px",
                    fontWeight: "800",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    border: "2px solid #ffffff"
                  }}
                  title={`${pendingPlateCount} Plate Requests Pending Approval`}
                >
                  {pendingPlateCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {activeView === "workorders" ? (
          <>
            {/* ===== FILTERS (Applies to both tables) ===== */}
            <div className="filter-bar production-real-filter-bar">
              <input
                type="text"
                placeholder="WO Number"
                className="form-control form-control-sm"
                style={{ width: "160px" }}
                value={filterWoNo}
                onChange={(e) => setFilterWoNo(e.target.value)}
              />
              <select
                className="form-select form-select-sm"
                style={{ width: "180px" }}
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
              >
                <option value="">All Customers</option>
                {customerOptions.map((cust, i) => (
                  <option key={i} value={cust}>{cust}</option>
                ))}
              </select>
              {(filterWoNo || filterCustomer || filterMachine) && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => { setFilterWoNo(""); setFilterCustomer(""); setFilterMachine(""); }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* ===== PENDING WORK ORDERS TABLE ===== */}
            <SectionHead
              icon={Icons.Reel}
              color="blue"
              title="Pending Work Orders"
              pill={`${displayedWorkOrders.length} pending`}
            />
            <div className="production-real-table-wrap" style={{ maxHeight: 280, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th style={{ width: "70px", textAlign: "center" }}>SL No</th>
                    <th style={{ width: "90px", textAlign: "center" }}>WO NO</th>
                    <th style={{ minWidth: "120px", textAlign: "left" }}>Product Code</th>
                    <th style={{ minWidth: "220px", textAlign: "left" }}>Customer Name</th>
                    <th style={{ minWidth: "110px", textAlign: "right", paddingRight: "18px" }}>Order Qty</th>
                    <th style={{ width: "95px", textAlign: "center" }}>View PDF</th>
                    <th style={{ minWidth: "160px", textAlign: "left" }}>Planning</th>
                    <th style={{ width: "90px", textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="empty-state" colSpan="8">Loading...</td></tr>
                  ) : displayedWorkOrders.length === 0 ? (
                    <tr><td className="empty-state" colSpan="8">No Work Orders Pending for Prepress</td></tr>
                  ) : (
                    displayedWorkOrders.map(wo => {
                      const custName = wo.customer?.name || wo.customer || "-";
                      return (
                        <tr key={wo._id}>
                          <td style={{ textAlign: "center", fontWeight: "700" }}>{wo.slNo}</td>
                          <td style={{ textAlign: "center", fontWeight: "700", color: "#0a4f8c" }}>{wo.efiWoNumber}</td>
                          <td style={{ textAlign: "left" }}>{wo.productCode}</td>
                          <td
                            style={{ ...truncCellStyle(`${wo._id}-customer`), textAlign: "left" }}
                            onClick={() => setExpandedCellKey(k => k === `${wo._id}-customer` ? null : `${wo._id}-customer`)}
                            title={typeof custName === "string" ? custName : ""}
                          >
                            {custName}
                          </td>
                          <td style={{ textAlign: "right", paddingRight: "18px", fontWeight: "700" }}>{wo.orderQty}</td>
                          <td style={{ textAlign: "center" }}>
                            {wo.itemPdfPath ? (
                              <a
                                href={`${BASE_URL}${wo.itemPdfPath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-info"
                              >
                                View
                              </a>
                            ) : "-"}
                          </td>
                          <td style={{ textAlign: "left" }}>
                            {wo.planningUser
                              ? `${wo.planningUser} - ${new Date(wo.createdAt).toLocaleString("en-IN")}`
                              : "-"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleDone(wo)}
                            >
                              Done
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== COMPLETED RECORDS TABLE (TOP 50 WITH ALIGNED HEADERS) ===== */}
            <SectionHead
              icon={Icons.Factory}
              color="green"
              title="Completed Prepress Records"
              pill="Top 50 Entries"
            />

            <div className="production-real-table-wrap" style={{ maxHeight: 360, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th style={{ width: "70px", textAlign: "center" }}>SL No</th>
                    <th style={{ width: "90px", textAlign: "center" }}>WO NO</th>
                    <th style={{ minWidth: "120px", textAlign: "left" }}>Product Code</th>
                    <th style={{ minWidth: "220px", textAlign: "left" }}>Customer Name</th>
                    <th style={{ minWidth: "110px", textAlign: "right", paddingRight: "20px" }}>Order Qty</th>
                    <th style={{ width: "95px", textAlign: "center" }}>View PDF</th>
                    <th style={{ minWidth: "120px", textAlign: "left" }}>Planning</th>
                    <th style={{ minWidth: "130px", textAlign: "left" }}>Completed By</th>
                    <th style={{ minWidth: "160px", textAlign: "left" }}>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {completedLoading ? (
                    <tr><td className="empty-state" colSpan="9">Loading...</td></tr>
                  ) : displayedCompletedRecords.length === 0 ? (
                    <tr><td className="empty-state" colSpan="9">No Completed Records Found</td></tr>
                  ) : (
                    displayedCompletedRecords.slice(0, 50).map((rec, i) => {
                      const custName = rec.customer || "-";
                      const rowKey = rec._id || `completed-${i}`;
                      return (
                        <tr key={rowKey}>
                          <td style={{ textAlign: "center", fontWeight: "700" }}>{rec.slNo}</td>
                          <td style={{ textAlign: "center", fontWeight: "700", color: "#0a4f8c" }}>{rec.efiWoNumber}</td>
                          <td style={{ textAlign: "left" }}>{rec.productCode}</td>
                          <td
                            style={{ ...truncCellStyle(`${rowKey}-customer`), textAlign: "left", fontWeight: "600" }}
                            onClick={() => setExpandedCellKey(k => k === `${rowKey}-customer` ? null : `${rowKey}-customer`)}
                            title={typeof custName === "string" ? custName : ""}
                          >
                            {custName}
                          </td>
                          <td style={{ textAlign: "right", paddingRight: "20px", fontWeight: "700" }}>
                            {rec.orderQty ? Number(rec.orderQty).toLocaleString("en-IN") : "-"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {rec.itemPdfPath ? (
                              <a
                                href={`${BASE_URL}${rec.itemPdfPath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-info px-2 py-1"
                                style={{ fontSize: "11.5px" }}
                              >
                                View
                              </a>
                            ) : "-"}
                          </td>
                          <td style={{ textAlign: "left" }}>{rec.planningUser || "-"}</td>
                          <td style={{ textAlign: "left" }}>{rec.assignedBy || "-"}</td>
                          <td style={{ textAlign: "left", fontSize: "12px" }}>
                            {rec.createdAt ? new Date(rec.createdAt).toLocaleString("en-IN") : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeView === "platerequests" ? (
          <>
            {/* ===== PLATE REQUESTS TABLE ===== */}
            <SectionHead
              icon={Icons.Alert}
              color="amber"
              title="Plate Requests Pending Approval"
              pill={`${displayedPlateRequests.length} pending`}
            />
            <div className="production-real-table-wrap" style={{ maxHeight: 300, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th>WO NO</th>
                    <th>Product Type</th>
                    <th>Job Description</th>
                    <th>Activity</th>
                    <th>Machine</th>
                    <th>Remarks</th>
                    <th>Requested By</th>
                    <th>Requested At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plateRequestsLoading ? (
                    <tr><td className="empty-state" colSpan="9">Loading...</td></tr>
                  ) : displayedPlateRequests.length === 0 ? (
                    <tr><td className="empty-state" colSpan="9">No Plate Requests Pending</td></tr>
                  ) : (
                    displayedPlateRequests.map(req => (
                      <tr key={req._id}>
                        <td>{req.efiWoNumber}</td>
                        <td>{req.productType || "-"}</td>
                        <td>{req.jobName}</td>
                        <td>{req.activities?.length ? req.activities.join(", ") : "-"}</td>
                        <td>{req.machineNames?.length ? req.machineNames.join(", ") : "-"}</td>
                        <td>{req.remarks || "-"}</td>
                        <td>{req.requestedBy}</td>
                        <td>{new Date(req.createdAt).toLocaleString("en-IN")}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handlePlateRequestDecision(req, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handlePlateRequestDecision(req, "reject")}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== ALL PLATE REQUESTS (full history, like PlateRequestForm) ===== */}
            <SectionHead
              icon={Icons.Search}
              color="purple"
              title="All Plate Requests"
              pill={`${displayedAllPlateRequests.length} records`}
            />

            <div className="filter-bar" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="WO Number"
                className="form-control form-control-sm"
                style={{ width: "130px" }}
                value={prFilterWoNo}
                onChange={(e) => setPrFilterWoNo(e.target.value)}
              />
              <select
                className="form-select form-select-sm"
                style={{ width: "150px" }}
                value={prFilterCustomer}
                onChange={(e) => setPrFilterCustomer(e.target.value)}
              >
                <option value="">All Customers</option>
                {prCustomerOptions.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
              <select
                className="form-select form-select-sm"
                style={{ width: "150px" }}
                value={prFilterProductType}
                onChange={(e) => setPrFilterProductType(e.target.value)}
              >
                <option value="">All Product Types</option>
                {prProductTypeOptions.map((t, i) => (
                  <option key={i} value={t}>{t}</option>
                ))}
              </select>
              <select
                className="form-select form-select-sm"
                style={{ width: "130px" }}
                value={prFilterStatus}
                onChange={(e) => setPrFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0a4f8c", textTransform: "uppercase" }}>From</span>
              <input
                type="date"
                className="form-control form-control-sm"
                style={{ width: "125px" }}
                value={prFilterFromDate}
                onChange={(e) => setPrFilterFromDate(e.target.value)}
              />
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0a4f8c", textTransform: "uppercase" }}>To</span>
              <input
                type="date"
                className="form-control form-control-sm"
                style={{ width: "125px" }}
                value={prFilterToDate}
                onChange={(e) => setPrFilterToDate(e.target.value)}
              />
              {(prFilterWoNo || prFilterCustomer || prFilterProductType || prFilterStatus || prFilterFromDate || prFilterToDate) && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setPrFilterWoNo("");
                    setPrFilterCustomer("");
                    setPrFilterProductType("");
                    setPrFilterStatus("");
                    setPrFilterFromDate("");
                    setPrFilterToDate("");
                  }}
                >
                  Clear
                </button>
              )}
              <button
                className="btn btn-sm btn-success"
                onClick={exportPlateRequestsToExcel}
                style={{ padding: "8px 17px", fontSize: "12px", whiteSpace: "nowrap" }}
              >
                Export
              </button>
            </div>

            <div className="production-real-table-wrap" style={{ maxHeight: 400, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: "90px" }}>WO NO</th>
                    <th style={{ minWidth: "160px" }}>Customer</th>
                    <th style={{ minWidth: "160px" }}>Job Description</th>
                    <th style={{ minWidth: "110px" }}>Product Type</th>
                    <th style={{ minWidth: "130px" }}>Activity</th>
                    <th style={{ minWidth: "130px" }}>Machine</th>
                    <th style={{ minWidth: "130px" }}>Remarks</th>
                    <th style={{ width: "130px" }}>Status</th>
                    <th style={{ minWidth: "150px" }}>Requested By</th>
                    <th style={{ minWidth: "120px" }}>Reviewed By</th>
                    <th style={{ minWidth: "130px" }}>Review Remarks</th>
                    <th style={{ minWidth: "150px" }}>Reviewed At</th>
                  </tr>
                </thead>
                <tbody>
                  {allPlateRequestsLoading ? (
                    <tr><td className="empty-state" colSpan="12">Loading...</td></tr>
                  ) : displayedAllPlateRequests.length === 0 ? (
                    <tr><td className="empty-state" colSpan="12">No Plate Requests Found</td></tr>
                  ) : (
                    displayedAllPlateRequests.map(req => (
                      <tr key={req._id}>
                        <td>{req.efiWoNumber}</td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-customer`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-customer` ? null : `${req._id}-pr-customer`)}
                          title={req.customerName}
                        >
                          {req.customerName || "-"}
                        </td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-job`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-job` ? null : `${req._id}-pr-job`)}
                          title={req.jobDescription || req.jobName}
                        >
                          {req.jobDescription || req.jobName}
                        </td>
                        <td>{req.productType || "-"}</td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-activity`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-activity` ? null : `${req._id}-pr-activity`)}
                          title={req.activities?.join(", ")}
                        >
                          {req.activities?.length ? req.activities.join(", ") : "-"}
                        </td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-machine`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-machine` ? null : `${req._id}-pr-machine`)}
                          title={req.machineNames?.join(", ")}
                        >
                          {req.machineNames?.length ? req.machineNames.join(", ") : "-"}
                        </td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-remarks`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-remarks` ? null : `${req._id}-pr-remarks`)}
                          title={req.remarks}
                        >
                          {req.remarks || "-"}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              req.status === "APPROVED"
                                ? "status-approved"
                                : req.status === "REJECTED"
                                ? "status-rejected"
                                : "status-pending"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{req.requestedBy || "-"}</div>
                          <div style={{ fontSize: "11px", color: "#4a7391" }}>
                            {req.createdAt ? new Date(req.createdAt).toLocaleString("en-IN") : "-"}
                          </div>
                        </td>
                        <td>{req.reviewedBy || "-"}</td>
                        <td>{req.reviewRemarks || "-"}</td>
                        <td>{req.reviewedAt ? new Date(req.reviewedAt).toLocaleString("en-IN") : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeView === "prepressartwork" ? (
          <PrepressArtworkDashboard />
        ) : (
          <>
            {/* ===== PRODUCTION LOG ===== */}
            <div className="filter-bar">
              <input
                type="text"
                placeholder="Search WO, customer, job"
                className="form-control form-control-sm"
                style={{ flex: "2 1 220px", minWidth: "180px" }}
                value={productionSearch}
                onChange={(e) => setProductionSearch(e.target.value)}
              />
              <select
                className="form-select form-select-sm"
                style={{ flex: "1 1 160px", minWidth: "140px" }}
                value={productionMachineFilter}
                onChange={(e) => setProductionMachineFilter(e.target.value)}
              >
                <option value="all">All Machines</option>
                {productionMachineOptions.map((m, i) => (
                  <option key={i} value={m}>{m}</option>
                ))}
              </select>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0a4f8c", textTransform: "uppercase" }}>From</span>
              <input
                type="date"
                className="form-control form-control-sm"
                style={{ flex: "1 1 130px", minWidth: "120px", maxWidth: "160px" }}
                value={productionFilterFromDate}
                onChange={(e) => setProductionFilterFromDate(e.target.value)}
              />
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0a4f8c", textTransform: "uppercase" }}>To</span>
              <input
                type="date"
                className="form-control form-control-sm"
                style={{ flex: "1 1 130px", minWidth: "120px", maxWidth: "160px" }}
                value={productionFilterToDate}
                onChange={(e) => setProductionFilterToDate(e.target.value)}
              />
              {(productionFilterFromDate || productionFilterToDate) && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setProductionFilterFromDate("");
                    setProductionFilterToDate("");
                  }}
                >
                  Clear
                </button>
              )}
              <button
                className="btn btn-sm btn-success"
                onClick={exportProductionToExcel}
              >
                Export to Excel
              </button>
            </div>

            <SectionHead
              icon={Icons.Gauge}
              color="purple"
              title="Plate Tracker Log"
              pill={`${displayedProduction.length} entries`}
            />

            <div className="production-real-table-wrap" style={{ maxHeight: 380, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th style={{ width: "48px" }}>Sl No</th>
                    <th>Date</th>
                    <th>WO No</th>
                    <th>Customer</th>
                    <th>Job Name</th>
                    <th>Machine</th>
                    <th>Fresh plate</th>
                    <th>Wastage plate</th>
                    <th>Reason</th>
                    <th>Remark</th>
                    <th>Logged By</th>
                    <th>Logged At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {productionLoading ? (
                    <tr><td className="empty-state" colSpan="13">Loading...</td></tr>
                  ) : displayedProduction.length === 0 ? (
                    <tr><td className="empty-state" colSpan="13">No Production Entries</td></tr>
                  ) : (
                    displayedProduction.slice(0, 30).map((e, i) => (
                      <tr key={e._id || i}>
                        <td>{displayedProduction.length - i}</td>
                        <td>{new Date(e.date).toLocaleDateString("en-IN")}</td>
                        <td>{e.woNumber}</td>
                        <td style={truncCellStyle(`${e._id}-customer`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-customer` ? null : `${e._id}-customer`)} title={e.customerName}>{e.customerName || "-"}</td>
                        <td style={truncCellStyle(`${e._id}-job`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-job` ? null : `${e._id}-job`)} title={e.jobName}>{e.jobName || "-"}</td>
                        <td style={truncCellStyle(`${e._id}-machine`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-machine` ? null : `${e._id}-machine`)} title={e.machine?.join(", ")}>{e.machine?.length ? e.machine.join(", ") : "-"}</td>
                        <td>{e.producedQty ?? "-"}</td>
                        <td>{e.wastageQty || "-"}</td>
                        <td style={truncCellStyle(`${e._id}-reason`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-reason` ? null : `${e._id}-reason`)} title={e.reason}>{e.reason || "-"}</td>
                        <td style={truncCellStyle(`${e._id}-remark`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-remark` ? null : `${e._id}-remark`)} title={e.remark}>{e.remark || "-"}</td>
                        <td>{e.loggedBy || "-"}</td>
                        <td>{e.createdAt ? new Date(e.createdAt).toLocaleString("en-IN") : "-"}</td>
                        <td>
                          {e.loggedBy === loggedInUser ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <button className="btn btn-sm btn-info" onClick={() => startEditProduction(e)}>Edit</button>
                              <button className="btn btn-sm btn-danger" onClick={() => deleteProductionEntry(e)}>Delete</button>
                            </div>
                          ) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <button className="pt-fab" onClick={() => setShowProductionForm(true)} aria-label="New entry">
              <Plus size={22} />
            </button>

          {showProductionForm && (() => {
  const tableBorderColor = "#cfe6f5";
  const darkBlue = "#0b2f4f";
  const labelBlue = "#0a4f8c";

  const labelCell = {
    background: "#eaf6fd",
    color: labelBlue,
    fontSize: "13px",
    fontWeight: "800",
    padding: "12px 16px",
    verticalAlign: "middle",
    borderColor: tableBorderColor,
    whiteSpace: "nowrap",
    textAlign: "left"
  };

  const valueCell = {
    background: "#ffffff",
    color: darkBlue,
    fontSize: "14px",
    fontWeight: "600",
    padding: "10px 16px",
    verticalAlign: "middle",
    borderColor: tableBorderColor
  };

  const cellInput = {
    borderColor: "#9ccbe6",
    borderWidth: "1.5px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "700",
    color: darkBlue,
    background: "#ffffff",
    width: "100%",
    padding: "8px 12px",
    boxShadow: "inset 0 2px 5px rgba(10, 80, 130, 0.12)"
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 70, 120, 0.38)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        padding: "16px"
      }}
      onClick={() => {
        setShowProductionForm(false);
        resetProductionForm();
      }}
    >
      <div
        id="production-entry-modal"
        onClick={(e) => e.stopPropagation()}
        className="card border-0 shadow-lg"
        style={{
          width: "100%",
          maxWidth: "800px",
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.95)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(226,246,255,0.95) 100%)",
          boxShadow: "0 24px 60px rgba(10, 80, 130, 0.35), inset 0 1px 0 #fff",
          fontFamily: "inherit"
        }}
      >
        {/* Modal Header */}
        <div
          className="d-flex justify-content-between align-items-center px-4 py-3 position-sticky top-0"
          style={{
            zIndex: 2,
            background: "linear-gradient(180deg, #f4fbff 0%, #d9eefb 100%)",
            borderBottom: "2px solid #9ccbe6",
            color: "#0a4f8c"
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <div className="hero-emblem-3d" style={{ width: 34, height: 34 }}>
              <Icons.Gauge />
            </div>
            <h5 className="fw-bold mb-0" style={{ fontSize: "17px", color: "#0a4f8c" }}>
              {editingProductionId ? "Edit PlateTracker Entry" : "New PlateTracker Entry"}
            </h5>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => {
              setShowProductionForm(false);
              resetProductionForm();
            }}
          />
        </div>

        {/* Modal Content */}
        <div className="p-3" style={{ background: "transparent" }}>
          <div
            className="bg-white overflow-hidden border-0 mb-0"
            style={{ borderRadius: "16px", border: "1px solid #a6d6ee", boxShadow: "0 8px 20px rgba(10,100,160,.14)" }}
          >
            <table
              className="table table-bordered mb-0"
              style={{
                borderColor: tableBorderColor,
                verticalAlign: "middle",
                tableLayout: "fixed",
                width: "100%",
                borderCollapse: "collapse",
                borderSpacing: 0
              }}
            >
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "32%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "32%" }} />
              </colgroup>
              <tbody>
                {/* Row 1: Date & Customer */}
                <tr>
                  <th style={labelCell} className="fw-bold">
                    Date <span className="text-danger">*</span>
                  </th>
                  <td style={valueCell}>
                    <input
                      type="date"
                      className="form-control"
                      style={cellInput}
                      value={productionForm.date}
                      onChange={(e) => setProductionForm({ ...productionForm, date: e.target.value })}
                      required
                    />
                  </td>

                  <th style={labelCell} className="fw-bold">
                    Customer <span className="text-danger">*</span>
                  </th>
                  <td style={valueCell}>
                    <input
                      type="text"
                      className="form-control-plaintext fw-bold p-0"
                      style={{ fontSize: "14px", color: darkBlue }}
                      value={productionForm.customerName || "-"}
                      readOnly
                    />
                  </td>
                </tr>

                {/* Row 2: WO No & Job Name */}
                <tr>
                  <th style={labelCell} className="fw-bold">
                    WO No <span className="text-danger">*</span>
                  </th>
                  <td style={valueCell}>
                    <input
                      className="form-control"
                      style={cellInput}
                      value={productionForm.woNumber}
                      onChange={(e) => handleProductionWoInput(e.target.value)}
                      onBlur={lookupProductionWo}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          lookupProductionWo();
                        }
                      }}
                      placeholder="Enter WO # & press Enter"
                    />
                    {productionWoMatched === false && (
                      <div className="text-danger fw-bold mt-1" style={{ fontSize: "12px" }}>
                        ✕ No matching work order found
                      </div>
                    )}
                  </td>

                  <th style={labelCell} className="fw-bold">
                    Job Name <span className="text-danger">*</span>
                  </th>
                  <td style={valueCell}>
                    <input
                      type="text"
                      className="form-control-plaintext fw-bold p-0"
                      style={{ fontSize: "14px", color: darkBlue }}
                      value={productionForm.jobName || "-"}
                      readOnly
                    />
                  </td>
                </tr>

                {/* Row 3: Produced & Machine */}
                <tr>
                  <th style={labelCell} className="fw-bold">
                    Fresh plate<span className="text-danger">*</span>
                  </th>
                  <td style={valueCell}>
                    <input
                      type="number"
                      min="0"
                      className="form-control fw-bold"
                      style={{
                        ...cellInput,
                        color: "#166534"
                      }}
                      value={productionForm.producedQty}
                      onChange={(e) => setProductionForm({ ...productionForm, producedQty: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </td>

                  <th style={labelCell} className="fw-bold">
                    Machine <span className="text-danger">*</span>
                  </th>
                  <td style={valueCell}>
                    <input
                      type="text"
                      className="form-control-plaintext fw-bold p-0"
                      style={{ fontSize: "14px", color: darkBlue }}
                      value={productionForm.machine.join(", ") || "-"}
                      readOnly
                    />
                  </td>
                </tr>

                {/* Row 4: Wastage & (Reason or Remark) */}
                <tr>
                  <th style={labelCell} className="fw-bold">
                    Wastage plate
                  </th>
                  <td style={valueCell}>
                    <input
                      type="number"
                      min="0"
                      className="form-control fw-bold"
                      style={{
                        ...cellInput,
                        color: Number(productionForm.wastageQty) > 0 ? "#dc2626" : darkBlue
                      }}
                      value={productionForm.wastageQty}
                      onChange={(e) => setProductionForm({ ...productionForm, wastageQty: e.target.value })}
                      placeholder="0"
                    />
                  </td>

                  {Number(productionForm.wastageQty) > 0 ? (
                    <>
                      <th style={labelCell} className="fw-bold">
                        Reason <span className="text-danger">*</span>
                      </th>
                      <td style={valueCell}>
                        <input
                          className="form-control"
                          style={{ ...cellInput, borderColor: "#f59e0b" }}
                          value={productionForm.reason}
                          onChange={(e) => setProductionForm({ ...productionForm, reason: e.target.value })}
                          placeholder="State reason for wastage"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <th style={labelCell} className="fw-bold">
                        Remark
                      </th>
                      <td style={valueCell}>
                        <input
                          className="form-control"
                          style={cellInput}
                          value={productionForm.remark}
                          onChange={(e) => setProductionForm({ ...productionForm, remark: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>
                    </>
                  )}
                </tr>

                {/* Row 5: Remark (Only when Wastage Qty > 0) */}
                {Number(productionForm.wastageQty) > 0 && (
                  <tr>
                    <th style={labelCell} className="fw-bold">
                      Remark
                    </th>
                    <td style={valueCell} colSpan={3}>
                      <input
                        className="form-control"
                        style={cellInput}
                        value={productionForm.remark}
                        onChange={(e) => setProductionForm({ ...productionForm, remark: e.target.value })}
                        placeholder="Optional"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="d-flex justify-content-end gap-2 px-4 py-3 position-sticky bottom-0"
          style={{
            zIndex: 2,
            background: "linear-gradient(180deg, #eaf8ff 0%, #d4f0fd 100%)",
            borderTop: "1px solid #bfe0f2",
            marginTop: 0
          }}
        >
          <button
            type="button"
            className="btn btn-sm btn-secondary px-3 py-1"
            style={{ fontSize: "13px" }}
            onClick={() => {
              setShowProductionForm(false);
              resetProductionForm();
            }}
          >
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary px-3 py-1"
            style={{ fontSize: "13px" }}
            disabled={
              !productionForm.date ||
              !productionForm.woNumber.trim() ||
              !productionForm.customerName.trim() ||
              !productionForm.jobName.trim() ||
              !productionForm.machine.length ||
              productionForm.producedQty === ""
            }
            onClick={addProductionEntry}
          >
            {editingProductionId ? "Update Entry" : "Save Entry"}
          </button>
        </div>
      </div>
    </div>
  );
})()}
          </>
        )}
      </div>
    </div>
  );
}

export default PreprocessDashboard;