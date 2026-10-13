import { useEffect, useMemo, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import BASE_URL from "../config/api";

const PAGE_SIZES = [10, 25, 50, 100];

// paging state for one table (resets to page 1 whenever resetKey changes)
function usePaging(rows, resetKey, initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    pageRows,
    setPage: (n) => setPage(Math.min(Math.max(n, 1), totalPages)),
    setPageSize: (n) => {
      setPageSizeState(n);
      setPage(1);
    }
  };
}

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

const EMPTY_SUMMARY = {
  totalCount: 0,
  filteredCount: 0,
  customers: [],
  mills: [],
  workOrders: []
};

export default function SummaryReport() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const [dateFilter, setDateFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [millFilter, setMillFilter] = useState("");
  const [gsmFilter, setGsmFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [customerFilter, setCustomerFilter] = useState("");
  const [customerOptions, setCustomerOptions] = useState([]);
  const [woFilter, setWoFilter] = useState("");
  const [groupOptions, setGroupOptions] = useState([]);
  const [millOptions, setMillOptions] = useState([]);
  const [gsmOptions, setGsmOptions] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
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

  const groupedCustomer = summary.customers;
  const groupedMill = summary.mills;
  const groupedWorkOrder = summary.workOrders;

  const groupedWO = useMemo(
    () =>
      summary.workOrders.map((w) => ({
        efiWoNumber: w.workOrder,
        plannedQty: w.plannedQty,
        output: w.output,
        achievedQty: w.achievedQty
      })),
    [summary.workOrders]
  );

  const fetchSummary = async (filters = {}) => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });

      const res = await axios.get(`${BASE_URL}/api/production/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (id !== requestId.current) return;

      setSummary({ ...EMPTY_SUMMARY, ...res.data });
    } catch (error) {
      console.error("Error loading summary report:", error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${BASE_URL}/api/production/summary-options`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setLocationOptions(res.data.locations || []);
      setCustomerOptions(res.data.customers || []);
      setGroupOptions(res.data.groups || []);
      setMillOptions(res.data.mills || []);
      setGsmOptions(res.data.gsms || []);
    } catch (error) {
      console.error("Error loading filter options:", error);
    }
  };

  useEffect(() => {
    loadOptions();
    fetchSummary();
  }, []);

  const applyFilter = () => {
    fetchSummary({
      wo: woFilter,
      from: fromDateFilter,
      to: toDateFilter,
      group: groupFilter,
      mill: millFilter,
      gsm: gsmFilter,
      type: typeFilter,
      location: locationFilter,
      customer: customerFilter
    });
  };

  const clearFilter = () => {
    setDateFilter("");
    setFromDateFilter("");
    setToDateFilter("");
    setMonthFilter("");
    setGroupFilter("");
    setMillFilter("");
    setGsmFilter("");
    setTypeFilter("");
    setLocationFilter("");
    setCustomerFilter("");
    setWoFilter("");
    fetchSummary();
  };

  const wastePercent = (waste, weight) =>
    weight > 0 ? ((waste / weight) * 100).toFixed(2) : "0.00";

  const customerTotal = useMemo(
    () =>
      groupedCustomer.reduce(
        (acc, item) => {
          acc.weight += item.weight;
          acc.waste += item.waste;
          return acc;
        },
        { weight: 0, waste: 0 }
      ),
    [groupedCustomer]
  );

  const millTotal = useMemo(
    () =>
      groupedMill.reduce(
        (acc, item) => {
          acc.weight += item.weight;
          acc.waste += item.waste;
          return acc;
        },
        { weight: 0, waste: 0 }
      ),
    [groupedMill]
  );

  const workOrderTotal = useMemo(
    () =>
      groupedWorkOrder.reduce(
        (acc, item) => {
          acc.weight += item.weight;
          acc.waste += item.waste;
          return acc;
        },
        { weight: 0, waste: 0 }
      ),
    [groupedWorkOrder]
  );

  const pvaTotal = useMemo(
    () =>
      groupedWO.reduce(
        (acc, item) => {
          acc.planned += item.plannedQty;
          acc.output += item.output;
          acc.achieved += item.achievedQty;
          return acc;
        },
        { planned: 0, output: 0, achieved: 0 }
      ),
    [groupedWO]
  );

  const custPg = usePaging(groupedCustomer, summary);
  const millPg = usePaging(groupedMill, summary);
  const woPg = usePaging(groupedWorkOrder, summary);
  const planPg = usePaging(groupedWO, summary);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [];

    // CUSTOMER
    rows.push(["--- CUSTOMER SUMMARY ---"]);
    rows.push(["Customer", "Actual Net Weight", "Total Waste", "Waste %"]);

    groupedCustomer.forEach((item) => {
      rows.push([
        item.customerName,
        item.weight,
        item.waste,
        wastePercent(item.waste, item.weight)
      ]);
    });

    rows.push([
      "TOTAL",
      customerTotal.weight,
      customerTotal.waste,
      wastePercent(customerTotal.waste, customerTotal.weight)
    ]);

    // MILL
    rows.push([]);
    rows.push(["--- MILL SUMMARY ---"]);
    rows.push(["Mill", "Actual Net Weight", "Total Waste", "Waste %"]);

    groupedMill.forEach((item) => {
      rows.push([
        item.mill,
        item.weight,
        item.waste,
        wastePercent(item.waste, item.weight)
      ]);
    });

    rows.push([
      "TOTAL",
      millTotal.weight,
      millTotal.waste,
      wastePercent(millTotal.waste, millTotal.weight)
    ]);

    // WORK ORDER
    rows.push([]);
    rows.push(["--- WORK ORDER SUMMARY ---"]);
    rows.push(["Work Order", "Actual Net Weight", "Total Waste", "Waste %"]);

    groupedWorkOrder.forEach((item) => {
      rows.push([
        item.workOrder,
        item.weight,
        item.waste,
        wastePercent(item.waste, item.weight)
      ]);
    });

    rows.push([
      "TOTAL",
      workOrderTotal.weight,
      workOrderTotal.waste,
      wastePercent(workOrderTotal.waste, workOrderTotal.weight)
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");

    // PLANNED VS ACHIEVED
    const woRows = [];
    woRows.push(["PLANNED VS ACHIEVED"]);
    woRows.push([
      "Work Order",
      "Planned Qty",
      "Output",
      "Achieved Qty",
      "Difference"
    ]);

    groupedWO.forEach((item) => {
      woRows.push([
        item.efiWoNumber,
        item.plannedQty,
        item.output,
        item.achievedQty,
        item.achievedQty - item.plannedQty
      ]);
    });

    woRows.push([
      "TOTAL",
      pvaTotal.planned,
      pvaTotal.output,
      pvaTotal.achieved,
      pvaTotal.achieved - pvaTotal.planned
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet(woRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Planned_vs_Achieved");

    const file = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([file]), "Reel_Summary.xlsx");
  };

  return (
    <div
      className="summary-report-page"
      style={{
        maxWidth: "100%",
        fontSize: "14px",
        background: "transparent",
        padding: "16px 20px 50px"
      }}
    >
      <style>{`
    
        .summary-report-page {
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #000000;
        }

        .summary-report-page * {
          box-sizing: border-box;
          font-family: inherit;
        }

        /* ── HEAVY 3D ELEVATION SHADOWS FOR EVERY GRID & CARD ── */
        .summary-report-page .card {
          background: #ffffff !important;
          border: 1px solid #d1d5db !important;
          border-radius: 10px !important;
          box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.14), 0 8px 16px -6px rgba(0, 0, 0, 0.08) !important;
          margin-bottom: 24px;
          overflow: hidden;
          transition: box-shadow 0.25s ease, transform 0.2s ease;
        }

        .summary-report-page .card:hover {
          box-shadow: 0 22px 42px -4px rgba(0, 0, 0, 0.18), 0 12px 20px -6px rgba(0, 0, 0, 0.12) !important;
        }

        /* ── LIGHT COLOR TINT FOR FILTER GRID CARD ── */
        .summary-report-page .filter-card-styled {
          background: #f0f7f9 !important; /* Soft light pastel tint */
          border: 1px solid #b8d4db !important;
          border-top: 3px solid #0f5560 !important;
        }

        /* ── Card Header ── */
        .summary-report-page .card-header {
          background: #f8fafc !important;
          border-bottom: 1.5px solid #cbd5e1 !important;
          color: #000000 !important;
          padding: 12px 18px !important;
          font-size: 14px;
          font-weight: 800 !important;
          letter-spacing: -0.01em;
          text-align: left;
        }

        .summary-report-page h5 {
          color: #000000 !important;
          font-weight: 800;
          font-size: 16px;
          margin: 0;
        }

        /* ── FILTER FIELDS: BLACK BORDER & HIGH VISIBILITY ── */
        .summary-report-page .form-label {
          color: #000000 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em;
          margin-bottom: 5px;
          display: block;
        }

        .summary-report-page .form-control,
        .summary-report-page .form-select {
          min-height: 40px;
          height: 40px;
          border: 1.5px solid #000000 !important; /* CRISP BLACK BORDER */
          border-radius: 6px !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          outline: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
          transition: all 0.15s ease;
        }

        .summary-report-page .form-control:focus,
        .summary-report-page .form-select:focus {
          border-color: #0f5560 !important;
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.25) !important;
        }

        /* ── Action Buttons ── */
        .summary-report-page .btn {
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

        .summary-report-page .btn-success {
          background: #10b981 !important;
          color: #ffffff !important;
          border-color: #059669 !important;
        }

        .summary-report-page .btn-success:hover {
          background: #059669 !important;
          border-color: #047857 !important;
        }

        .summary-report-page .btn-secondary {
          background: #475569 !important;
          color: #ffffff !important;
          border-color: #334155 !important;
        }

        .summary-report-page .btn-secondary:hover {
          background: #334155 !important;
          border-color: #1e293b !important;
        }

        .summary-report-page .count-pill {
          background: #ffffff;
          color: #0b3a45;
          border: 1.5px solid #0f5560;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 800;
        }

        /* ── Table Container ── */
        .summary-report-page .table-responsive {
          background: #ffffff !important;
          border: none;
        }

        .summary-report-page table {
          width: 100%;
          border-collapse: separate !important;
          border-spacing: 0 !important;
          font-size: 12.5px;
          color: #000000;
          background: #ffffff;
        }

        /* ── ALL TABLE HEADERS: CENTERED WITH RICH TEAL COLOR ── */
        .summary-report-page thead tr th {
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

        .summary-report-page thead tr th:last-child {
          border-right: none !important;
        }

        .summary-report-page tbody td {
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

        .summary-report-page tbody td:last-child {
          border-right: none !important;
        }

        .summary-report-page tbody tr:nth-child(even) td {
          background: #fafbfc;
        }

        .summary-report-page tbody tr:hover td {
          background: #f1f5f9 !important;
        }

        /* ── Total Row Highlight ── */
        .summary-report-page .total-row-highlight td {
          background: #eef7f9 !important;
          font-weight: 800 !important;
          color: #0b3a45 !important;
          border-top: 2px solid #0f5560 !important;
          border-bottom: 2px solid #0f5560 !important;
        }

        /* ── Pager Bar ── */
        .summary-report-page .pager-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 9px 16px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .summary-report-page .pager-info {
          font-size: 12px;
          font-weight: 700;
          color: #334155;
        }

        .summary-report-page .pager-btns {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .summary-report-page .pager-btns .btn {
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

        .summary-report-page .pager-btns .btn:hover:not(:disabled) {
          background: #f1f5f9 !important;
          border-color: #000000 !important;
        }

        .summary-report-page .pager-btns .btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          border-color: #94a3b8 !important;
        }

        .summary-report-page .pager-page {
          font-size: 12px;
          font-weight: 800;
          color: #000000;
          padding: 0 4px;
        }

        .summary-report-page .pager-size {
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
        @keyframes srFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes srRowIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes srPillPop {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Sections slide up one after the other:
           1 = filters, 2 = customer + mill row, 3 = work order, 4 = planned vs achieved */
        .summary-report-page > div:nth-of-type(1) {
          animation: srFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) backwards;
        }

        .summary-report-page > div:nth-of-type(2) {
          animation: srFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.15s backwards;
        }

        .summary-report-page > div:nth-of-type(3) {
          animation: srFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.3s backwards;
        }

        .summary-report-page > div:nth-of-type(4) {
          animation: srFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.45s backwards;
        }

        .summary-report-page .count-pill {
          animation: srPillPop 0.4s ease-out 0.35s backwards;
        }

        /* Table rows fade in with a short stagger */
        .summary-report-page tbody tr {
          animation: srRowIn 0.4s ease-out backwards;
        }

        .summary-report-page tbody tr:nth-child(1)  { animation-delay: 0.05s; }
        .summary-report-page tbody tr:nth-child(2)  { animation-delay: 0.09s; }
        .summary-report-page tbody tr:nth-child(3)  { animation-delay: 0.13s; }
        .summary-report-page tbody tr:nth-child(4)  { animation-delay: 0.17s; }
        .summary-report-page tbody tr:nth-child(5)  { animation-delay: 0.21s; }
        .summary-report-page tbody tr:nth-child(6)  { animation-delay: 0.25s; }
        .summary-report-page tbody tr:nth-child(7)  { animation-delay: 0.29s; }
        .summary-report-page tbody tr:nth-child(8)  { animation-delay: 0.33s; }
        .summary-report-page tbody tr:nth-child(9)  { animation-delay: 0.37s; }
        .summary-report-page tbody tr:nth-child(10) { animation-delay: 0.41s; }
        .summary-report-page tbody tr:nth-child(n+11) { animation-delay: 0.45s; }

        /* Respect users who prefer no motion */
        @media (prefers-reduced-motion: reduce) {
          .summary-report-page > div,
          .summary-report-page .count-pill,
          .summary-report-page tbody tr {
            animation: none !important;
          }
        }

        @media (max-width: 992px) {
          .dual-table-row {
            flex-direction: column !important;
          }
          .dual-table-col {
            width: 100% !important;
          }
        }
      `}</style>

      {/* FILTERS CARD WITH LIGHT COLOR ACCENT */}
      <div className="card filter-card-styled p-3 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5>Filters</h5>
          <span className="count-pill">
            {loading
              ? "Loading..."
              : `Showing ${summary.filteredCount.toLocaleString("en-IN")} of ${summary.totalCount.toLocaleString("en-IN")} Records`}
          </span>
        </div>

        <div className="row g-2">
          {/* Work Order */}
          <div className="col-md-2">
            <label className="form-label">Work Order</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search WO..."
              value={woFilter}
              onChange={(e) => setWoFilter(e.target.value)}
            />
          </div>

          {/* From Date */}
          <div className="col-md-2">
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-control"
              value={fromDateFilter}
              onChange={(e) => setFromDateFilter(e.target.value)}
            />
          </div>

          {/* To Date */}
          <div className="col-md-2">
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-control"
              value={toDateFilter}
              onChange={(e) => setToDateFilter(e.target.value)}
            />
          </div>

          {/* Material Group */}
          <div className="col-md-2">
            <label className="form-label">Material Group</label>
            <select
              className="form-select"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="">All</option>
              {groupOptions.map((grp, i) => (
                <option key={i}>{grp}</option>
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
              <option value="">All</option>
              {millOptions.map((m, i) => (
                <option key={i}>{m}</option>
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
              <option value="">All</option>
              {gsmOptions.map((g, i) => (
                <option key={i}>{g}</option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div className="col-md-2">
            <label className="form-label">Customer</label>
            <select
              className="form-select"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="">All</option>
              {customerOptions.map((c, i) => (
                <option key={i}>{c}</option>
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
              <option value="">All</option>
              {locationOptions.map((loc, i) => (
                <option key={i} value={loc}>
                  {loc}
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
              <option value="">All</option>
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

          {/* Export Excel */}
          {userRole !== "PLANNER" && (
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-success w-100" onClick={exportExcel}>
                Export Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================================
          SUMMARY TABLES ROW (CUSTOMER & MILL SIDE-BY-SIDE)
          ====================================================================== */}
      <div className="d-flex flex-nowrap gap-4 dual-table-row mb-4">
        {/* CUSTOMER SUMMARY */}
        <div className="w-50 dual-table-col">
          <div className="card h-100">
            <div className="card-header text-center">
              Customer Summary
            </div>
            <div
              className="table-responsive"
              style={{ maxHeight: "350px", overflowY: "auto" }}
            >
              <table className="table mb-0 align-middle">
                <thead className="sticky-top">
                  <tr>
                    <th>Customer</th>
                    <th>Actual Net Weight</th>
                    <th>Total Waste</th>
                    <th>Waste %</th>
                  </tr>
                </thead>
                <tbody>
                  {custPg.pageRows.map((item, i) => (
                    <tr key={i}>
                      <td className="fw-semibold">{item.customerName}</td>
                      <td>{item.weight.toFixed(2)}</td>
                      <td style={{ color: "#dc2626", fontWeight: "700" }}>
                        {item.waste.toFixed(2)}
                      </td>
                      <td className="fw-bold">
                        {wastePercent(item.waste, item.weight)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="total-row-highlight">
                    <td>TOTAL</td>
                    <td>{customerTotal.weight.toFixed(2)}</td>
                    <td style={{ color: "#dc2626", fontWeight: "700" }}>
                      {customerTotal.waste.toFixed(2)}
                    </td>
                    <td>
                      {wastePercent(customerTotal.waste, customerTotal.weight)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <PagerBar pg={custPg} />
          </div>
        </div>

        {/* MILL SUMMARY */}
        <div className="w-50 dual-table-col">
          <div className="card h-100">
            <div className="card-header text-center">
              Mill Summary
            </div>
            <div
              className="table-responsive"
              style={{ maxHeight: "350px", overflowY: "auto" }}
            >
              <table className="table mb-0 align-middle">
                <thead className="sticky-top">
                  <tr>
                    <th>Mill</th>
                    <th>Actual Net Weight</th>
                    <th>Total Waste</th>
                    <th>Waste %</th>
                  </tr>
                </thead>
                <tbody>
                  {millPg.pageRows.map((item, i) => (
                    <tr key={i}>
                      <td className="fw-semibold">{item.mill}</td>
                      <td>{item.weight.toFixed(2)}</td>
                      <td style={{ color: "#dc2626", fontWeight: "700" }}>
                        {item.waste.toFixed(2)}
                      </td>
                      <td className="fw-bold">
                        {wastePercent(item.waste, item.weight)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="total-row-highlight">
                    <td>TOTAL</td>
                    <td>{millTotal.weight.toFixed(2)}</td>
                    <td style={{ color: "#dc2626", fontWeight: "700" }}>
                      {millTotal.waste.toFixed(2)}
                    </td>
                    <td>{wastePercent(millTotal.waste, millTotal.weight)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <PagerBar pg={millPg} />
          </div>
        </div>
      </div>

      {/* ======================================================================
          WORK ORDER SUMMARY
          ====================================================================== */}
      <div className="card mb-4">
        <div className="card-header text-center">
          Work Order Summary
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "350px", overflowY: "auto" }}
        >
          <table className="table mb-0 align-middle">
            <thead className="sticky-top">
              <tr>
                <th>Work Order</th>
                <th>Customer</th>
                <th>Actual Net Weight</th>
                <th>Total Waste</th>
                <th>Waste %</th>
              </tr>
            </thead>

            <tbody>
              {woPg.pageRows.map((item, i) => (
                <tr key={i}>
                  <td className="fw-bold">#{item.workOrder}</td>
                  <td className="fw-semibold">{item.customer}</td>
                  <td>{item.weight.toFixed(2)}</td>
                  <td style={{ color: "#dc2626", fontWeight: "700" }}>
                    {item.waste.toFixed(2)}
                  </td>
                  <td className="fw-bold">
                    {wastePercent(item.waste, item.weight)}%
                  </td>
                </tr>
              ))}

              <tr className="total-row-highlight">
                <td>TOTAL</td>
                <td>--</td>
                <td>{workOrderTotal.weight.toFixed(2)}</td>
                <td style={{ color: "#dc2626", fontWeight: "700" }}>
                  {workOrderTotal.waste.toFixed(2)}
                </td>
                <td>
                  {wastePercent(workOrderTotal.waste, workOrderTotal.weight)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <PagerBar pg={woPg} />
      </div>

      {/* ======================================================================
          PLANNED V/S ACHIEVED QTY
          ====================================================================== */}
      <div className="card mb-4">
        <div className="card-header text-center">
          Planned V/s Achieved Qty
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "350px", overflowY: "auto" }}
        >
          <table className="table mb-0 align-middle">
            <thead className="sticky-top">
              <tr>
                <th>Work Order</th>
                <th>Planned Qty</th>
                <th>Output</th>
                <th>Achieved Qty</th>
                <th>Difference</th>
              </tr>
            </thead>

            <tbody>
              {planPg.pageRows.map((item, i) => {
                const diff = item.achievedQty - item.plannedQty;
                return (
                  <tr key={i}>
                    <td className="fw-bold">#{item.efiWoNumber}</td>
                    <td>{item.plannedQty.toLocaleString("en-IN")}</td>
                    <td>{item.output.toLocaleString("en-IN")}</td>
                    <td className="fw-semibold">
                      {item.achievedQty.toLocaleString("en-IN")}
                    </td>
                    <td
                      className="fw-bold"
                      style={{ color: diff < 0 ? "#dc2626" : "#059669" }}
                    >
                      {diff.toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}

              <tr className="total-row-highlight">
                <td>Grand Total</td>
                <td>{pvaTotal.planned.toLocaleString("en-IN")}</td>
                <td>{pvaTotal.output.toLocaleString("en-IN")}</td>
                <td>{pvaTotal.achieved.toLocaleString("en-IN")}</td>
                <td
                  className="fw-bold"
                  style={{
                    color:
                      pvaTotal.achieved - pvaTotal.planned < 0
                        ? "#dc2626"
                        : "#059669"
                  }}
                >
                  {(pvaTotal.achieved - pvaTotal.planned).toLocaleString("en-IN")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <PagerBar pg={planPg} />
      </div>
    </div>
  );
}