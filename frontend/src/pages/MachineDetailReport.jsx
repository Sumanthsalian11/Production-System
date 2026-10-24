import { useEffect, useMemo, useState, Fragment } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import BASE_URL from "../config/api";

const getTimeDiff = (from, to) => {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const f = fh * 60 + fm;
  let t = th * 60 + tm;
  if (t <= f) t += 24 * 60;
  return t - f;
};
const joinUnique = (arr) => [...new Set((arr || []).filter(Boolean))].join(", ");
const normStatus = (s) => String(s || "").trim().toLowerCase();
const isProdStatus = (k) => k === "production" || k === "working";
const fmtHMS = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:00`;
const formatTime = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const fmtD = (v) => (v ? new Date(v).toLocaleDateString("en-IN") : "-");
const DETAIL_PAGE_SIZE = 50;

function MachineDetailReport({ initial, machines, machineStatuses, customers, locations, onBack }) {
  const token = localStorage.getItem("token");
  const [machine, setMachine] = useState(initial.machine || "");
  const [fromDate, setFromDate] = useState(initial.fromDate || "");
  const [toDate, setToDate] = useState(initial.toDate || "");
  const [wo, setWo] = useState(initial.wo || "");
  const [customer, setCustomer] = useState(initial.customer || "");
  const [location, setLocation] = useState(initial.location || "");
  const [debouncedWo, setDebouncedWo] = useState(wo);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---------- Detail Records ----------
  const [detailRows, setDetailRows] = useState([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setDetailPage(1);
  }, [machine, fromDate, toDate, debouncedWo, customer, location]);

  useEffect(() => {
    let live = true;
    setDetailLoading(true);
    axios
      .get(`${BASE_URL}/api/production-real`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
          workOrder: debouncedWo || undefined,
          customer: customer || undefined,
          machine: machine || undefined,
          location: location || undefined,
          limit: DETAIL_PAGE_SIZE,
          page: detailPage,
          withCount: 1
        }
      })
      .then((r) => {
        if (!live) return;
        const list = Array.isArray(r.data) ? r.data : r.data.data || [];
        setDetailRows(list);
        setDetailTotal(Array.isArray(r.data) ? list.length : r.data.total || 0);
      })
      .catch((e) => console.error("Error fetching detail records:", e))
      .finally(() => live && setDetailLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine, fromDate, toDate, debouncedWo, customer, location, detailPage]);

  const detailTotalPages = Math.max(1, Math.ceil(detailTotal / DETAIL_PAGE_SIZE));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedWo(wo), 300);
    return () => clearTimeout(t);
  }, [wo]);

  useEffect(() => {
    if (!machine) {
      setRows([]);
      return;
    }
    let live = true;
    setLoading(true);
    axios
      .get(`${BASE_URL}/api/production-real`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
          workOrder: debouncedWo || undefined,
          customer: customer || undefined,
          machine,
          location: location || undefined
        }
      })
      .then((r) => live && setRows(Array.isArray(r.data) ? r.data : r.data.data || []))
      .catch((e) => console.error("Error fetching machine detail:", e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine, fromDate, toDate, debouncedWo, customer, location]);

  // every status in the master except Production/Working gets its own column
  const statusCols = useMemo(() => {
    const seen = new Map();
    machineStatuses.forEach((s) => {
      const k = normStatus(s.statusName);
      if (k && !isProdStatus(k) && !seen.has(k)) seen.set(k, String(s.statusName).trim());
    });
    return [...seen].map(([key, label]) => ({ key, label }));
  }, [machineStatuses]);

  // one From/To/Total group per status in the Machine Status master
  const detailStatusColumns = useMemo(() => {
    const seen = new Map();
    machineStatuses.forEach((s) => {
      const k = normStatus(s.statusName);
      if (k && !seen.has(k)) seen.set(k, String(s.statusName).trim());
    });
    return [...seen].map(([key, label]) => ({ key, label }));
  }, [machineStatuses]);

  const detailTotals = useMemo(() => {
    const t = { qty: 0, waste: 0, all: 0, status: {} };
    detailRows.forEach((r) => {
      const mins = getTimeDiff(r.productionFromTime, r.productionToTime);
      t.qty += Number(r.productionQty) || 0;
      t.waste += Number(r.wastageQty) || 0;
      t.all += mins;
      const k = normStatus(r.machineStatus);
      t.status[k] = (t.status[k] || 0) + mins;
    });
    return t;
  }, [detailRows]);

  // merge rows with the same Date + WO + Shift + Activity + Machine + Customer + Product Type
  const groupedRows = useMemo(() => {
    const map = new Map();
    detailRows.forEach((r) => {
      const activity = joinUnique((r.machiness || []).map((p) => p.activityId?.activityName));
      const mach = joinUnique((r.machiness || []).map((p) => p.machineId?.machineName));
      const dateKey = String(r.productionDate || "").split("T")[0];
      const key = [dateKey, r.workOrder, r.shift || "", activity, mach, (r.customerName || "").trim(), r.productType || ""].join("||");

      let g = map.get(key);
      if (!g) {
        g = {
          key,
          productionDate: r.productionDate,
          workOrder: r.workOrder,
          activity,
          machine: mach,
          customerName: r.customerName,
          productType: r.productType,
          shifts: [],
          remarks: [],
          productionQty: 0,
          wastageQty: 0,
          totalMins: 0,
          status: {}
        };
        map.set(key, g);
      }

      const mins = getTimeDiff(r.productionFromTime, r.productionToTime);
      g.productionQty += Number(r.productionQty) || 0;
      g.wastageQty += Number(r.wastageQty) || 0;
      g.totalMins += mins;
      g.shifts.push(r.shift);
      g.remarks.push(r.remarks);

      const k = normStatus(r.machineStatus);
      const s = g.status[k] || (g.status[k] = { from: [], to: [], mins: 0 });
      if (r.productionFromTime) s.from.push(r.productionFromTime);
      if (r.productionToTime) s.to.push(r.productionToTime);
      s.mins += mins;
    });
    return [...map.values()];
  }, [detailRows]);

  const report = useMemo(() => {
    const days = new Map();
    const totals = { day: 0, night: 0, prodMins: 0, status: {} };

    rows.forEach((r) => {
      const dateKey = String(r.productionDate || "").split("T")[0];
      let d = days.get(dateKey);
      if (!d) {
        d = { dateKey, day: 0, night: 0, prodMins: 0, status: {}, remarks: [] };
        days.set(dateKey, d);
      }

      const mins = getTimeDiff(r.productionFromTime, r.productionToTime);
      const k = normStatus(r.machineStatus);

      if (isProdStatus(k)) {
        const imp = Number(r.productionImpression) || 0;
        if (String(r.shift || "").toLowerCase() === "night") {
          d.night += imp;
          totals.night += imp;
        } else {
          d.day += imp;
          totals.day += imp;
        }
        d.prodMins += mins;
        totals.prodMins += mins;
      } else if (k) {
        d.status[k] = (d.status[k] || 0) + mins;
        totals.status[k] = (totals.status[k] || 0) + mins;
      }

      if (r.remarks && String(r.remarks).trim()) d.remarks.push(String(r.remarks).trim());
    });

    const list = [...days.values()]
      .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1))
      .map((d) => ({ ...d, remarks: joinUnique(d.remarks) }));

    return { list, totals };
  }, [rows]);

  return (
    <div className="container md-page" style={{ maxWidth: "100%", fontSize: 14, background: "#fff", padding: 18, minHeight: "100vh" }}>
      <style>{`
        .md-page .card{border:1px solid rgba(20,111,156,.42)!important;border-radius:12px!important;background:rgba(221,243,252,.94)!important;box-shadow:0 12px 28px rgba(14,86,122,.22)!important}
        .md-page .card-header{border:0;border-radius:12px 12px 0 0!important;background:#a9dcf3!important;color:#06324d!important;padding:12px 16px}
        .md-page .form-label{color:#092f47;font-weight:700;margin-bottom:5px}
        .md-page .form-control,.md-page .form-select{min-height:38px;border:1px solid rgba(14,94,135,.62)!important;border-radius:8px;font-weight:600}
        .md-page .btn{border:0;border-radius:8px;font-weight:700;min-height:38px}
        .md-page .btn-primary{background:linear-gradient(135deg,#0877ad,#16a4dc)!important;color:#fff!important}
        .md-page .table-responsive{background:#fff!important;border-radius:0 0 12px 12px}
        .md-page thead th{background:#bfe6f8!important;color:#06324d!important;border-color:rgba(20,111,156,.25)!important;font-size:13px;vertical-align:middle;white-space:nowrap;text-align:center}
        .md-page thead th.dt-group{background:#a9dcf3!important}
        .md-page tbody td{border-color:rgba(20,93,130,.28)!important;vertical-align:middle;text-align:center;font-weight:500}
        .md-page td.left{text-align:left}
        .md-page td.mono{font-variant-numeric:tabular-nums}
        .md-page tfoot td{background:#c9f7c9!important;color:#000;font-weight:800;text-align:center}
      `}</style>

      <div className="card shadow-lg p-3 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="m-0" style={{ color: "#06324d", fontWeight: 800 }}>Machine Detail</h5>
          <button className="btn btn-primary px-4" onClick={onBack}>← Back to Production Report</button>
        </div>

        <div className="row g-2">
          <div className="col-md-2">
            <label className="form-label">Machine</label>
            <select className="form-select" value={machine} onChange={(e) => setMachine(e.target.value)}>
              <option value="">Select Machine</option>
              {machines.map((m) => (
                <option key={m._id} value={m.machineName}>{m.machineName}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">From Date</label>
            <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">To Date</label>
            <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">WO Number</label>
            <input type="text" className="form-control" placeholder="Search WO" value={wo} onChange={(e) => setWo(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Customer Name</label>
            <select className="form-select" value={customer} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">All Customers</option>
              {customers.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">User Location</label>
            <select className="form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All Locations</option>
              {locations.map((l, i) => (
                <option key={i} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Machine Daily Report{machine ? ` - ${machine}` : ""}</strong>
        </div>

        <div className="table-responsive" style={{ maxHeight: "75vh", overflow: "auto" }}>
          {!machine ? (
            <div className="p-4 text-center fw-bold">Select a machine to view its daily report</div>
          ) : loading ? (
            <div className="p-4 text-center fw-bold">Loading…</div>
          ) : report.list.length === 0 ? (
            <div className="p-4 text-center fw-bold">No records for selected filters</div>
          ) : (
            <table className="table table-bordered table-hover mb-0 align-middle" style={{ whiteSpace: "nowrap" }}>
              <thead className="sticky-top">
                <tr>
                  <th rowSpan={2}>Date</th>
                  <th colSpan={3} className="dt-group">Production</th>
                  <th rowSpan={2}>Total PRODUCTION TIME</th>
                  {statusCols.map((s) => (
                    <th key={s.key} rowSpan={2}>Total {s.label.toUpperCase()} TIME</th>
                  ))}
                  <th rowSpan={2}>Remarks</th>
                </tr>
                <tr>
                  <th className="dt-group">Day</th>
                  <th className="dt-group">Night</th>
                  <th className="dt-group">Total</th>
                </tr>
              </thead>

              <tbody>
                {report.list.map((d) => (
                  <tr key={d.dateKey}>
                    <td className="mono">{d.dateKey.split("-").reverse().join("-")}</td>
                    <td className="mono">{d.day ? d.day.toLocaleString("en-IN") : ""}</td>
                    <td className="mono">{d.night ? d.night.toLocaleString("en-IN") : ""}</td>
                    <td className="mono">{(d.day + d.night).toLocaleString("en-IN")}</td>
                    <td className="mono">{fmtHMS(d.prodMins)}</td>
                    {statusCols.map((s) => (
                      <td key={s.key} className="mono">{fmtHMS(d.status[s.key] || 0)}</td>
                    ))}
                    <td className="left" style={{ whiteSpace: "normal", fontSize: 12 }}>{d.remarks}</td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td>Grand Total</td>
                  <td>{report.totals.day.toLocaleString("en-IN")}</td>
                  <td>{report.totals.night.toLocaleString("en-IN")}</td>
                  <td>{(report.totals.day + report.totals.night).toLocaleString("en-IN")}</td>
                  <td>{fmtHMS(report.totals.prodMins)}</td>
                  {statusCols.map((s) => (
                    <td key={s.key}>{fmtHMS(report.totals.status[s.key] || 0)}</td>
                  ))}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Detail Records</strong>
          <span className="ms-2 small">({detailTotal.toLocaleString("en-IN")} records)</span>
        </div>

        <div className="table-responsive" style={{ maxHeight: "480px", overflow: "auto" }}>
          {detailLoading ? (
            <div className="p-4 text-center fw-bold">Loading…</div>
          ) : detailRows.length === 0 ? (
            <div className="p-4 text-center fw-bold">No records for selected filters</div>
          ) : (
            <table className="table table-bordered table-hover mb-0 align-middle" style={{ whiteSpace: "nowrap" }}>
              <thead className="sticky-top">
                <tr>
                  <th rowSpan={2}>#</th>
                  <th rowSpan={2}>Date</th>
                  <th rowSpan={2}>WO No.</th>
                  <th rowSpan={2}>Shift</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Activity</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Machine</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Customer</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Product Type</th>
                  <th rowSpan={2}>Production Qty</th>
                  <th rowSpan={2}>Wastage</th>
                  {detailStatusColumns.map((s) => (
                    <th key={s.key} colSpan={3} className="dt-group">{s.label.toUpperCase()}</th>
                  ))}
                  <th rowSpan={2}>Remarks</th>
                  <th rowSpan={2}>Grand Total</th>
                </tr>
                <tr>
                  {detailStatusColumns.map((s) => (
                    <Fragment key={s.key}>
                      <th className="dt-group">FROM</th>
                      <th className="dt-group">TO</th>
                      <th className="dt-group">TOTAL</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {groupedRows.map((g, i) => {
                  const dash = <span style={{ color: "#94a3b8" }}>—</span>;
                  return (
                    <tr key={g.key}>
                      <td>{i + 1}</td>
                      <td className="mono">{fmtD(g.productionDate)}</td>
                      <td className="mono">{g.workOrder || dash}</td>
                      <td>{joinUnique(g.shifts) || dash}</td>
                      <td className="left">{g.activity || dash}</td>
                      <td className="left">{g.machine || dash}</td>
                      <td className="left">{g.customerName || dash}</td>
                      <td className="left">{g.productType || dash}</td>
                      <td className="mono">{g.productionQty.toLocaleString("en-IN")}</td>
                      <td className="mono">{g.wastageQty.toLocaleString("en-IN")}</td>

                      {detailStatusColumns.map((s) => {
                        const c = g.status[s.key];
                        return (
                          <Fragment key={s.key}>
                            <td className="mono">{c?.from.length ? c.from.join(", ") : dash}</td>
                            <td className="mono">{c?.to.length ? c.to.join(", ") : dash}</td>
                            <td className="mono">{c?.mins ? formatTime(c.mins) : dash}</td>
                          </Fragment>
                        );
                      })}

                      <td className="left" style={{ maxWidth: 160, whiteSpace: "normal", fontSize: 11 }}>
                        {joinUnique(g.remarks) || dash}
                      </td>
                      <td className="mono">{formatTime(g.totalMins)}</td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr>
                  <td colSpan={8} style={{ textAlign: "right" }}>PAGE TOTAL</td>
                  <td>{detailTotals.qty.toLocaleString("en-IN")}</td>
                  <td>{detailTotals.waste.toLocaleString("en-IN")}</td>
                  {detailStatusColumns.map((s) => (
                    <Fragment key={s.key}>
                      <td>—</td>
                      <td>—</td>
                      <td>{formatTime(detailTotals.status[s.key] || 0)}</td>
                    </Fragment>
                  ))}
                  <td>—</td>
                  <td>{formatTime(detailTotals.all)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-center p-2">
          <small>
            Page {detailPage} of {detailTotalPages}
          </small>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-primary" disabled={detailPage <= 1} onClick={() => setDetailPage((p) => p - 1)}>
              Prev
            </button>
            <button className="btn btn-sm btn-primary" disabled={detailPage >= detailTotalPages} onClick={() => setDetailPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MachineDetailReport;