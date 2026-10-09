import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import "../styles/adminPro.css";
import BASE_URL from "../config/api";

// Embedded Icons for 100% offline reliability
const Icons = {
  Gauge: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  ),
  Plus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  List: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Refresh: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16" />
    </svg>
  ),
  Filter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Reset: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
    </svg>
  ),
  Excel: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="10" y1="9" x2="10" y2="9.01" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  ChevronUp: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  Warning: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const emptyEntry = {
  instrumentName: "",
  quantity: "",
  make: "",
  modelSerialNo: "",
  yearOfInstallation: "",
  internalExternal: "",
  purpose: "",
  frequency: "",
  dateOfCalibration: "",
  nextDueDate: "",
  location: "",
  status: "",
};

// ✅ Centralized list of required fields (used for both Add form & Edit row validation)
const REQUIRED_FIELDS = [
  { key: "instrumentName", label: "Instrument Name" },
  { key: "quantity", label: "Quantity" },
  { key: "make", label: "Make / Brand" },
  { key: "modelSerialNo", label: "Model / Serial No" },
  { key: "yearOfInstallation", label: "Installation Year" },
  { key: "internalExternal", label: "Scope" },
  { key: "purpose", label: "Purpose" },
  { key: "frequency", label: "Frequency" },
  { key: "dateOfCalibration", label: "Calibration Date" },
  { key: "nextDueDate", label: "Next Due Date" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status" },
];

function CalibrationDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [entries, setEntries] = useState([]);
  const [locations, setLocations] = useState([]);
  const [newEntry, setNewEntry] = useState(emptyEntry);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const dueCheckDone = useRef(false);

  // ✅ NEW: validation error states
  const [errors, setErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});

  // ✅ NEW: toast-style notification system (supports multiple stacked notifications)
  const [notifications, setNotifications] = useState([]);
  const notifIdRef = useRef(0);

  // Dedicated Filter States
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterScope, setFilterScope] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDueStatus, setFilterDueStatus] = useState("");

  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
  };

  // ── Notification helpers ───────────────────────────────────────
  const pushNotification = (type, text, duration = type === "error" ? 6000 : 4500) => {
    const id = ++notifIdRef.current;
    setNotifications((prev) => [...prev, { id, type, text }]);
    if (duration) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }
    return id;
  };

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // ── Validation helper ──────────────────────────────────────────
  const validateFields = (data) => {
    const newErrors = {};
    REQUIRED_FIELDS.forEach(({ key, label }) => {
      const val = data[key];
      if (val === undefined || val === null || String(val).trim() === "") {
        newErrors[key] = `${label} is required`;
      }
    });
    return newErrors;
  };

  const renderFieldError = (field) =>
    errors[field] ? <small className="field-error-text">{errors[field]}</small> : null;

  const fieldClass = (field) =>
    `input-compact ${errors[field] ? "input-error" : ""}`;

  const editFieldClass = (field) =>
    `input-compact ${editErrors[field] ? "input-error" : ""}`;

  const clearError = (field) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const clearEditError = (field) => {
    if (editErrors[field]) {
      setEditErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const getDueStatus = (nextDueDate) => {
    if (!nextDueDate) return { label: "-", cls: "", diffDays: null };
    const due = new Date(nextDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: "Expired", cls: "badge-expired", tag: "ALERT", diffDays };
    if (diffDays <= 30) return { label: "Expire Soon", cls: "badge-soon", tag: "DUE", diffDays };
    return { label: "Active", cls: "badge-ok", tag: "VALID", diffDays };
  };

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_URL}/api/calibration`, authHeaders);
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load calibration entries", err);
      pushNotification("error", "Failed to load calibration records.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/locations`, authHeaders);
      setLocations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load locations", err);
    }
  };

  useEffect(() => {
    fetchEntries();
    fetchLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dueCheckDone.current || entries.length === 0) return;
    dueCheckDone.current = true;
    const expiredNames = entries
      .filter((e) => getDueStatus(e.nextDueDate).label === "Expired")
      .map((e) => {
        const { diffDays } = getDueStatus(e.nextDueDate);
        const name = e.instrumentName || "Unnamed Instrument";
        return `${name} (${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue)`;
      });
    const dueSoonNames = entries
      .filter((e) => getDueStatus(e.nextDueDate).label === "Expire Soon")
      .map((e) => {
        const { diffDays } = getDueStatus(e.nextDueDate);
        const name = e.instrumentName || "Unnamed Instrument";
        return `${name} (${diffDays} day${diffDays === 1 ? "" : "s"} left)`;
      });

    const formatNameList = (names, max = 5) => {
      const shown = names.slice(0, max).join(", ");
      const extra = names.length > max ? ` +${names.length - max} more` : "";
      return `${shown}${extra}`;
    };

    if (expiredNames.length > 0) {
      pushNotification(
        "error",
        `⚠ Warning: ${formatNameList(expiredNames)} ${expiredNames.length > 1 ? "have" : "has"} expired calibration.`,
        9000
      );
    }
    if (dueSoonNames.length > 0) {
      pushNotification(
        "warning",
        `⏳ Attention: ${formatNameList(dueSoonNames)} ${dueSoonNames.length > 1 ? "are" : "is"} due for calibration.`,
        9000
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const focusFirstError = (fieldKey) => {
    const el = document.querySelector(`[name="${fieldKey}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => el.focus(), 250);
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();

    const validationErrors = validateFields(newEntry);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      pushNotification("error", "Please fill all required fields before submitting.");
      focusFirstError(Object.keys(validationErrors)[0]);
      return;
    }

    try {
      const payload = {
        ...newEntry,
        slNo: entries.length + 1,
      };
      await axios.post(`${BASE_URL}/api/calibration`, payload, authHeaders);
      setNewEntry(emptyEntry);
      setErrors({});
      pushNotification("success", "Equipment calibration entry added successfully!");
      fetchEntries();
    } catch (err) {
      console.error("Failed to add entry", err);
      pushNotification("error", "Failed to add entry. Please verify inputs.");
    }
  };

  const startEdit = (entry) => {
    const id = entry._id || entry.id;
    setEditingId(id);
    setEditingData({ ...entry });
    setEditErrors({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingData({});
    setEditErrors({});
  };

  const handleSaveEdit = async (id) => {
    const validationErrors = validateFields(editingData);
    setEditErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      const missingLabels = REQUIRED_FIELDS
        .filter(({ key }) => validationErrors[key])
        .map(({ label }) => label)
        .join(", ");
      pushNotification("error", `Please fill required fields: ${missingLabels}`);
      return;
    }

    try {
      await axios.put(`${BASE_URL}/api/calibration/${id}`, editingData, authHeaders);
      setEditingId(null);
      setEditErrors({});
      pushNotification("success", "Record updated successfully!");
      fetchEntries();
    } catch (err) {
      console.error("Failed to update entry", err);
      pushNotification("error", "Error updating record.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this calibration record?")) return;
    try {
      await axios.delete(`${BASE_URL}/api/calibration/${id}`, authHeaders);
      pushNotification("success", "Record deleted.");
      fetchEntries();
    } catch (err) {
      console.error("Failed to delete entry", err);
      pushNotification("error", "Error deleting record.");
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setFilterLocation("");
    setFilterScope("");
    setFilterStatus("");
    setFilterDueStatus("");
  };

  // Filtered rows
  const filteredEntries = entries.filter((e) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (e.instrumentName && e.instrumentName.toLowerCase().includes(q)) ||
      (e.make && e.make.toLowerCase().includes(q)) ||
      (e.modelSerialNo && e.modelSerialNo.toLowerCase().includes(q)) ||
      (e.location && e.location.toLowerCase().includes(q)) ||
      (e.status && e.status.toLowerCase().includes(q)) ||
      (e.internalExternal && e.internalExternal.toLowerCase().includes(q)) ||
      (e.purpose && e.purpose.toLowerCase().includes(q));

    const matchesLocation =
      !filterLocation || (e.location && e.location.toLowerCase() === filterLocation.toLowerCase());

    const matchesScope =
      !filterScope ||
      (e.internalExternal && e.internalExternal.toLowerCase() === filterScope.toLowerCase());

    const matchesStatus =
      !filterStatus || (e.status && e.status.toLowerCase() === filterStatus.toLowerCase());

    const dueInfo = getDueStatus(e.nextDueDate);
    const matchesDueStatus =
      !filterDueStatus || (dueInfo.label && dueInfo.label.toLowerCase() === filterDueStatus.toLowerCase());

    return matchesSearch && matchesLocation && matchesScope && matchesStatus && matchesDueStatus;
  });

  // Excel Generator based on active filters
  const handleExportExcel = () => {
    if (filteredEntries.length === 0) {
      pushNotification("warning", "No calibration records to export based on current filters.");
      return;
    }

    try {
      const exportData = filteredEntries.map((e, idx) => {
        const due = getDueStatus(e.nextDueDate);
        return {
          "Sl. No": e.slNo || idx + 1,
          "Instrument Name": e.instrumentName || "",
          "Quantity": e.quantity || "",
          "Make / Brand": e.make || "",
          "Model / Serial No": e.modelSerialNo || "",
          "Year of Installation": e.yearOfInstallation || "",
          "Scope (Internal/External)": e.internalExternal || "",
          "Purpose": e.purpose || "",
          "Frequency": e.frequency || "",
          "Calibration Date": e.dateOfCalibration ? e.dateOfCalibration.split("T")[0] : "",
          "Next Due Date": e.nextDueDate ? e.nextDueDate.split("T")[0] : "",
          "Location": e.location || "",
          "Equipment Status": e.status || "",
          "Due Status": due.label || "-"
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 8 },  // Sl No
        { wch: 28 }, // Instrument Name
        { wch: 8 },  // Qty
        { wch: 18 }, // Make
        { wch: 22 }, // Model / Serial
        { wch: 16 }, // Installed
        { wch: 15 }, // Scope
        { wch: 25 }, // Purpose
        { wch: 14 }, // Frequency
        { wch: 16 }, // Cal Date
        { wch: 16 }, // Due Date
        { wch: 18 }, // Location
        { wch: 16 }, // Status
        { wch: 14 }  // Due Status
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Calibration Chart");
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Calibration_Chart_${dateStr}.xlsx`);
      pushNotification("success", "Excel report generated successfully.");
    } catch (err) {
      console.error("Failed to generate Excel file:", err);
      pushNotification("error", "Error generating Excel report. Please ensure xlsx is installed.");
    }
  };

  // KPI Statistics
  const totalCount = entries.length;
  const internalCount = entries.filter((e) => (e.internalExternal || "").toLowerCase() === "internal").length;
  const externalCount = entries.filter((e) => (e.internalExternal || "").toLowerCase() === "external").length;
  const expiredCount = entries.filter((e) => getDueStatus(e.nextDueDate).label === "Expired").length;
  const dueSoonCount = entries.filter((e) => getDueStatus(e.nextDueDate).label === "Expire Soon").length;

  const activeFiltersCount =
    (search ? 1 : 0) +
    (filterLocation ? 1 : 0) +
    (filterScope ? 1 : 0) +
    (filterStatus ? 1 : 0) +
    (filterDueStatus ? 1 : 0);

  return (
    <div className="calib-page-wrapper">
      <style>{`
        .calib-page-wrapper {
          min-height: 100vh;
          background: radial-gradient(circle at 10% 20%, #d8f1fb 0%, #edf9fe 90.2%);
          padding: 22px 18px 60px;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
          color: #0c3349;
        }

        .calib-container-3d {
          max-width: 1480px;
          margin: 0 auto;
          background: #d8f1fb;
          border: 1px solid rgba(12, 90, 130, 0.38);
          border-radius: 20px;
          box-shadow: 0 18px 40px rgba(4, 52, 78, 0.14);
          padding: 22px;
        }

        /* Top Header */
        .calib-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #075f90 0%, #119bd2 100%);
          border-radius: 16px;
          padding: 14px 22px;
          margin-bottom: 20px;
          box-shadow: 0 8px 22px rgba(7, 95, 144, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: #fff;
        }

        .calib-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .calib-header-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.12);
        }

        .calib-header h1 {
          font-size: 1.35rem;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.02em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }

        .calib-header p {
          margin: 2px 0 0;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.88);
          font-weight: 500;
        }

        .calib-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* KPI Metric Tiles */
        .calib-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .metric-card-3d {
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(12, 90, 130, 0.2);
          border-radius: 14px;
          padding: 14px 18px;
          box-shadow: 0 6px 16px rgba(4, 52, 78, 0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 4px solid #0f8ec7;
          transition: transform 0.15s ease;
        }
        .metric-card-3d:hover {
          transform: translateY(-2px);
        }

        .metric-card-3d.blue { border-top-color: #0284c7; }
        .metric-card-3d.purple { border-top-color: #8b5cf6; }
        .metric-card-3d.amber { border-top-color: #f59e0b; }
        .metric-card-3d.red { border-top-color: #ef4444; }

        .metric-label {
          font-size: 0.74rem;
          font-weight: 800;
          color: #436a80;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .metric-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: #074361;
          margin-top: 2px;
          line-height: 1.1;
        }

        .metric-icon-bubble {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e4f5fc;
          color: #08618f;
        }

        /* Glassmorphism Chassis Card */
        .card-glass-3d {
          background: rgba(221, 243, 252, 0.94);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid rgba(12, 90, 130, 0.28);
          box-shadow: 0 10px 24px rgba(4, 52, 78, 0.07);
          margin-bottom: 20px;
          overflow: hidden;
        }

        .card-header-bar {
          background: linear-gradient(135deg, #09689e 0%, #15a5df 100%);
          color: #ffffff;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .card-header-title {
          font-size: 0.92rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* Compact & Adjusted Form Grid */
        .form-grid-compact {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
          gap: 10px 14px;
          padding: 16px 18px 12px;
        }

        .form-group-compact {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .form-label-compact {
          font-size: 0.72rem;
          font-weight: 800;
          color: #094766;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .required-mark {
          color: #dc2626;
          margin-left: 2px;
        }

        .input-compact {
          width: 100%;
          height: 33px;
          background: #ffffff;
          border: 1.5px solid #91b5c9;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.04);
          border-radius: 8px;
          padding: 4px 10px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #0d3146;
          box-sizing: border-box;
          outline: none;
          transition: all 0.15s ease;
        }

        .input-compact:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 2.5px rgba(2, 132, 199, 0.22), inset 0 1px 2px rgba(0, 0, 0, 0.02);
          background: #ffffff;
        }

        /* ✅ NEW: validation error styling */
        .input-error {
          border-color: #dc2626 !important;
          background: #fff5f5 !important;
        }
        .input-error:focus {
          box-shadow: 0 0 0 2.5px rgba(220, 38, 38, 0.22) !important;
        }
        .field-error-text {
          color: #dc2626;
          font-size: 0.68rem;
          font-weight: 700;
          margin-top: 1px;
          line-height: 1.2;
        }

        select.input-compact {
          cursor: pointer;
        }

        /* Separate Dedicated Filter Section */
        .filter-panel-3d {
          padding: 14px 18px;
          background: rgba(230, 246, 253, 0.85);
          border-bottom: 1.5px solid rgba(12, 90, 130, 0.18);
        }

        .filter-controls-row {
          display: grid;
          grid-template-columns: 2fr repeat(4, 1.2fr) auto auto;
          gap: 10px;
          align-items: flex-end;
        }

        @media (max-width: 1200px) {
          .filter-controls-row {
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          }
        }

        .search-box-relative {
          position: relative;
        }
        .search-box-relative svg {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #5c8094;
          pointer-events: none;
        }
        .search-input-inner {
          padding-left: 32px !important;
        }

        /* 3D Tactile Buttons */
        .btn-3d {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 14px;
          font-size: 0.82rem;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.12s ease;
          user-select: none;
          border: none;
          text-decoration: none;
          height: 33px;
          box-sizing: border-box;
          white-space: nowrap;
        }

        .btn-3d:active {
          transform: translateY(2px);
        }

        .btn-3d-primary {
          background: linear-gradient(180deg, #1282b8 0%, #085f8c 100%);
          color: #ffffff;
          border: 1px solid #064c73;
          box-shadow: 0 3px 0 #043a57, 0 4px 10px rgba(8, 95, 140, 0.22);
        }
        .btn-3d-primary:hover {
          background: linear-gradient(180deg, #1693cf 0%, #0a6b9e 100%);
        }
        .btn-3d-primary:active {
          box-shadow: 0 1px 0 #043a57;
        }

        .btn-3d-success {
          background: linear-gradient(180deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          border: 1px solid #047857;
          box-shadow: 0 3px 0 #065f46, 0 4px 10px rgba(16, 185, 129, 0.22);
        }
        .btn-3d-success:hover {
          background: linear-gradient(180deg, #34d399 0%, #059669 100%);
        }
        .btn-3d-success:active {
          box-shadow: 0 1px 0 #065f46;
        }

        /* 3D Excel Export Button */
        .btn-3d-excel {
          background: linear-gradient(180deg, #168a48 0%, #0f6c37 100%);
          color: #ffffff;
          border: 1px solid #0a542a;
          box-shadow: 0 3px 0 #07401f, 0 4px 12px rgba(16, 124, 65, 0.35);
        }
        .btn-3d-excel:hover {
          background: linear-gradient(180deg, #1fa557 0%, #127d40 100%);
        }
        .btn-3d-excel:active {
          box-shadow: 0 1px 0 #07401f;
        }

        .btn-3d-danger {
          background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
          color: #ffffff;
          border: 1px solid #b91c1c;
          box-shadow: 0 3px 0 #991b1b;
        }
        .btn-3d-danger:hover {
          background: linear-gradient(180deg, #f87171 0%, #dc2626 100%);
        }
        .btn-3d-danger:active {
          box-shadow: 0 1px 0 #991b1b;
        }

        .btn-3d-secondary {
          background: linear-gradient(180deg, #64748b 0%, #475569 100%);
          color: #ffffff;
          border: 1px solid #334155;
          box-shadow: 0 3px 0 #1e293b;
        }
        .btn-3d-secondary:hover {
          background: linear-gradient(180deg, #94a3b8 0%, #475569 100%);
        }
        .btn-3d-secondary:active {
          box-shadow: 0 1px 0 #1e293b;
        }

        .btn-3d-sm {
          height: 27px;
          padding: 3px 8px;
          font-size: 0.74rem;
          border-radius: 6px;
        }

        /* ✅ NEW: Toast Notification Stack (replaces the single banner) */
        .toast-stack {
          position: fixed;
          top: 18px;
          right: 18px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 380px;
        }

        .toast-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.82rem;
          box-shadow: 0 10px 24px rgba(4, 52, 78, 0.22);
          animation: toastSlideIn 0.25s ease;
          border: 1px solid transparent;
        }

        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .toast-success {
          background: #d1fae5;
          color: #065f46;
          border-color: #a7f3d0;
        }
        .toast-error {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }
        .toast-warning {
          background: #fef3c7;
          color: #92400e;
          border-color: #fde68a;
        }

        .toast-icon {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .toast-text {
          flex: 1;
          line-height: 1.3;
        }

        .toast-close {
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          opacity: 0.6;
          padding: 0;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .toast-close:hover {
          opacity: 1;
        }

        /* 3D Table Design */
        .table-responsive-3d {
          overflow-x: auto;
          background: #ffffff;
          border-radius: 0 0 14px 14px;
        }

        .table-calib {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.81rem;
          white-space: nowrap;
        }

        .table-calib thead th {
          background: #064c73 !important;
          color: #ffffff;
          padding: 10px 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid rgba(255, 255, 255, 0.12);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .table-calib tbody td {
          padding: 8px 12px;
          border-bottom: 1px solid #d9e9f2;
          border-right: 1px solid #edf4f8;
          color: #10384d;
          font-weight: 600;
        }

        .table-calib tbody tr:nth-child(even) {
          background: #f7fcfe;
        }

        .table-calib tbody tr:hover {
          background: #d9f2fc !important;
        }

        /* Badges */
        .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 0.71rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .badge-internal {
          background: #e0e7ff;
          color: #3730a3;
          border: 1px solid #c7d2fe;
        }
        .badge-external {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .badge-ok {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .badge-soon {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }
        .badge-expired {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .filter-counter-badge {
          background: rgba(255, 255, 255, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.4);
          padding: 2px 7px;
          border-radius: 12px;
          font-size: 0.72rem;
          font-weight: 800;
        }

        .empty-placeholder {
          padding: 36px;
          text-align: center;
          color: #55798e;
          font-weight: 700;
        }
      `}</style>

      {/* ✅ NEW: Toast Notification Stack */}
      <div className="toast-stack">
        {notifications.map((n) => (
          <div key={n.id} className={`toast-item toast-${n.type}`}>
            <span className="toast-icon">
              {n.type === "success" && <Icons.Check />}
              {n.type === "error" && <Icons.X />}
              {n.type === "warning" && <Icons.Warning />}
            </span>
            <span className="toast-text">{n.text}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismissNotification(n.id)}
              title="Dismiss"
            >
              <Icons.X />
            </button>
          </div>
        ))}
      </div>

      <div className="calib-container-3d">
        {/* Top Header Bar */}
        <header className="calib-header">
          <div className="calib-header-left">
            <div className="calib-header-icon">
              <Icons.Gauge />
            </div>
            <div>
              <h1>Calibration Dashboard</h1>
              <p>MPi SP QS QA T087 • Equipment Master & Precision Calibration Record</p>
            </div>
          </div>

          <div className="calib-header-actions">
            <select
              className="input-compact"
              style={{ width: "210px", fontWeight: 800, cursor: "pointer" }}
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === "new-inspection") navigate("/new-inspection");
                else if (val === "inspection-dashboard") navigate("/receiving-inspection");
                e.target.value = "";
              }}
            >
              <option value="" disabled>-- Quick Actions --</option>
              <option value="new-inspection">➕ Receiving Inspection</option>
              <option value="inspection-dashboard">📊 Inspection Dashboard</option>
            </select>
          </div>
        </header>

        {/* 3D KPI Metrics Banner */}
        <section className="calib-metrics-grid">
          <div className="metric-card-3d blue">
            <div>
              <div className="metric-label">Total Registered</div>
              <div className="metric-value">{totalCount}</div>
            </div>
            <div className="metric-icon-bubble">
              <Icons.Gauge />
            </div>
          </div>
          <div className="metric-card-3d purple">
            <div>
              <div className="metric-label">Internal Verification</div>
              <div className="metric-value">{internalCount}</div>
            </div>
            <div className="metric-icon-bubble" style={{ background: "#ede9fe", color: "#6d28d9" }}>
              <Icons.List />
            </div>
          </div>
          <div className="metric-card-3d amber">
            <div>
              <div className="metric-label">Due Soon (30 Days)</div>
              <div className="metric-value">{dueSoonCount}</div>
            </div>
            <div className="metric-icon-bubble" style={{ background: "#fef3c7", color: "#b45309" }}>
              <Icons.Gauge />
            </div>
          </div>
          <div className="metric-card-3d red">
            <div>
              <div className="metric-label">Calibration Expired</div>
              <div className="metric-value">{expiredCount}</div>
            </div>
            <div className="metric-icon-bubble" style={{ background: "#fee2e2", color: "#b91c1c" }}>
              <Icons.X />
            </div>
          </div>
        </section>

        {/* Form: Compact & Adjusted Manual Entry Form */}
        <section className="card-glass-3d">
          <div className="card-header-bar">
            <div className="card-header-title">
              <Icons.Plus /> Add New Instrument Entry
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="btn-3d btn-3d-secondary btn-3d-sm"
              style={{ background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.35)", boxShadow: "none" }}
            >
              {isFormOpen ? <><Icons.ChevronUp /> Collapse</> : <><Icons.ChevronDown /> Expand Form</>}
            </button>
          </div>

          {isFormOpen && (
            <form onSubmit={handleAddEntry} noValidate>
              <div className="form-grid-compact">
                {/* Instrument Name */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Instrument Name<span className="required-mark">*</span>
                  </label>
                  <input
                    type="text"
                    name="instrumentName"
                    className={fieldClass("instrumentName")}
                    placeholder="e.g. Digital Micrometer"
                    value={newEntry.instrumentName}
                    onChange={(e) => {
                      clearError("instrumentName");
                      setNewEntry({ ...newEntry, instrumentName: e.target.value });
                    }}
                  />
                  {renderFieldError("instrumentName")}
                </div>

                {/* Quantity */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Quantity<span className="required-mark">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    className={fieldClass("quantity")}
                    placeholder="e.g. 1"
                    value={newEntry.quantity}
                    onChange={(e) => {
                      clearError("quantity");
                      setNewEntry({ ...newEntry, quantity: e.target.value });
                    }}
                  />
                  {renderFieldError("quantity")}
                </div>

                {/* Make */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Make / Brand<span className="required-mark">*</span>
                  </label>
                  <input
                    type="text"
                    name="make"
                    className={fieldClass("make")}
                    placeholder="e.g. Mitutoyo"
                    value={newEntry.make}
                    onChange={(e) => {
                      clearError("make");
                      setNewEntry({ ...newEntry, make: e.target.value });
                    }}
                  />
                  {renderFieldError("make")}
                </div>

                {/* Model / Serial No */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Model / Serial No<span className="required-mark">*</span>
                  </label>
                  <input
                    type="text"
                    name="modelSerialNo"
                    className={fieldClass("modelSerialNo")}
                    placeholder="e.g. MIT-2023-8871"
                    value={newEntry.modelSerialNo}
                    onChange={(e) => {
                      clearError("modelSerialNo");
                      setNewEntry({ ...newEntry, modelSerialNo: e.target.value });
                    }}
                  />
                  {renderFieldError("modelSerialNo")}
                </div>

                {/* Year of Installation */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Installation Year<span className="required-mark">*</span>
                  </label>
                  <input
                    type="text"
                    name="yearOfInstallation"
                    className={fieldClass("yearOfInstallation")}
                    placeholder="e.g. 2022"
                    value={newEntry.yearOfInstallation}
                    onChange={(e) => {
                      clearError("yearOfInstallation");
                      setNewEntry({ ...newEntry, yearOfInstallation: e.target.value });
                    }}
                  />
                  {renderFieldError("yearOfInstallation")}
                </div>

                {/* Scope */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Scope<span className="required-mark">*</span>
                  </label>
                  <select
                    name="internalExternal"
                    className={fieldClass("internalExternal")}
                    value={newEntry.internalExternal}
                    onChange={(e) => {
                      clearError("internalExternal");
                      setNewEntry({ ...newEntry, internalExternal: e.target.value });
                    }}
                  >
                    <option value="">Select Scope</option>
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                  </select>
                  {renderFieldError("internalExternal")}
                </div>

                {/* Purpose */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Purpose<span className="required-mark">*</span>
                  </label>
                  <input
                    type="text"
                    name="purpose"
                    className={fieldClass("purpose")}
                    placeholder="e.g. Thickness Measurement"
                    value={newEntry.purpose}
                    onChange={(e) => {
                      clearError("purpose");
                      setNewEntry({ ...newEntry, purpose: e.target.value });
                    }}
                  />
                  {renderFieldError("purpose")}
                </div>

                {/* Frequency */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Frequency<span className="required-mark">*</span>
                  </label>
                  <input
                    type="text"
                    name="frequency"
                    className={fieldClass("frequency")}
                    placeholder="e.g. 1 Year / 6 Months"
                    value={newEntry.frequency}
                    onChange={(e) => {
                      clearError("frequency");
                      setNewEntry({ ...newEntry, frequency: e.target.value });
                    }}
                  />
                  {renderFieldError("frequency")}
                </div>

                {/* Date of Calibration */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Calibration Date<span className="required-mark">*</span>
                  </label>
                  <input
                    type="date"
                    name="dateOfCalibration"
                    className={fieldClass("dateOfCalibration")}
                    value={newEntry.dateOfCalibration ? newEntry.dateOfCalibration.split("T")[0] : ""}
                    onChange={(e) => {
                      clearError("dateOfCalibration");
                      setNewEntry({ ...newEntry, dateOfCalibration: e.target.value });
                    }}
                  />
                  {renderFieldError("dateOfCalibration")}
                </div>

                {/* Next Due Date */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Next Due Date<span className="required-mark">*</span>
                  </label>
                  <input
                    type="date"
                    name="nextDueDate"
                    className={fieldClass("nextDueDate")}
                    value={newEntry.nextDueDate ? newEntry.nextDueDate.split("T")[0] : ""}
                    onChange={(e) => {
                      clearError("nextDueDate");
                      setNewEntry({ ...newEntry, nextDueDate: e.target.value });
                    }}
                  />
                  {renderFieldError("nextDueDate")}
                </div>

                {/* Location */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Location<span className="required-mark">*</span>
                  </label>
                  {locations && locations.length > 0 ? (
                    <select
                      name="location"
                      className={fieldClass("location")}
                      value={newEntry.location}
                      onChange={(e) => {
                        clearError("location");
                        setNewEntry({ ...newEntry, location: e.target.value });
                      }}
                    >
                      <option value="">Select Location</option>
                      {locations.map((loc) => {
                        const locName = typeof loc === "string" ? loc : loc.name || loc.locationName;
                        return (
                          <option key={loc._id || locName} value={locName}>
                            {locName}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="location"
                      className={fieldClass("location")}
                      placeholder="e.g. QA Lab"
                      value={newEntry.location}
                      onChange={(e) => {
                        clearError("location");
                        setNewEntry({ ...newEntry, location: e.target.value });
                      }}
                    />
                  )}
                  {renderFieldError("location")}
                </div>

                {/* Status */}
                <div className="form-group-compact">
                  <label className="form-label-compact">
                    Status<span className="required-mark">*</span>
                  </label>
                  <select
                    name="status"
                    className={fieldClass("status")}
                    value={newEntry.status}
                    onChange={(e) => {
                      clearError("status");
                      setNewEntry({ ...newEntry, status: e.target.value });
                    }}
                  >
                    <option value="">Select Status</option>
                    <option value="Calibrated">Calibrated</option>
                    <option value="Active">Active</option>
                    <option value="Due Soon">Due Soon</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                  </select>
                  {renderFieldError("status")}
                </div>
              </div>

              <div style={{ padding: "0 18px 14px", display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn-3d btn-3d-primary" style={{ padding: "8px 20px" }}>
                  <Icons.Plus /> Add Calibration Record
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Separate Filter & Search Control Center */}
        <section className="card-glass-3d">
          <div className="card-header-bar">
            <div className="card-header-title">
              <Icons.Filter /> Filters & Data Query
              {activeFiltersCount > 0 && (
                <span className="filter-counter-badge">{activeFiltersCount} Active</span>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  className="btn-3d btn-3d-secondary btn-3d-sm"
                  onClick={handleResetFilters}
                  title="Clear All Filters"
                >
                  <Icons.Reset /> Reset Filters
                </button>
              )}
              <button
                type="button"
                className="btn-3d btn-3d-excel btn-3d-sm"
                onClick={handleExportExcel}
                title="Export filtered records to Microsoft Excel"
              >
                <Icons.Excel /> Export to Excel ({filteredEntries.length})
              </button>
            </div>
          </div>

          <div className="filter-panel-3d">
            <div className="filter-controls-row">
              {/* Keyword Search */}
              <div className="form-group-compact">
                <label className="form-label-compact">Search Keyword</label>
                <div className="search-box-relative">
                  <Icons.Search />
                  <input
                    type="text"
                    className="input-compact search-input-inner"
                    placeholder="Instrument, serial, make, purpose..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Location Filter */}
              <div className="form-group-compact">
                <label className="form-label-compact">Location</label>
                <select
                  className="input-compact"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => {
                    const locName = typeof loc === "string" ? loc : loc.name || loc.locationName;
                    return (
                      <option key={loc._id || locName} value={locName}>
                        {locName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Scope Filter */}
              <div className="form-group-compact">
                <label className="form-label-compact">Scope</label>
                <select
                  className="input-compact"
                  value={filterScope}
                  onChange={(e) => setFilterScope(e.target.value)}
                >
                  <option value="">All Scopes</option>
                  <option value="Internal">Internal</option>
                  <option value="External">External</option>
                </select>
              </div>

              {/* Equipment Status Filter */}
              <div className="form-group-compact">
                <label className="form-label-compact">Equipment Status</label>
                <select
                  className="input-compact"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="Calibrated">Calibrated</option>
                  <option value="Active">Active</option>
                  <option value="Due Soon">Due Soon</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                </select>
              </div>

              {/* Due Status Filter */}
              <div className="form-group-compact">
                <label className="form-label-compact">Due Status</label>
                <select
                  className="input-compact"
                  value={filterDueStatus}
                  onChange={(e) => setFilterDueStatus(e.target.value)}
                >
                  <option value="">All Due Statuses</option>
                  <option value="Active">Active (Valid)</option>
                  <option value="Expire Soon">Expire Soon (&le; 30d)</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Master Records Table Section */}
        <section className="card-glass-3d">
          <div className="card-header-bar">
            <div className="card-header-title">
              <Icons.List /> Master Calibration Records
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                Showing <strong>{filteredEntries.length}</strong> of <strong>{entries.length}</strong> items
              </span>
            </div>
          </div>

          {/* 3D Modern Data Table */}
          <div className="table-responsive-3d">
            <table className="table-calib">
              <thead>
                <tr>
                  <th style={{ width: "45px", textAlign: "center" }}>Sl</th>
                  <th>Instrument Name</th>
                  <th style={{ width: "45px" }}>Qty</th>
                  <th>Make</th>
                  <th>Model / Serial No</th>
                  <th>Installed</th>
                  <th>Scope</th>
                  <th>Purpose</th>
                  <th>Frequency</th>
                  <th>Calib Date</th>
                  <th>Next Due Date</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Due Status</th>
                  <th style={{ textAlign: "center", width: "95px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="15" className="empty-placeholder">
                      Loading calibration records...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan="15" className="empty-placeholder">
                      No matching records found for the applied filters.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, idx) => {
                    const id = entry._id || entry.id;
                    const isEditing = editingId === id;
                    const due = getDueStatus(entry.nextDueDate);

                    return (
                      <tr key={id || idx}>
                        {/* Sl. No */}
                        <td style={{ textAlign: "center", fontWeight: 800 }}>
                          {entry.slNo || idx + 1}
                        </td>

                        {/* Instrument Name */}
                        <td>
                          {isEditing ? (
                            <input
                              className={editFieldClass("instrumentName")}
                              value={editingData.instrumentName || ""}
                              onChange={(e) => {
                                clearEditError("instrumentName");
                                setEditingData({ ...editingData, instrumentName: e.target.value });
                              }}
                            />
                          ) : (
                            <strong style={{ color: "#064c73" }}>{entry.instrumentName}</strong>
                          )}
                        </td>

                        {/* Quantity */}
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              className={editFieldClass("quantity")}
                              style={{ width: "55px" }}
                              value={editingData.quantity || ""}
                              onChange={(e) => {
                                clearEditError("quantity");
                                setEditingData({ ...editingData, quantity: e.target.value });
                              }}
                            />
                          ) : (
                            entry.quantity || "-"
                          )}
                        </td>

                        {/* Make */}
                        <td>
                          {isEditing ? (
                            <input
                              className={editFieldClass("make")}
                              value={editingData.make || ""}
                              onChange={(e) => {
                                clearEditError("make");
                                setEditingData({ ...editingData, make: e.target.value });
                              }}
                            />
                          ) : (
                            entry.make || "-"
                          )}
                        </td>

                        {/* Model / Serial No */}
                        <td>
                          {isEditing ? (
                            <input
                              className={editFieldClass("modelSerialNo")}
                              value={editingData.modelSerialNo || ""}
                              onChange={(e) => {
                                clearEditError("modelSerialNo");
                                setEditingData({ ...editingData, modelSerialNo: e.target.value });
                              }}
                            />
                          ) : (
                            <code style={{ background: "#e5f4fa", padding: "2px 5px", borderRadius: "4px", color: "#075f90" }}>
                              {entry.modelSerialNo || "-"}
                            </code>
                          )}
                        </td>

                        {/* Year of Installation */}
                        <td>
                          {isEditing ? (
                            <input
                              className={editFieldClass("yearOfInstallation")}
                              style={{ width: "70px" }}
                              value={editingData.yearOfInstallation || ""}
                              onChange={(e) => {
                                clearEditError("yearOfInstallation");
                                setEditingData({ ...editingData, yearOfInstallation: e.target.value });
                              }}
                            />
                          ) : (
                            entry.yearOfInstallation || "-"
                          )}
                        </td>

                        {/* Scope */}
                        <td>
                          {isEditing ? (
                            <select
                              className={editFieldClass("internalExternal")}
                              value={editingData.internalExternal || ""}
                              onChange={(e) => {
                                clearEditError("internalExternal");
                                setEditingData({ ...editingData, internalExternal: e.target.value });
                              }}
                            >
                              <option value="">Select</option>
                              <option value="Internal">Internal</option>
                              <option value="External">External</option>
                            </select>
                          ) : entry.internalExternal ? (
                            <span
                              className={`badge-pill ${
                                entry.internalExternal.toLowerCase() === "internal"
                                  ? "badge-internal"
                                  : "badge-external"
                              }`}
                            >
                              {entry.internalExternal}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        {/* Purpose */}
                        <td>
                          {isEditing ? (
                            <input
                              className={editFieldClass("purpose")}
                              value={editingData.purpose || ""}
                              onChange={(e) => {
                                clearEditError("purpose");
                                setEditingData({ ...editingData, purpose: e.target.value });
                              }}
                            />
                          ) : (
                            entry.purpose || "-"
                          )}
                        </td>

                        {/* Frequency */}
                        <td>
                          {isEditing ? (
                            <input
                              className={editFieldClass("frequency")}
                              value={editingData.frequency || ""}
                              onChange={(e) => {
                                clearEditError("frequency");
                                setEditingData({ ...editingData, frequency: e.target.value });
                              }}
                            />
                          ) : (
                            entry.frequency || "-"
                          )}
                        </td>

                        {/* Date of Calibration */}
                        <td>
                          {isEditing ? (
                            <input
                              type="date"
                              className={editFieldClass("dateOfCalibration")}
                              value={
                                editingData.dateOfCalibration
                                  ? editingData.dateOfCalibration.split("T")[0]
                                  : ""
                              }
                              onChange={(e) => {
                                clearEditError("dateOfCalibration");
                                setEditingData({ ...editingData, dateOfCalibration: e.target.value });
                              }}
                            />
                          ) : entry.dateOfCalibration ? (
                            entry.dateOfCalibration.split("T")[0]
                          ) : (
                            "-"
                          )}
                        </td>

                        {/* Next Due Date */}
                        <td>
                          {isEditing ? (
                            <input
                              type="date"
                              className={editFieldClass("nextDueDate")}
                              value={
                                editingData.nextDueDate ? editingData.nextDueDate.split("T")[0] : ""
                              }
                              onChange={(e) => {
                                clearEditError("nextDueDate");
                                setEditingData({ ...editingData, nextDueDate: e.target.value });
                              }}
                            />
                          ) : entry.nextDueDate ? (
                            <span style={{ fontWeight: 700 }}>
                              {entry.nextDueDate.split("T")[0]}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        {/* Location */}
                        <td>
                          {isEditing ? (
                            <input
                              className={editFieldClass("location")}
                              value={editingData.location || ""}
                              onChange={(e) => {
                                clearEditError("location");
                                setEditingData({ ...editingData, location: e.target.value });
                              }}
                            />
                          ) : (
                            entry.location || "-"
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          {isEditing ? (
                            <select
                              className={editFieldClass("status")}
                              value={editingData.status || ""}
                              onChange={(e) => {
                                clearEditError("status");
                                setEditingData({ ...editingData, status: e.target.value });
                              }}
                            >
                              <option value="">Select</option>
                              <option value="Calibrated">Calibrated</option>
                              <option value="Active">Active</option>
                              <option value="Due Soon">Due Soon</option>
                              <option value="Overdue">Overdue</option>
                              <option value="Under Maintenance">Under Maintenance</option>
                            </select>
                          ) : (
                            entry.status || "-"
                          )}
                        </td>

                        {/* Due Status Badge */}
                        <td>
                          {entry.nextDueDate ? (
                            <span className={`badge-pill ${due.cls}`}>
                              {due.label}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        {/* Actions */}
                        <td>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-3d btn-3d-success btn-3d-sm"
                                  onClick={() => handleSaveEdit(id)}
                                  title="Save Changes"
                                >
                                  <Icons.Check />
                                </button>
                                <button
                                  type="button"
                                  className="btn-3d btn-3d-secondary btn-3d-sm"
                                  onClick={cancelEdit}
                                  title="Cancel"
                                >
                                  <Icons.X />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn-3d btn-3d-primary btn-3d-sm"
                                  onClick={() => startEdit(entry)}
                                  title="Edit Record"
                                >
                                  <Icons.Edit />
                                </button>
                                <button
                                  type="button"
                                  className="btn-3d btn-3d-danger btn-3d-sm"
                                  onClick={() => handleDelete(id)}
                                  title="Delete Record"
                                >
                                  <Icons.Trash />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CalibrationDashboard;