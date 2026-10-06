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
        <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
        <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
        <span className="pager-page">Page {page} / {totalPages}</span>
        <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>

        <select
          className="form-select form-select-sm pager-size"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n} / page</option>
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
  // grouped numbers come from the server (raw records never reach the browser)
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

  // ✅ GROUPED DATA (already grouped by the server)
  const groupedCustomer = summary.customers;
  const groupedMill = summary.mills;
  const groupedWorkOrder = summary.workOrders;

  // ✅ GROUP BY WORK ORDER (planned vs achieved)
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

  // LOAD SUMMARY FROM SERVER (filters are sent as query params)
  // no filter -> latest 20 records, filters -> ALL matching records
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

      if (id !== requestId.current) return; // a newer request replaced this one

      setSummary({ ...EMPTY_SUMMARY, ...res.data });
    } catch (error) {
      console.error("Error loading summary report:", error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // LOAD FILTER DROPDOWN VALUES (once)
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

  // TOTALS
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

  // PAGINATION (display only; totals and exports still use all rows)
  const custPg = usePaging(groupedCustomer, summary);
  const millPg = usePaging(groupedMill, summary);
  const woPg = usePaging(groupedWorkOrder, summary);
  const planPg = usePaging(groupedWO, summary);

  // EXPORT EXCEL (always exports ALL grouped rows, not just the rows of the current page)
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // ================= SHEET 1: SUMMARY =================
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

    // ================= SHEET 2: PLANNED VS ACHIEVED =================
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

    // GRAND TOTAL
    woRows.push([
      "TOTAL",
      pvaTotal.planned,
      pvaTotal.output,
      pvaTotal.achieved,
      pvaTotal.achieved - pvaTotal.planned
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet(woRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Planned_vs_Achieved");

    // EXPORT
    const file = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([file]), "Reel_Summary.xlsx");
  };

  return (
    <div
      className="container mt-2 summary-report-page"
      style={{
        maxWidth: "100%",
        fontSize: "14px",
        background: "#d8f1fb",
        border: "1px solid rgba(12, 90, 130, 0.38)",
        borderRadius: "20px"
      }}
    >
      {/* ======================================================================
          🎨 MATCHING THE PRODUCTION DASHBOARD DESIGN LANGUAGE
          ====================================================================== */}
      <style>{`
        .summary-report-page {
          min-height: 100vh;
          padding: 18px;
          color: #08283d;
          background:
            radial-gradient(circle at top left, rgba(34, 153, 204, 0.34), transparent 32%),
            linear-gradient(135deg, #d6f1fb 0%, #edfaff 48%, #c7e9f7 100%) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .summary-report-page .summary-title {
          color: #06324d;
          letter-spacing: 0;
          font-size: 28px;
          font-weight: 800;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .summary-report-page .card {
          border: 1px solid rgba(20, 111, 156, 0.42) !important;
          border-radius: 12px !important;
          background: rgba(221, 243, 252, 0.94) !important;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22) !important;
        }

        .summary-report-page h5,
        .summary-report-page h6 {
          color: #062b42 !important;
          font-weight: 800;
          padding: 8px 0;
        }

        .summary-report-page .form-label {
          color: #092f47 !important;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .summary-report-page .form-control,
        .summary-report-page .form-select {
          min-height: 38px;
          border: 1px solid rgba(14, 94, 135, 0.62) !important;
          border-radius: 8px;
          background-color: rgba(255, 255, 255, 0.98) !important;
          color: #071f31;
          font-weight: 600;
          box-shadow: inset 0 1px 2px rgba(8, 55, 83, 0.08);
        }

        .summary-report-page .form-control:focus,
        .summary-report-page .form-select:focus {
          border-color: #087fb5 !important;
          box-shadow: 0 0 0 3px rgba(8, 127, 181, 0.22) !important;
        }

        .summary-report-page .btn {
          border: 0;
          border-radius: 8px;
          font-weight: 700;
          min-height: 38px;
          box-shadow: 0 7px 15px rgba(10, 78, 115, 0.24);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .summary-report-page .btn:active {
          transform: translateY(2px);
          box-shadow: 0 2px 6px rgba(10, 78, 115, 0.2);
        }

        .summary-report-page .btn-success {
          background: linear-gradient(135deg, #087f68, #18aa91) !important;
          color: #ffffff !important;
        }

        .summary-report-page .btn-secondary {
          background: linear-gradient(135deg, #405f76, #6f91a6) !important;
          color: #ffffff !important;
        }

        .summary-report-page .card-header {
          border: 0;
          border-radius: 12px 12px 0 0 !important;
          background: linear-gradient(135deg, #075f90, #119bd2) !important;
          color: #ffffff !important;
          padding: 12px 16px;
        }

        .summary-report-page .table-responsive {
          background: #d5edf8 !important;
          border-radius: 0 0 12px 12px;
        }

        .summary-report-page table {
          color: #09283d;
          background: #ffffff;
        }

        .summary-report-page thead th {
          background: #064c73 !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.28) !important;
          font-size: 13px;
          vertical-align: middle;
          white-space: nowrap;
          text-align: center;
        }

        .summary-report-page tbody td {
          border-color: rgba(20, 93, 130, 0.28) !important;
          vertical-align: middle;
          text-align: center;
          font-weight: 500;
        }

        .summary-report-page tbody tr:hover td {
          background: #d9f2fc !important;
        }

        .summary-report-page .total-row-highlight {
          background: #e0f2fe !important;
          font-weight: 800 !important;
          border-top: 2px solid #075f90 !important;
        }

        .summary-header-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 20px;
        }

        .count-pill {
          background: rgba(8, 119, 173, 0.15);
          color: #064c73;
          border: 1px solid rgba(8, 119, 173, 0.35);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
        }

        .summary-report-page .pager-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          border-top: 1px solid rgba(20, 93, 130, 0.28);
          background: rgba(247, 253, 255, 0.98);
          border-radius: 0 0 12px 12px;
        }
        .summary-report-page .pager-info {
          font-size: 12.5px;
          font-weight: 700;
          color: #092f47;
        }
        .summary-report-page .pager-btns {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .summary-report-page .pager-btns .btn {
          min-height: 30px;
          padding: 3px 10px;
          box-shadow: none;
        }
        .summary-report-page .pager-btns .btn:disabled {
          opacity: 0.45;
        }
        .summary-report-page .pager-page {
          font-size: 12.5px;
          font-weight: 800;
          color: #064c73;
          padding: 0 6px;
        }
        .summary-report-page .pager-size {
          width: auto;
          min-height: 30px;
        }

        @media (max-width: 992px) {
          .dual-table-row {
            flex-direction: column !important;
          }
          .dual-table-col {
            width: 100% !important;
          }
        }

        @media (max-width: 768px) {
          .summary-report-page {
            padding: 12px;
            border-radius: 14px !important;
          }

          .summary-report-page .summary-title {
            font-size: 23px;
          }

          .summary-header-box {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>

      {/* HEADER WITH CENTERED TITLE & RIGHT-ALIGNED BUTTON */}
      <div className="position-relative text-center mt-2 mb-4">
        <h1 className="summary-title m-0">
          <b>Reel Summary Report</b>
        </h1>

        {userRole !== "PLANNER" && (
          <div className="position-absolute top-50 end-0 translate-middle-y">
            <button className="btn btn-success px-4" onClick={exportExcel}>
              Export Excel
            </button>
          </div>
        )}
      </div>

      {/* FILTERS CARD */}
      <div className="card shadow-lg p-3 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0" style={{ color: "#06324d", fontWeight: 800 }}>
            Filters
          </h5>
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

          {/* Date */}
          {/* <div className="col-md-2">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div> */}

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

          {/* Month */}
          {/* <div className="col-md-2">
            <label className="form-label">Month</label>
            <input
              type="month"
              className="form-control"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </div> */}

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
        </div>
      </div>

      {/* ======================================================================
          SUMMARY TABLES ROW (CUSTOMER & MILL SIDE-BY-SIDE)
          ====================================================================== */}
      <div className="d-flex flex-nowrap gap-4 dual-table-row mb-4">
        {/* CUSTOMER SUMMARY */}
        <div className="w-50 dual-table-col">
          <div className="card shadow-lg h-100">
            <div className="card-header text-center">
              <strong>Customer Summary</strong>
            </div>
            <div
              className="table-responsive"
              style={{ maxHeight: "350px", overflowY: "auto" }}
            >
              <table className="table table-striped table-bordered table-hover text-center mb-0 align-middle">
                <thead className="table-dark sticky-top">
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
                      <td className="text-danger fw-bold">
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
                    <td className="text-danger fw-bold">
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
          <div className="card shadow-lg h-100">
            <div className="card-header text-center">
              <strong>Mill Summary</strong>
            </div>
            <div
              className="table-responsive"
              style={{ maxHeight: "350px", overflowY: "auto" }}
            >
              <table className="table table-striped table-bordered table-hover text-center mb-0 align-middle">
                <thead className="table-dark sticky-top">
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
                      <td className="text-danger fw-bold">
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
                    <td className="text-danger fw-bold">
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
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Work Order Summary</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "350px", overflowY: "auto" }}
        >
          <table className="table table-striped table-bordered table-hover text-center mb-0 align-middle">
            <thead className="table-dark sticky-top">
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
                  <td className="text-danger fw-bold">
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
                <td className="text-danger fw-bold">
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
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Planned V/s Achieved Qty</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "350px", overflowY: "auto" }}
        >
          <table className="table table-striped table-bordered table-hover text-center mb-0 align-middle">
            <thead className="table-dark sticky-top">
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
                      className={`fw-bold ${
                        diff < 0 ? "text-danger" : "text-success"
                      }`}
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
                  className={`fw-bold ${
                    pvaTotal.achieved - pvaTotal.planned < 0
                      ? "text-danger"
                      : "text-success"
                  }`}
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