import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { saveAs } from "file-saver";
  import BASE_URL from "../config/api";

function ProductionRealDashboard() {

  const [workOrderDetails, setWorkOrderDetails] = useState(null);
const showAlert = (message, icon = "warning") => {

  let bgColor = "#fffafb"; // pink default

  if (icon === "success") bgColor = "#f0f2f4";   // blue
  if (icon === "error") bgColor = "#e3dede";     // red
  if (icon === "info") bgColor = "#17a2b8";      // cyan

  Swal.fire({
    toast: true,
    position: "top",
    icon: icon,
    title: message,
    width:"450px",
    showConfirmButton: false,
    timer: 5000,
    timerProgressBar: true,
    background: bgColor,
    color: "#0a0808",
    didOpen: (toast) => {
      toast.style.marginLeft = "120px"; // slight right shift
    }
  });
};
  const [form, setForm] = useState({
    workOrderNo: "",
    productionDate: "",
    productionFromTime: "",
    productionToTime: "",
     machineStatus: "", 
    shift: "",
    productionQty: "",
    wastageQty: "",
     productionImpression: "",
  wasteImpression: "",
  productionUps: "",
    remarks: ""
  });

  
  const [activities, setActivities] = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activityMachinePairs, setActivityMachinePairs] = useState([
    { activityId: "", machineId: "" }
  ]);
 const [productionList, setProductionList] = useState([]);
 const [expandedCell, setExpandedCell] = useState(null);
 const [wastePercent, setWastePercent] = useState(0);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [editingId, setEditingId] = useState(null);
const formRef = useRef(null);
  const token = localStorage.getItem("token");
