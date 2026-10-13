import { useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import BASE_URL from "../config/api";

const PAGE_SIZES = [25, 50, 100];

// Excel export fetches the matching records in chunks.
const EXPORT_CHUNK = 5000;
const EXPORT_LIMIT = 200000;

const normalizeGroup = (name) => {
  if (!name) return "";
  name = name.trim();

  if (name.startsWith("Non Surface Sized"))
    return "Non Surface Sized Maplit";

  if (name === "Parachment Paper")
    return "Parchment Paper";

  return name;
};

const normalizeRow = (item) => {
  const groups = [
    ...new Set(
      (item.materials || [])
        .map((m) => normalizeGroup(m.materialGroupDescription))
        .filter(Boolean)
    )
  ];

  return {
    ...item,
    mill: item.mill?.trim() || "",
    groups
  };
};

function PagerBar({ pg }) {
  const { page, pageSize, total, totalPages, setPage, setPageSize } = pg;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pager-bar">
      <span className="pager-info">
        Showing {start.toLocaleString("en-IN")}–{end.toLocaleString("en-IN")} of{" "}
        {total.toLocaleString("en-IN")}
      </span>

      <div className="pager-btns">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={page <= 1}
          onClick={() => setPage(1)}
        >
          «
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Prev
        </button>
        <span className="pager-page">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={page >= totalPages}
          onClick={() => setPage(totalPages)}
        >
          »
        </button>

        <select
          className="form-select form-select-sm pager-size"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function WastageReport() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [latestMode, setLatestMode] = useState(true);
  const [applied, setApplied] = useState({});
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(50);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [woFilter, setWoFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [millFilter, setMillFilter] = useState("");
  const [gsmFilter, setGsmFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [expandedCell, setExpandedCell] = useState(null);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [millOptions, setMillOptions] = useState([]);
  const [gsmOptions, setGsmOptions] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserRole(decoded.role || "");
      } catch (e) {
        console.error("Token decoding error:", e);
      }
    }
  }, []);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`
  });

  const requestRows = async ({ latest, filters, page: pageNo, limit }) => {
    const params = {};
    if (latest) {
      params.latest = 1;
    } else {
      Object.entries(filters || {}).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      params.page = pageNo;
      params.limit = limit;
    }

    const res = await axios.get(`${BASE_URL}/api/production/wastage`, {
      headers: authHeaders(),
      params
    });
    return res.data;
  };

  const showRows = async (opts) => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const data = await requestRows(opts);
      if (id !== requestId.current) return;

      setRows((data.rows || []).map(normalizeRow));
      setTotal(data.total || 0);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/production/summary-options`, {
        headers: authHeaders(),
        params: { by: "production" }
      });

      setLocationOptions(res.data.locations || []);
      setCustomerOptions(res.data.customers || []);
      setGroupOptions(res.data.groups || []);
      setMillOptions(res.data.mills || []);
      setGsmOptions(res.data.gsms || []);
    } catch (err) {
      console.error("Error loading filter options:", err);
    }
  };

  useEffect(() => {
    loadOptions();
    showRows({ latest: true });
  }, []);

  const applyFilter = () => {
    const filters = {
      wo: woFilter,
      date: dateFilter,
      month: monthFilter,
      from: fromDate,
      to: toDate,
      group: groupFilter,
      mill: millFilter,
      gsm: gsmFilter,
      customer: customerFilter,
      type: typeFilter,
      location: locationFilter
    };

    setApplied(filters);
    setLatestMode(false);
    setPageState(1);
    showRows({ filters, page: 1, limit: pageSize });
  };

  const clearFilter = () => {
    setWoFilter("");
    setDateFilter("");
    setMonthFilter("");
    setGroupFilter("");
    setMillFilter("");
    setGsmFilter("");
    setCustomerFilter("");
    setTypeFilter("");
    setLocationFilter("");
    setFromDate("");
    setToDate("");

    setApplied({});
    setLatestMode(true);
    setPageState(1);
    showRows({ latest: true });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pg = {
    page,
    pageSize,
    total,
    totalPages,
    setPage: (n) => {
      const next = Math.min(Math.max(n, 1), totalPages);
      setPageState(next);
      showRows({ filters: applied, page: next, limit: pageSize });
    },
    setPageSize: (n) => {
      setPageSizeState(n);
      setPageState(1);
      showRows({ filters: applied, page: 1, limit: n });
    }
  };

  const buildWorkbook = (list) => {
    const wb = XLSX.utils.book_new();

    const sheetRows = [
      ["WASTAGE REPORT"],
      [],
      [
        "WO No",
        "WO Date",
        "Prod Date",
        "Customer",
        "Job",
        "Material",
        "Material Group",
        "Mill",
        "GSM",
        "Paper Size",
        "Reel No",
        "Production Type",
        "Gross",
        "Mill Net",
        "Actual Net",
        "Output",
        "Matt",
        "Print",
        "End",
        "Core",
        "Total Waste",
        "Balance",
        "Waste %",
        "Remarks",
        "User Location"
      ]
    ];

    list.forEach((item) => {
      sheetRows.push([
        item.efiWoNumber,
        item.date ? new Date(item.date).toLocaleDateString("en-IN") : "-",
        item.productionDate
          ? new Date(item.productionDate).toLocaleDateString("en-IN")
          : "-",
        item.customerName,
        item.jobDescription,
        item.materials?.map((m) => m.materialCode).join(", "),
        item.groups?.join(", "),
        item.mill,
        item.materials?.map((m) => m.gsm).join(", "),
        item.materials?.map((m) => m.paperSize).join(", "),
        item.reelNo,
        item.productionType,
        item.grossWeight,
        item.millNetWeight,
        item.actualNetWeight,
        item.productionOutput,
        item.mattWaste,
        item.printWaste,
        item.realEndWaste,
        item.coreWeight,
        item.totalWaste,
        item.balance,
        item.wastePercent + "%",
        item.remarks || "-",
        item.userLocations?.filter(Boolean).join(", ") || "-"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, "Wastage");

    const file = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([file]), "Wastage_Report.xlsx");
  };

  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      let list = rows;

      if (!latestMode) {
        const wanted = Math.min(total, EXPORT_LIMIT);
        list = [];
        let pageNo = 1;

        while (list.length < wanted) {
          const data = await requestRows({
            filters: applied,
            page: pageNo,
            limit: EXPORT_CHUNK
          });
          const chunk = (data.rows || []).map(normalizeRow);
          if (chunk.length === 0) break;
          chunk.forEach((r) => list.push(r));
          pageNo += 1;
        }

        list = list.slice(0, wanted);

        if (total > EXPORT_LIMIT) {
          window.alert(
            `Only the first ${EXPORT_LIMIT.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} matching records were exported (browser/Excel limit). Narrow the filters to export the rest.`
          );
        }
      }

      buildWorkbook(list);
    } catch (err) {
      console.error("Export error:", err);
      window.alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const truncateText = (text, length = 12) => {
    if (!text) return "-";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  return (
    <div
      className="container wastage-report-page"
      style={{
        maxWidth: "100%",
        fontSize: "14px",
        background: "transparent",
        padding: "16px 20px 50px"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap');

        .wastage-report-page {
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #000000;
        }

        .wastage-report-page * {
          box-sizing: border-box;
          font-family: inherit;
        }

        /* ── HEAVY 3D ELEVATION SHADOWS FOR EVERY GRID & CARD ── */
        .wastage-report-page .card {
          background: #ffffff !important;
          border: 1px solid #d1d5db !important;
          border-radius: 10px !important;
          box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.14), 0 8px 16px -6px rgba(0, 0, 0, 0.08) !important;
          margin-bottom: 24px;
          overflow: hidden;
          transition: box-shadow 0.25s ease, transform 0.2s ease;
        }

        .wastage-report-page .card:hover {
          box-shadow: 0 22px 42px -4px rgba(0, 0, 0, 0.18), 0 12px 20px -6px rgba(0, 0, 0, 0.12) !important;
        }

        /* ── COLOR ACCENT ON FILTER GRID CARD ── */
        .wastage-report-page .filter-card-styled {
          background: #e3f1f4 !important; /* Soft light teal background */
          border: 1px solid #bdd9df !important;
          border-top: 3.5px solid #0f5560 !important;
        }

        .filter-header-title {
          font-size: 16px;
          font-weight: 800;
          color: #0b3a45;
          margin: 0;
        }

        /* ── FILTER FIELDS: BLACK BORDER & HIGH VISIBILITY ── */
        .wastage-report-page .form-label {
          color: #000000 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em;
          margin-bottom: 5px;
          display: block;
        }

        .wastage-report-page .form-control,
        .wastage-report-page .form-select {
          min-height: 40px;
          height: 40px;
          border: 1.5px solid #000000 !important;
          border-radius: 6px !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          outline: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
          transition: all 0.15s ease;
        }

        .wastage-report-page .form-control:focus,
        .wastage-report-page .form-select:focus {
          border-color: #0f5560 !important;
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.25) !important;
        }

        /* ── Action Buttons ── */
        .wastage-report-page .btn {
          height: 40px;
          border-radius: 6px !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          letter-spacing: 0.02em;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid transparent !important;
          transition: all 0.15s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15) !important;
        }

        .wastage-report-page .btn-success {
          background: #10b981 !important;
          color: #ffffff !important;
          border-color: #059669 !important;
        }

        .wastage-report-page .btn-success:hover {
          background: #059669 !important;
          border-color: #047857 !important;
        }

        .wastage-report-page .btn-secondary {
          background: #475569 !important;
          color: #ffffff !important;
          border-color: #334155 !important;
        }

        .wastage-report-page .btn-secondary:hover {
          background: #334155 !important;
          border-color: #1e293b !important;
        }

        .count-pill {
          background: #ffffff;
          color: #0b3a45;
          border: 1.5px solid #0f5560;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 800;
        }

        /* ── Table Card Header ── */
        .wastage-report-page .card-header {
          background: #f8fafc !important;
          border-bottom: 1.5px solid #cbd5e1 !important;
          color: #000000 !important;
          padding: 12px 18px !important;
          font-size: 14px;
          font-weight: 800 !important;
          letter-spacing: -0.01em;
          text-align: center;
        }

        .wastage-report-page .table-responsive {
          background: #ffffff !important;
          border: none;
        }

        .wastage-report-page table {
          width: 100%;
          border-collapse: separate !important;
          border-spacing: 0 !important;
          font-size: 12.5px;
          color: #000000;
          background: #ffffff;
        }

        /* ── ATTRACTIVE COLORFUL TABLE HEADER (Teal Accent with White Text & Centered) ── */
        .wastage-report-page thead tr th {
          background: #0f5560 !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          padding: 11px 12px !important;
          border-bottom: 2px solid #0b3a45 !important;
          border-right: 1px solid rgba(255, 255, 255, 0.18) !important;
          border-top: none !important;
          border-left: none !important;
          white-space: nowrap;
          text-align: center !important;
          vertical-align: middle !important;
        }

        .wastage-report-page thead tr th:last-child {
          border-right: none !important;
        }

        .wastage-report-page tbody td {
          padding: 9px 12px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          border-right: 1px solid #f1f5f9 !important;
          border-left: none !important;
          border-top: none !important;
          color: #000000 !important;
          font-weight: 600;
          vertical-align: middle;
          text-align: center !important;
          white-space: nowrap;
        }

        .wastage-report-page tbody td:last-child {
          border-right: none !important;
        }

        .wastage-report-page tbody tr:nth-child(even) td {
          background: #fafbfc;
        }

        .wastage-report-page tbody tr:hover td {
          background: #f1f5f9 !important;
        }

        .cell-expandable {
          cursor: pointer;
          color: #0b3a45;
          font-weight: 700;
          text-decoration: underline dotted;
        }

        .cell-expandable:hover {
          color: #e4572e;
        }

        .reel-badge-pill {
          background: #e3f1f4;
          color: #0b3a45;
          border: 1px solid #bdd9df;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 800;
        }

        /* ── Pager Bar ── */
        .wastage-report-page .pager-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 9px 16px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .wastage-report-page .pager-info {
          font-size: 12px;
          font-weight: 700;
          color: #334155;
        }

        .wastage-report-page .pager-btns {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .wastage-report-page .pager-btns .btn {
          height: 30px !important;
          min-height: 30px !important;
          padding: 0 10px !important;
          font-size: 11.5px !important;
          font-weight: 800;
          background: #ffffff !important;
          color: #000000 !important;
          border: 1.5px solid #000000 !important;
          box-shadow: none !important;
        }

        .wastage-report-page .pager-btns .btn:hover:not(:disabled) {
          background: #f1f5f9 !important;
          border-color: #000000 !important;
        }

        .wastage-report-page .pager-btns .btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          border-color: #94a3b8 !important;
        }

        .wastage-report-page .pager-page {
          font-size: 12px;
          font-weight: 800;
          color: #000000;
          padding: 0 4px;
        }

        .wastage-report-page .pager-size {
          height: 30px !important;
          min-height: 30px !important;
          padding: 2px 24px 2px 8px !important;
          font-size: 11.5px !important;
          font-weight: 700 !important;
          width: auto;
          background-color: #ffffff !important;
          border: 1.5px solid #000000 !important;
          color: #000000 !important;
        }

        /* ── PAGE ANIMATIONS ── */
        @keyframes wrFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes wrRowIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes wrPillPop {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Filters card, then table card, slide up one after the other */
        .wastage-report-page > .card:nth-of-type(1) {
          animation: wrFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) backwards;
        }

        .wastage-report-page > .card:nth-of-type(2) {
          animation: wrFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.15s backwards;
        }

        .wastage-report-page .count-pill {
          animation: wrPillPop 0.4s ease-out 0.35s backwards;
        }

        /* Table rows fade in with a short stagger (replays on page change / new data) */
        .wastage-report-page tbody tr {
          animation: wrRowIn 0.4s ease-out backwards;
        }

        .wastage-report-page tbody tr:nth-child(1)  { animation-delay: 0.30s; }
        .wastage-report-page tbody tr:nth-child(2)  { animation-delay: 0.34s; }
        .wastage-report-page tbody tr:nth-child(3)  { animation-delay: 0.38s; }
        .wastage-report-page tbody tr:nth-child(4)  { animation-delay: 0.42s; }
        .wastage-report-page tbody tr:nth-child(5)  { animation-delay: 0.46s; }
        .wastage-report-page tbody tr:nth-child(6)  { animation-delay: 0.50s; }
        .wastage-report-page tbody tr:nth-child(7)  { animation-delay: 0.54s; }
        .wastage-report-page tbody tr:nth-child(8)  { animation-delay: 0.58s; }
        .wastage-report-page tbody tr:nth-child(9)  { animation-delay: 0.62s; }
        .wastage-report-page tbody tr:nth-child(10) { animation-delay: 0.66s; }
        .wastage-report-page tbody tr:nth-child(n+11) { animation-delay: 0.70s; }

        /* Respect users who prefer no motion */
        @media (prefers-reduced-motion: reduce) {
          .wastage-report-page > .card,
          .wastage-report-page .count-pill,
          .wastage-report-page tbody tr {
            animation: none !important;
          }
        }

        @media (max-width: 768px) {
          .wastage-report-page {
            padding: 10px;
          }
        }
      `}</style>

      {/* FILTERS CARD WITH SOFT TEAL COLOR ACCENT */}
      <div className="card filter-card-styled p-3 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="filter-header-title">Filters</h5>
          <div className="d-flex align-items-center gap-3">
            <span className="count-pill">
              {loading
                ? "Loading..."
                : `Showing ${total.toLocaleString("en-IN")} of ${totalCount.toLocaleString("en-IN")} Records`}
            </span>
            {userRole !== "PLANNER" && (
              <button
                type="button"
                className="btn btn-success px-4"
                onClick={exportExcel}
                disabled={exporting}
              >
                {exporting ? "Exporting..." : "Export Excel"}
              </button>
            )}
          </div>
        </div>

        <div className="row g-2">
          {/* WO Number */}
          <div className="col-md-2">
            <label className="form-label">WO Number</label>
            <input
              className="form-control"
              placeholder="Enter WO..."
              value={woFilter}
              onChange={(e) => setWoFilter(e.target.value)}
            />
          </div>

          {/* Customer */}
          <div className="col-md-2">
            <label className="form-label">Customer</label>
            <select
              className="form-select"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="">All Customers</option>
              {customerOptions.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="col-md-2">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          {/* Month */}
          <div className="col-md-2">
            <label className="form-label">Month</label>
            <input
              type="month"
              className="form-control"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </div>

          {/* From Date */}
          <div className="col-md-2">
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          {/* To Date */}
          <div className="col-md-2">
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {/* Group */}
          <div className="col-md-2">
            <label className="form-label">Material Group</label>
            <select
              className="form-select"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="">All Groups</option>
              {groupOptions.map((g, i) => (
                <option key={i} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Mill */}
          <div className="col-md-2">
            <label className="form-label">Mill</label>
            <select
              className="form-select"
              value={millFilter}
              onChange={(e) => setMillFilter(e.target.value)}
            >
              <option value="">All Mills</option>
              {millOptions.map((m, i) => (
                <option key={i} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* User Location */}
          <div className="col-md-2">
            <label className="form-label">User Location</label>
            <select
              className="form-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All Locations</option>
              {locationOptions.map((loc, i) => (
                <option key={i} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* GSM */}
          <div className="col-md-2">
            <label className="form-label">GSM</label>
            <select
              className="form-select"
              value={gsmFilter}
              onChange={(e) => setGsmFilter(e.target.value)}
            >
              <option value="">All GSM</option>
              {gsmOptions.map((g, i) => (
                <option key={i} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Production Type */}
          <div className="col-md-2">
            <label className="form-label">Production Type</label>
            <select
              className="form-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="Make Ready">Make Ready</option>
              <option value="Production">Production</option>
            </select>
          </div>

          {/* Actions: Apply & Clear */}
          <div className="col-md-2 d-flex align-items-end gap-2">
            <button
              className="btn btn-success w-100"
              onClick={applyFilter}
              disabled={loading}
            >
              Apply
            </button>
            <button
              className="btn btn-secondary w-100"
              onClick={clearFilter}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="card mb-4">
        <div className="card-header">
          <strong>Wastage Report Records</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "70vh", overflowY: "auto" }}
        >
          <table
            className="table mb-0 align-middle small"
            style={{ minWidth: "1400px" }}
          >
            <thead className="sticky-top">
              <tr>
                <th>WO No</th>
                <th>WO Date</th>
                <th>Prod Date</th>
                <th>Customer</th>
                <th>Job description</th>
                <th>Material</th>
                <th>Material Group</th>
                <th>Mill</th>
                <th>GSM</th>
                <th>Paper Size</th>
                <th>Reel No</th>
                <th>Production Type</th>
                <th>Gross</th>
                <th>Mill Net</th>
                <th>Actual Net</th>
                <th>Output</th>
                <th>Matt Waste</th>
                <th>Print Waste</th>
                <th>End Waste</th>
                <th>Core</th>
                <th>Total Waste</th>
                <th>Balance</th>
                <th>Waste %</th>
                <th>Remarks</th>
                <th>User Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="25" className="p-4 text-center text-muted">
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <span className="fw-bold">#{item.efiWoNumber}</span>
                    </td>
                    <td>
                      {item.date
                        ? new Date(item.date).toLocaleDateString("en-IN")
                        : "-"}
                    </td>
                    <td>
                      {item.productionDate
                        ? new Date(item.productionDate).toLocaleDateString("en-IN")
                        : "-"}
                    </td>
                    <td className="fw-semibold">{item.customerName}</td>
                    <td
                      className="cell-expandable"
                      style={{
                        whiteSpace:
                          expandedCell === `job-${item._id}`
                            ? "normal"
                            : "nowrap"
                      }}
                      onClick={() =>
                        setExpandedCell(
                          expandedCell === `job-${item._id}`
                            ? null
                            : `job-${item._id}`
                        )
                      }
                    >
                      {expandedCell === `job-${item._id}`
                        ? item.jobDescription
                        : truncateText(item.jobDescription)}
                    </td>
                    <td>
                      {item.materials?.map((m) => m.materialCode).join(", ") || "-"}
                    </td>
                    <td
                      className="cell-expandable"
                      style={{
                        whiteSpace:
                          expandedCell === `material-${item._id}`
                            ? "normal"
                            : "nowrap"
                      }}
                      onClick={() =>
                        setExpandedCell(
                          expandedCell === `material-${item._id}`
                            ? null
                            : `material-${item._id}`
                        )
                      }
                    >
                      {expandedCell === `material-${item._id}`
                        ? item.materials
                            ?.map((m) => m.materialDescription)
                            .join(", ")
                        : truncateText(
                            item.materials
                              ?.map((m) => m.materialDescription)
                              .join(", ")
                          )}
                    </td>
                    <td>{item.mill || "-"}</td>
                    <td>{item.materials?.map((m) => m.gsm).join(", ") || "-"}</td>
                    <td>
                      {item.materials?.map((m) => m.paperSize).join(", ") || "-"}
                    </td>
                    <td>
                      <span className="reel-badge-pill">{item.reelNo}</span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            item.productionType === "Make Ready"
                              ? "#fff3d6"
                              : "#e3f1f4",
                          color:
                            item.productionType === "Make Ready"
                              ? "#8a5a00"
                              : "#0b3a45",
                          border: `1px solid ${
                            item.productionType === "Make Ready"
                              ? "#f2d291"
                              : "#bdd9df"
                          }`
                        }}
                      >
                        {item.productionType || "-"}
                      </span>
                    </td>
                    <td>{item.grossWeight}</td>
                    <td>{item.millNetWeight}</td>
                    <td className="fw-bold">{item.actualNetWeight}</td>
                    <td>{item.productionOutput}</td>
                    <td>{item.mattWaste}</td>
                    <td>{item.printWaste}</td>
                    <td>{item.realEndWaste}</td>
                    <td>{item.coreWeight}</td>
                    <td className="fw-bold text-danger">
                      {Number(item.totalWaste || 0).toFixed(2)}
                    </td>
                    <td className="fw-bold text-success">{item.balance}</td>
                    <td
                      className={
                        Number(item.wastePercent) > 15
                          ? "text-danger fw-bold"
                          : "text-success fw-bold"
                      }
                    >
                      {Number(item.wastePercent || 0).toFixed(2)}%
                    </td>
                    <td
                      className="cell-expandable"
                      style={{
                        whiteSpace:
                          expandedCell === `remarks-${item._id}`
                            ? "normal"
                            : "nowrap"
                      }}
                      onClick={() =>
                        setExpandedCell(
                          expandedCell === `remarks-${item._id}`
                            ? null
                            : `remarks-${item._id}`
                        )
                      }
                    >
                      {expandedCell === `remarks-${item._id}`
                        ? item.remarks || "-"
                        : truncateText(item.remarks)}
                    </td>
                    <td>
                      {item.userLocations?.filter(Boolean).length > 0
                        ? item.userLocations.filter(Boolean).join(", ")
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!latestMode && <PagerBar pg={pg} />}
      </div>
    </div>
  );
}