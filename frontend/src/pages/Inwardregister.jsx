import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";
import {
  FiSearch, FiUser, FiClipboard, FiList, FiSave, FiX,
  FiRefreshCw, FiDownload, FiLock, FiBriefcase, FiBox,
  FiTag, FiHash, FiCalendar, FiDatabase, FiChevronLeft, FiChevronRight
} from "react-icons/fi";

// Utility helper to truncate long texts elegantly
const truncateText = (text, maxLength = 20) => {
  if (!text) return "-";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

const PAGE_SIZE = 50;

// UI-only: pastel icon-bubble colours for the work-order info cards
const PASTELS = ["lavender", "peach", "mint", "sky", "rose", "lemon", "lilac", "aqua"];

function InwardRegister() {
  const [woNumber, setWoNumber] = useState("");
  const [woData, setWoData] = useState(null);
  const [woLoading, setWoLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState("");

  // Records are now a single SERVER-FILTERED PAGE, not the full dataset
  const [inwardRecords, setInwardRecords] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [filterWo, setFilterWo] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [expandedCell, setExpandedCell] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Previously-received total for the currently fetched WO (from a server aggregate, not from inwardRecords)
  const [previouslyReceived, setPreviouslyReceived] = useState(0);

  const filterDebounceRef = useRef(null);

  const [form, setForm] = useState({
    dateOfInward: "",
    printReceivedQty: "",
    pendingQty: "",
    chequeFromNo: "",
    chequeToNo: "",
    defectCount: "",
    materialDocumentNo: "",
    issuer: "",
    receiver: "",
    remarks: "",
  });

  const showAlert = (title, text = "", icon = "warning") =>
    Swal.fire({
      title, text, icon,
      confirmButtonColor: "#2563eb",
      confirmButtonText: "OK",
      width: "350px",
      customClass: {
        popup: 'custom-swal-popup',
        title: 'custom-swal-title',
        confirmButton: 'custom-swal-button'
      }
    });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name || "");
      setForm((prev) => ({ ...prev, issuer: decoded.name || "" }));
    }
    fetchInwardRecords(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server-side paginated + filtered fetch.
  // ASSUMPTION: GET /api/inward-register accepts { page, limit, woNumber, from, to }
  // and returns { records: [...], total: <number>, totalPages: <number> }.
  const fetchInwardRecords = async (pageNum = page) => {
    setListLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/inward-register`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: {
          page: pageNum,
          limit: PAGE_SIZE,
          woNumber: filterWo || undefined,
          from: filterFrom || undefined,
          to: filterTo || undefined,
        },
      });

      // Backward-compatible: if backend still returns a plain array (old shape),
      // fall back to treating it as page 1 with no real pagination.
      if (Array.isArray(res.data)) {
        setInwardRecords(res.data);
        setTotalRecords(res.data.length);
        setTotalPages(1);
      } else {
        setInwardRecords(res.data.records || []);
        setTotalRecords(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
      setPage(pageNum);
    } catch (err) {
      console.error("Fetch inward records error:", err);
    }
    setListLoading(false);
  };

  // Debounced refetch whenever filters change (resets to page 1)
  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      fetchInwardRecords(1);
    }, 350);
    return () => clearTimeout(filterDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterWo, filterFrom, filterTo]);

  // Lightweight aggregate call instead of summing the full dataset client-side.
  // ASSUMPTION: GET /api/inward-register/summary/:efiWoNumber returns { totalReceived: <number> }
  const fetchPreviouslyReceived = async (efiWoNumber) => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/inward-register/summary/${encodeURIComponent(efiWoNumber)}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      return Number(res.data?.totalReceived) || 0;
    } catch (err) {
      console.error("Fetch previously-received summary error:", err);
      return 0;
    }
  };

  const handleFetchWO = async () => {
    if (!woNumber.trim()) { showAlert("Please enter a Work Order Number"); return; }
    setWoLoading(true);
    setWoData(null);
    try {
      const res = await axios.get(`${BASE_URL}/api/workorders/efi/${woNumber.trim()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const fetchedWo = res.data;
      setWoData(fetchedWo);

      // Get previously received total from server aggregate (works at any scale)
      const received = await fetchPreviouslyReceived(fetchedWo.efiWoNumber);
      setPreviouslyReceived(received);

      const remaining = Math.max(Number(fetchedWo.orderQty) - received, 0);

      setForm((prev) => ({
        ...prev,
        pendingQty: remaining,
        printReceivedQty: "",
        chequeFromNo: "",
        chequeToNo: "",
        defectCount: "",
        materialDocumentNo: "",
        receiver: "",
        remarks: "",
      }));
    } catch (err) {
      showAlert("Work Order Not Found", "Please check the WO number and try again.", "error");
    }
    setWoLoading(false);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const numericFields = ["printReceivedQty", "pendingQty", "defectCount"];

    if (type === "number" && numericFields.includes(name) && value.includes("-")) {
      showAlert("Negative values are not allowed");
      return;
    }

    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === "printReceivedQty") {
        const orderQty = Number(woData?.orderQty) || 0;
        const remainingPending = Math.max(orderQty - previouslyReceived, 0);
        const received = Number(value) || 0;

        // Block values larger than the remaining pending quantity
        if (received > remainingPending) {
          showAlert(
            "Invalid Quantity",
            `Print Received Quantity (${received}) cannot exceed the remaining pending quantity (${remainingPending})`,
            "warning"
          );
          updated.printReceivedQty = remainingPending;
          updated.pendingQty = 0;
        } else {
          updated.pendingQty = Math.max(remainingPending - received, 0);
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!woData) { showAlert("Please fetch a Work Order first"); return; }

    const required = [
      { key: "dateOfInward", label: "Date of Inward" },
      { key: "printReceivedQty", label: "Print Received Quantity" },
    ];
    for (const field of required) {
      if (!form[field.key] || String(form[field.key]).trim() === "") {
        showAlert(`${field.label} is required`); return;
      }
    }

    const orderQty = Number(woData?.orderQty) || 0;
    const printReceivedQty = Number(form.printReceivedQty) || 0;
    const remainingPending = Math.max(orderQty - previouslyReceived, 0);
    const pendingQty = Number(form.pendingQty) || 0;

    if (printReceivedQty <= 0) {
      showAlert("Invalid Quantity", "Print Received Quantity must be greater than 0", "warning"); return;
    }
    if (printReceivedQty > remainingPending) {
      showAlert("Invalid Quantity", `Print Received Quantity (${printReceivedQty}) cannot exceed remaining pending quantity (${remainingPending})`, "warning"); return;
    }
    if (pendingQty < 0) {
      showAlert("Invalid Quantity", "Pending Quantity cannot be negative", "warning"); return;
    }

    try {
      const payload = {
        workOrderId: woData._id,
        efiWoNumber: woData.efiWoNumber,
        customerName: woData.customer?.name || woData.customer,
        itemDescription: woData.productName || woData.description,
        materialCode: woData.materials?.map((m) => m.materialCode).join(", ") || "-",
        workOrderQty: woData.orderQty,
        workOrderDate: woData.createdAt,
        ...form,
        issuer: loggedInUser,
      };
      await axios.post(`${BASE_URL}/api/inward-register`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      showAlert("Success", "Inward Record saved successfully ✅", "success");
      setForm({
        dateOfInward: "", printReceivedQty: "", pendingQty: "",
        chequeFromNo: "", chequeToNo: "", defectCount: "",
        materialDocumentNo: "", issuer: loggedInUser, receiver: "", remarks: "",
      });
      setWoData(null);
      setWoNumber("");
      fetchInwardRecords(1);
    } catch (err) {
      console.error("Save inward record error:", err);
      showAlert("Error", "Failed to save record", "error");
    }
  };

  // Export now uses the CURRENT SERVER-FILTERED PAGE only, since pulling millions
  // of rows into the browser to build an xlsx is not viable. For a true "export all
  // filtered results" button, add a dedicated backend export endpoint that streams
  // the file — say the word and I'll wire that up too.
  const downloadExcel = () => {
    const filtered = inwardRecords;
    if (!filtered.length) { showAlert("No data to export"); return; }

    const first = filtered[0];
    const aoa = [];

    aoa.push(["", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["Confidential Document", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["Document ID: MPi_SP_QS_PRD_T063_Store DC_V1.00", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["VDP Stores DC", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push([`Customer Name : ${first.customerName || ""}`, "", "", "", "", "", "", "", "", "", ""]);
    aoa.push([`Item Description : ${first.itemDescription || ""}`, "", "", "", "", "", "", "", "", "", ""]);
    aoa.push([`Material Code  : ${first.materialCode || ""}`, "", "", "", "", "", "", "", "", "", ""]);
    aoa.push([`Work Order Qty  : ${first.workOrderQty || ""}`, "", "", "", "", "", "", "", "", "", ""]);
    aoa.push([`Work Order No : ${first.efiWoNumber || ""}`, "", "", "", "", "", "", "", "", "", ""]);
    aoa.push([`Work Order  Date : ${first.workOrderDate ? new Date(first.workOrderDate).toLocaleDateString("en-IN") : ""}`, "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["Signature with Date & Time:", "", "", "", "", "", "", "", "", "", ""]);

    aoa.push([
      "Sl. No", "Date of inward", "Print received quantity", "Pending quantity",
      "Cheque from No.", "Cheque to No.", "Defect Count",
      "Issuer", "Receiver", "Remarks"
    ]);

    filtered.forEach((r, i) => {
      aoa.push([
        i + 1,
        r.dateOfInward ? new Date(r.dateOfInward).toLocaleDateString("en-IN") : "",
        r.printReceivedQty || "",
        r.pendingQty || "",
        r.chequeFromNo || "",
        r.chequeToNo || "",
        r.defectCount || 0,

        r.issuer || "",
        r.receiver || "",
        r.remarks || "",
      ]);
    });

    while (aoa.length < 28) {
      aoa.push(["", "", "", "", "", "", "", "", "", "", ""]);
    }

    const totalReceived = filtered.reduce((s, r) => s + (Number(r.printReceivedQty) || 0), 0);
    const totalDefects  = filtered.reduce((s, r) => s + (Number(r.defectCount) || 0), 0);

    aoa.push(["Total Received", totalReceived, "", "", "", "", "", "", "", "", ""]);
    aoa.push(["Defect Count",   totalDefects,  "", "", "", "", "", "", "", "", ""]);
    aoa.push(["Status",         "",            "", "", "", "", "", "", "", "", ""]);

    aoa.push(["Store Supervisior", "", "", "", "Planning Co Ordinator", "", "", "", "", "", ""]);
    aoa.push(["", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["", "", "", "", "", "", "", "", "", "", ""]);
    aoa.push(["* Confidential and Internal Use Document", "", "", "", "", "", "", "", "", "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws["!cols"] = [
      { wch: 8 }, { wch: 12.5 }, { wch: 12 }, { wch: 15 }, { wch: 17 },
      { wch: 16 }, { wch: 13.5 }, { wch: 19.5 }, { wch: 14.5 }, { wch: 18 },
      { wch: 17 }
    ];

    ws["!merges"] = [
      ...Array.from({ length: 11 }, (_, i) => ({
        s: { r: i, c: 0 }, e: { r: i, c: 10 }
      })),
      { s: { r: 28, c: 0 }, e: { r: 28, c: 2 } },
      { s: { r: 29, c: 0 }, e: { r: 29, c: 2 } },
      { s: { r: 30, c: 0 }, e: { r: 30, c: 2 } },
      { s: { r: 31, c: 0 }, e: { r: 33, c: 3 } },
      { s: { r: 31, c: 4 }, e: { r: 33, c: 7 } },
      { s: { r: 31, c: 8 }, e: { r: 33, c: 10 } },
      { s: { r: 34, c: 0 }, e: { r: 34, c: 10 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VDP Stores DC");
    XLSX.writeFile(wb, `MPi_StoresDC_${first.efiWoNumber || "ALL"}.xlsx`);
  };

  const css = `
    /* ---------- Light aqua-glass design (same family as Reel Register) ---------- */
    .ir-wrap {
      --ink: #0b2f4f; --muted: #4a6f8c; --hint: #8fb0c8;
      min-height: 100vh;
      padding: 18px 22px 40px;
      font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 30%),
        radial-gradient(circle at 88% 18%, rgba(160, 222, 250, 0.7) 0, rgba(160, 222, 250, 0) 32%),
        radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
        linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%);
      background-attachment: fixed;
    }
    .ir-wrap * { box-sizing: border-box; }
    .ir-inner { max-width: 1440px; margin: 0 auto; }

    /* ── HEADER ── */
    .ir-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 22px;
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(222, 244, 254, 0.8) 100%);
      border: 1px solid rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 14px 30px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140, 210, 245, 0.2);
    }
    .ir-brand { display: flex; align-items: center; gap: 14px; }
    .ir-emblem {
      width: 48px; height: 48px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; color: #0a6fb8;
      background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 50%, #8fd0f0 100%);
      border: 1px solid #86c6e8;
      box-shadow: 0 6px 14px rgba(40, 120, 170, 0.22), inset 0 2px 3px rgba(255, 255, 255, 0.9);
    }
    .ir-header h1 {
      font-size: 24px;
      font-weight: 800;
      color: #0a4f8c;
      margin: 0;
      letter-spacing: -0.4px;
    }
    .ir-header p {
      color: var(--muted);
      font-size: 12.5px;
      margin: 2px 0 0;
      font-weight: 600;
    }
    .ir-user-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
      color: #0a4f8c;
      border: 1px solid #a9d9f2;
      padding: 7px 16px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 800;
      box-shadow: 0 4px 12px rgba(40, 120, 170, 0.15), inset 0 1px 0 #fff;
    }
    .ir-user-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; }

    /* ── CARD ── */
    .ir-card {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(228, 246, 255, 0.9) 100%);
      border-radius: 22px;
      border: 1px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 14px 32px rgba(40, 120, 170, 0.16), inset 0 1px 0 #fff;
      padding: 16px 20px 18px;
      margin-bottom: 18px;
      position: relative;
      overflow: hidden;
    }
    .ir-card-title {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 14px;
      padding: 5px 16px 5px 10px;
      background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%);
      border: 1px solid #a9d9f2;
      border-radius: 999px;
      box-shadow: 0 3px 8px rgba(40, 120, 170, 0.12), inset 0 1px 0 #fff;
    }
    .ir-card-title h2 {
      font-size: 12px;
      font-weight: 800;
      color: #0a4f8c;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      margin: 0;
    }
    .ir-icon-blue, .ir-icon-teal, .ir-icon-slate { color: #0a6fb8; }

    /* ── LOOKUP ── */
    .ir-lookup-row {
      display: flex;
      gap: 12px;
      align-items: center;
      max-width: 650px;
      flex-wrap: wrap;
    }
    .ir-input-wrap {
      position: relative;
      flex: 1;
      min-width: 240px;
    }
    .ir-input-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #6b8aa0;
      pointer-events: none;
      display: flex;
    }
    .ir-lookup-input {
      width: 100%;
      padding: 10px 12px 10px 38px;
      border: 1.5px solid #9ccbe6;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--ink);
      background: #fff;
      outline: none;
      box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1);
      transition: border-color 0.18s, box-shadow 0.18s;
    }
    .ir-lookup-input:hover { border-color: #5fb4de; }
    .ir-lookup-input:focus {
      border-color: #1b9be0;
      box-shadow: 0 0 0 4px rgba(27, 155, 224, 0.2), 0 6px 14px rgba(27, 155, 224, 0.12);
    }

    /* ── WO INFO GRID ── */
    .ir-wo-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 14px;
      animation: irFadeUp 0.3s ease forwards;
    }
    @media(max-width:1100px){ .ir-wo-grid { grid-template-columns: repeat(2,1fr); } }
    @media(max-width:480px){ .ir-wo-grid { grid-template-columns: 1fr; } }

    .ir-wo-item {
      display: flex;
      align-items: center;
      gap: 11px;
      background: linear-gradient(180deg, #ffffff 0%, #f1faff 100%);
      border: 1px solid #cfe8f6;
      border-radius: 14px;
      padding: 9px 12px;
      box-shadow: 0 3px 10px rgba(40, 120, 170, 0.08), inset 0 1px 0 #fff;
    }
    .ir-wo-icon-box {
      background: radial-gradient(circle at 30% 25%, #ffffff 0%, #d6effc 55%, #b3dff5 100%);
      color: #0a6fb8;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid #a9d9f2;
    }
    .ir-wo-label {
      font-size: 10.5px;
      font-weight: 800;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .ir-wo-value {
      font-size: 13.5px;
      font-weight: 800;
      color: var(--ink);
      word-break: break-word;
    }

    /* ── FORM GRID ── */
    .ir-form-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px 18px;
    }
    @media(max-width:1024px){ .ir-form-grid { grid-template-columns: repeat(2,1fr); } }
    @media(max-width:640px) { .ir-form-grid { grid-template-columns: 1fr; } }

    .ir-full { grid-column: 1 / -1; }

    .ir-fgroup { display: flex; flex-direction: column; gap: 4px; }
    .ir-label {
      font-size: 12px;
      font-weight: 800;
      color: var(--ink);
    }
    .ir-req { color: #e11d48; }
    .ir-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      padding: 1px 7px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #e3eef6;
      color: #4a6f8c;
      margin-left: 6px;
      vertical-align: middle;
    }
    .ir-badge.green { background: #d4f6e5; color: #07583b; }

    .ir-input {
      width: 100%;
      padding: 9px 12px;
      border: 1.5px solid #9ccbe6;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--ink);
      background: #fff;
      outline: none;
      box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1);
      transition: border-color 0.18s, box-shadow 0.18s;
    }
    .ir-input::placeholder { color: var(--hint); font-weight: 600; }
    .ir-input:hover  { border-color: #5fb4de; }
    .ir-input:focus  { border-color: #1b9be0; box-shadow: 0 0 0 4px rgba(27,155,224,0.2), 0 6px 14px rgba(27, 155, 224, 0.12); }

    .ir-readonly-wrap { position: relative; }
    .ir-input-ro {
      background: linear-gradient(180deg, #eaf7ff 0%, #d6effc 100%) !important;
      color: #0a4f8c;
      cursor: not-allowed;
      border-color: #86c6e8;
      padding-right: 32px;
      font-weight: 800;
    }
    .ir-input-issuer { color: #07583b; font-weight: 800; }
    .ir-lock-icon {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #6b8aa0;
      pointer-events: none;
      display: flex;
    }

    /* ── BUTTONS ── */
    .ir-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 800;
      padding: 9px 22px;
      border-radius: 12px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      font-family: inherit;
    }
    .ir-btn:hover:not(:disabled) { transform: translateY(-1px); }
    .ir-btn:active:not(:disabled) { transform: translateY(2px); }
    .ir-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .ir-btn-blue {
      background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%); color: #08406b; border-color: #7fc3e8;
      box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40, 120, 170, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }
    .ir-btn-teal {
      background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%); color: #07583b; border-color: #7fd3ab;
      box-shadow: 0 3px 0 #84cba9, 0 7px 12px rgba(20, 168, 112, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }
    .ir-btn-gray {
      background: linear-gradient(180deg, #ffffff 0%, #dcebf5 100%); color: #34526b; border-color: #aac3d4;
      box-shadow: 0 3px 0 #b6cbd9, 0 7px 12px rgba(93, 124, 147, 0.14), inset 0 1px 0 #fff;
    }
    .ir-btn-red {
      background: linear-gradient(180deg, #ffdcdc 0%, #f7a3a3 100%); color: #8f1414; border-color: #ee8f8f;
      font-size: 12.5px; padding: 7px 14px;
      box-shadow: 0 3px 0 #e08a8a, 0 7px 12px rgba(220, 38, 38, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .ir-form-actions {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px dashed rgba(10, 111, 184, 0.35);
    }

    /* ── TOOLBAR ── */
    .ir-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 14px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      padding: 10px 14px;
      box-shadow: 0 6px 16px rgba(40, 120, 170, 0.1), inset 0 1px 0 #fff;
    }
    .ir-filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
    .ir-filter-group { display: flex; flex-direction: column; gap: 4px; }
    .ir-filter-label { font-size: 10.5px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .ir-filter-input {
      padding: 6px 11px;
      border: 1.5px solid #9ccbe6;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--ink);
      background: #fff;
      outline: none;
      height: 36px;
      box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1);
      transition: border-color 0.18s, box-shadow 0.18s;
    }
    .ir-filter-input:hover { border-color: #5fb4de; }
    .ir-filter-input:focus { border-color: #1b9be0; box-shadow: 0 0 0 4px rgba(27,155,224,0.2); }

    /* ── TABLE ── */
    .ir-table-wrap {
      overflow-x: auto;
      border-radius: 18px;
      border: 1px solid #a9d9f2;
      background: #fff;
      box-shadow: 0 10px 24px rgba(40, 120, 170, 0.14);
    }
    .ir-table-wrap::-webkit-scrollbar { height: 8px; }
    .ir-table-wrap::-webkit-scrollbar-track { background: #eaf7ff; }
    .ir-table-wrap::-webkit-scrollbar-thumb { background: #96d3f2; border-radius: 4px; }

    .ir-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      min-width: 1200px;
      background: #fff;
    }
    .ir-table thead tr {
      background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%);
    }
    .ir-table th {
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 800;
      color: #08406b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
      text-align: left;
      border: 1px solid #7fbfe4;
    }
    .ir-table tbody tr {
      border-bottom: 1px solid #d3e8f4;
      transition: background 0.12s;
    }
    .ir-table tbody tr:nth-child(even) { background: #f3faff; }
    .ir-table tbody tr:hover { background: #d9f2fc; }
    .ir-table td {
      padding: 9px 14px;
      color: var(--ink);
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid #d3e8f4;
    }
    .ir-td-bold { font-weight: 800; color: #0a4f8c; }

    .ir-badge-pending {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 800;
    }
    .ir-badge-pending.has  { background: #fef3c7; color: #8a5a00; border: 1px solid #fde68a; }
    .ir-badge-pending.done { background: #d4f6e5; color: #07583b; border: 1px solid #86efac; }

    .ir-badge-issuer {
      display: inline-block;
      background: #d6effc;
      color: #08406b;
      border: 1px solid #86c6e8;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }

    .ir-empty {
      text-align: center;
      padding: 44px 20px;
      color: var(--muted);
    }
    .ir-empty h4 { font-size: 15px; font-weight: 800; color: #0a4f8c; margin: 8px 0 4px; }
    .ir-empty p  { font-size: 13px; margin: 0; font-weight: 600; }

    /* ── PAGINATION ── */
    .ir-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding: 12px 4px 0;
    }
    .ir-pagination-info {
      font-size: 12.5px;
      color: var(--muted);
      font-weight: 700;
    }
    .ir-pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ir-page-indicator {
      font-size: 13px;
      font-weight: 800;
      color: #0a4f8c;
      min-width: 90px;
      text-align: center;
    }

    .custom-swal-popup {
      font-family: 'Segoe UI', system-ui, sans-serif !important;
      border-radius: 22px !important;
    }
    .custom-swal-title {
      font-size: 20px !important;
      font-weight: 800 !important;
      color: #0a4f8c !important;
    }
    .custom-swal-button {
      font-weight: 700 !important;
      border-radius: 12px !important;
    }

    /* ── WORK ORDER INFO CARDS (soft white cards, pastel icon bubbles) + compact layout ── */
    .ir-sub-head {
      font-size: 11.5px; font-weight: 800; color: #0a4f8c; text-transform: uppercase;
      letter-spacing: 0.7px; margin: 0 0 8px 2px;
    }
    .ir-wo-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 0; gap: 8px 10px; }
    @media(max-width:1100px){ .ir-wo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media(max-width:480px){ .ir-wo-grid { grid-template-columns: 1fr; } }
    .ir-wo-cards .ir-wo-item {
      background: linear-gradient(180deg, #ffffff 0%, #f6fcff 100%);
      border: 1px solid #dcedf8; border-radius: 18px; padding: 7px 12px; gap: 11px;
      box-shadow: 0 6px 16px rgba(40, 120, 170, 0.1), inset 0 1px 0 #fff;
    }
    .ir-wo-text { min-width: 0; }
    .ir-wo-cards .ir-wo-icon-box {
      width: 38px; height: 38px; border-radius: 13px; border: none;
      box-shadow: 0 5px 10px rgba(40, 90, 130, 0.16), inset 0 2px 3px rgba(255, 255, 255, 0.85), inset 0 -3px 5px rgba(0, 0, 0, 0.06);
    }
    .ir-wo-icon-box.lavender { background: linear-gradient(145deg, #efe7ff, #c9b8fb); color: #6d4fd6; }
    .ir-wo-icon-box.peach    { background: linear-gradient(145deg, #fff0d1, #ffc978); color: #c2650a; }
    .ir-wo-icon-box.mint     { background: linear-gradient(145deg, #dcf9ea, #8fe0b8); color: #107a4d; }
    .ir-wo-icon-box.sky      { background: linear-gradient(145deg, #e0f3ff, #9fd6f7); color: #0a6fb8; }
    .ir-wo-icon-box.rose     { background: linear-gradient(145deg, #ffe4ec, #f9a8c0); color: #be1e55; }
    .ir-wo-icon-box.lemon    { background: linear-gradient(145deg, #fffbd1, #f6e27a); color: #8a6d00; }
    .ir-wo-icon-box.lilac    { background: linear-gradient(145deg, #f1e4ff, #d2a8f7); color: #7a2fc2; }
    .ir-wo-icon-box.aqua     { background: linear-gradient(145deg, #d9fbf8, #86e3dc); color: #0b7a74; }
    .ir-wo-cards .ir-wo-value { font-size: 13px; }
    .ir-form-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 14px; }
    @media(max-width:1024px){ .ir-form-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media(max-width:640px) { .ir-form-grid-4 { grid-template-columns: 1fr; } }

    /* compact: header + search + info cards + form on the first screen */
    .ir-wrap { padding: 10px 20px 30px; }
    .ir-header { padding: 8px 20px; margin-bottom: 10px; }
    .ir-emblem { width: 40px; height: 40px; }
    .ir-header h1 { font-size: 20px; }
    .ir-header p { font-size: 11.5px; margin-top: 0; }
    .ir-user-chip { padding: 5px 14px; }
    .ir-card { padding: 10px 16px 12px; margin-bottom: 12px; border-radius: 20px; }
    .ir-card-title { margin-bottom: 8px; padding: 4px 14px 4px 9px; }
    .ir-lookup-input { padding: 7px 12px 7px 36px; }
    .ir-input { padding: 6px 11px; font-size: 13.5px; }
    .ir-label { font-size: 11.5px; }
    .ir-btn { padding: 7px 20px; }
    .ir-form-actions { margin-top: 10px; padding-top: 10px; }

    @keyframes irFadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ir-animate { animation: irFadeUp 0.3s ease forwards; }

    @media (max-width: 768px) {
      .ir-wrap { padding: 10px; }
      .ir-header { border-radius: 20px; }
    }
  `;

  return (
    <div className="ir-wrap">
      <style>{css}</style>

      <div className="ir-inner">
      {/* ── HEADER ── */}
      <div className="ir-header">
        <div className="ir-brand">
          <div className="ir-emblem"><FiClipboard size={22} /></div>
          <div className="ir-header-text">
            <h1>Store Inward Register</h1>
            <p>Record print inward entries against work orders</p>
          </div>
        </div>
        {loggedInUser && (
          <div className="ir-user-chip">
            <span className="ir-user-dot"></span>
            <FiUser size={13} />
            <span>{loggedInUser}</span>
          </div>
        )}
      </div>

      {/* ── LOOKUP ── */}
      <div className="ir-card ir-card-blue">
        <div className="ir-card-title">
          <FiSearch size={16} className="ir-icon-blue" />
          <h2>Search Work Order</h2>
        </div>
        <div className="ir-lookup-row">
          <div className="ir-input-wrap">
            <span className="ir-input-icon"><FiSearch size={16} /></span>
            <input
              type="text"
              placeholder="Enter WO number (e.g. 1042)"
              value={woNumber}
              onChange={(e) => setWoNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetchWO()}
              className="ir-lookup-input"
            />
          </div>
          <button onClick={handleFetchWO} disabled={woLoading} className="ir-btn ir-btn-blue" style={{ height: "42px" }}>
            {woLoading ? "Searching…" : <><FiSearch size={14} /> Search</>}
          </button>
        </div>

      </div>

      {/* ── WORK ORDER DETAILS + ENTRY FORM (open together after fetch) ── */}
      {woData && (() => {
        const remainingPending = Math.max(Number(woData.orderQty) - previouslyReceived, 0);
        const woInfo = [
          { label: "Customer Name",       value: woData.customer?.name || woData.customer,                          icon: <FiBriefcase size={17}/> },
          { label: "Item Description",    value: woData.productName || woData.description || "-",                icon: <FiBox size={17}/> },
          { label: "Material Code",       value: woData.materials?.map((m) => m.materialCode).join(", ") || "-",   icon: <FiTag size={17}/> },
          { label: "Total Order Qty",     value: woData.orderQty,                                                   icon: <FiHash size={17}/> },
          { label: "Previously Received",  value: previouslyReceived,                                                icon: <FiHash size={17}/> },
          { label: "Remaining Pending",   value: remainingPending,                                                  icon: <FiHash size={17}/> },
          { label: "WO Number",           value: woData.efiWoNumber,                                               icon: <FiHash size={17}/> },
          { label: "WO Date",             value: woData.createdAt ? new Date(woData.createdAt).toLocaleDateString("en-IN") : "-", icon: <FiCalendar size={17}/> },
        ];

        return (
          <div className="ir-card ir-animate">
            <div className="ir-sub-head">Work Order Details</div>
            <div className="ir-wo-grid ir-wo-cards">
              {woInfo.map((item, i) => (
                <div key={item.label} className="ir-wo-item">
                  <div className={`ir-wo-icon-box ${PASTELS[i % PASTELS.length]}`}>{item.icon}</div>
                  <div className="ir-wo-text">
                    <div className="ir-wo-label">{item.label}</div>
                    <div className="ir-wo-value">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="ir-sub-head" style={{ marginTop: 12 }}>Inward Register Entry</div>

            <form onSubmit={handleSubmit}>
              <div className="ir-form-grid ir-form-grid-4">

                {/* Date of Inward */}
                <div className="ir-fgroup">
                  <label className="ir-label">Date of Inward <span className="ir-req">*</span></label>
                  <input type="date" name="dateOfInward" value={form.dateOfInward}
                    onChange={handleChange} className="ir-input" required />
                </div>

                {/* Print Received Qty */}
                <div className="ir-fgroup">
                  <label className="ir-label">Print Received Quantity <span className="ir-req">*</span></label>
                  <input type="number" name="printReceivedQty" value={form.printReceivedQty}
                    onChange={handleChange} min="0" className="ir-input" placeholder="0"
                    onKeyDown={(e) => ["e","+","-"].includes(e.key) && e.preventDefault()} required />
                </div>

                {/* Pending Qty (auto) */}
                <div className="ir-fgroup">
                  <label className="ir-label">Pending Quantity <span className="ir-badge">Auto</span></label>
                  <div className="ir-readonly-wrap">
                    <input type="number" value={form.pendingQty} readOnly className="ir-input ir-input-ro" />
                  </div>
                </div>

                {/* Defect Count */}
                <div className="ir-fgroup">
                  <label className="ir-label">Defect Count</label>
                  <input type="number" name="defectCount" value={form.defectCount}
                    onChange={handleChange} min="0" className="ir-input" placeholder="0"
                    onKeyDown={(e) => ["e","+","-"].includes(e.key) && e.preventDefault()} />
                </div>

                {/* Cheque From */}
                <div className="ir-fgroup">
                  <label className="ir-label">From Number<span className="ir-req"></span></label>
                  <input type="text" name="chequeFromNo" value={form.chequeFromNo}
                    onChange={handleChange} className="ir-input" placeholder="Start sequence" />
                </div>

                {/* Cheque To */}
                <div className="ir-fgroup">
                  <label className="ir-label">To Number<span className="ir-req"></span></label>
                  <input type="text" name="chequeToNo" value={form.chequeToNo}
                    onChange={handleChange} className="ir-input" placeholder="End sequence"/>
                </div>

                {/* Reciever — login-based, read-only */}
                <div className="ir-fgroup">
                  <label className="ir-label">Reciever <span className="ir-badge green">Active User</span></label>
                  <div className="ir-readonly-wrap">
                    <input type="text" value={loggedInUser} readOnly
                      className="ir-input ir-input-ro ir-input-issuer" />
                  </div>
                </div>

                {/* Remarks */}
                <div className="ir-fgroup">
                  <label className="ir-label">Remarks</label>
                  <textarea name="remarks" value={form.remarks} onChange={handleChange}
                    rows={1} className="ir-input" style={{ resize: "vertical" }}
                    placeholder="Add any additional notes..." />
                </div>
              </div>

              <div className="ir-form-actions">
                <button type="submit" className="ir-btn ir-btn-teal">
                  <FiSave size={15}/> Save Inward Record
                </button>
                <button type="button" className="ir-btn ir-btn-gray"
                  onClick={() => {
                    setWoData(null); setWoNumber("");
                    setForm({ dateOfInward:"", printReceivedQty:"", pendingQty:"",
                      chequeFromNo:"", chequeToNo:"", defectCount:"",
                      materialDocumentNo:"", issuer: loggedInUser, receiver:"", remarks:"" });
                  }}>
                  <FiX size={15}/> Cancel
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* ── RECORDS TABLE ── */}
      <div className="ir-card ir-card-slate">
        <div className="ir-card-title">
          <FiList size={16} className="ir-icon-slate" />
          <h2>Inward Records</h2>
        </div>

        {/* Toolbar */}
        <div className="ir-toolbar">
          <div className="ir-filters">
            <div className="ir-filter-group">
              <span className="ir-filter-label">WO Number</span>
              <input type="text" placeholder="Search…" value={filterWo}
                onChange={(e) => setFilterWo(e.target.value)} className="ir-filter-input" style={{ width: "160px" }} />
            </div>
            <div className="ir-filter-group">
              <span className="ir-filter-label">From Date</span>
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="ir-filter-input" />
            </div>
            <div className="ir-filter-group">
              <span className="ir-filter-label">To Date</span>
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="ir-filter-input" />
            </div>
            <button onClick={() => { setFilterWo(""); setFilterFrom(""); setFilterTo(""); }}
              className="ir-btn ir-btn-red" style={{ alignSelf: "flex-end" }}>
              <FiRefreshCw size={13}/> Clear
            </button>
          </div>
          <button onClick={downloadExcel} className="ir-btn ir-btn-teal" style={{ alignSelf: "flex-end" }}>
            <FiDownload size={15}/> Export Excel
          </button>
        </div>

        {listLoading ? (
          <div className="ir-empty">
            <p style={{ fontWeight: 600 }}>Loading records…</p>
          </div>
        ) : (
          <>
            <div className="ir-table-wrap">
              <table className="ir-table">
                <thead>
                  <tr>
                    {["WO No","Customer Name","Item Description","Material Code",
                      "WO Qty","WO Date","Date of Inward","Print Recv Qty",
                      "Pending Qty","Cheque From","Cheque To","Defect Count"
                      ,"Receiver","Remarks"
                    ].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {inwardRecords.length === 0 ? (
                    <tr>
                      <td colSpan={16}>
                        <div className="ir-empty">
                          <FiDatabase size={36} style={{ color: "#8fb0c8", marginBottom: "8px" }} />
                          <h4>No Inward Records Found</h4>
                          <p>Adjust your filters or save a new entry above.</p>
                        </div>
                      </td>
                    </tr>
                  ) : inwardRecords.map((r) => (
                    <tr key={r._id}>
                      <td className="ir-td-bold">{r.efiWoNumber || "-"}</td>

                      {/* Customer Name Cell */}
                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "180px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: expandedCell === `cust-${r._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() => setExpandedCell(expandedCell === `cust-${r._id}` ? null : `cust-${r._id}`)}
                      >
                        {expandedCell === `cust-${r._id}`
                          ? r.customerName
                          : truncateText(r.customerName, 20)}
                      </td>

                      {/* Item Description Cell */}
                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "220px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: expandedCell === `item-${r._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() => setExpandedCell(expandedCell === `item-${r._id}` ? null : `item-${r._id}`)}
                      >
                        {expandedCell === `item-${r._id}`
                          ? r.itemDescription
                          : truncateText(r.itemDescription, 25)}
                      </td>

                      {/* Material Code Cell */}
                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "180px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: expandedCell === `mat-${r._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() => setExpandedCell(expandedCell === `mat-${r._id}` ? null : `mat-${r._id}`)}
                      >
                        {expandedCell === `mat-${r._id}`
                          ? r.materialCode
                          : truncateText(r.materialCode, 20)}
                      </td>

                      <td style={{ fontWeight: 600 }}>{r.workOrderQty}</td>
                      <td>{r.workOrderDate ? new Date(r.workOrderDate).toLocaleDateString("en-IN") : "-"}</td>
                      <td>{r.dateOfInward ? new Date(r.dateOfInward).toLocaleDateString("en-IN") : "-"}</td>
                      <td style={{ fontWeight: 600 }}>{r.printReceivedQty}</td>
                      <td>
                        <span className={`ir-badge-pending ${Number(r.pendingQty) > 0 ? "has" : "done"}`}>
                          {r.pendingQty}
                        </span>
                      </td>
                      <td>{r.chequeFromNo || "-"}</td>
                      <td>{r.chequeToNo || "-"}</td>
                      <td>{r.defectCount || 0}</td>
                  
                      <td><span className="ir-badge-issuer">{r.issuer || "-"}</span></td>

                      {/* Remarks Cell */}
                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "200px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: expandedCell === `remarks-${r._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() => setExpandedCell(expandedCell === `remarks-${r._id}` ? null : `remarks-${r._id}`)}
                      >
                        {expandedCell === `remarks-${r._id}`
                          ? r.remarks || "-"
                          : truncateText(r.remarks, 20)}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="ir-pagination">
              <span className="ir-pagination-info">
                {totalRecords > 0
                  ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalRecords)} of ${totalRecords}`
                  : "No records"}
              </span>
              <div className="ir-pagination-controls">
                <button
                  className="ir-btn ir-btn-gray"
                  disabled={page <= 1}
                  onClick={() => fetchInwardRecords(page - 1)}
                >
                  <FiChevronLeft size={14}/> Prev
                </button>
                <span className="ir-page-indicator">Page {page} of {totalPages}</span>
                <button
                  className="ir-btn ir-btn-gray"
                  disabled={page >= totalPages}
                  onClick={() => fetchInwardRecords(page + 1)}
                >
                  Next <FiChevronRight size={14}/>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

export default InwardRegister;