const [userLocations, setUserLocations] = useState([]);
const [locationFilter, setLocationFilter] = useState("");
const [locationOptions, setLocationOptions] = useState([]);

 const handleEdit = (item) => {
  setEditingId(item._id);

  setForm({
    workOrderNo: item.workOrder,
    productionDate: item.productionDate?.split("T")[0],
    productionFromTime: item.productionFromTime,
    productionToTime: item.productionToTime,
    shift: item.shift,
    machineStatus: item.machineStatus || "",
    productionImpression: item.productionImpression || "",
    wasteImpression: item.wasteImpression || "",
    productionUps: item.productionUps || "",
    productionQty: item.productionQty,
    wastageQty: item.wastageQty,
    remarks: item.remarks
  });

  // ✅ ADD THIS
  if (item.productionQty > 0) {
    setWastePercent(
      ((item.wastageQty / item.productionQty) * 100).toFixed(2)
    );
  } else {
    setWastePercent(0);
  }

  setWorkOrderDetails({
    customerName: item.customerName,
    jobDescription: item.jobDescription,
    jobSize: item.jobSize,
    materials: item.materials,
    ups: item.ups,
    orderQty: item.orderQty
  });

  setActivityMachinePairs(
    item.machiness?.map(pair => ({
      activityId: pair.activityId?._id || pair.activityId,
      machineId: pair.machineId?._id || pair.machineId
    })) || [{ activityId: "", machineId: "" }]
  );

  setTimeout(() => {
    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 200);
};
const truncateText = (text, length = 25) => {
  if (!text) return "-";
  return text.length > length ? text.substring(0, length) + "..." : text;
};


const fetchMachineStatuses = async () => {
  try {
   const res = await axios.get(
  `${BASE_URL}/api/master/machine-status`,
  { headers: { Authorization: `Bearer ${token}` } }
);

    setMachineStatuses(res.data || []);
  } catch (err) {
    console.error("Error fetching machine statuses:", err);
  }
};

const handleDelete = async (id) => {
  const confirm = await Swal.fire({
    title: "Are you sure?",
    text: "You won't be able to revert this!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!"
  });

  if (confirm.isConfirmed) {
    try {
      await axios.delete(`${BASE_URL}/api/production-real/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showAlert("Deleted successfully ✅", "success");
      fetchProductionReal(); // refresh table
    } catch (err) {
      console.error(err);
      showAlert("Delete failed", "error");
    }
  }
};

  // ================= FILTER STATE =================
const [filters, setFilters] = useState({
  workOrder: "",
  dateFrom: "",
  dateTo: "",
  month: "",
  shift: "",
  machine: "",
   machineStatus: ""  
});

// ================= FILTER HANDLER =================
const handleFilterChange = (e) => {
  const { name, value } = e.target;
  setFilters(prev => ({ ...prev, [name]: value }));
};

// ================= CLEAR FILTERS =================
const clearFilters = () => {
  setFilters({
    workOrder: "",
    dateFrom: "",
    dateTo: "",
    month: "",
    shift: "",
    machine: "",
     machineStatus: ""  
  });
   setLocationFilter("");
};
// ================= FILTER LOGIC =================
const filteredProductionList = productionList.filter(item => {

  const itemDate = new Date(item.productionDate);
  const itemMonth = itemDate.getMonth() + 1;
  const itemYear = itemDate.getFullYear();

  // Work Order filter
  if (filters.workOrder &&
      !String(item.workOrder).includes(filters.workOrder))
    return false;

  // Date From filter
  if (filters.dateFrom &&
      itemDate < new Date(filters.dateFrom))
    return false;

    // Machine Status filter
if (filters.machineStatus &&
    item.machineStatus !== filters.machineStatus)
  return false;

  // Date To filter
  if (filters.dateTo &&
      itemDate > new Date(filters.dateTo))
    return false;
    if (locationFilter) {
  const matchLocation = item.userLocations?.some(
    loc => loc === locationFilter
  );

  if (!matchLocation) return false;
}

  // Month filter
  if (filters.month) {
    const [year, month] = filters.month.split("-");
    if (
      itemYear !== Number(year) ||
      itemMonth !== Number(month)
    ) return false;
  }

  // Shift filter
  if (filters.shift &&
      item.shift !== filters.shift)
    return false;

  // Machine filter
  if (filters.machine) {
    const machineMatch = item.machiness?.some(pair =>
      pair.machineId?.machineName === filters.machine
    );
    if (!machineMatch) return false;
  }

  return true;
});

  // ================= JWT =================
  useEffect(() => {
  if (token) {
    const decoded = jwtDecode(token);
    setLoggedInUser(decoded.name);

    // If your decoded token contains locations
    if (decoded.locations) {
      setUserLocations(decoded.locations);
    } 
    // OR fetch from backend
    else {
      axios
        .get(`${BASE_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setUserLocations(res.data.locations || []))
        .catch((err) => console.error("Error fetching user locations:", err));
    }
  }
}, [token]);

  // ================= FETCH ACTIVITIES =================
  const fetchActivities = async () => {
    try {
     const res = await axios.get(
  `${BASE_URL}/api/master/activities`,
  { headers: { Authorization: `Bearer ${token}` } }
);
      setActivities(res.data || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    }
  };
const fetchProductionReal = async () => {
  try {
 const res = await axios.get(
  `${BASE_URL}/api/production-real`,
  { headers: { Authorization: `Bearer ${token}` } }
);
    // 🔥 Sort latest first
    const sorted = res.data.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    setProductionList(sorted);
    setLocationOptions([
  ...new Set(
    res.data
      .flatMap(item => item.userLocations || [])
      .filter(Boolean)
  )
]);
  } catch (err) {
    console.error("Error fetching Production:", err);
  }
};
  // ================= FETCH MACHINES =================
  const fetchMachines = async () => {
    try {
     const res = await axios.get(
  `${BASE_URL}/api/master/machines`,
  { headers: { Authorization: `Bearer ${token}` } }
);
      setMachines(res.data || []);
    } catch (err) {
      console.error("Error fetching machines:", err);
    }
  };

useEffect(() => {
  fetchActivities();
  fetchMachines();
  fetchMachineStatuses(); // 👈 ADD THIS
  fetchProductionReal();
}, [token]);

const exportToExcel = () => {

  const excelData = filteredProductionList.map((item, index) => ({

    "SL NO": index + 1,
    "WO No": item.workOrder,
    "Customer": item.customerName,
    "Job Description": item.jobDescription,
    "Job Size": item.jobSize,
    "PlannerUPS": item.ups,

    "Date": new Date(item.productionDate).toLocaleDateString("en-IN"),
    "Shift": item.shift,
    "Machine status":item.machineStatus,
    "From Time (12H)": formatTime12Hour(item.productionFromTime),
    "To Time (12H)": formatTime12Hour(item.productionToTime),

    "Stage": item.machiness
      ?.map(pair => pair.activityId?.activityName)
      .join(", ") || "-",

    "Machine": item.machiness
      ?.map(pair => pair.machineId?.machineName)
      .join(", ") || "-",

    "Material Code": item.materials
      ?.map(m => m.materialCode)
      .join(", ") || "-",

    "Material Description": item.materials
      ?.map(m => m.materialDescription)
      .join(", ") || "-",

    "Material Group": item.materials
      ?.map(m => m.materialGroupDescription)
      .join(", ") || "-",

    "Mill": item.materials
      ?.map(m => m.mill)
      .join(", ") || "-",

   "GSM": item.materials?.map(m => m.gsm).join(", ") || "-",
"PaperSize": item.materials?.map(m => m.paperSize).join(", ") || "-",
    "Order Qty":item.orderQty,
    "Production Impression": item.productionImpression || "-",
    "Waste Impression": item.wasteImpression || "-",
    "Production UPS": item.productionUps || "-",

    "Production Qty": item.productionQty,
    "Wastage Qty": item.wastageQty,
    "Waste %": item.productionQty
  ? ((item.wastageQty / item.productionQty) * 100).toFixed(2) + "%"
  : "0%",

    "Entered By": item.enteredBy,
    "Created Date & Time": new Date(item.createdAt).toLocaleString(),

    "Remarks": item.remarks || "-"

  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ProductionReal");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array"
  });

  const data = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(data, "Production.xlsx");
};

  // ================= FILTER MACHINES =================
  const filteredMachinesForPair = (activityId) => {
    if (!activityId) return [];

    const activity = activities.find(a => a._id === activityId);
    if (!activity?.machines) return [];

    return machines.filter(m =>
      activity.machines.map(String).includes(String(m._id))
    );
  };

  // ================= HANDLE ACTIVITY CHANGE =================
  const handleActivityChange = (index, value) => {
    const pairs = [...activityMachinePairs];
    pairs[index].activityId = value;
    pairs[index].machineId = "";
    setActivityMachinePairs(pairs);
  };

  const handleMachineChangeForPair = (index, value) => {
    const pairs = [...activityMachinePairs];
    pairs[index].machineId = value;
    setActivityMachinePairs(pairs);
  };

  const addActivityMachinePair = () => {
    setActivityMachinePairs(prev => [
      ...prev,
      { activityId: "", machineId: "" }
    ]);
  };

  const removeActivityMachinePair = (index) => {
    setActivityMachinePairs(prev =>
      prev.filter((_, i) => i !== index)
    );
  };

  // ================= FETCH WORK ORDER =================
  const fetchWorkOrder = async () => {
    if (!form.workOrderNo) return showAlert("Enter Work Order No", "warning");

    try {
     const res = await axios.get(
  `${BASE_URL}/api/production/workorder/${form.workOrderNo}`,
  { headers: { Authorization: `Bearer ${token}` } }
);

     setWorkOrderDetails({
  ...res.data,
 orderQty: res.data.qty
});

      // Reset activity rows
      setActivityMachinePairs([{ activityId: "", machineId: "" }]);

    } catch {
      showAlert("Work Order not found","error");
    }
  };

const handleChange = (e) => {
  const { name, value } = e.target;

  // ================= EXISTING VALIDATION =================
  if (
    name === "productionQty" ||
    name === "wastageQty" ||
    name === "productionImpression" ||
    name === "wasteImpression" ||
    name === "productionUps"
  ) {
    // 🚫 Block + - e
    if (
      value.includes("-") ||
      value.includes("+") ||
      value.toLowerCase().includes("e")
    ) {
      showAlert("Invalid characters are not allowed", "warning");
      return;
    }

    if (name === "machineStatus" && value.toLowerCase() !== "production") {
      setForm((prev) => ({
        ...prev,
        machineStatus: value,
        productionQty: "",
        wastageQty: "",
        productionImpression: "",
        wasteImpression: "",
        productionUps: ""
      }));
      setWastePercent(0);
      return;
    }
  }

  if (name === "remarks") {
    const remarksRegex = /^[a-zA-Z0-9 ]*$/;

    if (!remarksRegex.test(value)) {
      showAlert("Special characters are not allowed", "error");
      return;
    }
  }

  // ================= KEEP ORIGINAL =================
  setForm((prev) => ({ ...prev, [name]: value }));

  // ================= NEW AUTO CALCULATION =================
  const updatedForm = {
    ...form,
    [name]: value
  };

  const prodImp = Number(updatedForm.productionImpression);
  const wasteImp = Number(updatedForm.wasteImpression);
  const ups = Number(updatedForm.productionUps);

  let calculatedProductionQty = updatedForm.productionQty;
  let calculatedWastageQty = updatedForm.wastageQty;

  // ✅ UPDATED FORMULA (MULTIPLICATION)
 // ✅ CLEAR when UPS is removed
if (!ups || ups === 0) {
  calculatedProductionQty = "";
  calculatedWastageQty = "";
} else {
  if (prodImp > 0) {
    calculatedProductionQty = prodImp * ups;
  } else {
    calculatedProductionQty = "";
  }

  if (wasteImp > 0) {
    calculatedWastageQty = wasteImp * ups;
  } else {
    calculatedWastageQty = "";
  }
}
if (!ups) {
  setWastePercent(0);
}

  // update calculated values
  setForm((prev) => ({
    ...prev,
    productionQty: calculatedProductionQty,
    wastageQty: calculatedWastageQty
  }));

  // ================= KEEP ORIGINAL WASTE % =================
  const prodQty = Number(
    name === "productionQty"
      ? value
      : calculatedProductionQty || form.productionQty
  );

  const wastageQty = Number(
    name === "wastageQty"
      ? value
      : calculatedWastageQty || form.wastageQty
  );

  if (prodQty > 0) {
    setWastePercent(((wastageQty / prodQty) * 100).toFixed(2));
  } else {
    setWastePercent(0);
  }
};
  // ================= SUBMIT =================
 const handleSubmit = async (e) => {
  e.preventDefault();

  if (!workOrderDetails) return showAlert("Fetch Work Order first","warning");

  // validate all activity-machine pairs
  for (let i = 0; i < activityMachinePairs.length; i++) {
    const pair = activityMachinePairs[i];
    if (!pair.activityId || !pair.machineId) {
      showAlert(`Select activity & machine`,"warning");
      return;
    }
  }

  const workOrderNumber = Number(
    workOrderDetails.efiWoNumber || form.workOrderNo
  );
  if (!workOrderNumber) return showAlert("Invalid Work Order Number","error");

  // 🚫 Production Qty cannot be 0
if (
  form.machineStatus?.toLowerCase() === "production" &&
  Number(form.productionQty) === 0
) {
  showAlert("Production Quantity cannot be 0","warning");
  return;
}

  // 🚫 Wastage cannot be greater than Production
// ✅ Remarks mandatory only when wastage > production
if (
  form.machineStatus?.toLowerCase() === "production" &&
  Number(form.wastageQty) > Number(form.productionQty) &&
  (!form.remarks || form.remarks.trim() === "")
) {
  showAlert(
    "Remarks is mandatory when Wastage is greater than Production Quantity",
    "warning"
  );
  return;
}

  try {
    const payload = {
      workOrder: workOrderNumber,
      currentStage: activities.find(
        (a) => a._id === activityMachinePairs[0].activityId
      )?.activityName,
      machine: activityMachinePairs[0].machineId,
      productionDate: form.productionDate,
      productionFromTime: form.productionFromTime,
      productionToTime: form.productionToTime,
      shift: form.shift,
      machineStatus: form.machineStatus,
   productionQty:form.machineStatus?.toLowerCase() === "production" ? Number(form.productionQty) : 0,
wastageQty: form.machineStatus?.toLowerCase() === "production" ? Number(form.wastageQty) : 0,
wastePercent: form.machineStatus?.toLowerCase() === "production" ? Number(wastePercent) : 0,
      remarks: form.remarks,
      customerName: workOrderDetails.customerName,
      jobDescription: workOrderDetails.jobDescription,
      jobSize: workOrderDetails.jobSize,
      materials: workOrderDetails.materials || [],
      ups: workOrderDetails.ups,
      productionImpression: Number(form.productionImpression),
wasteImpression: Number(form.wasteImpression),
productionUps: Number(form.productionUps),
      orderQty:workOrderDetails.orderQty,
      machiness: activityMachinePairs.map((pair) => ({
        activityId: pair.activityId,
        machineId: pair.machineId,
      })),
      enteredBy: loggedInUser,
      locations: userLocations,
    };

    // ✅ EDIT MODE
    if (editingId) {
   await axios.put(
  `${BASE_URL}/api/production-real/${editingId}`,
  payload,
  { headers: { Authorization: `Bearer ${token}` } }
);

      showAlert("Production Updated Successfully ✅","success");
    }
    // ✅ CREATE MODE
    else {
      await axios.post(
  `${BASE_URL}/api/production-real`,
  payload,
  { headers: { Authorization: `Bearer ${token}` } }
);

      showAlert("Production Saved Successfully ✅","success");
    }

    fetchProductionReal();

    // reset form
    setForm({
      workOrderNo: "",
      productionDate: "",
      productionFromTime: "",
      productionToTime: "",
      shift: "",
      productionQty: "",
      wastageQty: "",
      machineStatus: "",
      remarks: "",
    });

    setActivityMachinePairs([{ activityId: "", machineId: "" }]);
    setEditingId(null);
    setWorkOrderDetails(null);

  } catch (err) {
    console.error("Error saving Production :", err);
    showAlert("Error saving Production","error");
  }
};
const formatTime12Hour = (time) => {
  if (!time) return "";

  const [hour, minute] = time.split(":");
  let h = parseInt(hour);
  const ampm = h >= 12 ? "PM" : "AM";

  h = h % 12;
  h = h ? h : 12; // 0 becomes 12

  return `${h}:${minute} ${ampm}`;
};

  return (
    <div className="container mt-2" style={{ maxWidth: "1150px", fontSize: "14px",background: "#f2fbfb",border:"2px solid black",borderRadius:"20px" }}>
      <h1 className="text-center mb-4 mt-2"><b>Production Entry</b></h1>
    

      {/* WORK ORDER INPUT */}
      <div
  className="card p-3 mt-3 "
  style={{
  border: "2px solid #0a0a0b",
  borderRadius: "10px",
  background: "#e9f8f7",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"
}}
>     
    <div className="row g-3">
          <div className="col-md-9">
            <label className="form-label text-black">WO number</label>
            <input
              type="text"
              name="workOrderNo"
              value={form.workOrderNo}
              onChange={handleChange}
              placeholder="Enter Work Order No"
              className="form-control border-dark"
            />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button
              className="btn btn-primary w-100"
              type="button"
              onClick={fetchWorkOrder}
            >
              Fetch Work Order
            </button>
          </div>
        </div>
      </div>
      {/* WORK ORDER DETAILS */}
{workOrderDetails && (
  <div className="card shadow-lg mb-4" style={{background: "#e9f8f7", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}>

  
      <h6 className="mb-0 fw-bold text-black text-center" >
        Work Order Summary
      </h6>
    
<div
    className="card shadow-lg border-0 mb-2"
    style={{ background: "#bfeeec", borderRadius: "12px", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}
  >

    <div className="card-body" >
      <div className="row g-1">

        <div className="col-md-2">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>Wo Date:</b></small>
            <div className="fw-semibold">
              {new Date(workOrderDetails.date).toLocaleDateString("en-IN")}
            </div>
          </div>
        </div>

        <div className="col-md-2">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>Customer Name:</b></small>
            <div className="fw-semibold">
              {workOrderDetails.customerName}
            </div>
          </div>
        </div>

        <div className="col-md-5">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>Job Description:</b></small>
            <div className="fw-semibold">
              {workOrderDetails.jobDescription}
            </div>
          </div>
        </div>

        <div className="col-md-2">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>Job Size:</b></small>
            <div className="fw-semibold">
              {workOrderDetails.jobSize}
            </div>
          </div>
        </div>

       
        <div className="col-md-2">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>Material Code:</b></small>
            <div className="fw-semibold">
              {workOrderDetails.materials?.map(m => m.materialCode).join(", ")}
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>Material Description:</b></small>
            <div className="fw-semibold">
              {workOrderDetails.materials?.map(m => m.materialDescription).join(", ")}
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>Material Group Desc.:</b></small>
            <div className="fw-semibold">
              {workOrderDetails.materials?.map(m => m.materialGroupDescription).join(", ")}
            </div>
          </div>
        </div>

        <div className="col-md-1">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>Mill:</b></small>
            <div className="fw-semibold">
              {[...new Set(workOrderDetails.materials?.map(m => m.mill))].join(", ")}
            </div>
          </div>
        </div>

        <div className="col-md-2">
          <div className="border rounded p-2 bg-light">
            <small className="text-black"><b>GSM:</b></small>
            <div className="fw-semibold">
              {workOrderDetails.materials?.map(m => m.gsm).join(", ")}
            </div>
          </div>
        </div>
        
        <div className="col-md-2">
  <div className="border rounded p-2 bg-light">
    <small className="text-black"><b>Paper Size:</b></small>
    <div className="fw-semibold">
      {workOrderDetails.materials?.map(m => m.paperSize).join(", ")}
    </div>
  </div>
</div>

        <div className="col-md-3">
          <div className="border rounded p-2 bg-light">
            <small className="text-black">Planner UPS:</small>
            <div className="fw-semibold">
              {workOrderDetails.ups}
            </div>
          </div>
        </div>
        <div className="col-md-3">
  <div className="border rounded p-2 bg-light">
    <small className="text-black"><b>Order Qty:</b></small>
    <div className="fw-semibold">
      {workOrderDetails.orderQty}
    </div>
  </div>
</div>
</div>
      </div>
    </div>
  </div>
)}

      {/* PRODUCTION FORM */}
 
      {workOrderDetails && (
         <div className="card shadow-lg mb-3 " style={{background: "#e9f8f7", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}>

            <h6 className="mb-3 fw-bold text-black text-center">
        Production Entry
      </h6>
       <form
  ref={formRef}
  className="card shadow-lg p-3 mt-0"
    style={{ background: "#bfeeec", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}
  onSubmit={handleSubmit}
>   
  
       <div className="row g-3 align-items-end" >

  {/* Production Date */}
  <div className="col-md-2">
    <label className="form-label text-black">Production Date</label>
    <input
      type="date"
      name="productionDate"
      value={form.productionDate}
      onChange={handleChange}
      required
      className="form-control border-dark"
    />
  </div>

  {activityMachinePairs.map((pair, index) => (
    <>

      {/* Activity */}
      <div className="col-md-2" key={`activity-${index}`}>
        <label className="form-label text-black">Activity</label>
        <select
          value={pair.activityId}
          onChange={(e) => handleActivityChange(index, e.target.value)}
          className="form-select border-dark"
          required
        >
          <option value="">Select Activity</option>
          {activities.map(a => (
            <option key={a._id} value={a._id}>
              {a.activityName}
            </option>
          ))}
        </select>
      </div>

      {/* Machine */}
      <div className="col-md-2" key={`machine-${index}`}>
        <label className="form-label text-black">Machine</label>
        <select
          value={pair.machineId}
          onChange={(e) => handleMachineChangeForPair(index, e.target.value)}
          className="form-select border-dark"
          disabled={!pair.activityId}
          required
        >
          <option value="">Select Machine</option>
          {filteredMachinesForPair(pair.activityId).map(m => (
            <option key={m._id} value={m._id}>
              {m.machineName}
            </option>
          ))}
        </select>
      </div>

     {/* 
      <div className="col-md-1 d-flex align-items-end" key={`btn-${index}`}>
        <div className="d-flex gap-2 w-100">
          {index === activityMachinePairs.length - 1 && (
            <button
              type="button"
              className="btn btn-outline-dark w-100"
              onClick={addActivityMachinePair}
            >
              +
            </button>
          )}

          {activityMachinePairs.length > 1 && (
            <button
              type="button"
              className="btn btn-outline-danger w-100"
              onClick={() => removeActivityMachinePair(index)}
            >
              -
            </button>
          )}

        </div>
      </div>
*/}
<div className="col-md-2">
  <label className="form-label text-black">From Time</label>
  <input
    type="time"
    name="productionFromTime"
    value={form.productionFromTime}
    onChange={handleChange}
    required
   className="form-control border-dark"
  />
</div>
<div className="col-md-2">
  <label className="form-label text-black">To Time</label>
  <input
    type="time"
    name="productionToTime"
    value={form.productionToTime}
    onChange={handleChange}
    required
    className="form-control border-dark"
  />
</div>

    </>
  ))}
</div>


<div className="row g-3 mt-3">
<div className="mb-3 col-md-2">
  <label className="form-label text-black">Shift</label>
  <select
    name="shift"
    value={form.shift}
    onChange={handleChange}
    required
    className="form-select border-dark"
  >
    <option value="">Select Shift</option>
    <option value="Day">Day</option>
    <option value="Night">Night</option>
   
  </select>
</div>
<div className="mb-3 col-md-3">
  <label className="form-label text-black">Machine Status</label>

  <select
    name="machineStatus"
    value={form.machineStatus}
    onChange={handleChange}
    required
    className="form-select border-dark"
  >
    <option value="">Select Status</option>

    {machineStatuses.map((s) => (
      <option key={s._id} value={s.statusName}>
        {s.statusName}
      </option>
    ))}
  </select>
</div>

{form.machineStatus?.toLowerCase() === "production"&& (
<>
<div className="mb-3 col-md-2">
  <label className="form-label text-black">Production Impression</label>
  <input
    type="number"
    name="productionImpression"
    value={form.productionImpression}
    onChange={handleChange}
    className="form-control border-dark"
    required
  />
</div>

<div className="mb-3 col-md-2">
  <label className="form-label text-black">Waste Impression</label>
  <input
    type="number"
    name="wasteImpression"
    value={form.wasteImpression}
    onChange={handleChange}
    className="form-control border-dark"
    required
  />
</div>

<div className="mb-3 col-md-2">
  <label className="form-label text-black">Production UPS</label>
  <input
    type="number"
    name="productionUps"
    value={form.productionUps}
    onChange={handleChange}
    className="form-control border-dark"
    required
  />
</div>

<div className="mb-3 col-md-2">
  <label className="form-label text-black">Production Qty</label>
  <input
    type="number"
    value={form.productionQty}
    readOnly
    className="form-control border-dark"
  />
</div>

<div className="mb-3 col-md-2">
  <label className="form-label text-black">Wastage Qty</label>
  <input
    type="number"
    value={form.wastageQty}
    readOnly
    className="form-control border-dark"
  />
</div>

<div className="mb-3 col-md-2">
  <label className="form-label text-black">Waste %</label>
  <input
    type="text"
    value={wastePercent + "%"}
    readOnly
    className="form-control border-dark"
  />
</div>
</>
)}
</div>

<div className="mb-3 col-md-12">
  <label className="form-label text-black">Remarks</label>
  <textarea
    name="remarks"
    value={form.remarks}
    onChange={handleChange}
    className="form-control border-dark"
  />
</div>
<div className="col-md-11 d-flex justify-content-center mt-3">
  <button className="btn btn-success px-4" type="submit">
  Save
</button>
</div>
        </form>
          </div>
      )}
    
      <div className="card mt-4 p-3" style={{ background: "#bfeeec", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}>
  <h5 className="mb-3 text-center">Filters</h5>

  <div className="row g-2">

    <div className="col-md-2">
      <label className="form-label text-black">WO Number</label>
      <input
        type="text"
        name="workOrder"
        placeholder="WO No"
        value={filters.workOrder}
        onChange={handleFilterChange}
       className="form-control border-dark"
      />
    </div>

    <div className="col-md-2">
      <label className="form-label text-black">From date</label>
      <input
        type="date"
        name="dateFrom"
        value={filters.dateFrom}
        onChange={handleFilterChange}
       className="form-control border-dark"
      />
    </div>

    <div className="col-md-2">
      <label className="form-label text-black">To date</label>
      <input
        type="date"
        name="dateTo"
        value={filters.dateTo}
        onChange={handleFilterChange}
      className="form-control border-dark"
      />
    </div>

    <div className="col-md-2">
      <label className="form-label text-black">Month</label>
      <input
        type="month"
        name="month"
        value={filters.month}
        onChange={handleFilterChange}
        className="form-control border-dark"
      />
    </div>
    <div className="col-md-2">
  <label className="form-label text-black">User Location</label>
  <select
    value={locationFilter}
    onChange={(e) => setLocationFilter(e.target.value)}
    className="form-select border-dark"
  >
    <option value="">All Locations</option>
    {locationOptions.map((loc, i) => (
      <option key={i} value={loc}>{loc}</option>
    ))}
  </select>
</div>

    <div className="col-md-2">
      <label className="form-label text-black">Shifts</label>
      <select
        name="shift"
        value={filters.shift}
        onChange={handleFilterChange}
        className="form-select border-dark"
      >
        <option value="">All Shifts</option>
        <option value="Day">Day</option>
        <option value="Night">Night</option>
      
      </select>
    </div>

    <div className="col-md-2">
      <label className="form-label text-black">Machines</label>
      <select
        name="machine"
        value={filters.machine}
        onChange={handleFilterChange}
        className="form-select border-dark"
      >
        <option value="">All Machines</option>
        {[...new Set(
          productionList.flatMap(item =>
            item.machiness?.map(pair =>
              pair.machineId?.machineName
            ) || []
          )
        )].map((machine, i) => (
          <option key={i} value={machine}>
            {machine}
          </option>
        ))}
      </select>
    </div>
    <div className="col-md-2">
  <label className="form-label text-black">Machine Status</label>
  <select
    name="machineStatus"
    value={filters.machineStatus}
    onChange={handleFilterChange}
    className="form-select border-dark"
  >
    <option value="">All Status</option>

    {machineStatuses.map((s) => (
      <option key={s._id} value={s.statusName}>
        {s.statusName}
      </option>
    ))}

  </select>
</div>
    <div className="col-md-2 d-flex align-items-end">
  <button
    type="button"
    className="btn btn-secondary w-100"
    onClick={clearFilters}
  >
    Clear
  </button>
</div>
  <div className="col-md-2 d-flex align-items-end">
  <button
    className="btn btn-success"
    onClick={exportToExcel}
  >
    Export Excel
  </button>
</div>

  </div>
</div>
      {productionList.length > 0 && (
  <div className="card mt-4 shadow-lg" style={{background: "#bfeeec"}}>
    
    <div className="card-header bg-primary text-white text-center" >
      <strong>Production Records</strong>
    </div>

      <div className="table-responsive" style={{ maxHeight: "350px", overflowY: "auto" }}>
      <table className="table  border-dark table-striped table-bordered table-hover mb-0">
<thead className="table-dark sticky-top">
          <tr>
            <th>SL NO</th>
            <th>WO No</th>
            <th>Customer</th>
            <th>Job Description</th>
            <th>Job Size</th>
            <th>Planner UPS</th>
            <th>Date</th>
            <th>Shift</th>
             <th>From Time</th>
            <th>To Time</th>
            <th>Activity</th>
            <th>Machine</th>
            <th>Material Code</th>
            <th>Material Description</th>
            <th>Material Group</th>
            <th>Mill</th>
            <th>GSM</th>
             <th>Paper Size</th>
            <th>Order Qty</th>
            <th>Production Impression</th>
            <th>Waste Impression</th>
            <th>Production UPS</th>
            <th>Production Qty</th>
            <th>Wastage</th>
            <th>Waste %</th>
            <th>Machine Status</th>
            <th>User</th>
            <th>Remarks</th>
            <th>User Location</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
         {filteredProductionList
  .slice(0, 30)
  .map((item, index) => (
  <tr key={item._id}>
    <td>{index + 1}</td>
    <td>{item.workOrder}</td>
    <td>{item.customerName}</td>
<td
  style={{
    cursor: "pointer",
    maxWidth: "250px",
    whiteSpace:
      expandedCell === `jobdesc-${item._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `jobdesc-${item._id}` ? null : `jobdesc-${item._id}`
    )
  }
>
  {expandedCell === `jobdesc-${item._id}`
    ? item.jobDescription
    : truncateText(item.jobDescription)}
</td>
<td>{item.jobSize}</td>
<td>{item.ups}</td>
    <td>{new Date(item.productionDate).toLocaleDateString("en-IN")}</td>
    <td>{item.shift}</td>
   <td>{formatTime12Hour(item.productionFromTime)}</td>
<td>{formatTime12Hour(item.productionToTime)}</td>
    <td>
      {item.machiness
        ?.map(pair => pair.activityId?.activityName)
        .join(", ") || "-"}
    </td>

   <td
  style={{
    maxWidth: "180px",
    cursor: "pointer",
    whiteSpace: expandedCell === `machine-${item._id}` ? "normal" : "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `machine-${item._id}` ? null : `machine-${item._id}`
    )
  }
>
  {item.machiness
    ?.map(pair => pair.machineId?.machineName)
    .join(", ") || "-"}
</td>


    <td>{item.materials?.[0]?.materialCode}</td>
<td
  style={{
    cursor: "pointer",
    maxWidth: "220px",
    whiteSpace:
      expandedCell === `matdesc-${item._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `matdesc-${item._id}` ? null : `matdesc-${item._id}`
    )
  }
>
  {expandedCell === `matdesc-${item._id}`
    ? item.materials?.[0]?.materialDescription
    : truncateText(item.materials?.[0]?.materialDescription)}
</td>
<td
  style={{
    cursor: "pointer",
    maxWidth: "200px",
    whiteSpace:
      expandedCell === `matgroup-${item._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `matgroup-${item._id}` ? null : `matgroup-${item._id}`
    )
  }
>
  {expandedCell === `matgroup-${item._id}`
    ? item.materials?.[0]?.materialGroupDescription
    : truncateText(item.materials?.[0]?.materialGroupDescription)}
</td>
<td>{item.materials?.[0]?.mill}</td>
<td>{item.materials?.[0]?.gsm}</td>
<td>{item.materials?.[0]?.paperSize}</td>
<td>{item.orderQty}</td>
<td>{item.productionImpression ||"-"}</td>
<td>{item.wasteImpression ||"-"}</td>
<td>{item.productionUps ||"-"}</td>
    <td>{item.productionQty}</td>
    <td>{item.wastageQty}</td>
    <td>{item.wastePercent ? item.wastePercent + "%" : "0%"}</td>
    <td
  style={{
    fontWeight: "bold",
    color:
      item.machineStatus?.toLowerCase() === "production"
        ? "green"
        : item.machineStatus?.toLowerCase() === "idle"
        ? "orange"
        : item.machineStatus?.toLowerCase() === "breakdown"
        ? "red"
        : "black"
  }}
>
  {item.machineStatus}
</td>
  
   <td
  style={{
    cursor: "pointer",
    maxWidth: "180px",
    whiteSpace:
      expandedCell === `user-${item._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `user-${item._id}` ? null : `user-${item._id}`
    )
  }
>
  {expandedCell === `user-${item._id}` ? (
    <>
      {item.enteredBy}
      <br />
      <small className="text-muted">
        {new Date(item.createdAt).toLocaleString()}
      </small>
    </>
  ) : (
    <>
      {truncateText(item.enteredBy)}
      <br />
      <small className="text-muted">
        {truncateText(new Date(item.createdAt).toLocaleString(), 15)}
      </small>
    </>
  )}
</td>
    <td
  style={{
    cursor: "pointer",
    maxWidth: "220px",
    whiteSpace:
      expandedCell === `remarks-${item._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `remarks-${item._id}` ? null : `remarks-${item._id}`
    )
  }
>
  {expandedCell === `remarks-${item._id}`
    ? item.remarks
    : truncateText(item.remarks)}
</td>
<td>{item.userLocations?.join(", ")}</td>
<td>
  {item.enteredBy === loggedInUser ? (
    <div className="d-flex gap-2">
      <button
        className="btn btn-sm btn-warning"
        onClick={() => handleEdit(item)}
      >
        Edit
      </button>

      <button
        className="btn btn-sm btn-danger"
        onClick={() => handleDelete(item._id)}
      >
        Delete
      </button>
    </div>
  ) : (
    <span>-</span>
  )}
</td>
  </tr>
))}
        </tbody>
      </table>
    </div>
  </div>
)}
    </div>
  );
}

export default ProductionRealDashboard;