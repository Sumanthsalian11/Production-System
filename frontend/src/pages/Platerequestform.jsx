import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";
import * as XLSX from "xlsx";

// ============================================================================
// 🎨 CRISP 3D SVG ICONS (Embedded directly - zero external icon dependencies)
// ============================================================================
const Icons = {
  Layers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Excel: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <path d="M8 13l3 4m0-4l-3 4" /><path d="M14 13l3 4m0-4l-3 4" />
    </svg>
  ),
  Reset: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
    </svg>
  ),
  Clock: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Check: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  XCircle: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  User: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Box: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  File: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
};

function PlateRequestForm() {
  const token = localStorage.getItem("token");
  const loggedInUser = token ? jwtDecode(token).name : "";

  const [woNumber, setWoNumber] = useState("");
  const [selectedWoDetails, setSelectedWoDetails] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Cascading activity -> machine selection
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");

  const [myRequests, setMyRequests] = useState([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);

  // Filters
  const [filterWoNo, setFilterWoNo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterProductType, setFilterProductType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUserLocation, setFilterUserLocation] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [expandedCellKey, setExpandedCellKey] = useState(null);

  const truncCellStyle = (key) =>
    expandedCellKey === key
      ? { maxWidth: 260, whiteSpace: "normal", wordBreak: "break-word", cursor: "pointer", background: "#f1f7f8" }
      : { maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" };

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchWorkOrder = async () => {
    if (!woNumber.trim()) {
      Swal.fire({
        title: "Missing Work Order",
        text: "Please enter a valid Work Order number.",
        icon: "warning",
        confirmButtonColor: "#043a45",
        width: "360px"
      });
      return;
    }

    setFetching(true);
    setSelectedWoDetails(null);
    setSelectedActivity("");
    setSelectedMachine("");
    try {
      const res = await axios.get(`${BASE_URL}/api/platerequest/fetch-workorder/${woNumber.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedWoDetails(res.data);
    } catch (err) {
      console.error("Error fetching work order:", err.response?.data || err);
      Swal.fire({
        title: "Work Order Not Found",
        text: err.response?.data?.message || `No work order found with number ${woNumber}`,
        icon: "error",
        confirmButtonColor: "#043a45",
        width: "360px"
      });
    }
    setFetching(false);
  };

  const fetchMyRequests = async () => {
    setMyRequestsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/platerequest`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyRequests(res.data || []);
    } catch (err) {
      console.error("Error fetching plate requests:", err);
      setMyRequests([]);
    }
    setMyRequestsLoading(false);
  };

  const machinesForSelectedActivity = selectedActivity
    ? [
        ...new Set(
          (selectedWoDetails?.machinePairs || [])
            .filter((p) => p.activity === selectedActivity)
            .map((p) => p.machine)
        )
      ]
    : [];

  const handleActivityChange = (value) => {
    setSelectedActivity(value);
    setSelectedMachine("");
  };

  const customerOptions = useMemo(() => [
    ...new Set(myRequests.map((r) => r.customerName).filter(Boolean))
  ], [myRequests]);

  const productTypeOptions = useMemo(() => [
    ...new Set(myRequests.map((r) => r.productType).filter(Boolean))
  ], [myRequests]);

  const userLocationOptions = useMemo(() => [
    ...new Set(myRequests.flatMap((r) => r.userLocations || []).filter(Boolean))
  ], [myRequests]);

  // Request Statistics
  const stats = useMemo(() => {
    const total = myRequests.length;
    const pending = myRequests.filter((r) => r.status === "PENDING").length;
    const approved = myRequests.filter((r) => r.status === "APPROVED").length;
    const rejected = myRequests.filter((r) => r.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [myRequests]);

  const displayedRequests = myRequests.filter((r) => {
    const matchWo = filterWoNo === "" || String(r.efiWoNumber).includes(filterWoNo);
    const matchCustomer = filterCustomer === "" || r.customerName === filterCustomer;
    const matchProductType = filterProductType === "" || r.productType === filterProductType;
    const matchStatus = filterStatus === "" || r.status === filterStatus;
    const matchUserLocation =
      filterUserLocation === "" || r.userLocations?.includes(filterUserLocation);

    let matchDate = true;
    if (r.createdAt && (filterFromDate || filterToDate)) {
      const created = new Date(r.createdAt);
      if (filterFromDate) {
        const from = new Date(filterFromDate);
        from.setHours(0, 0, 0, 0);
        if (created < from) matchDate = false;
      }
      if (filterToDate) {
        const to = new Date(filterToDate);
        to.setHours(23, 59, 59, 999);
        if (created > to) matchDate = false;
      }
    }

    return matchWo && matchCustomer && matchProductType && matchStatus && matchUserLocation && matchDate;
  });

  const resetForm = () => {
    setWoNumber("");
    setSelectedWoDetails(null);
    setRemarks("");
    setSelectedActivity("");
    setSelectedMachine("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedWoDetails?._id) {
      Swal.fire({
        title: "Missing Work Order",
        text: "Please fetch a Work Order first before submitting.",
        icon: "warning",
        confirmButtonColor: "#043a45",
        width: "360px"
      });
      return;
    }

    if (!selectedActivity || !selectedMachine) {
      Swal.fire({
        title: "Select Allocation",
        text: "Please select both an Activity and a Machine.",
        icon: "warning",
        confirmButtonColor: "#043a45",
        width: "360px"
      });
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(
        `${BASE_URL}/api/platerequest`,
        {
          workOrderId: selectedWoDetails._id,
          remarks: remarks.trim(),
          activity: selectedActivity,
          machine: selectedMachine
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire({
        title: "Sent to Prepress ✅",
        text: "Your plate request has been submitted for approval.",
        icon: "success",
        confirmButtonColor: "#e4572e",
        width: "360px"
      });

      resetForm();
      fetchMyRequests();
    } catch (err) {
      console.error("Error creating plate request:", err.response?.data || err);
      Swal.fire({
        title: "Submission Error",
        text: err.response?.data?.message || "Error creating plate request",
        icon: "error",
        confirmButtonColor: "#e4572e",
        width: "360px"
      });
    }
    setSubmitting(false);
  };

  const exportToExcel = () => {
    if (!displayedRequests.length) {
      Swal.fire({ title: "No Data", text: "No requests to export", icon: "info", confirmButtonColor: "#043a45" });
      return;
    }

    const data = displayedRequests.map((r, i) => ({
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

  return (
    <div className="pr-root">
      {/* ========================================================================= */}
      {/* 💅 LIGHT AQUA-GLASS DESIGN (scoped, no external CSS needed)               */}
      {/* ========================================================================= */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap');

        .pr-root {
          --ink: #1f2d3a; --muted: #5f6c7a; --hint: #9aa5b1;
          --teal: #043a45; --teal-2: #0f6b7c; --orange: #e4572e; --orange-d: #cf4a22;
          --line: #dfe4e9; --bg: #f3f5f7;
          min-height: 100vh;
          padding: 20px 24px 32px;
          font-family: 'Source Sans 3', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
          font-size: 14px;
          color: var(--ink);
          background: var(--bg);
          -webkit-font-smoothing: antialiased;
        }
        .pr-root * { box-sizing: border-box; }
        .pr-shell { max-width: 100%; margin: 0 auto; }

        /* Header (unused block kept for compatibility) */
        .pr-hero {
          display: flex; align-items: center; justify-content: center; gap: 14px;
          margin-bottom: 12px; padding: 12px 22px; border-radius: 6px;
          background: #fff; border: 1px solid var(--line);
        }
        .pr-emblem { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--teal-2); background: #e6f1f3; }
        .pr-hero h1 { margin: 0; font-size: 20px; font-weight: 700; color: var(--ink); }
        .pr-hero p { margin: 1px 0 0; font-size: 13px; font-weight: 500; color: var(--muted); }

        /* Cards */
        .pr-glass {
          background: #fff; border: 1px solid var(--line); border-radius: 6px;
          padding: 20px 24px 24px; margin-bottom: 20px;
          box-shadow: 0 1px 2px rgba(16,40,56,0.05);
        }
        .pr-head { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 6px; padding: 0 0 14px; text-align: left; }
        .pr-head-left { display: flex; align-items: center; gap: 12px; }
        .pr-icon {
          width: 34px; height: 34px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          color: var(--teal-2); background: #e6f1f3; border: 0;
        }
        .pr-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--ink); letter-spacing: 0; }
        .pr-sub { font-size: 13px; font-weight: 400; color: var(--muted); }
        .pr-pill {
          font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: 999px; color: var(--muted);
          background: #fff; border: 1px solid var(--line);
        }

        /* Section labels */
        .pr-sec {
          display: flex; align-items: center; gap: 8px; margin: 0 0 10px;
          font-size: 15px; font-weight: 700; color: var(--ink); text-transform: none; letter-spacing: 0;
        }
        .pr-sec::before { content: ""; width: 3px; height: 16px; border-radius: 2px; background: var(--orange); }
        .pr-divider { height: 0; border-top: 1px solid var(--line); margin: 18px 0 16px; }

        .pr-label {
          display: block; margin: 0 0 6px; font-size: 11px; font-weight: 600; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.4px;
        }
        .pr-label i { color: var(--orange); font-style: normal; }

        .pr-input {
          width: 100%; height: 38px; padding: 0 12px;
          font-size: 14px; font-weight: 400; color: var(--ink); font-family: inherit;
          background: #fff; border: 1px solid #cfd6dd; border-radius: 4px; outline: none;
          box-shadow: none; transition: border-color .15s ease, box-shadow .15s ease;
        }
        .pr-input:hover { border-color: #9fb0bd; }
        .pr-input:focus { border-color: var(--teal-2); box-shadow: 0 0 0 3px rgba(15,107,124,0.15); }
        .pr-input:disabled { background: #f1f3f5; color: var(--hint); cursor: not-allowed; }
        .pr-input::placeholder { color: var(--hint); font-weight: 400; }

        .pr-callrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pr-callrow .pr-input { max-width: 340px; }

        /* Work order detail cards */
        .pr-info-grid { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 12px; margin-bottom: 4px; }
        .pr-info {
          display: flex; align-items: center; gap: 12px; min-width: 0; padding: 12px 14px;
          background: #fff; border: 1px solid var(--line); border-radius: 6px; box-shadow: none;
        }
        .pr-bubble {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: none;
        }
        .pr-bubble.lavender { background: #e6f1f3; color: var(--teal-2); }
        .pr-bubble.peach    { background: #fdeee8; color: var(--orange); }
        .pr-bubble.mint     { background: #e5f4ec; color: #2f8f5b; }
        .pr-info-text { min-width: 0; }
        .pr-info-text > span { display: block; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
        .pr-info-text > b { display: block; font-size: 15px; font-weight: 600; color: var(--ink); word-break: break-word; }

        .pr-fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 16px; align-items: end; }

        /* Buttons */
        .pr-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          height: 38px; padding: 0 18px; font-size: 14px; font-weight: 600; font-family: inherit;
          border-radius: 4px; border: 1px solid transparent; cursor: pointer; white-space: nowrap; transition: background .15s ease, border-color .15s ease;
        }
        .pr-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .pr-btn-primary { background: var(--teal); color: #fff; border-color: var(--teal); }
        .pr-btn-primary:hover:not(:disabled) { background: #06515f; }
        .pr-btn-success { background: var(--orange); color: #fff; border-color: var(--orange); }
        .pr-btn-success:hover:not(:disabled) { background: var(--orange-d); }
        .pr-btn-ghost { background: #fff; color: var(--ink); border-color: #cfd6dd; }
        .pr-btn-ghost:hover:not(:disabled) { background: #f3f5f7; }

        /* KPI tiles */
        .pr-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
        .pr-kpi {
          display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 6px;
          background: #fff; border: 1px solid var(--line); box-shadow: none;
        }
        .pr-kpi-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pr-kpi small { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; color: var(--muted); }
        .pr-kpi h5 { margin: 0; font-size: 22px; font-weight: 700; color: var(--ink); }

        /* Filter toolbar */
        .pr-toolbar {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 14px; padding: 12px;
          border-radius: 6px; background: #f8f9fa; border: 1px solid var(--line);
        }
        .pr-toolbar .pr-input { width: auto; min-width: 150px; height: 36px; font-size: 13.5px; }
        .pr-toolbar .pr-btn { height: 36px; }
        .pr-datebox { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }

        /* Table */
        .pr-table-wrap { overflow: auto; max-height: 460px; border-radius: 6px; border: 1px solid var(--line); background: #fff; }
        .pr-table-wrap::-webkit-scrollbar { height: 8px; width: 8px; }
        .pr-table-wrap::-webkit-scrollbar-track { background: #f1f3f5; }
        .pr-table-wrap::-webkit-scrollbar-thumb { background: #c2ccd4; border-radius: 4px; }
        .pr-table { width: 100%; border-collapse: collapse; font-size: 13.5px; white-space: nowrap; margin: 0; }
        .pr-table thead th {
          position: sticky; top: 0; z-index: 5; padding: 11px 14px; text-align: left; white-space: nowrap;
          background: #f4f6f8; color: var(--muted); font-weight: 600; font-size: 11.5px;
          text-transform: uppercase; letter-spacing: 0.5px; border: 0; border-bottom: 1px solid var(--line);
        }
        .pr-table tbody td { padding: 10px 14px; border: 0; border-bottom: 1px solid #edf0f3; color: var(--ink); font-weight: 400; vertical-align: middle; background: #fff; }
        .pr-table tbody tr:hover td { background: #f1f7f8; }
        .pr-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 600; color: var(--teal-2); }
        .pr-strong { font-weight: 600; }
        .pr-center { text-align: center; }
        .pr-empty { text-align: center; padding: 34px 12px !important; color: var(--muted); font-weight: 600; }
        .pr-small { font-size: 12px; color: var(--muted); font-weight: 400; }

        .pr-badge {
          display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px;
          font-size: 11.5px; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid transparent;
        }
        .pr-badge-blue { background: #e6f1f3; color: var(--teal-2); border-color: #c5dde2; text-transform: none; }
        .pr-badge-warn { background: #fff4db; color: #8a5a00; border-color: #f4dc9c; }
        .pr-badge-ok { background: #e5f4ec; color: #1f7a48; border-color: #b7e0c8; }
        .pr-badge-bad { background: #fde8e8; color: #b42318; border-color: #f5c0c0; }

        @media (max-width: 992px) {
          .pr-fields, .pr-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pr-info-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .pr-fields, .pr-kpis { grid-template-columns: 1fr; }
          .pr-root { padding: 10px; }
        }
      `}</style>

      <div className="pr-shell">
        {/* ========================================================================= */}
        {/* 2. SUBMIT NEW PLATE REQUEST                                               */}
        {/* ========================================================================= */}
        <div className="pr-glass">
          <div className="pr-head">
            <div className="pr-head-left">
              <div className="pr-icon">
                <Icons.Layers />
              </div>
              <div>
                <h5 className="pr-title">Create New Plate Request</h5>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Work Order Calling Box */}
            <div>
              <label className="pr-label">
                Work Order Number <i>*</i>
              </label>
              <div className="pr-callrow">
                <input
                  type="text"
                  placeholder="Enter WO number (e.g. 10452)"
                  className="pr-input"
                  value={woNumber}
                  onChange={(e) => setWoNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), fetchWorkOrder())}
                />
                <button
                  type="button"
                  className="pr-btn pr-btn-primary"
                  onClick={fetchWorkOrder}
                  disabled={fetching}
                >
                  <Icons.Search /> {fetching ? "Calling WO..." : "Call WO"}
                </button>
                {selectedWoDetails && (
                  <button
                    type="button"
                    className="pr-btn pr-btn-ghost"
                    onClick={resetForm}
                  >
                    <Icons.Reset /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Fetched Specifications + Machine Allocation (one form, shown together) */}
            {selectedWoDetails && (
              <>
                <div className="pr-divider" />

                <div className="pr-sec">Work Order Details</div>
                <div className="pr-info-grid">
                  <div className="pr-info">
                    <div className="pr-bubble lavender"><Icons.User /></div>
                    <div className="pr-info-text">
                      <span>Customer name</span>
                      <b>{selectedWoDetails.customerName || "-"}</b>
                    </div>
                  </div>
                  <div className="pr-info">
                    <div className="pr-bubble peach"><Icons.Box /></div>
                    <div className="pr-info-text">
                      <span>Product type</span>
                      <b>{selectedWoDetails.productType || "-"}</b>
                    </div>
                  </div>
                  <div className="pr-info">
                    <div className="pr-bubble mint"><Icons.File /></div>
                    <div className="pr-info-text">
                      <span>Job description</span>
                      <b>{selectedWoDetails.jobDescription || "-"}</b>
                    </div>
                  </div>
                </div>

                <div className="pr-sec" style={{ marginTop: 12 }}>Activity &amp; Machine Assignment</div>
                <div className="pr-fields">
                  <div>
                    <label className="pr-label">
                      Activity <i>*</i>
                    </label>
                    <select
                      className="pr-input"
                      value={selectedActivity}
                      onChange={(e) => handleActivityChange(e.target.value)}
                      required
                    >
                      <option value="">Select Activity</option>
                      {(selectedWoDetails.activities || []).map((a, i) => (
                        <option key={i} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="pr-label">
                      Machine <i>*</i>
                    </label>
                    <select
                      className="pr-input"
                      value={selectedMachine}
                      onChange={(e) => setSelectedMachine(e.target.value)}
                      disabled={!selectedActivity}
                      required
                    >
                      <option value="">
                        {selectedActivity ? "Select Machine" : "Select an Activity first"}
                      </option>
                      {machinesForSelectedActivity.map((m, i) => (
                        <option key={i} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="pr-label">
                      Remarks / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      className="pr-input"
                      placeholder="Notes for Prepress team..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="pr-btn pr-btn-success"
                      style={{ width: "100%" }}
                      disabled={submitting}
                    >
                      <Icons.Send /> {submitting ? "Sending Request..." : "Send to Prepress"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        </div>

        {/* ========================================================================= */}
        {/* 3. MY PLATE REQUESTS SECTION (TABLE & FILTERS)                            */}
        {/* ========================================================================= */}
        <div className="pr-glass">
          <div style={{ textAlign: "left", marginBottom: "14px" }}>
            <h4 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1f2d3a" }}>
              My Plate Requests
            </h4>
          </div>

          {/* 4 Summary KPI Tiles */}
          <div className="pr-kpis">
            <div className="pr-kpi" style={{ borderLeft: "3px solid #0f6b7c" }}>
              <div className="pr-kpi-icon" style={{ background: "#e6f1f3", color: "#0f6b7c" }}>
                <Icons.Layers />
              </div>
              <div>
                <small>TOTAL REQUESTS</small>
                <h5>{stats.total}</h5>
              </div>
            </div>

            <div className="pr-kpi" style={{ borderLeft: "3px solid #d98a00" }}>
              <div className="pr-kpi-icon" style={{ background: "#fff4db", color: "#b26a00" }}>
                <Icons.Clock />
              </div>
              <div>
                <small>PENDING APPROVAL</small>
                <h5 style={{ color: "#b26a00" }}>{stats.pending}</h5>
              </div>
            </div>

            <div className="pr-kpi" style={{ borderLeft: "3px solid #2f9e60" }}>
              <div className="pr-kpi-icon" style={{ background: "#e5f4ec", color: "#1f7a48" }}>
                <Icons.Check />
              </div>
              <div>
                <small>APPROVED</small>
                <h5 style={{ color: "#1f7a48" }}>{stats.approved}</h5>
              </div>
            </div>

            <div className="pr-kpi" style={{ borderLeft: "3px solid #d64545" }}>
              <div className="pr-kpi-icon" style={{ background: "#fde8e8", color: "#b42318" }}>
                <Icons.XCircle />
              </div>
              <div>
                <small>REJECTED</small>
                <h5 style={{ color: "#b42318" }}>{stats.rejected}</h5>
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="pr-toolbar">
            <input
              type="text"
              placeholder="🔍 Search WO Number"
              value={filterWoNo}
              onChange={(e) => setFilterWoNo(e.target.value)}
              className="pr-input"
            />

            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="pr-input"
              style={{ maxWidth: "200px" }}
            >
              <option value="">All Customers</option>
              {customerOptions.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={filterProductType}
              onChange={(e) => setFilterProductType(e.target.value)}
              className="pr-input"
            >
              <option value="">All Product Types</option>
              {productTypeOptions.map((t, i) => (
                <option key={i} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pr-input"
              style={{ fontWeight: "600" }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={filterUserLocation}
              onChange={(e) => setFilterUserLocation(e.target.value)}
              className="pr-input"
            >
              <option value="">All Locations</option>
              {userLocationOptions.map((loc, i) => (
                <option key={i} value={loc}>{loc}</option>
              ))}
            </select>

            <div className="pr-datebox">
              <span>From:</span>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="pr-input"
                style={{ minWidth: 0 }}
              />
            </div>

            <div className="pr-datebox">
              <span>To:</span>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="pr-input"
                style={{ minWidth: 0 }}
              />
            </div>

            <button
              className="pr-btn pr-btn-success"
              onClick={exportToExcel}
            >
              <Icons.Excel /> Export Excel
            </button>

            {(filterWoNo || filterCustomer || filterProductType || filterStatus || filterUserLocation || filterFromDate || filterToDate) && (
              <button
                className="pr-btn pr-btn-ghost"
                onClick={() => {
                  setFilterWoNo("");
                  setFilterCustomer("");
                  setFilterProductType("");
                  setFilterStatus("");
                  setFilterUserLocation("");
                  setFilterFromDate("");
                  setFilterToDate("");
                }}
              >
                <Icons.Reset /> Clear
              </button>
            )}
          </div>

          {/* Main Requests Table */}
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>WO NO</th>
                  <th>Customer Name</th>
                  <th>Job Description</th>
                  <th>Product Type</th>
                  <th>Activity</th>
                  <th>Machine</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  <th>Requested By</th>
                  <th>Reviewed By</th>
                  <th>Review Remarks</th>
                  <th>Reviewed At</th>
                </tr>
              </thead>
              <tbody>
                {myRequestsLoading ? (
                  <tr>
                    <td colSpan="12" className="pr-empty">
                      Loading plate requests...
                    </td>
                  </tr>
                ) : displayedRequests.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="pr-empty">
                      No Plate Requests Found
                    </td>
                  </tr>
                ) : (
                  displayedRequests.map((req) => (
                    <tr key={req._id}>
                      <td className="pr-mono">{req.efiWoNumber}</td>
                      <td
                        style={truncCellStyle(`${req._id}-customer`)}
                        onClick={() =>
                          setExpandedCellKey((k) => (k === `${req._id}-customer` ? null : `${req._id}-customer`))
                        }
                        title={req.customerName}
                      >
                        {req.customerName || "-"}
                      </td>
                      <td
                        style={truncCellStyle(`${req._id}-job`)}
                        onClick={() =>
                          setExpandedCellKey((k) => (k === `${req._id}-job` ? null : `${req._id}-job`))
                        }
                        title={req.jobDescription || req.jobName}
                      >
                        {req.jobDescription || req.jobName || "-"}
                      </td>
                      <td>
                        <span className="pr-badge pr-badge-blue">
                          {req.productType || "-"}
                        </span>
                      </td>
                      <td
                        style={truncCellStyle(`${req._id}-activity`)}
                        onClick={() =>
                          setExpandedCellKey((k) => (k === `${req._id}-activity` ? null : `${req._id}-activity`))
                        }
                        title={req.activities?.join(", ")}
                      >
                        {req.activities?.length ? req.activities.join(", ") : "-"}
                      </td>
                      <td
                        style={truncCellStyle(`${req._id}-machine`)}
                        onClick={() =>
                          setExpandedCellKey((k) => (k === `${req._id}-machine` ? null : `${req._id}-machine`))
                        }
                        title={req.machineNames?.join(", ")}
                      >
                        {req.machineNames?.length ? req.machineNames.join(", ") : "-"}
                      </td>
                      <td
                        style={truncCellStyle(`${req._id}-remarks`)}
                        onClick={() =>
                          setExpandedCellKey((k) => (k === `${req._id}-remarks` ? null : `${req._id}-remarks`))
                        }
                        title={req.remarks}
                      >
                        {req.remarks || "-"}
                      </td>
                      <td className="pr-center">
                        <span
                          className={`pr-badge ${
                            req.status === "APPROVED"
                              ? "pr-badge-ok"
                              : req.status === "REJECTED"
                              ? "pr-badge-bad"
                              : "pr-badge-warn"
                          }`}
                        >
                          ● {req.status}
                        </span>
                      </td>
                      <td>
                        <div className="pr-strong">{req.requestedBy || "-"}</div>
                        <span className="pr-small">
                          {req.createdAt ? new Date(req.createdAt).toLocaleString("en-IN") : "-"}
                        </span>
                      </td>
                      <td className="pr-strong">{req.reviewedBy || "-"}</td>
                      <td
                        style={truncCellStyle(`${req._id}-revRemarks`)}
                        onClick={() =>
                          setExpandedCellKey((k) => (k === `${req._id}-revRemarks` ? null : `${req._id}-revRemarks`))
                        }
                        title={req.reviewRemarks}
                      >
                        {req.reviewRemarks || "-"}
                      </td>
                      <td className="pr-small">
                        {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString("en-IN") : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlateRequestForm;