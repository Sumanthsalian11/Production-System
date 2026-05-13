import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import BASE_URL from "../config/api";

export default function WastageReport() {
  const [records, setRecords] = useState([]);
  const [filtered, setFiltered] = useState([]);
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
      const decoded = jwtDecode(token);
      setUserRole(decoded.role);
    }
  }, []);

  const normalizeGroup = (name) => {
    if (!name) return "";
    name = name.trim();

    if (name.startsWith("Non Surface Sized"))
      return "Non Surface Sized Maplit";

    if (name === "Parachment Paper")
      return "Parchment Paper";

    return name;
  };

  const loadData = async () => {
   const token = localStorage.getItem("token");

const res = await axios.get(`${BASE_URL}/api/production`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
    const data = res.data || [];

    const normalized = data
      .sort((a, b) => new Date(b.productionDate) - new Date(a.productionDate))
      .map(item => {
        const groups = [...new Set(
          (item.materials || [])
            .map(m => normalizeGroup(m.materialGroupDescription))
            .filter(Boolean)
        )];

        
        const gsms = [...new Set(
          (item.materials || [])
            .map(m => m.gsm ? String(m.gsm) : "")
            .filter(Boolean)
        )];

        return {
          ...item,
          mill: item.mill?.trim() || "",
          groups,
          gsms,
          mills: item.mill ? [item.mill.trim()] : []
        };
      });
setLocationOptions([
  ...new Set(
    normalized
      .flatMap(r => r.userLocations || [])
      .filter(Boolean)   // 🔥 REMOVE null/undefined
  )
]);
 
    setRecords(normalized);
    setFiltered(normalized.slice(0, 30));

    setCustomerOptions([...new Set(normalized.map(r => r.customerName).filter(Boolean))].sort());
    setGroupOptions([...new Set(normalized.flatMap(r => r.groups))].sort());
    setMillOptions([...new Set(normalized.flatMap(r => r.mills))].sort());
    setGsmOptions([...new Set(normalized.flatMap(r => r.gsms))].sort());
  };

  useEffect(() => { loadData(); }, []);

  const applyFilter = () => {
    const result = records.filter(r => {
      if (!r.productionDate) return false;

      const formatted = new Date(r.productionDate).toISOString().split("T")[0];

      if (woFilter && !String(r.efiWoNumber).includes(woFilter)) return false;
      if (dateFilter && formatted !== dateFilter) return false;
      if (monthFilter && !formatted.startsWith(monthFilter)) return false;
      if (millFilter && !r.mills.includes(millFilter)) return false;
      if (gsmFilter && !r.gsms.includes(gsmFilter)) return false;
      if (groupFilter && !r.groups.includes(groupFilter)) return false;
      if (customerFilter && r.customerName !== customerFilter) return false;
      if (typeFilter && r.productionType !== typeFilter) return false;
       if (fromDate && formatted < fromDate) return false;
    if (toDate && formatted > toDate) return false;
   if (
  locationFilter &&
  !r.userLocations?.includes(locationFilter)
) return false;

      return true;
    });

    setFiltered(result);
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
    setFiltered(records.slice(0, 30));
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const rows = [
      ["WASTAGE REPORT"],
      [],
      ["WO No","WO Date","Prod Date","Customer","Job","Material","Material Group","Mill","GSM","Paper Size",
       "Reel No","Production Type","Gross","Mill Net","Actual Net","Output","Matt","Print","End","Core","Total Waste","Balance","Waste %","Remarks"]
    ];

    filtered.forEach(item => {
      rows.push([
        item.efiWoNumber,
        item.date ? new Date(item.date).toLocaleDateString("en-IN") : "-",
        item.productionDate ? new Date(item.productionDate).toLocaleDateString("en-IN") : "-",
        item.customerName,
        item.jobDescription,
        item.materials?.map(m => m.materialCode).join(", "),
        item.groups?.join(", "),
        item.mill,
        item.materials?.map(m => m.gsm).join(", "),
        item.materials?.map(m => m.paperSize).join(", "),
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
        item.remarks || "-"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Wastage");

    const file = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([file]), "Wastage_Report.xlsx");
  };

    const truncateText = (text, length = 7) => {
  if (!text) return "-";
  return text.length > length ? text.substring(0, length) + "..." : text;
};


  return (
<div
  className="container-fluid px-3 px-md-4 my-3 my-md-4"
  style={{
    maxWidth: "1150px",
    background: "#20bdd81d",
    border: "2px solid #000",
    borderRadius: "20px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
  }}
>

<div className="position-relative mb-4">

  {/* Center Title */}
  <h1 className="fw-bold text-black text-center m-4">
    Wastage Report
  </h1>

  {/* Right Button */}
  {userRole !== "PLANNER" && (
    <div className="position-absolute top-0 end-0">
      <button className="btn btn-primary" onClick={exportExcel}>
        Export Excel
      </button>
    </div>
  )}

</div>

      {/* FILTERS */}
<div
  className="row g-0 mb-5 row-cols-1 row-cols-md-1 row-cols-lg-6 p-3"
  style={{
    background: "#33bbb445",
    borderRadius: "10px",
    border: "2px solid black",
    boxShadow: "0 4px 10px"
  }}>

          <div>
            <label className="form-label text-black">WO Number</label>
            <input className="form-control border-dark" value={woFilter} onChange={e=>setWoFilter(e.target.value)} />
          </div>

          <div>
            <label className="form-label text-black">Customer</label>
            <select className="form-select border-dark" value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)}>
              <option value="">All</option>
              {customerOptions.map((c,i)=><option key={i}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label text-black">Date</label>
            <input type="date" className="form-control border-dark" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
          </div>

          <div>
            <label className="form-label text-black">Month</label>
            <input type="month" className="form-control border-dark" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} />
          </div>

  <div className="col-md-3">
    <label className="form-label text-black">From Date</label>
    <input
      type="date"
      className="form-control border-dark"
      value={fromDate}
      onChange={(e) => setFromDate(e.target.value)}
    />
  </div>

  <div className="col-md-3">
    <label className="form-label text-black">To Date</label>
    <input
      type="date"
      className="form-control border-dark"
      value={toDate}
      onChange={(e) => setToDate(e.target.value)}
    />
  </div>
          <div>
            <label className="form-label text-black">Group</label>
            <select className="form-select border-dark" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}>
              <option value="">All</option>
              {groupOptions.map((g,i)=><option key={i}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label text-black">Mill</label>
            <select className="form-select border-dark" value={millFilter} onChange={e=>setMillFilter(e.target.value)}>
              <option value="">All</option>
              {millOptions.map((m,i)=><option key={i}>{m}</option>)}
            </select>
          </div>
         <div>
  <label className="form-label text-black">User Location</label>
  <select
    className="form-select border-dark"
    value={locationFilter}
    onChange={e => setLocationFilter(e.target.value)}
  >
    <option value="">All</option>
    {locationOptions.map((loc, i) => (
      <option key={i} value={loc}>
        {loc}
      </option>
    ))}
  </select>
</div>

          <div>
            <label className="form-label text-black">GSM</label>
            <select className="form-select border-dark" value={gsmFilter} onChange={e=>setGsmFilter(e.target.value)}>
              <option value="">All</option>
              {gsmOptions.map((g,i)=><option key={i}>{g}</option>)}
            </select>
          </div>
          <div>
  <label className="form-label text-black">Production Type</label>
  <select
    className="form-select border-dark"
    value={typeFilter}
    onChange={e => setTypeFilter(e.target.value)}
  >
    <option value="">All</option>
    <option value="Make Ready">Make Ready</option>
    <option value="Production">Production</option>
  </select>
</div>

          <div className="d-grid d-md-flex align-items-end gap-2">
            <button className="btn btn-success w-100" onClick={applyFilter}>Apply</button>
            <button className="btn btn-primary w-100" onClick={clearFilter}>Clear</button>
          </div>

        </div>
    

      {/* TABLE */}
      <div
  className="card shadow-lg"
  style={{
    background: "#33bbb445",
    borderRadius: "10px",
    border: "2px solid black",
    boxShadow: "0 4px 10px rgb(99, 126, 224)"
  }}>
        <div className="table-responsive" style={{maxHeight:"70vh"}}>
          <table className="table-modern table-hover align-middle text-center mb-0 small" style={{minWidth:"1400px"}}>
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
              {filtered.length === 0 ? (
                <tr><td colSpan="21">No records found</td></tr>
              ) : (
                filtered.map(item => (
                  <tr key={item._id}>
                    <td>{item.efiWoNumber}</td>
                    <td>{item.date ? new Date(item.date).toLocaleDateString("en-IN") : "-"}</td>
                    <td>{item.productionDate ? new Date(item.productionDate).toLocaleDateString("en-IN") : "-"}</td>
                    <td>{item.customerName}</td>
                 <td style={{
    cursor: "pointer",
    whiteSpace: expandedCell === `job-${item._id}` ? "normal" : "nowrap" }}
    onClick={() =>
    setExpandedCell(
      expandedCell === `job-${item._id}` ? null : `job-${item._id}`
    )
  }
>
  {expandedCell === `job-${item._id}`
    ? item.jobDescription
    : truncateText(item.jobDescription)}
</td>
                    <td>{item.materials?.map(m=>m.materialCode).join(", ")}</td>
                    <td
  style={{
    cursor: "pointer",
    whiteSpace: expandedCell === `material-${item._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `material-${item._id}` ? null : `material-${item._id}`
    )
  }
>
  {expandedCell === `material-${item._id}`
    ? item.materials?.map(m => m.materialDescription).join(", ")
    : truncateText(item.materials?.map(m => m.materialDescription).join(", "))}
</td>
                    <td>{item.mill}</td>
                    <td>{item.materials?.map(m=>m.gsm).join(", ")}</td>
                    <td>{item.materials?.map(m=>m.paperSize).join(", ")}</td>
                    <td>{item.reelNo}</td>
                    <td>{item.productionType}</td>
                    <td>{item.grossWeight}</td>
                    <td>{item.millNetWeight}</td>
                    <td>{item.actualNetWeight}</td>
                    <td>{item.productionOutput}</td>
                    <td>{item.mattWaste}</td>
                    <td>{item.printWaste}</td>
                    <td>{item.realEndWaste}</td>
                    <td>{item.coreWeight}</td>
                   <td>{Number(item.totalWaste || 0).toFixed(2)}</td>
                    <td>{item.balance}</td>
                    <td className={item.wastePercent>100?"text-danger fw-bold":"text-success fw-bold"}>
                      {Number(item.wastePercent || 0).toFixed(2)}%
                    </td>
<td
  style={{
    cursor: "pointer",
    whiteSpace: expandedCell === `remarks-${item._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `remarks-${item._id}` ? null : `remarks-${item._id}`
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
      </div>

    </div>
  );
}