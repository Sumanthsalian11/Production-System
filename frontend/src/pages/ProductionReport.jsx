import { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

function ProductionReport() {

const [productionData,setProductionData] = useState([]);
const token = localStorage.getItem("token");
const [machines, setMachines] = useState([]);
const [machineStatuses, setMachineStatuses] = useState([]);
const [searchWO, setSearchWO] = useState("");
const [customerFilter, setCustomerFilter] = useState("");
const [machineFilter, setMachineFilter] = useState("");
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
const [locationFilter, setLocationFilter] = useState("");
const [locationOptions, setLocationOptions] = useState([]);
const [expandedHeader,setExpandedHeader] = useState(null);
const [usedMachines, setUsedMachines] = useState([]);

useEffect(()=>{
fetchProduction();
},[]);

const fetchProduction = async()=>{

try{

const res = await axios.get(
`${BASE_URL}/api/production-real`,
{ headers:{ Authorization:`Bearer ${token}`}}
);

const data = res.data || [];

setProductionData(data);

// 🔥 ADD THIS
setLocationOptions([
  ...new Set(
    data
      .flatMap(item => item.userLocations || [])
      .filter(Boolean)
  )
]);

}catch(err){
console.log(err);
}

};
useEffect(() => {
  fetchMachines();
   fetchMachineStatuses();
}, []);


const clearFilters = () => {
  setSearchWO("");
  setCustomerFilter("");
  setMachineFilter("");
  setFromDate("");
  setToDate("");
  setLocationFilter("");
};

const fetchMachines = async () => {
  const res = await axios.get(
    `${BASE_URL}/api/master/machines`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setMachines(res.data);
};
const fetchMachineStatuses = async () => {
  const res = await axios.get(
   `${BASE_URL}/api/master/machine-status`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setMachineStatuses(res.data);
};

const filteredData = productionData
  .filter((item) => {

    let matchWO = searchWO
      ? String(item.workOrder).toLowerCase().includes(searchWO.toLowerCase())
      : true;

    let matchCustomer = customerFilter
      ? item.customerName?.trim() === customerFilter.trim()
      : true;

    let matchMachine = true;

    if (machineFilter) {
      matchMachine = item.machiness?.some(
        (m) =>
          m?.machineId?.machineName?.toLowerCase() ===
          machineFilter.toLowerCase()
      );
    }

    // ✅ UPDATED LOCATION FILTER
    let matchLocation = true;

    if (locationFilter) {
      matchLocation = item.userLocations?.some(
        loc => loc === locationFilter
      );
    }

    let itemDate = new Date(item.productionDate);

    let matchFromDate = fromDate ? itemDate >= new Date(fromDate) : true;
    let matchToDate = toDate ? itemDate <= new Date(toDate) : true;

    return (
      matchWO &&
      matchCustomer &&
      matchMachine &&
      matchFromDate &&
      matchToDate &&
      matchLocation
    );
  })
  .sort((a, b) => new Date(b.productionDate) - new Date(a.productionDate));

 useEffect(() => {
  if (!filteredData.length) return;

  setUsedMachines(prev => {
    const existing = new Set(prev);
    let hasNew = false;

    const sortedData = [...filteredData].sort((a, b) => {
      const t1 = new Date(`${a.productionDate} ${a.productionFromTime || "00:00"}`);
      const t2 = new Date(`${b.productionDate} ${b.productionFromTime || "00:00"}`);
      return t1 - t2;
    });

    const updated = [...prev];

    sortedData.forEach(item => {
      item.machiness?.forEach(pair => {
        const machine = pair.machineId?.machineName;

        if (machine && !existing.has(machine)) {
          existing.add(machine);
          updated.push(machine);
          hasNew = true; // ✅ track change
        }
      });
    });

    // ❗ IMPORTANT: only update if something changed
    return hasNew ? updated : prev;
  });

}, [filteredData]);
const customers = [...new Set(productionData.map(p => p.customerName))];

const exportExcel = () => {

const wb = XLSX.utils.book_new();

/* ================= KPI ================= */

const kpiData = [{
"Total Orders": totalOrders,
"Total Production": totalProduction,
"Total Wastage": totalWastage,
"Average Waste %": avgWaste
}];

const kpiSheet = XLSX.utils.json_to_sheet(kpiData);
XLSX.utils.book_append_sheet(wb, kpiSheet, "KPI");


/* ================= JOB PERFORMANCE ================= */

const latestJobPerformance = Object.values(

  filteredData.reduce((acc, item) => {

    if (item.machineStatus !== "PRODUCTION") return acc;

    const wo = item.workOrder;

    const currentTime = new Date(item.createdAt).getTime();

    if (
      !acc[wo] ||
      currentTime > acc[wo].latestTime
    ) {

      acc[wo] = {
        workOrder: wo,
        customer: item.customerName,
        orderQty: item.orderQty,
        production: Number(item.productionQty) || 0,
        latestTime: currentTime
      };

    }

    return acc;

  }, {})

);

const jobPerfData = latestJobPerformance.map(j => ({
  "WO No": j.workOrder,
  Customer: j.customer,
  "Order Qty": j.orderQty,
  Production: j.production,
  "Completion %": (
    (j.production / j.orderQty) * 100
  ).toFixed(2)
}));

const jobPerfSheet = XLSX.utils.json_to_sheet(jobPerfData);
XLSX.utils.book_append_sheet(wb, jobPerfSheet, "Job Performance");
/* ================= JOB MACHINE PERFORMANCE ================= */

const jobMachineData = jobMachinePerformance.map(j => {

let row = {
"WO No": j.workOrder,
Customer: j.customer,
"Order Qty": j.orderQty
};

Object.keys(j.machines || {}).forEach(machine => {

  const value = j.machines?.[machine];

  if (value > 0) {
    row[machine + " Production"] = value;
  }

});

return row;

});

const jobMachineSheet = XLSX.utils.json_to_sheet(jobMachineData);
XLSX.utils.book_append_sheet(wb, jobMachineSheet, "Job Machine Performance");


/* ================= JOB WASTAGE ================= */

const jobWastageData = jobWastage.map(j => {

let row = {
"WO No": j.workOrder,
Customer: j.customer,
"Order Qty": j.orderQty
};

Object.keys(j.machines || {}).forEach(machine => {

  const value = j.machines?.[machine];

  if (value > 0) {
    row[machine + " Wastage"] = value;
  }

});

return row;

});

const jobWastageSheet = XLSX.utils.json_to_sheet(jobWastageData);
XLSX.utils.book_append_sheet(wb, jobWastageSheet, "Job Wastage");


/* ================= JOB WASTAGE % ================= */
const jobWastePercentData = jobWastagePercent.map(j => {

let row = {
  "WO No": j.workOrder,
  Customer: j.customer,
  "Order Qty": j.orderQty
};

// ✅ only add machines having waste %
Object.keys(j.machines || {}).forEach(machine => {

  const value = j.machines?.[machine];

  if (value > 0) {
    row[machine + " Waste %"] = value.toFixed(2);
  }

});

return row;

});

const jobWastePercentSheet = XLSX.utils.json_to_sheet(jobWastePercentData);
XLSX.utils.book_append_sheet(wb, jobWastePercentSheet, "Job Waste %");


/* ================= MACHINE PRODUCTION ================= */

const machineProdData = machineProduction.map(m => {

const percent = m.production
? ((m.wastage / m.production) * 100).toFixed(2)
: 0;

return {
Machine: m.machine,
Production: m.production,
Wastage: m.wastage,
"Order Qty": m.orderQty,
"Wastage %": percent
};

});

const machineProdSheet = XLSX.utils.json_to_sheet(machineProdData);
XLSX.utils.book_append_sheet(wb, machineProdSheet, "Machine Production");

/* ================= WORK ORDER PRODUCTION ================= */

const woProductionData = woCustomerProduction.map(m => {

  const percent = m.production
    ? ((m.wastage / m.production) * 100).toFixed(2)
    : 0;

  return {
    "Work Order": m.workOrder,
    "Customer": m.customer,
    "Production": m.production,
    "Wastage": m.wastage,
    "Wastage %": percent
  };

});

const woProductionSheet = XLSX.utils.json_to_sheet(woProductionData);
XLSX.utils.book_append_sheet(wb, woProductionSheet, "WO Production");

/* ================= MACHINE UTILIZATION ================= */

const machineUtilData = machineUtilizationDatewise.map(m => {

let row = {
   Date: m.date, 
Machine: m.machine
};

machineStatuses.forEach(s => {
row[s.statusName] = formatTime(m[s.statusName] || 0);
});

const productionMinutes = m["PRODUCTION"] || 0;
const productionHours = productionMinutes / 60;

row["Utilization %"] = ((productionHours / 24) * 100).toFixed(2);

return row;

});

const machineUtilSheet = XLSX.utils.json_to_sheet(machineUtilData);
XLSX.utils.book_append_sheet(wb, machineUtilSheet, "Machine Utilization");


/* ================= DOWNLOAD ================= */

XLSX.writeFile(wb, "Production_Report.xlsx");

};
// ================= JOB PERFORMANCE =================
// ================= JOB PERFORMANCE =================

const jobPerformance = Object.values(

  filteredData.reduce((acc, item) => {

    // only production records
    if (item.machineStatus !== "PRODUCTION") return acc;

    const wo = item.workOrder;

    // current record datetime
    const currentTime = new Date(item.createdAt).getTime();

    // if first time OR latest entry
    if (
      !acc[wo] ||
      currentTime > acc[wo].latestTime
    ) {

      acc[wo] = {
        workOrder: wo,
        customer: item.customerName,
        orderQty: item.orderQty,
        production: Number(item.productionQty) || 0,
        latestTime: currentTime
      };

    }

    return acc;

  }, {})

).map(j => ({
  workOrder: j.workOrder,
  customer: j.customer,
  orderQty: j.orderQty,
  production: j.production
}));

// ================= JOBWISE MACHINE PERFORMANCE =================

const jobMachinePerformance = Object.values(
filteredData.reduce((acc,item)=>{

if(item.machineStatus !== "PRODUCTION") return acc;

const wo = item.workOrder;

if(!acc[wo]){

acc[wo] = {
workOrder: wo,
customer: item.customerName,
orderQty: item.orderQty,
machines: {},
lastMachine: null
};

}

item.machiness?.forEach(pair=>{

const machine = pair.machineId?.machineName;

if(!acc[wo].machines[machine]){
acc[wo].machines[machine] = 0;
}

acc[wo].machines[machine] += Number(item.productionQty);

acc[wo].lastMachine = machine;

});

return acc;

},{}));


// ================= JOBWISE WASTAGE =================

const jobWastage = Object.values(

filteredData.reduce((acc,item)=>{

if(item.machineStatus !== "PRODUCTION") return acc;

const wo = item.workOrder;

if(!acc[wo]){

acc[wo] = {
workOrder: wo,
customer: item.customerName,
orderQty: item.orderQty,
machines: {}
};

}

item.machiness?.forEach(pair=>{

const machine = pair.machineId?.machineName;

if(!acc[wo].machines[machine]){
acc[wo].machines[machine] = 0;
}

acc[wo].machines[machine] += Number(item.wastageQty);

});

return acc;

},{})
);

// ================= JOBWISE WASTAGE % =================

const jobWastagePercent = Object.values(

filteredData.reduce((acc,item)=>{

if(item.machineStatus !== "PRODUCTION") return acc;

const wo = item.workOrder;

if(!acc[wo]){

acc[wo] = {
workOrder: wo,
customer: item.customerName,
orderQty: item.orderQty,
machines: {}
};

}

item.machiness?.forEach(pair=>{

const machine = pair.machineId?.machineName;

if(!acc[wo].machines[machine]){
acc[wo].machines[machine] = 0;
}

acc[wo].machines[machine] += Number(item.wastePercent || 0);

});

return acc;

},{})
);

const woCustomerProduction = Object.values(
  jobMachinePerformance
    .filter((job) => {
      let matchWO = searchWO
        ? String(job.workOrder).toLowerCase().includes(searchWO.toLowerCase())
        : true;

      let matchCustomer = customerFilter
        ? job.customer?.trim() === customerFilter.trim()
        : true;

      return matchWO && matchCustomer;
    })
    .reduce((acc, job) => {

      const key = job.workOrder;

      if (!acc[key]) {
        acc[key] = {
          workOrder: job.workOrder,
          customer: job.customer,
          production: 0,
          wastage: 0,
          orderQty: job.orderQty
        };
      }

      machines.forEach((m) => {
        const machine = m.machineName;

        const production = job.machines?.[machine] || 0;
        const wastage =
          jobWastage
            ?.find((w) => w.workOrder === job.workOrder)
            ?.machines?.[machine] || 0;

        acc[key].production += Number(production);
        acc[key].wastage += Number(wastage);
      });

      return acc;
    }, {})
);

const machineProduction = Object.values(
  jobMachinePerformance
    .filter((job) => {
      let matchWO = searchWO
        ? String(job.workOrder).toLowerCase().includes(searchWO.toLowerCase())
        : true;

      let matchCustomer = customerFilter
        ? job.customer?.trim() === customerFilter.trim()
        : true;

      let matchMachine = true;
      if (machineFilter) {
        matchMachine = Object.keys(job.machines || {}).some(
          (m) => m.toLowerCase() === machineFilter.toLowerCase()
        );
      }

      return matchWO && matchCustomer && matchMachine;
    })
    .reduce((acc, job) => {
      machines.forEach((m) => {
        const machine = m.machineName;
        const production = job.machines?.[machine] || 0;
        const wastage = jobWastage
          ?.find((w) => w.workOrder === job.workOrder)
          ?.machines?.[machine] || 0;

        if (!acc[machine]) {
          acc[machine] = { machine, production: 0, wastage: 0, orderQty: 0 };
        }

        // sum production
        acc[machine].production += Number(production);

        // sum wastage
        acc[machine].wastage += Number(wastage);

        // add orderQty only if machine exists for that WO
        if (production > 0 || wastage > 0) {
          acc[machine].orderQty += Number(job.orderQty || 0);
        }
      });

      return acc;
    }, {})
)
// ✅ Remove machines with 0 production and 0 wastage
.filter((m) => m.production > 0 || m.wastage > 0);
const getTimeDiff = (from, to) => {

  if (!from || !to) return 0;

  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);

  let fromMinutes = fh * 60 + fm;
  let toMinutes = th * 60 + tm;

  // ✅ handle midnight crossing
  if (toMinutes <= fromMinutes) {
    toMinutes += 24 * 60;
  }

  return toMinutes - fromMinutes;
};

const formatTime = (minutes) => {

const h = Math.floor(minutes / 60);
const m = minutes % 60;

return `${h}h ${m}m`;

};
// ================= MACHINE UTILIZATION =================

const machineUtilizationDatewise = Object.values(

  filteredData.reduce((acc, item) => {

    const minutes = getTimeDiff(
      item.productionFromTime,
      item.productionToTime
    );

    const date = new Date(item.productionDate)
      .toISOString()
      .split("T")[0]; // YYYY-MM-DD

    item.machiness?.forEach(pair => {

      const machine = pair.machineId?.machineName;

      const key = machine + "_" + date;

      if (!acc[key]) {
        acc[key] = {
          machine,
          date
        };

        machineStatuses.forEach(s => {
          acc[key][s.statusName] = 0;
        });
      }

      const status = item.machineStatus;

      if (status && acc[key][status] !== undefined) {
        acc[key][status] += minutes;
      }

    });

    return acc;

  }, {})
);

const totalOrderQty = Object.values(
filteredData.reduce((acc, item) => {
    const wo = item.workOrder;

    if (!acc[wo]) {
      acc[wo] = item.orderQty;
    }

    return acc;
  }, {})
).reduce((sum, qty) => sum + Number(qty), 0);
// ================= KPI =================

const totalOrders = new Set(
  filteredData
    .filter(p => p.machineStatus === "PRODUCTION")
    .map(p => p.workOrder)
).size;

const totalProduction = filteredData.reduce(
(sum,p)=> sum + Number(p.productionQty),0
);

const totalWastage =filteredData.reduce(
(sum,p)=> sum + Number(p.wastageQty),0
);

const avgWaste = totalProduction
? ((totalWastage/totalProduction)*100).toFixed(2)
:0;



return(

<div className="container my-3" style={{border:"2px solid black",borderRadius:"20px", maxWidth:"1150px",background: "linear-gradient(135deg,#20bdd81d,#f2fbfb)"
}} >
<div className="d-flex align-items-center justify-content-between mb-3 mt-3">

  {/* Empty space for balance */}
  <div style={{ width: "150px" }}></div>

  <div className="text-center">
    <h1
      style={{
        borderBottom: "2px solid black",
        display: "inline-block",
        paddingBottom: "3px"
      }}
    >
      <b>Production Report</b>
    </h1>
  </div>

  <button
    className="btn btn-primary px-3"
    onClick={exportExcel}
  >
    Export Excel
  </button>

</div>
<div className="row g-0 mb-0">
<div
  className="row g-0 mb-3 row-cols-1 row-cols-md-1   row-cols-lg-6 p-3"
  style={{
    background: "#33bbb445",
    borderRadius: "10px",
    border: "2px solid black",
    boxShadow: "0 4px 10px"
  }}>
<div className="col-md-2">
  <label className="form-label text-black">WO Number</label>
<input
type="text"
className="form-control border-dark"
placeholder="Search WO"
value={searchWO}
onChange={(e)=>setSearchWO(e.target.value)}
/>
</div>

<div className="col-md-2">
  <label className="form-label text-black">Customer Name</label>
<select
className="form-control border-dark"
value={customerFilter}
onChange={(e)=>setCustomerFilter(e.target.value)}
>
<option value="">All Customers</option>
{customers.map((c,i)=>(
<option key={i}>{c}</option>
))}
</select>
</div>

<div className="col-md-2">
  <label className="form-label text-black">Machine</label>
<select
className="form-control border-dark"
value={machineFilter}
onChange={(e)=>setMachineFilter(e.target.value)}
>
<option value="">All Machines</option>
{machines.map((m)=>(
<option key={m._id}>{m.machineName}</option>
))}
</select>
</div>

<div className="col-md-2">
  <label className="form-label text-black">From date</label>
<input
type="date"
className="form-control border-dark"
value={fromDate}
onChange={(e)=>setFromDate(e.target.value)}
/>
</div>

<div className="col-md-2">
  <label className="form-label text-black">To date</label>
<input
type="date"
className="form-control border-dark"
value={toDate}
onChange={(e)=>setToDate(e.target.value)}
/>
</div>
<div className="col-md-2">
  <label className="form-label text-black">User Location</label>
  <select
    className="form-control border-dark"
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
<div className="col-md-2 d-flex align-items-end">
<button
className="btn btn-danger w-100"
onClick={clearFilters}
>
Clear
</button>
</div>
</div>
</div>
{/* KPI */}
<h4 className="mb-0 text-center"><b>KPI</b></h4>

<div className="d-flex gap-3 flex-nowrap">

  <div className="card shadow-lg border-black text-center p-3 flex-fill">
    <h6 className="text-black">Total Orders</h6>
    <h4 className="fw-bold">{totalOrders}</h4>
  </div>

  <div className="card shadow-lg border-black  text-center p-3 flex-fill">
    <h6 className="text-black">Total Production</h6>
    <h4 className="fw-bold">{totalProduction.toLocaleString("en-IN")}</h4>
  </div>

  <div className="card shadow-lg border-black  text-center p-3 flex-fill">
    <h6 className="text-black">Total Wastage</h6>
    <h4 className="fw-bold">{totalWastage.toLocaleString("en-IN")}</h4>
  </div>

  <div className="card shadow-lg border-black  text-center p-3 flex-fill">
    <h6 className="text-black">Average Waste %</h6>
    <h4 className="fw-bold text-danger">{avgWaste}%</h4>
  </div>

</div>
{/* JOB PERFORMANCE */}

<h3 className="text-center">Job Performance</h3>

<div className="table-responsive" style={{ maxHeight: "250px", overflowY: "auto" }}>
  <table className="table border-black table-bordered">
    <thead className="table-dark sticky-top">

<tr>

<th>WO No</th>
<th>Customer</th>
<th>Order Qty</th>
<th>Production Qty</th>
<th>Completion %</th>

</tr>

</thead>

<tbody>

{jobPerformance
.sort((a,b)=> b.workOrder - a.workOrder)
.slice(0,10)
.map((j,i)=>{

const completion = ((j.production/j.orderQty)*100).toFixed(2);

return(

<tr key={i}>

<td>{j.workOrder}</td>
<td>{j.customer}</td>
<td>
  {j.orderQty ? j.orderQty.toLocaleString("en-IN") : "-"}
</td>

<td>
  {j.production ? j.production.toLocaleString("en-IN") : "-"}
</td>
<td>{completion}%</td>

</tr>


);

})}

</tbody>

</table>

</div>

{/* JOBWISE MACHINE PERFORMANCE */}

<h3 className="text-center mt-3">Jobwise Machine Performance</h3>

<div className="table-responsive" style={{ maxHeight: "250px", overflowY: "auto" }}>
  <table className="table border-black table-bordered">
    <thead className="table-dark sticky-top">

<tr>

<th>WO No</th>
<th>Customer</th>
<th>Order Qty</th>

{usedMachines.map((machine)=>(
<th key={machine} style={{minWidth:"170px"}}>

<span
title={machine}
style={{
cursor:"pointer",
display:"inline-block",
maxWidth: expandedHeader===machine+"prod" ? "400px" : "90px",
whiteSpace: expandedHeader===machine+"prod" ? "normal" : "nowrap",
wordBreak:"break-word",
overflow:"hidden",
textOverflow:"ellipsis"
}}
onClick={()=>setExpandedHeader(
expandedHeader===machine+"prod" ? null : machine+"prod"
)}
>
{machine} Production
</span>

</th>
))}

</tr>

</thead>

<tbody>

{jobMachinePerformance
.sort((a,b)=> b.workOrder - a.workOrder)
.slice(0,10)
.map((j,i)=>{

const lastProduction = j.machines?.[j.lastMachine] || 0;

const wastePercent = j.orderQty
? ((lastProduction / j.orderQty) * 100).toFixed(2)
: 0;

return(

<tr key={i}>

<td>{j.workOrder}</td>
<td style={{ maxWidth: "150px" }}>
  <span
    title={j.customer}
    style={{
      cursor: "pointer",
      display: "inline-block",
      maxWidth: expandedHeader === j.workOrder + "customer" ? "300px" : "100px",
      whiteSpace: expandedHeader === j.workOrder + "customer" ? "normal" : "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      wordBreak: "break-word"
    }}
    onClick={() =>
      setExpandedHeader(
        expandedHeader === j.workOrder + "customer"
          ? null
          : j.workOrder + "customer"
      )
    }
  >
    {j.customer}
  </span>
</td>
<td>{j.orderQty.toLocaleString("en-IN")}</td>

{usedMachines.map((machine)=>(
<td key={machine}>
  {j.machines?.[machine] || j.machines?.[machine] === 0
    ? Number(j.machines[machine]).toLocaleString("en-IN")
    : "-"}
</td>
))}


</tr>

);

})}

</tbody>
</table>
</div>



<h3 className="text-center mt-3">Jobwise Wastage Performance</h3>

<div className="table-responsive" style={{ maxHeight: "250px", overflowY: "auto" }}>
  <table className="table border-black table-bordered">
    <thead className="table-dark sticky-top">

<tr>

<th>WO No</th>
<th>Customer</th>
<th>Order Qty</th>

{usedMachines.map((machine)=>(
<th key={machine} style={{maxWidth:"170px"}}>

<span
title={machine}
style={{
cursor:"pointer",
display:"inline-block",
maxWidth: expandedHeader===machine ? "400px":"90px",
whiteSpace: expandedHeader===machine ? "normal":"nowrap",
wordBreak:"break-word",
overflow:"hidden",
textOverflow:"ellipsis"
}}
onClick={()=>setExpandedHeader(
expandedHeader===machine ? null : machine
)}
>
{machine} Wastage
</span>

</th>
))}

</tr>

</thead>

<tbody>

{jobWastage.map((j,i)=>(

<tr key={i}>

<td>{j.workOrder}</td>
<td style={{ maxWidth: "150px" }}>
  <span
    title={j.customer}
    style={{
      cursor: "pointer",
      display: "inline-block",
      maxWidth:
        expandedHeader === j.workOrder + "wastageCustomer"
          ? "300px"
          : "100px",
      whiteSpace:
        expandedHeader === j.workOrder + "wastageCustomer"
          ? "normal"
          : "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      wordBreak: "break-word"
    }}
    onClick={() =>
      setExpandedHeader(
        expandedHeader === j.workOrder + "wastageCustomer"
          ? null
          : j.workOrder + "wastageCustomer"
      )
    }
  >
    {j.customer}
  </span>
</td>
<td>{j.orderQty.toLocaleString("en-IN")}</td>

{usedMachines.map((machine)=>(
<td key={machine}>
  {j.machines?.[machine] || j.machines?.[machine] === 0
    ? j.machines[machine]
    : "-"}
</td>
))}

</tr>

))}

</tbody>

</table>
</div>


{/* JOBWISE WASTAGE % */}

<h3 className="text-center mt-3">Jobwise Wastage %</h3>

<div className="table-responsive" style={{ maxHeight: "250px", overflowY: "auto" }}>
  <table className="table border-black table-bordered">
    <thead className="table-dark sticky-top">
<tr>

<th>WO No</th>
<th>Customer</th>
<th>Order Qty</th>

{usedMachines.map((machine)=>(
<th key={machine+"percent"} style={{maxWidth:"170px"}}>

<span
title={machine}
style={{
cursor:"pointer",
display:"inline-block",
maxWidth: expandedHeader===machine+"percent" ? "400px":"90px",
whiteSpace: expandedHeader===machine+"percent" ? "normal":"nowrap",
wordBreak:"break-word",
overflow:"hidden",
textOverflow:"ellipsis"
}}
onClick={()=>setExpandedHeader(
expandedHeader===machine+"percent" ? null : machine+"percent"
)}
>
{machine} Waste %
</span>

</th>
))}

</tr>

</thead>

<tbody>

{jobWastagePercent
.sort((a,b)=> b.workOrder - a.workOrder)
.slice(0,10)
.map((j,i)=>(

<tr key={i}>

<td>{j.workOrder}</td>
<td style={{ maxWidth: "150px" }}>
  <span
    title={j.customer}
    style={{
      cursor: "pointer",
      display: "inline-block",
      maxWidth:
        expandedHeader === j.workOrder + "wastePercentCustomer"
          ? "300px"
          : "100px",
      whiteSpace:
        expandedHeader === j.workOrder + "wastePercentCustomer"
          ? "normal"
          : "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      wordBreak: "break-word"
    }}
    onClick={() =>
      setExpandedHeader(
        expandedHeader === j.workOrder + "wastePercentCustomer"
          ? null
          : j.workOrder + "wastePercentCustomer"
      )
    }
  >
    {j.customer}
  </span>
</td>
<td>{j.orderQty.toLocaleString("en-IN")}</td>

{usedMachines.map((machine)=>(
<td key={machine}>
{j.machines?.[machine] ? j.machines[machine].toFixed(2)+"%" : "-"}
</td>
))}

</tr>

))}

</tbody>

</table>
</div>

{/* MACHINE PRODUCTION */}

<h3 className="text-center mt-3">Machine Production</h3>

<div className="table-responsive" style={{ maxHeight: "250px", overflowY: "auto" }}>
  <table className="table border-black table-bordered">
    <thead className="table-dark sticky-top">
<tr>
<th>Machine</th>
<th>Production</th>
<th>Wastage</th>
<th>Wastage %</th>
</tr>
</thead>

<tbody>

{machineProduction.slice(0,10).map((m,i)=>{

const percent = totalOrderQty
? ((m.wastage/ m.production) * 100).toFixed(2)
: 0;

return(

<tr key={i}>
<td>{m.machine}</td>
<td>
  {m.production || m.production === 0
    ? m.production.toLocaleString("en-IN")
    : "-"}
</td>

<td>
  {m.wastage || m.wastage === 0
    ? m.wastage.toLocaleString("en-IN")
    : "-"}
</td>
<td>{percent}%</td>
</tr>

);

})}

</tbody>

</table>
</div>
<h3 className="text-center mt-3">Work Order Production</h3>

<div className="table-responsive" style={{ maxHeight: "250px", overflowY: "auto" }}>
  <table className="table border-black table-bordered">
    <thead className="table-dark sticky-top">
      <tr>
        <th>Work Order</th>
        <th>Customer</th>
        <th>Production</th>
        <th>Wastage</th>
        <th>Wastage %</th>
      </tr>
    </thead>

    <tbody>
      {woCustomerProduction.slice(0, 10).map((m, i) => {
        const percent = m.production
          ? ((m.wastage / m.production) * 100).toFixed(2)
          : 0;

        return (
          <tr key={i}>
            <td>{m.workOrder}</td>
            <td>{m.customer}</td>

            <td>
              {m.production || m.production === 0
                ? m.production.toLocaleString("en-IN")
                : "-"}
            </td>

            <td>
              {m.wastage || m.wastage === 0
                ? m.wastage.toLocaleString("en-IN")
                : "-"}
            </td>

            <td>{percent}%</td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>

{/* MACHINE UTILIZATION */}

<h3 className="text-center mt-3">Machine Utilization</h3>

<div className="table-responsive" style={{ maxHeight: "250px", overflowY: "auto" }}>
  <table className="table border-black table-bordered">
    <thead className="table-dark sticky-top">

<tr>
<th>Date</th>
<th>Machine</th>
{machineStatuses.slice(0,10).map((s)=>(
<th key={s._id}>{s.statusName}</th>
))}
<th>Utilization</th>
</tr>

</thead>

<tbody>

{machineUtilizationDatewise
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 15)
  .map((m, i) => {

    const productionMinutes = m["PRODUCTION"] || 0;
    const productionHours = productionMinutes / 60;
    const utilization = ((productionHours / 24) * 100).toFixed(2);

    return (
      <tr key={i}>
         <td>{m.date.toLocaleString("en-IN") ||"-"}</td>
        <td>{m.machine}</td>
        {machineStatuses.map((s) => (
          <td key={s._id}>
            {formatTime(m[s.statusName] || 0)}
          </td>
        ))}

        <td>{utilization}%</td>
      </tr>
    );
  })}

</tbody>

</table>
</div>

</div>

);

}

export default ProductionReport;