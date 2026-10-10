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
      ? { maxWidth: 260, whiteSpace: "normal", wordBreak: "break-word", cursor: "pointer", background: "#eef8fc" }
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
        confirmButtonColor: "#0284c7",
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
        confirmButtonColor: "#0284c7",
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
        confirmButtonColor: "#0284c7",
        width: "360px"
      });
      return;
    }

    if (!selectedActivity || !selectedMachine) {
      Swal.fire({
        title: "Select Allocation",
        text: "Please select both an Activity and a Machine.",
        icon: "warning",
        confirmButtonColor: "#0284c7",
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
        confirmButtonColor: "#10b981",
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
        confirmButtonColor: "#ef4444",
        width: "360px"
      });
    }
    setSubmitting(false);
  };

  const exportToExcel = () => {
    if (!displayedRequests.length) {
      Swal.fire({ title: "No Data", text: "No requests to export", icon: "info", confirmButtonColor: "#0284c7" });
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
        .pr-root {
          --ink: #0b2f4f; --muted: #4a6f8c; --hint: #8fb0c8;
          min-height: 100vh;
          padding: 12px 18px 30px;
          font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
          font-size: 15px;
          color: var(--ink);
          background:
            radial-gradient(circle at 12% 6%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 30%),
            radial-gradient(circle at 88% 18%, rgba(160,222,250,0.7) 0, rgba(160,222,250,0) 32%),
            radial-gradient(circle at 50% 100%, rgba(255,255,255,0.7) 0, rgba(255,255,255,0) 45%),
            linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%);
          background-attachment: fixed;
        }
        .pr-root * { box-sizing: border-box; }
        .pr-shell { max-width: 100%; margin: 0 auto; }

        /* Glass header with round emblem */
        .pr-hero {
          display: flex; align-items: center; justify-content: center; gap: 14px;
          margin-bottom: 12px; padding: 9px 22px; border-radius: 28px;
          background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(222,244,254,0.8) 100%);
          border: 1px solid rgba(255,255,255,0.95); backdrop-filter: blur(14px);
          box-shadow: 0 14px 30px rgba(40,120,170,0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140,210,245,0.2);
        }
        .pr-emblem {
          width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #0a6fb8;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 50%, #8fd0f0 100%);
          border: 1px solid #86c6e8; box-shadow: 0 6px 14px rgba(40,120,170,0.22), inset 0 2px 3px rgba(255,255,255,0.9);
        }
        .pr-hero h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.4px; color: #0a4f8c; }
        .pr-hero p { margin: 1px 0 0; font-size: 13.5px; font-weight: 600; color: var(--muted); }

        /* Glass cards */
        .pr-glass {
          background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(228,246,255,0.9) 100%);
          border: 1px solid rgba(255,255,255,0.95); border-radius: 22px;
          padding: 12px 18px 16px; margin-bottom: 14px;
          box-shadow: 0 14px 32px rgba(40,120,170,0.16), inset 0 1px 0 #fff;
        }
        .pr-head { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 0 2px 10px; text-align: center; }
        .pr-head-left { display: flex; align-items: center; justify-content: center; gap: 12px; }
        .pr-icon {
          width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #0a6fb8;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #d6effc 55%, #b3dff5 100%);
          border: 1px solid #a9d9f2; box-shadow: 0 3px 8px rgba(40,120,170,0.14);
        }
        .pr-title { margin: 0; font-size: 17px; font-weight: 800; color: #0a4f8c; align-self: center; letter-spacing: -0.3px; }
        .pr-sub { font-size: 13px; font-weight: 600; color: var(--muted); }
        .pr-pill {
          font-size: 12px; font-weight: 800; padding: 4px 14px; border-radius: 999px; color: #0a4f8c; letter-spacing: 0.3px;
          background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%); border: 1px solid #a9d9f2;
          box-shadow: 0 3px 8px rgba(40,120,170,0.12), inset 0 1px 0 #fff;
        }

        /* section labels inside the form */
        .pr-sec {
          display: inline-flex; align-items: center; gap: 9px; margin: 0 0 8px 2px;
          font-size: 12.5px; font-weight: 800; color: #0a4f8c; text-transform: uppercase; letter-spacing: 0.7px;
        }
        .pr-sec::before {
          content: ""; width: 9px; height: 9px; border-radius: 50%;
          background: radial-gradient(circle at 30% 25%, #b6ecff, #2a9be0 70%); box-shadow: 0 0 0 3px rgba(42,155,224,0.2);
        }
        .pr-divider { height: 0; border-top: 1px dashed rgba(10,111,184,0.3); margin: 12px 0 10px; }

        .pr-label { display: block; margin: 0 0 4px 2px; font-size: 13px; font-weight: 800; color: var(--ink); }
        .pr-label i { color: #e11d48; font-style: normal; }

        .pr-input {
          width: 100%; height: 40px; padding: 0 12px;
          font-size: 15px; font-weight: 600; color: var(--ink); font-family: inherit;
          background: #fff; border: 1.5px solid #9ccbe6; border-radius: 12px; outline: none;
          box-shadow: inset 0 2px 5px rgba(10,80,130,0.1); transition: border-color .18s ease, box-shadow .18s ease;
        }
        .pr-input:hover { border-color: #5fb4de; }
        .pr-input:focus { border-color: #1b9be0; box-shadow: 0 0 0 4px rgba(27,155,224,0.2), 0 6px 14px rgba(27,155,224,0.12); }
        .pr-input:disabled { background: linear-gradient(180deg, #f1f7fb, #dfecf5); color: #4a6f8c; cursor: not-allowed; }
        .pr-input::placeholder { color: var(--hint); font-weight: 600; }

        /* Work order call row */
        .pr-callrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pr-callrow .pr-input { max-width: 340px; font-weight: 700; }

        /* Work order detail cards (soft white, pastel icon bubbles) */
        .pr-info-grid { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 10px; margin-bottom: 4px; }
        .pr-info {
          display: flex; align-items: center; gap: 12px; min-width: 0; padding: 8px 14px;
          background: linear-gradient(180deg, #ffffff 0%, #f6fcff 100%); border: 1px solid #dcedf8; border-radius: 18px;
          box-shadow: 0 6px 16px rgba(40,120,170,0.1), inset 0 1px 0 #fff;
        }
        .pr-bubble {
          width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 5px 10px rgba(40,90,130,0.16), inset 0 2px 3px rgba(255,255,255,0.85), inset 0 -3px 5px rgba(0,0,0,0.06);
        }
        .pr-bubble.lavender { background: linear-gradient(145deg, #efe7ff, #c9b8fb); color: #6d4fd6; }
        .pr-bubble.peach    { background: linear-gradient(145deg, #fff0d1, #ffc978); color: #c2650a; }
        .pr-bubble.mint     { background: linear-gradient(145deg, #dcf9ea, #8fe0b8); color: #107a4d; }
        .pr-info-text { min-width: 0; }
        .pr-info-text > span { display: block; font-size: 12px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .pr-info-text > b { display: block; font-size: 16px; font-weight: 800; color: var(--ink); word-break: break-word; }

        /* Assignment fields */
        .pr-fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 14px; align-items: end; }

        /* Buttons */
        .pr-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          height: 40px; padding: 0 20px; font-size: 14.5px; font-weight: 800; font-family: inherit;
          border-radius: 12px; border: 1px solid transparent; cursor: pointer; white-space: nowrap; transition: all .15s ease;
        }
        .pr-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .pr-btn:active { transform: translateY(2px); }
        .pr-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .pr-btn-primary {
          background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%); color: #08406b; border-color: #7fc3e8;
          box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40,120,170,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .pr-btn-success {
          background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%); color: #07583b; border-color: #7fd3ab;
          box-shadow: 0 3px 0 #84cba9, 0 7px 12px rgba(20,168,112,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .pr-btn-ghost {
          background: linear-gradient(180deg, #ffffff 0%, #dcebf5 100%); color: #34526b; border-color: #aac3d4;
          box-shadow: 0 3px 0 #b6cbd9, 0 7px 12px rgba(93,124,147,0.14), inset 0 1px 0 #fff;
        }

        /* KPI tiles */
        .pr-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
        .pr-kpi {
          display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-radius: 16px;
          background: linear-gradient(180deg, #ffffff 0%, #f1faff 100%); border: 1px solid #cfe8f6;
          box-shadow: 0 4px 12px rgba(40,120,170,0.1), inset 0 1px 0 #fff;
        }
        .pr-kpi-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pr-kpi small { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: 0.4px; color: var(--muted); }
        .pr-kpi h5 { margin: 0; font-size: 22px; font-weight: 800; color: var(--ink); }

        /* Filter toolbar */
        .pr-toolbar {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; padding: 8px 12px; border-radius: 16px;
          background: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.95); box-shadow: inset 0 1px 0 #fff, 0 6px 16px rgba(40,120,170,0.08);
        }
        .pr-toolbar .pr-input { width: auto; min-width: 150px; height: 38px; font-size: 14px; }
        .pr-toolbar .pr-btn { height: 38px; }
        .pr-datebox { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: #0a4f8c; }

        /* Table */
        .pr-table-wrap {
          overflow: auto; max-height: 460px; border-radius: 18px; border: 1px solid #a9d9f2; background: #fff;
          box-shadow: 0 10px 24px rgba(40,120,170,0.14);
        }
        .pr-table-wrap::-webkit-scrollbar { height: 8px; width: 8px; }
        .pr-table-wrap::-webkit-scrollbar-track { background: #eaf7ff; }
        .pr-table-wrap::-webkit-scrollbar-thumb { background: #96d3f2; border-radius: 4px; }
        .pr-table { width: 100%; border-collapse: collapse; font-size: 14px; white-space: nowrap; margin: 0; }
        .pr-table thead th {
          position: sticky; top: 0; z-index: 5; padding: 11px 14px; text-align: center; white-space: nowrap;
          background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%); color: #08406b;
          font-weight: 800; font-size: 13px; letter-spacing: 0.3px; border: 1px solid #7fbfe4;
        }
        .pr-table tbody td { padding: 9px 14px; border: 1px solid #d3e8f4; color: var(--ink); font-weight: 600; vertical-align: middle; background: #fff; }
        .pr-table tbody tr:nth-child(even) td { background: #f3faff; }
        .pr-table tbody tr:hover td { background: #d9f2fc; }
        .pr-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 800; }
        .pr-strong { font-weight: 800; }
        .pr-center { text-align: center; }
        .pr-empty { text-align: center; padding: 34px 12px !important; color: var(--muted); font-weight: 800; }
        .pr-small { font-size: 12px; color: var(--muted); font-weight: 600; }

        .pr-badge {
          display: inline-flex; align-items: center; gap: 5px; padding: 3px 12px; border-radius: 999px;
          font-size: 12px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid transparent;
        }
        .pr-badge-blue { background: #d6effc; color: #08406b; border-color: #86c6e8; text-transform: none; }
        .pr-badge-warn { background: #fef3c7; color: #8a5a00; border-color: #fde68a; }
        .pr-badge-ok { background: #dcfce7; color: #15803d; border-color: #86efac; }
        .pr-badge-bad { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }

        @media (max-width: 992px) {
          .pr-fields, .pr-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pr-info-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .pr-fields, .pr-kpis { grid-template-columns: 1fr; }
          .pr-root { padding: 8px; }
          .pr-hero { border-radius: 20px; }
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
          <div style={{ textAlign: "center", marginBottom: "10px" }}>
            <h4 style={{ margin: 0, fontSize: "19px", fontWeight: 800, color: "#0a4f8c" }}>
              My Plate Requests
            </h4>
          </div>

          {/* 4 Summary KPI Tiles */}
          <div className="pr-kpis">
            <div className="pr-kpi" style={{ borderLeft: "4px solid #0284c7" }}>
              <div className="pr-kpi-icon" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                <Icons.Layers />
              </div>
              <div>
                <small>TOTAL REQUESTS</small>
                <h5>{stats.total}</h5>
              </div>
            </div>

            <div className="pr-kpi" style={{ borderLeft: "4px solid #f59e0b" }}>
              <div className="pr-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
                <Icons.Clock />
              </div>
              <div>
                <small>PENDING APPROVAL</small>
                <h5 style={{ color: "#b45309" }}>{stats.pending}</h5>
              </div>
            </div>

            <div className="pr-kpi" style={{ borderLeft: "4px solid #10b981" }}>
              <div className="pr-kpi-icon" style={{ background: "#dcfce7", color: "#15803d" }}>
                <Icons.Check />
              </div>
              <div>
                <small>APPROVED</small>
                <h5 style={{ color: "#15803d" }}>{stats.approved}</h5>
              </div>
            </div>

            <div className="pr-kpi" style={{ borderLeft: "4px solid #ef4444" }}>
              <div className="pr-kpi-icon" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <Icons.XCircle />
              </div>
              <div>
                <small>REJECTED</small>
                <h5 style={{ color: "#b91c1c" }}>{stats.rejected}</h5>
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
              style={{ fontWeight: "700" }}
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