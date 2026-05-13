import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import BASE_URL from "../config/api";

export default function SummaryReport() {
  const [records, setRecords] = useState([]);       // ALL records from DB
  const [filtered, setFiltered] = useState([]);     // what tables render from
  const [isFiltered, setIsFiltered] = useState(false); // track if filter is active
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [millFilter, setMillFilter] = useState("");
  const [gsmFilter, setGsmFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [woFilter, setWoFilter] = useState("");
  const [woOptions, setWoOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [millOptions, setMillOptions] = useState([]);
  const [gsmOptions, setGsmOptions] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setUserRole(decoded.role);
    }
  }, []);

  // ✅ GROUP BY WORK ORDER
  const groupedWO = Object.values(
    filtered.reduce((acc, item) => {
      const key = item.efiWoNumber || "Unknown";

      if (!acc[key]) {
        acc[key] = {
          efiWoNumber: key,
          plannedQty: 0,
          output: 0,
          achievedQty: 0
        };
      }

      const output = Number(item.productionOutput || 0);
      const ups = Number(item.ups || 0);
      const achieved = output * ups;

      acc[key].plannedQty = Number(item.plannedQty || 0);
      acc[key].output += output;
      acc[key].achievedQty += achieved;

      return acc;
    }, {})
  );

  const normalizeGroup = (name) => {
    if (!name) return "";
    name = name.trim();

    if (name.startsWith("Non Surface Sized"))
      return "Non Surface Sized Maplit";

    if (name === "Parachment Paper")
      return "Parchment Paper";

    return name;
  };

  // LOAD DATA
  const loadData = async () => {
    try {
      const token = localStorage.getItem("token");

      // 1️⃣ Fetch Production
      const productionRes = await axios.get(
        `${BASE_URL}/api/production`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 2️⃣ Fetch Planner (WorkOrders)
      const plannerRes = await axios.get(
        `${BASE_URL}/api/workorders`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const productionData = productionRes.data || [];
      const plannerData = plannerRes.data || [];

      // 3️⃣ Map Production + Planned Qty
      const normalized = productionData.map(item => {
        const matchedWO = plannerData.find(
          wo => String(wo.efiWoNumber) === String(item.efiWoNumber)
        );

        const materials = item.materials || [];

        const groups = materials
          .map(m => normalizeGroup(m.materialGroupDescription))
          .filter(Boolean);

        const gsms = materials
          .map(m => String(m.gsm))
          .filter(Boolean);

        return {
          ...item,
          plannedQty: Number(matchedWO?.qtyInLvs) || 0,
          achievedQty:
            Number(item.productionOutput || 0) *
            Number(item.ups || 0),
          materialGroupDescription: groups.join(", "),
          mill: item.mill?.trim() || "",
          gsm: gsms.join(", "),
          groups,
          gsms,
          mills: item.mill ? [item.mill.trim()] : []
        };
      });

      setWoOptions([
        ...new Set(normalized.map(r => r.efiWoNumber).filter(Boolean))
      ].sort());

      setLocationOptions([
        ...new Set(
          normalized
            .flatMap(r => r.userLocations || [])
            .filter(Boolean)
        )
      ]);

      setGroupOptions([...new Set(normalized.flatMap(r => r.groups))].sort());
      setMillOptions([...new Set(normalized.flatMap(r => r.mills))].sort());
      setGsmOptions([...new Set(normalized.flatMap(r => r.gsms))].sort());

      // ✅ Store ALL records in full (used when filters are applied)
      const allSorted = normalized.sort(
        (a, b) => new Date(b.productionDate) - new Date(a.productionDate)
      );

      setRecords(allSorted);
      // Default view: only latest 20 records
      setFiltered(allSorted.slice(0, 20));
      setIsFiltered(false);

    } catch (error) {
      console.error("Error loading summary report:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const applyFilter = () => {
    // ✅ Filter across ALL records in DB, not just the default 20
    let result = records.filter(r => {
      if (woFilter && String(r.efiWoNumber) !== String(woFilter)) return false;
if (fromDate || toDate) {
  const recordDate = new Date(r.productionDate);

  if (fromDate && recordDate < new Date(fromDate))
    return false;

  if (toDate) {
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    if (recordDate > endDate)
      return false;
  }
}
      if (monthFilter && !r.productionDate?.startsWith(monthFilter)) return false;
      if (millFilter && !r.mills.includes(millFilter)) return false;
      if (gsmFilter && !r.gsms.includes(gsmFilter)) return false;
      if (groupFilter && !r.groups.includes(groupFilter)) return false;
      if (typeFilter && r.productionType !== typeFilter) return false;
      if (locationFilter && !r.userLocations?.includes(locationFilter)) return false;
      return true;
    });

    result = result.sort(
      (a, b) => new Date(b.productionDate) - new Date(a.productionDate)
    );

    setFiltered(result);
    setIsFiltered(true); // show all matched results, no 20-limit
  };

  const clearFilter = () => {
   setFromDate("");
setToDate("");
    setMonthFilter("");
    setGroupFilter("");
    setMillFilter("");
    setGsmFilter("");
    setTypeFilter("");
    setLocationFilter("");
    setWoFilter("");
    // ✅ Back to default: latest 20 only
    setFiltered(records.slice(0, 20));
    setIsFiltered(false);
  };

  const wastePercent = (waste, weight) =>
    weight > 0 ? ((waste / weight) * 100).toFixed(2) : "0.00";

  // ✅ UNIQUE CUSTOMER GROUPING
  const groupedCustomer = Object.values(
    filtered.reduce((acc, item) => {
      const key = item.customerName || "Unknown";

      if (!acc[key]) {
        acc[key] = {
          customerName: key,
          weight: 0,
          waste: 0
        };
      }

      acc[key].weight += Number(item.actualNetWeight || 0);
      acc[key].waste += Number(item.totalWaste || 0);

      return acc;
    }, {})
  );

  // ✅ WORK ORDER SUMMARY
  const groupedWorkOrder = Object.values(
    filtered.reduce((acc, item) => {
      const key = item.efiWoNumber || "Unknown";

      if (!acc[key]) {
        acc[key] = {
          workOrder: key,
          customer: item.customerName || "Unknown",
          weight: 0,
          waste: 0
        };
      }

      acc[key].weight += Number(item.actualNetWeight || 0);
      acc[key].waste += Number(item.totalWaste || 0);

      return acc;
    }, {})
  );

  // ✅ UNIQUE MILL GROUPING
  const groupedMill = Object.values(
    filtered.reduce((acc, item) => {
      const key = item.mill || "Unknown";

      if (!acc[key]) {
        acc[key] = {
          mill: key,
          weight: 0,
          waste: 0
        };
      }

      acc[key].weight += Number(item.actualNetWeight || 0);
      acc[key].waste += Number(item.totalWaste || 0);

      return acc;
    }, {})
  );

  // TOTALS
  const customerTotal = groupedCustomer.reduce(
    (acc, item) => {
      acc.weight += item.weight;
      acc.waste += item.waste;
      return acc;
    },
    { weight: 0, waste: 0 }
  );

  const millTotal = groupedMill.reduce(
    (acc, item) => {
      acc.weight += item.weight;
      acc.waste += item.waste;
      return acc;
    },
    { weight: 0, waste: 0 }
  );

  // ✅ PLANNED VS ACHIEVED GROUPING
  const groupedProduction = Object.values(
    filtered.reduce((acc, item) => {
      const key = item.customerName || "Unknown";

      if (!acc[key]) {
        acc[key] = {
          customerName: key,
          planned: 0,
          achieved: 0
        };
      }

      acc[key].planned += Number(item.plannedQty || 0);
      acc[key].achieved += Number(item.achievedQty || 0);

      return acc;
    }, {})
  );

  const workOrderTotal = groupedWorkOrder.reduce(
    (acc, item) => {
      acc.weight += item.weight;
      acc.waste += item.waste;
      return acc;
    },
    { weight: 0, waste: 0 }
  );

  const productionTotal = groupedProduction.reduce(
    (acc, item) => {
      acc.planned += item.planned;
      acc.achieved += item.achieved;
      return acc;
    },
    { planned: 0, achieved: 0 }
  );

  // EXPORT EXCEL
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // ================= SHEET 1: SUMMARY =================
    const rows = [];

    rows.push(["--- CUSTOMER SUMMARY ---"]);
    rows.push(["Customer", "Actual Net Weight", "Total Waste", "Waste %"]);

    groupedCustomer.forEach(item => {
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

    rows.push([]);
    rows.push(["--- MILL SUMMARY ---"]);
    rows.push(["Mill", "Actual Net Weight", "Total Waste", "Waste %"]);

    groupedMill.forEach(item => {
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

    rows.push([]);
    rows.push(["--- WORK ORDER SUMMARY ---"]);
    rows.push(["Work Order", "Actual Net Weight", "Total Waste", "Waste %"]);

    groupedWorkOrder.forEach(item => {
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
    woRows.push(["Work Order", "Planned Qty", "Output", "Achieved Qty", "Difference"]);

    groupedWO.forEach(item => {
      woRows.push([
        item.efiWoNumber,
        item.plannedQty,
        item.output,
        item.achievedQty,
        item.achievedQty - item.plannedQty
      ]);
    });

    const totalOutput = groupedWO.reduce((sum, i) => sum + i.output, 0);
    const totalAchieved = groupedWO.reduce((sum, i) => sum + i.achievedQty, 0);
    const totalPlanned = groupedWO.reduce((sum, i) => sum + i.plannedQty, 0);

    woRows.push([
      "TOTAL",
      totalPlanned,
      totalOutput,
      totalAchieved,
      totalAchieved - totalPlanned
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet(woRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Planned_vs_Achieved");

    const file = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([file]), "Reel_Summary.xlsx");
  };

  return (
    <div className="container my-3" style={{ border: "2px solid black", borderRadius: "20px", maxWidth: "1150px", background: "linear-gradient(135deg,#20bdd81d,#f2fbfb)" }}>

      {/* HEADER */}
      <div className="position-relative text-center mb-">
        <h1 className="fw-bold text-black m-4">Reel Summary Report</h1>

        {userRole !== "PLANNER" && (
          <div className="position-absolute top-0 end-0">
            <button className="btn btn-success" onClick={exportExcel}>
              Export Excel
            </button>
          </div>
        )}

        {/* FILTER BAR */}
        <div
          className="row g-0 mb-5 row-cols-1 row-cols-md-1 row-cols-lg-6 p-3"
          style={{
            background: "#33bbb445",
            borderRadius: "10px",
            border: "2px solid black",
            boxShadow: "0 4px 10px",
          }}
        >
          <div className="col-md-2">
            <label className="form-label text-black">Work Order</label>
            <input
              type="text"
              className="form-control border-dark"
              placeholder="Search WO..."
              value={woFilter}
              onChange={(e) => setWoFilter(e.target.value)}
            />
          </div>
<div className="col-md-2">
  <label className="form-label text-black">From Date</label>
  <input
    type="date"
    className="form-control border-dark"
    value={fromDate}
    onChange={(e) => setFromDate(e.target.value)}
  />
</div>

<div className="col-md-2">
  <label className="form-label text-black">To Date</label>
  <input
    type="date"
    className="form-control border-dark"
    value={toDate}
    onChange={(e) => setToDate(e.target.value)}
  />
</div>

          <div className="col-md-2">
            <label className="form-label text-black">Month</label>
            <input
              type="month"
              className="form-control border-dark"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label text-black">Material Group</label>
            <select
              className="form-select border-dark"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="">All</option>
              {groupOptions.map((grp, i) => (
                <option key={i}>{grp}</option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label text-black">Mill</label>
            <select
              className="form-select border-dark"
              value={millFilter}
              onChange={(e) => setMillFilter(e.target.value)}
            >
              <option value="">All</option>
              {millOptions.map((m, i) => (
                <option key={i}>{m}</option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label text-black">GSM</label>
            <select
              className="form-select border-dark"
              value={gsmFilter}
              onChange={(e) => setGsmFilter(e.target.value)}
            >
              <option value="">All</option>
              {gsmOptions.map((g, i) => (
                <option key={i}>{g}</option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label text-black">User Location</label>
            <select
              className="form-select border-dark"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All</option>
              {locationOptions.map((loc, i) => (
                <option key={i} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label text-black">Production Type</label>
            <select
              className="form-select border-dark"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="Make Ready">Make Ready</option>
              <option value="Production">Production</option>
            </select>
          </div>

          {/* APPLY BUTTON */}
          <div className="col-md-2 d-flex align-items-end">
            <button className="btn btn-success w-100" onClick={applyFilter}>
              Apply
            </button>
          </div>

          {/* CLEAR BUTTON */}
          <div className="col-md-2 d-flex align-items-end">
            <button className="btn btn-secondary w-100" onClick={clearFilter}>
              Clear
            </button>
          </div>
        </div>

        {/* SUMMARY TABLES */}
        <div className="d-flex flex-nowrap gap-4">

          {/* CUSTOMER SUMMARY */}
          <div className="w-50">
            <div className="card shadow-lg h-100" style={{ border: "1px solid black", background: "#ffffff" }}>
              <div className="card-header text-black text-center fw-semibold" style={{ backgroundColor: "#4cbae5" }}>
                <b>Customer Summary</b>
              </div>
              <div className="table-responsive bg-white" style={{ maxHeight: "350px", overflowY: "auto" }}>
                <table className="table table-bordered border-dark table-hover text-center mb-0 align-middle">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th>Customer</th>
                      <th>Actual Net Weight</th>
                      <th>Total Waste</th>
                      <th>Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedCustomer.sort((a, b) => b.weight - a.weight).slice(0, 15).map((item, i) => (
                      <tr key={i}>
                        <td>{item.customerName}</td>
                        <td>{item.weight.toFixed(2)}</td>
                        <td>{item.waste.toFixed(2)}</td>
                        <td>{wastePercent(item.waste, item.weight)}%</td>
                      </tr>
                    ))}
                    <tr className="fw-bold table-primary">
                      <td>TOTAL</td>
                      <td>{customerTotal.weight.toFixed(2)}</td>
                      <td>{customerTotal.waste.toFixed(2)}</td>
                      <td>{wastePercent(customerTotal.waste, customerTotal.weight)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* MILL SUMMARY */}
          <div className="w-50">
            <div className="card shadow-lg h-100" style={{ border: "1px solid black", background: "#ffffff" }}>
              <div className="card-header text-black text-center fw-semibold" style={{ backgroundColor: "#4cbae5" }}>
                <b>Mill Summary</b>
              </div>
              <div className="table-responsive bg-white" style={{ maxHeight: "350px", overflowY: "auto" }}>
                <table className="table table-bordered border-dark table-hover text-center mb-0 align-middle">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th>Mill</th>
                      <th>Actual Net Weight</th>
                      <th>Total Waste</th>
                      <th>Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedMill.sort((a, b) => b.weight - a.weight).slice(0, 15).map((item, i) => (
                      <tr key={i}>
                        <td>{item.mill}</td>
                        <td>{item.weight.toFixed(2)}</td>
                        <td>{item.waste.toFixed(2)}</td>
                        <td>{wastePercent(item.waste, item.weight)}%</td>
                      </tr>
                    ))}
                    <tr className="fw-bold table-success">
                      <td>TOTAL</td>
                      <td>{millTotal.weight.toFixed(2)}</td>
                      <td>{millTotal.waste.toFixed(2)}</td>
                      <td>{wastePercent(millTotal.waste, millTotal.weight)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* WORK ORDER SUMMARY */}
        <div className="w-100 mt-5">
          <div className="card shadow-lg h-100" style={{ border: "1px solid black", background: "#ffffff" }}>
            <div className="card-header text-black text-center fw-semibold" style={{ backgroundColor: "#4cbae5" }}>
              <b>Work Order Summary</b>
            </div>
            <div className="table-responsive bg-white" style={{ maxHeight: "350px", overflowY: "auto" }}>
              <table className="table table-bordered border-dark table-hover text-center mb-0 align-middle">
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
                  {groupedWorkOrder
                    .sort((a, b) => b.workOrder - a.workOrder)
                    .slice(0, 15)
                    .map((item, i) => (
                      <tr key={i}>
                        <td>{item.workOrder}</td>
                        <td>{item.customer}</td>
                        <td>{item.weight.toFixed(2)}</td>
                        <td>{item.waste.toFixed(2)}</td>
                        <td>{wastePercent(item.waste, item.weight)}%</td>
                      </tr>
                    ))}
                  <tr className="fw-bold table-primary">
                    <td>TOTAL</td>
                    <td>--</td>
                    <td>{workOrderTotal.weight.toFixed(2)}</td>
                    <td>{workOrderTotal.waste.toFixed(2)}</td>
                    <td>{wastePercent(workOrderTotal.waste, workOrderTotal.weight)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PLANNED VS ACHIEVED */}
        <div className="mt-5">
          <div className="card shadow-lg" style={{ border: "1px solid black" }}>
            <div className="card-body p-0">
              <div className="table-responsive bg-white" style={{ maxHeight: "350px", overflowY: "auto" }}>
                <table className="table table-bordered border-dark table-hover text-center mb-0 align-middle">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th colSpan="5" className="fs-4 fw-bold" style={{ backgroundColor: "#4cbae5", color: "black" }}>
                        Planned V/s Achieved Qty
                      </th>
                    </tr>
                    <tr className="table-dark">
                      <th>Work order</th>
                      <th>Planned Qty</th>
                      <th>Output</th>
                      <th>Achieved Qty</th>
                      <th>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedWO.slice(0, 15).map((item, i) => (
                      <tr key={i}>
                        <td>{item.efiWoNumber}</td>
                        <td>{item.plannedQty.toLocaleString("en-IN")}</td>
                        <td>{item.output.toLocaleString("en-IN")}</td>
                        <td>{item.achievedQty.toLocaleString("en-IN")}</td>
                        <td>{(item.achievedQty - item.plannedQty).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                    <tr className="fw-bold table-primary" style={{ backgroundColor: "#dee2e6", borderTop: "3px solid #6c757d" }}>
                      <td>Grand Total</td>
                      <td></td>
                      <td>{groupedWO.reduce((sum, item) => sum + item.output, 0).toLocaleString()}</td>
                      <td>{groupedWO.reduce((sum, item) => sum + item.achievedQty, 0).toLocaleString()}</td>
                      <td>
                        {(
                          groupedWO.reduce((sum, item) => sum + item.achievedQty, 0) -
                          groupedWO.reduce((sum, item) => sum + item.plannedQty, 0)
                        ).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}