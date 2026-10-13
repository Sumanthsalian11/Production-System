import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";

const FILTER_STORAGE_KEY = "billingReport.filterCustomer";
const REPORT_NO_STORAGE_KEY = "billingReport.filterReportNo";
const MAX_ROWS_SHOWN = 30;

/* ---------- Production Report style (white page, light-blue cards) ---------- */
const CSS = `
  .pro-container.br-root {
    --ink: #08283d; --muted: #475569; --hint: #94a3b8;
    min-height: 100vh;
    max-width: 100%;
    margin: 0;
    padding: 18px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    color: var(--ink);
    background: #ffffff;
    border: 1px solid rgba(12, 90, 130, 0.38);
  }
  .br-root * { box-sizing: border-box; }
  .br-inner { width: 100%; max-width: none; margin: 0; }

  /* ---------- Header ---------- */
  .br-root .pro-header {
    display: flex; align-items: center; justify-content: center; gap: 14px;
    margin: 0 auto 16px; padding: 12px 22px;
    border-radius: 12px;
    background: rgba(221, 243, 252, 0.94);
    border: 1px solid rgba(20, 111, 156, 0.42);
    box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22);
  }
  .br-root .pro-header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 0; color: #06324d; }
  .br-emblem {
    width: 46px; height: 46px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: #0a6fb8;
    background: #ffffff;
    border: 1px solid rgba(20, 111, 156, 0.42);
  }

  /* ---------- Cards ---------- */
  .br-root .pro-card {
    background: rgba(221, 243, 252, 0.94);
    border: 1px solid rgba(20, 111, 156, 0.42);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22);
  }
  .br-root .pro-card-header,
  .br-modal-box .pro-card-header { margin-bottom: 12px; padding: 0; border: none; background: transparent; }
  .br-root .pro-card-header > span,
  .br-modal-box .pro-card-header > span {
    display: inline-block;
    font-size: 18px; font-weight: 800; color: #062b42;
    padding: 6px 0;
    background: none; border: 0; border-radius: 0; box-shadow: none;
    text-transform: none; letter-spacing: 0;
  }
  .br-root .pro-card-header > span::before,
  .br-modal-box .pro-card-header > span::before {
    display: none;
  }

  /* ---------- Inputs ---------- */
  .br-root .pro-input,
  .br-modal-box .pro-input {
    width: 100%; height: 38px; padding: 0 12px;
    border: 1px solid rgba(14, 94, 135, 0.62); border-radius: 8px;
    background: rgba(255, 255, 255, 0.98); color: #071f31;
    font-size: 14px; font-weight: 600; outline: none; font-family: inherit;
    box-shadow: inset 0 1px 2px rgba(8, 55, 83, 0.08);
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .br-root .pro-input:hover,
  .br-modal-box .pro-input:hover { border-color: #087fb5; }
  .br-root .pro-input:focus,
  .br-modal-box .pro-input:focus { border-color: #087fb5; box-shadow: 0 0 0 3px rgba(8, 127, 181, 0.22); }
  .br-root .pro-input::placeholder,
  .br-modal-box .pro-input::placeholder { color: var(--hint); font-weight: 600; }

  /* ---------- Buttons (light) ---------- */
  .br-root .pro-btn, .br-modal-box .pro-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 38px; padding: 6px 16px;
    border: 1px solid #9fcfe9; border-radius: 8px;
    background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%); color: #08406b;
    font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
    box-shadow: 0 3px 8px rgba(40, 120, 170, 0.14), inset 0 1px 0 #ffffff;
    transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
  }
  .br-root .pro-btn:hover:not(:disabled), .br-modal-box .pro-btn:hover:not(:disabled) { filter: brightness(1.03); }
  .br-root .pro-btn:active:not(:disabled), .br-modal-box .pro-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 3px rgba(40, 120, 170, 0.18); }
  .br-root .pro-btn:disabled, .br-modal-box .pro-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .br-root .pro-btn.primary, .br-modal-box .pro-btn.primary {
    background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%); color: #07583b; border-color: #7fd3ab;
  }
  .br-root .pro-btn.br-danger, .br-modal-box .pro-btn.br-danger {
    background: linear-gradient(180deg, #ffdcdc 0%, #f7a3a3 100%); color: #8f1414; border-color: #ee8f8f;
  }

  /* ---------- Generate form fields ---------- */
  .br-root .pro-header h1 { border: none !important; padding: 0 !important; background: none !important; }
  .br-root .pro-header h1::before, .br-root .pro-header h1::after { content: none !important; display: none !important; }
  .br-form-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px; }
  .br-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .br-field-customer { flex: 1 1 340px; min-width: 220px; }
  .br-field-file { flex: 1 1 260px; min-width: 200px; }
  .br-form-row .pro-input { height: 38px; }
  .br-label { font-size: 14px; font-weight: 700; color: #092f47; margin: 0 0 0 2px; }
  .br-upload { width: 100%; max-width: none; justify-content: center; height: 38px; min-height: 38px; }
  .br-upload-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 230px; }
  .br-generate { height: 38px; min-height: 38px; padding: 6px 34px; }

  /* ---------- Floating round Generate button ---------- */
  .br-fab {
    position: fixed; right: 28px; bottom: 28px; z-index: 1000;
    width: 58px; height: 58px; padding: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 34px; font-weight: 700; line-height: 1; cursor: pointer;
    font-family: inherit;
    background: linear-gradient(180deg, #097a9c 0%, #0c6da6 100%);
    color: #ffffff; border: 1px solid #080606;
    box-shadow: 0 18px 18px rgba(217, 201, 201, 0.74), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    transition: transform 0.12s ease, filter 0.12s ease;
  }
  .br-fab:hover { filter: brightness(1.04); transform: translateY(-2px); }
  .br-fab:active { transform: translateY(1px); }

  /* ---------- Generate pop-up form ---------- */
  .br-gen-modal { width: 480px; }
  .br-gen-modal .br-form-row { flex-direction: column; align-items: stretch; gap: 14px; }
  .br-gen-modal .br-field-customer,
  .br-gen-modal .br-field-file { flex: none; width: 100%; min-width: 0; }
  .br-gen-modal .br-generate { width: 100%; }

  /* ---------- Report history table ---------- */
  .br-table-head { border-radius: 12px 12px 0 0; overflow: hidden; margin-top: 12px; border: 1px solid rgba(20, 111, 156, 0.25); border-bottom: none; }
  .br-th {
    background: #bfe6f8; color: #06324d;
    font-weight: 800; font-size: 13px; letter-spacing: 0; text-align: left;
  }
  .br-body-wrap {
    max-height: 300px; overflow-y: auto;
    border: 1px solid rgba(20, 93, 130, 0.28); border-top: none; border-radius: 0 0 12px 12px; background: #fff;
  }
  .br-row td { border-bottom: 1px solid rgba(20, 93, 130, 0.28); color: #09283d; font-weight: 500; background: #fff; }
  .br-row:nth-child(even) td { background: #f3faff; }
  .br-row:hover td { background: #d9f2fc; }
  .br-sub { font-size: 12px; color: var(--muted); }
  .br-note { padding: 12px 0; font-size: 14px; color: var(--muted); font-weight: 600; }
  .br-count { margin-top: 8px; font-size: 13px; color: var(--muted); font-weight: 600; }

  /* ---------- Messages / toast ---------- */
  .br-msg { margin-top: 12px; padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 700; }
  .br-msg.ok, .br-toast.ok { background: #effcf5; border: 1px solid #86efac; color: #15803d; }
  .br-msg.err, .br-toast.err { background: #fff1f1; border: 1px solid #fca5a5; color: #b91c1c; }
  .br-toast {
    position: fixed; top: 20px; right: 20px; z-index: 1100;
    padding: 12px 18px; border-radius: 12px; font-size: 14px; font-weight: 700;
    box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22); max-width: 320px;
  }

  /* ---------- Modal ---------- */
  .br-modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(6, 50, 77, 0.4);
  }
  .br-modal-box {
    width: 360px; max-width: 90vw; padding: 22px 24px;
    border-radius: 12px;
    background: rgba(221, 243, 252, 0.98);
    border: 1px solid rgba(20, 111, 156, 0.42); color: #08283d;
    box-shadow: 0 12px 28px rgba(14, 86, 122, 0.3);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  .br-modal-box h3 { margin: 0; font-size: 18px; font-weight: 800; color: #062b42; }
  .br-modal-box p { margin: 10px 0 20px; font-size: 14px; color: #08283d; line-height: 1.5; font-weight: 500; }
  .br-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
  .br-modal-box * { box-sizing: border-box; }

  /* ---------- PAGE ANIMATIONS ---------- */
  @keyframes brFadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes brRowIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes brFabPop {
    from { opacity: 0; transform: scale(0.4) rotate(-90deg); }
    to   { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  @keyframes brOverlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes brModalIn {
    from { opacity: 0; transform: translateY(16px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes brToastIn {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes brMsgIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Generated Reports card slides up, table header and body follow */
  .br-root .pro-card {
    animation: brFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) backwards;
  }
  .br-table-head {
    animation: brFadeUp 0.5s cubic-bezier(0.22, 0.8, 0.3, 1) 0.15s backwards;
  }
  .br-body-wrap {
    animation: brFadeUp 0.5s cubic-bezier(0.22, 0.8, 0.3, 1) 0.2s backwards;
  }

  /* Floating + button pops in */
  .br-fab {
    animation: brFabPop 0.5s cubic-bezier(0.22, 0.8, 0.3, 1) 0.3s backwards;
  }

  /* Report rows fade in with a short stagger (rows load after the API call) */
  .br-row {
    animation: brRowIn 0.4s ease-out backwards;
  }
  .br-row:nth-child(1)  { animation-delay: 0.05s; }
  .br-row:nth-child(2)  { animation-delay: 0.09s; }
  .br-row:nth-child(3)  { animation-delay: 0.13s; }
  .br-row:nth-child(4)  { animation-delay: 0.17s; }
  .br-row:nth-child(5)  { animation-delay: 0.21s; }
  .br-row:nth-child(6)  { animation-delay: 0.25s; }
  .br-row:nth-child(7)  { animation-delay: 0.29s; }
  .br-row:nth-child(8)  { animation-delay: 0.33s; }
  .br-row:nth-child(9)  { animation-delay: 0.37s; }
  .br-row:nth-child(10) { animation-delay: 0.41s; }
  .br-row:nth-child(n+11) { animation-delay: 0.45s; }

  /* Generate pop-up and delete-confirm pop-up */
  .br-modal-overlay {
    animation: brOverlayIn 0.2s ease-out backwards;
  }
  .br-modal-box {
    animation: brModalIn 0.3s cubic-bezier(0.22, 0.8, 0.3, 1) backwards;
  }

  /* Toast and inline message */
  .br-toast {
    animation: brToastIn 0.35s cubic-bezier(0.22, 0.8, 0.3, 1) backwards;
  }
  .br-msg {
    animation: brMsgIn 0.25s ease-out backwards;
  }

  /* Respect users who prefer no motion */
  @media (prefers-reduced-motion: reduce) {
    .br-root .pro-card,
    .br-table-head,
    .br-body-wrap,
    .br-fab,
    .br-row,
    .br-modal-overlay,
    .br-modal-box,
    .br-toast,
    .br-msg {
      animation: none !important;
    }
  }

  @media (max-width: 768px) {
    .pro-container.br-root { padding: 12px; }
    .br-root .pro-header h1 { font-size: 23px; }
  }
`;

// ---- Simple, reusable confirm modal (replaces window.confirm) ----
function ConfirmModal({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="br-modal-overlay" onClick={onCancel}>
      <div className="br-modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="br-modal-actions">
          <button
            type="button"
            className="pro-btn"
            style={{ padding: "8px 16px", fontSize: "13px" }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pro-btn br-danger"
            style={{ padding: "8px 16px", fontSize: "13px" }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function BillingCountReport() {
  const token = localStorage.getItem("token");
  const loggedInUser = token ? jwtDecode(token).name : "";
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [file, setFile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);

  // ---- Report history table ----
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // Persist the filter selection across visits/reloads
  const [filterCustomer, setFilterCustomer] = useState(
    () => localStorage.getItem(FILTER_STORAGE_KEY) || "All"
  );
  const [filterReportNo, setFilterReportNo] = useState(
    () => localStorage.getItem(REPORT_NO_STORAGE_KEY) || ""
  );

  // ---- Custom delete-confirmation modal state ----
  const [reportPendingDelete, setReportPendingDelete] = useState(null);

  // Auto-dismiss the success/error banner after a few seconds so it
  // doesn't sit on screen forever (also drives the floating toast below).
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // Close the Generate pop-up once a report has been generated successfully
  useEffect(() => {
    if (message?.success) setShowGenerateForm(false);
  }, [message]);

  useEffect(() => {
    axios
      .get(`${BASE_URL}/api/master/items/meta/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error("Error fetching customers:", err));
  }, []);

  const fetchReports = useCallback(
    async (customer) => {
      setLoadingReports(true);
      try {
        const res = await axios.get(`${BASE_URL}/api/billing-report/list`, {
          headers: { Authorization: `Bearer ${token}` },
          params: customer && customer !== "All" ? { customer } : {},
        });
        setReports(res.data);
      } catch (err) {
        console.error("Error fetching report history:", err);
        setMessage({
          error: err.response?.data?.message || `Could not load reports (${err.response?.status || "network error"})`,
        });
      } finally {
        setLoadingReports(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchReports(filterCustomer);
  }, [filterCustomer, fetchReports]);

  const handleFilterChange = (e) => {
    const value = e.target.value;
    setFilterCustomer(value);
    localStorage.setItem(FILTER_STORAGE_KEY, value);
  };

  const handleReportNoFilterChange = (e) => {
    const value = e.target.value;
    setFilterReportNo(value);
    localStorage.setItem(REPORT_NO_STORAGE_KEY, value);
  };

  const handleClearFilters = () => {
    setFilterCustomer("All");
    setFilterReportNo("");
    localStorage.setItem(FILTER_STORAGE_KEY, "All");
    localStorage.setItem(REPORT_NO_STORAGE_KEY, "");
  };

  // Client-side report-number search (substring, case-insensitive) applied
  // on top of the customer filter already fetched from the server, then
  // capped to the first 30 rows for display.
  const visibleReports = reports
    .filter((r) =>
      filterReportNo.trim()
        ? r.reportNumber.toLowerCase().includes(filterReportNo.trim().toLowerCase())
        : true
    )
    .slice(0, MAX_ROWS_SHOWN);

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const base64ToBlob = (base64, contentType) => {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: contentType });
  };

  const handleGenerate = async () => {
    if (!selectedCustomer) return setMessage({ error: "Select a customer first" });
    if (!file) return setMessage({ error: "Choose an Excel file to upload" });

    setGenerating(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("customerName", selectedCustomer);

    try {
      const res = await axios.post(`${BASE_URL}/api/billing-report/generate`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        responseType: "blob",
      });

      const contentType = res.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        const payload = JSON.parse(await res.data.text());
        if (Array.isArray(payload.files) && payload.files.length > 0) {
          payload.files.forEach((generatedFile) => {
            downloadBlob(
              base64ToBlob(generatedFile.base64, generatedFile.contentType),
              generatedFile.fileName
            );
          });

          setMessage({
            success: `${payload.files.length} Canara Bank reports generated and downloaded.`,
          });

          fetchReports(filterCustomer);
          return;
        }
      }

      const reportNumber = res.headers["x-report-number"];
      const generatedFileName = res.headers["x-generated-file-name"];
      const filename =
        generatedFileName ||
        (reportNumber ? `${reportNumber}.xlsx` : `Billing_Report_${selectedCustomer}_${Date.now()}.xlsx`);

      downloadBlob(new Blob([res.data]), filename);

      setMessage({
        success: reportNumber
          ? `Report ${reportNumber} generated and downloaded.`
          : "Report generated and downloaded.",
      });

      // Refresh the table so the new report shows up immediately.
      fetchReports(filterCustomer);
    } catch (err) {
      console.error("Report generation failed:", err);
      let serverMessage = err.response?.data?.message;
      if (err.response?.data instanceof Blob) {
        try {
          serverMessage = JSON.parse(await err.response.data.text()).message;
        } catch {
          /* response was not JSON */
        }
      }
      setMessage({
        error: serverMessage || `Failed to generate report${err.response?.status ? ` (${err.response.status})` : ""}`,
      });
    } finally {
      setGenerating(false);
    }
  };

  // Opens the custom modal instead of window.confirm
  const requestDelete = (report) => {
    setReportPendingDelete(report);
  };

  const cancelDelete = () => setReportPendingDelete(null);

  const confirmDelete = async () => {
    const report = reportPendingDelete;
    if (!report) return;
    setReportPendingDelete(null);

    setDeletingId(report._id);
    try {
      await axios.delete(`${BASE_URL}/api/billing-report/${report._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports((prev) => prev.filter((r) => r._id !== report._id));
      setMessage({ success: `Report ${report.reportNumber} deleted successfully.` });
    } catch (err) {
      console.error("Failed to delete report:", err);
      setMessage({ error: err.response?.data?.message || "Failed to delete report" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleView = async (report) => {
    setViewingId(report._id);
    try {
      const res = await axios.get(
        `${BASE_URL}/api/billing-report/${report._id}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );

      const contentType = res.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        const payload = JSON.parse(await res.data.text());
        if (Array.isArray(payload.files) && payload.files.length > 0) {
          payload.files.forEach((generatedFile) => {
            downloadBlob(
              base64ToBlob(generatedFile.base64, generatedFile.contentType),
              generatedFile.fileName
            );
          });
          setMessage({
            success: `${payload.files.length} files downloaded for report ${report.reportNumber}.`,
          });
          return;
        }
      }

      downloadBlob(new Blob([res.data]), report.generatedFileName);
    } catch (err) {
      console.error("Failed to open report:", err);
      let serverMessage = err.response?.data?.message;
      if (err.response?.data instanceof Blob) {
        try {
          serverMessage = JSON.parse(await err.response.data.text()).message;
        } catch {
          /* response was not JSON */
        }
      }
      setMessage({
        error: serverMessage || `Failed to open report${err.response?.status ? ` (${err.response.status})` : ""}`,
      });
    } finally {
      setViewingId(null);
    }
  };

  return (
    <div className="pro-container br-root">
      <style>{CSS}</style>

      {/* Floating toast — visible even when scrolled away from the top card,
          e.g. right after deleting a report further down the page. */}
      {message && (
        <div className={`br-toast ${message.error ? "err" : "ok"}`}>
          {message.error ? `❌ ${message.error}` : `✅ ${message.success}`}
        </div>
      )}

      <ConfirmModal
        open={!!reportPendingDelete}
        title="Delete report?"
        message={
          reportPendingDelete
            ? `Delete report ${reportPendingDelete.reportNumber}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <div className="br-inner">

        <button
          type="button"
          className="br-fab"
          title="Generate Report"
          aria-label="Generate Report"
          onClick={() => setShowGenerateForm(true)}
        >
          +
        </button>

        {showGenerateForm && (
        <div className="br-modal-overlay" onClick={() => setShowGenerateForm(false)}>
        <div className="br-modal-box br-gen-modal" onClick={(e) => e.stopPropagation()}>
          <div className="pro-card-header">
            <span>Generate Report</span>
          </div>

          <div className="br-form-row">
            <div className="br-field br-field-customer">
              <label className="br-label">Customer</label>
              <select
                className="pro-input"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                <option value="">Select Customer</option>
                {customers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="br-field br-field-file">
              <label className="br-label">Excel File</label>
              <label className="pro-btn br-upload" style={{ cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="br-upload-name">{file ? `📄 ${file.name}` : "Upload Excel File"}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files[0] || null)}
                />
              </label>
            </div>

            <div className="br-field">
              <label className="br-label">&nbsp;</label>
              <button className="pro-btn primary br-generate" onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>

          {message && (
            <div className={`br-msg ${message.error ? "err" : "ok"}`}>
              {message.error ? `❌ ${message.error}` : `✅ ${message.success}`}
            </div>
          )}

          <div className="br-modal-actions" style={{ marginTop: 14 }}>
            <button type="button" className="pro-btn" onClick={() => setShowGenerateForm(false)}>
              Close
            </button>
          </div>
        </div>
        </div>
        )}

        {/* ---- Report history ---- */}
        <div className="pro-card" style={{ marginTop: "20px" }}>
          <div
            className="pro-card-header"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}
          >
            <span>Generated Reports</span>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                className="pro-input"
                style={{ maxWidth: "180px" }}
                placeholder="Search report no..."
                value={filterReportNo}
                onChange={handleReportNoFilterChange}
              />

              <select
                className="pro-input"
                style={{ maxWidth: "240px" }}
                value={filterCustomer}
                onChange={handleFilterChange}
              >
                <option value="All">All Customers</option>
                {customers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="pro-btn"
                style={{ padding: "6px 12px", fontSize: "13px" }}
                onClick={handleClearFilters}
                disabled={filterCustomer === "All" && !filterReportNo}
              >
                Clear
              </button>
            </div>
          </div>

          {loadingReports ? (
            <p className="br-note">Loading reports...</p>
          ) : reports.length === 0 ? (
            <p className="br-note">No reports generated yet.</p>
          ) : visibleReports.length === 0 ? (
            <p className="br-note">No reports match "{filterReportNo}".</p>
          ) : (
            <>
            <div className="br-table-head">
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th className="br-th" style={{ padding: "9px 8px", width: "16%" }}>Report No.</th>
                    <th className="br-th" style={{ padding: "9px 8px", width: "28%" }}>Customer</th>
                    <th className="br-th" style={{ padding: "9px 8px", width: "28%" }}>Generated By</th>
                    <th className="br-th" style={{ padding: "9px 8px", width: "28%" }}>Actions</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="br-body-wrap">
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px", tableLayout: "fixed" }}>
                <tbody>
                  {visibleReports.map((r) => (
                    <tr key={r._id} className="br-row">
                      <td style={{ padding: "8px", fontWeight: 700, width: "16%" }}>{r.reportNumber}</td>
                      <td style={{ padding: "8px", width: "28%" }}>{r.customerName}</td>
                      <td style={{ padding: "8px", width: "28%" }}>
                        <div style={{ fontWeight: 700 }}>{r.generatedByName || "-"}</div>
                        <div className="br-sub">
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", width: "28%" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button
                            className="pro-btn"
                            style={{ padding: "4px 12px", fontSize: "12px", minHeight: "28px" }}
                            onClick={() => handleView(r)}
                            disabled={viewingId === r._id}
                          >
                            {viewingId === r._id ? "Opening..." : "View"}
                          </button>
                          {r.generatedByName === loggedInUser && (
                            <button
                              className="pro-btn br-danger"
                              style={{ padding: "4px 12px", fontSize: "12px", minHeight: "28px" }}
                              onClick={() => requestDelete(r)}
                              disabled={deletingId === r._id}
                            >
                              {deletingId === r._id ? "Deleting..." : "Delete"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="br-count">
              Showing {visibleReports.length} of{" "}
              {reports.filter((r) =>
                filterReportNo.trim()
                  ? r.reportNumber.toLowerCase().includes(filterReportNo.trim().toLowerCase())
                  : true
              ).length}{" "}
              matching reports{visibleReports.length === MAX_ROWS_SHOWN ? " (refine your search to see more)" : ""}.
            </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BillingCountReport;