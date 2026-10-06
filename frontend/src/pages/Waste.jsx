import { useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import BASE_URL from "../config/api";

const PAGE_SIZES = [25, 50, 100];

// Excel export fetches the matching records in chunks. A browser cannot build a
// workbook of millions of rows, so the export stops at this many rows.
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

// same per-record preparation as before (only for the records on screen)
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

export default function WastageReport() {
  // the records currently on screen (one page) - the rest stay on the server
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0); // records matching the applied filters (30 in the default view)
  const [totalCount, setTotalCount] = useState(0); // all records
  const [loading, setLoading] = useState(true);
  const [latestMode, setLatestMode] = useState(true); // default view = latest 30
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

  // ask the server for records: the latest 30, or one page of everything matching the filters
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
      if (id !== requestId.current) return; // a newer request replaced this one

      setRows((data.rows || []).map(normalizeRow));
      setTotal(data.total || 0);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // filter dropdown values (loaded once)
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

  // exports ALL records matching the applied filters (not only the page on screen)
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
      className="container mt-2 wastage-report-page"
      style={{
        maxWidth: "100%",
        fontSize: "14px",
        background: "#d8f1fb",
        border: "1px solid rgba(12, 90, 130, 0.38)",
        borderRadius: "20px"
      }}
    >
      {/* ======================================================================
          🎨 MATCHING THE PRODUCTION-DASHBOARD-PAGE DESIGN SYSTEM
          ====================================================================== */}
      <style>{`
        .wastage-report-page {
          min-height: 100vh;
          padding: 18px;
          color: #08283d;
          background:
            radial-gradient(circle at top left, rgba(34, 153, 204, 0.34), transparent 32%),
            linear-gradient(135deg, #d6f1fb 0%, #edfaff 48%, #c7e9f7 100%) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .wastage-report-page .report-title {
          color: #06324d;
          letter-spacing: 0;
          font-size: 28px;
          font-weight: 800;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .wastage-report-page .card {
          border: 1px solid rgba(20, 111, 156, 0.42) !important;
          border-radius: 12px !important;
          background: rgba(221, 243, 252, 0.94) !important;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22) !important;
        }

        .wastage-report-page h5,
        .wastage-report-page h6 {
          color: #062b42 !important;
          font-weight: 800;
          padding: 8px 0;
        }

        .wastage-report-page .form-label,
        .wastage-report-page small {
          color: #092f47 !important;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .wastage-report-page .form-control,
        .wastage-report-page .form-select {
          min-height: 38px;
          border: 1px solid rgba(14, 94, 135, 0.62) !important;
          border-radius: 8px;
          background-color: rgba(255, 255, 255, 0.98) !important;
          color: #071f31;
          font-weight: 600;
          box-shadow: inset 0 1px 2px rgba(8, 55, 83, 0.08);
        }

        .wastage-report-page .form-control:focus,
        .wastage-report-page .form-select:focus {
          border-color: #087fb5 !important;
          box-shadow: 0 0 0 3px rgba(8, 127, 181, 0.22) !important;
        }

        .wastage-report-page .btn {
          border: 0;
          border-radius: 8px;
          font-weight: 700;
          min-height: 38px;
          box-shadow: 0 7px 15px rgba(10, 78, 115, 0.24);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .wastage-report-page .btn:active {
          transform: translateY(2px);
          box-shadow: 0 2px 6px rgba(10, 78, 115, 0.2);
        }

        .wastage-report-page .btn-primary {
          background: linear-gradient(135deg, #0877ad, #16a4dc) !important;
          color: #ffffff !important;
        }

        .wastage-report-page .btn-success {
          background: linear-gradient(135deg, #087f68, #18aa91) !important;
          color: #ffffff !important;
        }

        .wastage-report-page .btn-secondary {
          background: linear-gradient(135deg, #405f76, #6f91a6) !important;
          color: #ffffff !important;
        }

        .wastage-report-page .card-header {
          border: 0;
          border-radius: 12px 12px 0 0 !important;
          background: linear-gradient(135deg, #075f90, #119bd2) !important;
          color: #ffffff;
          padding: 12px 16px;
        }

        .wastage-report-page .table-responsive {
          background: #d5edf8 !important;
          border-radius: 0 0 12px 12px;
        }

        .wastage-report-page table {
          color: #09283d;
          background: #ffffff;
        }

        .wastage-report-page thead th {
          background: #064c73 !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.28) !important;
          font-size: 13px;
          vertical-align: middle;
          white-space: nowrap;
          text-align: center;
        }

        .wastage-report-page tbody td {
          border-color: rgba(20, 93, 130, 0.28) !important;
          vertical-align: middle;
          text-align: center;
          font-weight: 500;
        }

        .wastage-report-page tbody tr:hover td {
          background: #d9f2fc !important;
        }

        /* 3D Visual Accents & Badges */
        .report-header-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 20px;
        }

        .filter-header-title {
          font-size: 16px;
          font-weight: 800;
          color: #06324d;
          margin: 0;
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

        .cell-expandable {
          cursor: pointer;
          color: #0877ad;
          font-weight: 600;
          text-decoration: underline dotted;
        }

        .cell-expandable:hover {
          color: #064c73;
        }

        .reel-badge-pill {
          background: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 700;
        }

        .wastage-report-page .pager-bar {
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
        .wastage-report-page .pager-info {
          font-size: 12.5px;
          font-weight: 700;
          color: #092f47;
        }
        .wastage-report-page .pager-btns {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .wastage-report-page .pager-btns .btn {
          min-height: 30px;
          padding: 3px 10px;
          box-shadow: none;
        }
        .wastage-report-page .pager-btns .btn:disabled {
          opacity: 0.45;
        }
        .wastage-report-page .pager-page {
          font-size: 12.5px;
          font-weight: 800;
          color: #064c73;
          padding: 0 6px;
        }
        .wastage-report-page .pager-size {
          width: auto;
          min-height: 30px;
        }

        @media (max-width: 768px) {
          .wastage-report-page {
            padding: 12px;
            border-radius: 14px !important;
          }

          .wastage-report-page .report-title {
            font-size: 23px;
          }

          .report-header-box {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>

      {/* HEADER WITH CENTERED TITLE & RIGHT-ALIGNED BUTTON */}
      <div className="position-relative text-center mt-2 mb-4">
        <h1 className="report-title m-0">
          <b>Wastage Report</b>
        </h1>

        {userRole !== "PLANNER" && (
          <div className="position-absolute top-50 end-0 translate-middle-y">
            <button
              className="btn btn-success px-4"
              onClick={exportExcel}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        )}
      </div>

      {/* FILTERS CARD */}
      <div className="card shadow-lg p-3 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="filter-header-title">Filters</h5>
          <span className="count-pill">
            {loading
              ? "Loading..."
              : `Showing ${total.toLocaleString("en-IN")} of ${totalCount.toLocaleString("en-IN")} Records`}
          </span>
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
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Wastage Report Records</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "70vh", overflowY: "auto" }}
        >
          <table
            className="table table-striped table-bordered table-hover mb-0 align-middle small"
            style={{ minWidth: "1400px" }}
          >
            <thead className="table-dark sticky-top">
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
                        className={`badge ${
                          item.productionType === "Make Ready"
                            ? "bg-warning text-dark"
                            : "bg-info text-dark"
                        }`}
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

        {/* paging appears once filters are applied (the default view is just the latest 30) */}
        {!latestMode && <PagerBar pg={pg} />}
      </div>
    </div>
  );
}