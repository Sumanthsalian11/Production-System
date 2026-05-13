import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";
import "../styles/plannerDashboard.css";

function PlannerDashboard() {

  const navigate = useNavigate();
  const [printingTypeFilter, setPrintingTypeFilter] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [loggedInUser, setLoggedInUser] = useState("");
  const [hiddenOrders, setHiddenOrders] = useState([]);
const [filterUserLocation, setFilterUserLocation] = useState("");
  const [statusFilter, setStatusFilter] = useState("ORDER_RECEIVED");
 const [printingOrders, setPrintingOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [machines, setMachines] = useState([]);
  const [activities, setActivities] = useState([]);
const [activityMachinePairs, setActivityMachinePairs] = useState([
  { activityId: "", machineId: "" }
]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCell, setExpandedCell] = useState(null);
  
  // Filter states
  const [filterCustomer, setFilterCustomer] = useState(""); 
  const [filterWoNo, setFilterWoNo] = useState("");
  const [filterMachine, setFilterMachine] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const showAlert = (title, text, icon = "warning") => {
  Swal.fire({
    title: title,
    text: text,
    confirmButtonColor: "#3085d6",
    confirmButtonText: "OK",
    width: "350px"
  });
};
 const [materialRows, setMaterialRows] = useState([
  { 
    materialCode: "", 
    materialDescription: "", 
    materialGroupDescription: "", 
    mill: "", 
    gsm: "",
    paperSize: ""  ,
    paperQty: ""     // ✅ add this
  }
]);
const [priorities, setPriorities] = useState([]);
const formRef = useRef(null);

  const [workOrderForm, setWorkOrderForm] = useState({
    workorder2:"",
  priority: "",
 machines: [],
 productCode:"",
  colorFront: "",
  colorBack: "",
  materialCode: "",
  materialDescription: "",
  materialGroupDescription: "",   // ⭐ ADD
  mill: "",                     // ⭐ ADD
  gsm: "",   
  paperQty:"",                   // ⭐ ADD
  orderQty: "",
  wasteQty: "",
  totalQty: "",
  jobSize: "",
  paperSize: "",
  UPS: "",
  impFront: "",
  impBack: "",
  totalImp: "",
  inkDetails: "",   // ✅ FIXED (comma added)
remarks: ""
});
  const cust = () => {
    
    navigate("/customer-dashboard");
  };

const [userLocations, setUserLocations] = useState([]);

useEffect(() => {
  const token = localStorage.getItem("token");
  if (token) {
    const decoded = jwtDecode(token);
    setLoggedInUser(decoded.name);
    setUserLocations(decoded.locations || []); // ✅ important
  }
}, []);

useEffect(() => {
  if (selectedOrder && formRef.current) {
    formRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}, [selectedOrder]);
const fetchWorkOrders = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/workorders`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });

    const filtered = (res.data || []).filter(
  wo => wo.status === "PLANNED"
);

setWorkOrders(filtered);
  } catch (err) {
    console.error("Error fetching work orders:", err);
  }
};

  // Fetch data
  useEffect(() => {

    const token = localStorage.getItem("token");
if (token) {
  const decoded = jwtDecode(token);
  setLoggedInUser(decoded.name);   // ✅ name comes from login
}


   const fetchData = async () => {
  setLoading(true);
  try {

    // ✅ 1. CUSTOMER ORDERS
   // ✅ CUSTOMER ORDERS
const orderRes = await axios.get(`${BASE_URL}/api/customer-orders`, {
  params: { 
    status: "ORDER_RECEIVED",
    orderType: "Inhouse"
  },
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
});

// ✅ PRINTING ORDERS
const printingRes = await axios.get(`${BASE_URL}/api/printing-instructions`);

// ✅ FILTER ONLY ORDER_RECEIVED
const filteredPrinting = printingRes.data.filter(
  p => p.status === "ORDER_RECEIVED"
);

// ✅ SET BOTH
setOrders(orderRes.data || []);
setPrintingOrders(filteredPrinting || []);


  } catch (err) {
    console.error("FETCH ERROR:", err);
    setOrders([]);
  }

  setLoading(false);
};


    fetchData();
    fetchWorkOrders();
    fetchMachines();
    fetchMaterials();
    fetchActivities();
    fetchPriorities();
  }, [statusFilter]);

  const fetchMachines = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/machines`);
      setMachines(res.data || []);
    } catch (err) {
      console.error("Error fetching machines:", err);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/materials`);
      setMaterials(res.data || []);
    } catch (err) {
      console.error("Error fetching materials:", err);
    }
  };
const fetchActivities = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/master/activities`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    setActivities(res.data || []);
  } catch (err) {
    console.error("Error fetching activities:", err);
  }
};
const fetchPriorities = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/master/priorities`);
    setPriorities(res.data || []);
  } catch (err) {
    console.error("Error fetching priorities:", err);
  }
};
const handleDeleteWorkOrder = async (id) => {
  const confirm = window.confirm("Are you sure you want to delete this Work Order?");
  if (!confirm) return;

  try {
    await axios.delete(`${BASE_URL}/api/workorders/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });

    showAlert("Deleted Successfully ✅", "", "success");

    // refresh list
    const workRes = await axios.get(`${BASE_URL}/api/workorders`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });

    setWorkOrders(workRes.data || []);

  } catch (err) {
    console.error(err);
    showAlert("Error deleting Work Order", "", "error");
  }
};

// 🔥 ADD THIS FUNCTION HERE
const handleEditWorkOrder = (wo) => {
  setSelectedOrder({
    _id: wo._id,
    poDate: wo.poDate,
    customer: wo.customer?.name || wo.customer, // ✅ map correct field
    productName: wo.productName|| wo.description || "-", // fallback to description if productName is missing
    location: wo.location?._id || wo.location, // ✅ handle both populated and unpopulated
   qtyInLvs: wo.qtyInLvs,
   orderQty: wo.orderQty,
     slNo: wo.slNo,          // ✅ ADD THIS
    efiWoNumber: wo.efiWoNumber, // ✅ ADD THIS
      expectedDeliveryDate: wo.expectedDeliveryDate,
    status: "PLANNED"
  });

  setWorkOrderForm({
    priority: wo.priority,
    colorFront: wo.colorFront,
    colorBack: wo.colorBack,
    materialCode: wo.materialCode,
    materialDescription: wo.materialDescription,
    materialGroupDescription: wo.materialGroupDescription,
    mill: wo.mill,
    gsm: wo.gsm,
    productCode:wo.productCode,
    paperSize: wo.paperSize,
    paperQty: wo.materials?.map(m => m.paperQty).join(", "),
    orderQty: wo.orderQty,
    wasteQty: wo.wasteQty,
    totalQty: wo.totalQty,
    jobSize: wo.jobSize,
    
    UPS: wo.UPS,
    impFront: wo.impFront,
    impBack: wo.impBack,
    totalImp: wo.totalImp,
    inkDetails: wo.inkDetails,
    remarks: wo.remarks
  });
  setMaterialRows(
  wo.materials?.length > 0
    ? wo.materials
    : [{ materialCode: "", materialDescription: "", materialGroupDescription: "", mill: "", gsm: "",paperSize:"" }]
);

  setActivityMachinePairs(
    wo.machines?.map(pair => ({
      activityId: pair.activityId,
      machineId: pair.machineId
    })) || [{ activityId: "", machineId: "" }]
  );
};


// ===== Functions =====
const handleActivityChange = (index, value) => {
  const pairs = [...activityMachinePairs];
  pairs[index].activityId = value;
  pairs[index].machineId = ""; // reset machine when activity changes
  setActivityMachinePairs(pairs);
};

const handleMachineChangeForPair = (index, value) => {
  const pairs = [...activityMachinePairs];
  pairs[index].machineId = value;
  setActivityMachinePairs(pairs);
};

const addActivityMachinePair = () => {
  setActivityMachinePairs(prev => [...prev, { activityId: "", machineId: "" }]);
};

const removeActivityMachinePair = (index) => {
  setActivityMachinePairs(prev => prev.filter((_, i) => i !== index));
};

const handleMaterialChange = (index, field, value) => {
  const rows = [...materialRows];
  rows[index][field] = value;
  

  if (field === "materialCode") {
    const material = materials.find(
      m => String(m.code).trim() === String(value).trim()
    );

    rows[index].materialDescription = material?.description || "";
    rows[index].materialGroupDescription = material?.group || "";
    rows[index].mill = material?.mill || "";
    rows[index].gsm = material?.gsm || "";
    rows[index].paperSize = material?.paperSize || "";   // ✅ added
  }

  setMaterialRows(rows);
};

const addMaterialRow = () => {
  setMaterialRows(prev => [...prev, { materialCode: "", materialDescription: "", materialGroupDescription: "", mill: "", gsm: "",paperSize:"" }]);
};

const removeMaterialRow = (index) => {
  setMaterialRows(prev => prev.filter((_, i) => i !== index));
};
// ===== Filtered Machines Function =====
const filteredMachinesForPair = (activityId) => {
  if (!activityId) return [];
  const activity = activities.find(a => a._id === activityId);
  if (!activity?.machines) return [];
  return machines.filter(m => activity.machines.map(String).includes(String(m._id)));
};
const handleSelectOrder = (order) => {

  // ✅ HIDE ROW
  setHiddenOrders(prev => [...prev, order._id]);

  setSelectedOrder({
    ...order,
    qtyInLvs: order.quantity,
    customer: order.customerName,
    productName: order.description,
    expectedDeliveryDate: order.expectedDeliveryDate || order.deliveryDate,
    isPrinting: order.isPrinting || false,
    colorFront: order.colorFront,
    colorBack: order.colorBack,
    wasteQty: order.wasteQty,
    jobSize: order.jobSize,
    inkDetails: order.inkDetails
  });

  setActivityMachinePairs([{ activityId: "", machineId: "" }]);

  setMaterialRows([
    {
      materialCode: "",
      materialDescription: "",
      materialGroupDescription: "",
      mill: "",
      gsm: ""
    }
  ]);

  setWorkOrderForm({
    priority: "",
    machines: [],
    colorFront: order.colorFront || "",
    colorBack: order.colorBack || "",
    wasteQty: order.wasteQty || "",
    jobSize: order.jobSize || "",
    inkDetails: order.inkDetails || "",
    materialCode: "",
    materialDescription: "",
    materialGroupDescription: "",
    paperQty: "",
    orderQty: order.quantity || 0,
    totalQty: order.quantity || 0,
    UPS: "",
    impFront: "",
    impBack: "",
    totalImp: "",
    remarks: ""
  });
}
  const containsSpecialChars = (value) => {
  const regex = /[^a-zA-Z0-9\s.]/; 
  return regex.test(value);
};

 const handleFormChange = (e) => {
  const { name, value } = e.target;

  if (value.includes("-")) {
    showAlert("Invalid Input", "Negative values are not allowed", "warning");
    return;
  }

  // 🔴 SPECIAL CHARACTER BLOCK (for text fields)
  const textFields = ["jobSize", "inkDetails", "remarks"];
  if (textFields.includes(name)) {
    if (containsSpecialChars(value)) {
      showAlert("Special characters are not allowed");
      return;
    }
  }

  // 🔵 1 DIGIT ONLY (Color Front & Back)
  if (name === "colorFront" || name === "colorBack") {
    if (!/^[0-9]?$/.test(value)) {
      showAlert("Only 1 digit allowed");
      return;
    }
  }

  // 🔵 Waste % → Max 2 digits before decimal
  if (name === "wasteQty") {
    if (!/^\d{0,2}(\.\d{0,2})?$/.test(value)) {
      showAlert("Waste % allows only 2 digits");
      return;
    }
  }

 if (name === "UPS") {
  if (!/^[0-9]{0,2}$/.test(value)) {
    showAlert("UPS must be up to 2 digits only");
    return;
  }
}


  setWorkOrderForm(prev => {
    let updated = { ...prev, [name]: value };

 if (name === "orderQty" || name === "wasteQty" || name === "UPS" || name === "colorFront" || name === "colorBack") {

  const qty = Number(name === "orderQty" ? value : prev.orderQty) || 0;
  const waste = Number(name === "wasteQty" ? value : prev.wasteQty) || 0;
  const ups = Number(name === "UPS" ? value : prev.UPS) || 0;

  const colorFront = Number(name === "colorFront" ? value : prev.colorFront) || 0;
  const colorBack = Number(name === "colorBack" ? value : prev.colorBack) || 0;

  // Calculate Total Qty
  const totalQty = qty + (qty * (waste / 100));
  updated.totalQty = totalQty;

  if (ups > 0) {
    const imp = Math.round(totalQty / ups);

    // IMP FRONT
    updated.impFront = colorFront > 0 ? imp : 0;

    // IMP BACK
    updated.impBack = colorBack > 0 ? imp : 0;

    // TOTAL IMP
    updated.totalImp = updated.impFront + updated.impBack;
  } else {
    updated.impFront = 0;
    updated.impBack = 0;
    updated.totalImp = 0;
  }
}
// ✅ Auto control IMP Back based on Color Back
if (name === "colorBack") {
  const colorBackValue = Number(value);
  const front = Number(prev.impFront) || 0;

  if (colorBackValue === 0) {
    updated.impBack = 0;
  } else if (colorBackValue >= 1 && colorBackValue <= 9) {
    updated.impBack = front;
  }
}

// ✅ If IMP Front changes and Color Back > 0 → update IMP Back also
if (name === "impFront") {
  const front = Number(value) || 0;
  const colorBackValue = Number(prev.colorBack) || 0;

  if (colorBackValue > 0) {
    updated.impBack = front;
  }
}

// ✅ Always calculate total IMP
if (
  name === "impFront" ||
  name === "impBack" ||
  name === "colorBack"
) {
  const front = Number(
    name === "impFront" ? value : updated.impFront
  ) || 0;

  const back = Number(
    name === "impBack" ? value : updated.impBack
  ) || 0;

   updated.totalImp = front + back;
    }

    return updated;   
  });
};

const handleMachineChange = (machineId) => {
  setWorkOrderForm(prev => {
    const exists = prev.machines.includes(machineId);

    return {
      ...prev,
      machines: exists
        ? prev.machines.filter(id => id !== machineId)
        : [...prev.machines, machineId]
    };
  });
};

  const handleSubmitWorkOrder = async (e) => {
  e.preventDefault();
  if (!selectedOrder) return;
  // ===== REQUIRED FIELD VALIDATION =====
const requiredFields = [
  { key: "priority", label: "Priority" },
  { key: "colorFront", label: "Color Front" },
  { key: "colorBack", label: "Color Back" },
  { key: "orderQty", label: "Order Quantity" },
  { key: "wasteQty", label: "Waste %" },
  { key: "jobSize", label: "Job Size" },
  { key: "UPS", label: "UPS" },
  { key: "inkDetails", label: "Ink Details" },
 
];

for (let field of requiredFields) {
  if (
    workOrderForm[field.key] === "" ||
    workOrderForm[field.key] === null ||
    workOrderForm[field.key] === undefined
  ) {
   showAlert(`${field.label} is required`);
    return;
  }
}

// Paper Qty
// ✅ Paper Qty validation per material row
if (
  !(selectedOrder?.isPrinting && selectedOrder?.workorder2)
) {
  const hasInvalidPaperQty = materialRows.some(
    row => !row.paperQty || Number(row.paperQty) <= 0
  );

  if (hasInvalidPaperQty) {
    showAlert("Paper Quantity is required for all materials");
    return;
  }
}

// Materials validation
// ===== MATERIAL CODE VALIDATION =====
if (!materialRows.length) {
  showAlert("At least one material is required");
  return;
}

for (let i = 0; i < materialRows.length; i++) {
 if (
  !(selectedOrder?.isPrinting && selectedOrder?.workorder2) &&
  (!materialRows[i].materialCode || materialRows[i].materialCode.trim() === "")
) {
  showAlert("Material Code is required");
  return;
}
}

// Activity Machine validation
for (let i = 0; i < activityMachinePairs.length; i++) {
  if (!activityMachinePairs[i].activityId) {
    showAlert(`Activity is required`);
    return;
  }

  if (!activityMachinePairs[i].machineId) {
    showAlert(`Machine is required `);
    return;
  }
}

 
 // if (!workOrderForm.machines || workOrderForm.machines.length === 0) {
 //   alert("Please select at least one machine in the main Machines section");
 //   return;
 // }

  try {
  const payload = {
 customerOrderId: selectedOrder.isPrinting ? null : selectedOrder._id,
printingId: selectedOrder.isPrinting ? selectedOrder._id : null,
  slNo: selectedOrder.slNo || 0,
  efiWoNumber: selectedOrder.efiWoNumber || 0,
  workorder2:selectedOrder.workorder2,
  productCode:selectedOrder.productCode,
  purchaseOrderNo: selectedOrder.purchaseOrderNo,
   poDate: selectedOrder.poDate,
  priority: workOrderForm.priority,
 customer: selectedOrder.customer || selectedOrder.customerName, // ✅ map correct field
  productName: selectedOrder.productName || selectedOrder.description || "-",
  location: selectedOrder.location?.locationName || selectedOrder.location,
  qtyInLvs: Number(selectedOrder.qtyInLvs),
  colorFront: Number(workOrderForm.colorFront) || 0,
  colorBack: Number(workOrderForm.colorBack) || 0,

materials: materialRows
  .filter(row => row.materialCode && row.materialCode.trim() !== "")
  .map(row => ({
    materialCode: row.materialCode,
    materialDescription: row.materialDescription,
    materialGroupDescription: row.materialGroupDescription,
    mill: row.mill,
    gsm: row.gsm,
    paperSize: row.paperSize  ,
      paperQty: Number(row.paperQty) || 0,// ✅ added
  })),

  orderQty: Number(workOrderForm.orderQty) || 0,
  wasteQty: Number(workOrderForm.wasteQty) || 0,
  totalQty: Number(workOrderForm.totalQty) || 0,
  jobSize: workOrderForm.jobSize,
  UPS: Number(workOrderForm.UPS) || 0,
  impFront: Number(workOrderForm.impFront) || 0,
  impBack: Number(workOrderForm.impBack) || 0,
  totalImp: Number(workOrderForm.totalImp) || 0,
  inkDetails: workOrderForm.inkDetails,
  remarks: workOrderForm.remarks,
  expectedDeliveryDate: selectedOrder.expectedDeliveryDate,

  machines: activityMachinePairs.map(pair => ({
  activityId: pair.activityId || null,
  machineId: pair.machineId || null
}))
};

// ✅ PUT CONSOLE.LOG HERE
console.log("Material Rows State:", materialRows);
console.log("Final Payload Materials:", payload.materials);
console.log("Full Payload:", payload);
if (selectedOrder._id && selectedOrder.status === "PLANNED") {

  // 🔄 UPDATE EXISTING WORK ORDER
 await axios.put(
  `${BASE_URL}/api/workorders/${selectedOrder._id}`,
  payload,
    { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
  );

  showAlert("Work Order Updated Successfully ✅");

} else {

// ➕ CREATE NEW WORK ORDER
await axios.post(
  `${BASE_URL}/api/workorders/create`,
  payload,
  { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
);

// 🔥 UPDATE PRINTING STATUS (separate try)
if (selectedOrder.isPrinting) {
  try {
    await axios.put(
      `${BASE_URL}/api/printing-instructions/${selectedOrder._id}`,
      { status: "PLANNED" }
    );
  } catch (err) {
    console.error("Printing status update failed:", err);
  }
}

showAlert("Success", "Work Order Created Successfully ✅", "success");
}
// ✅ REMOVE FROM TABLE IMMEDIATELY
if (selectedOrder?._id) {
  setHiddenOrders(prev => [...prev, selectedOrder._id]);
}

setSelectedOrder(null);

      // Refresh data
   const orderRes = await axios.get(`${BASE_URL}/api/customer-orders`, {
  params: { 
    status: "ORDER_RECEIVED",
    orderType: "Inhouse"
  },
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setOrders(orderRes.data || []);
      const printingRes = await axios.get(`${BASE_URL}/api/printing-instructions`);

const filteredPrinting = printingRes.data.filter(
  p => p.status === "ORDER_RECEIVED"
);

setPrintingOrders(filteredPrinting || []);

      const workRes = await axios.get(`${BASE_URL}/api/workorders`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setWorkOrders(workRes.data || []);

    } catch (err) {
      console.error("Error creating Work Order:", err.response?.data || err);
      showAlert("Error", "Error creating Work Order", "error");
    }
  };
const productTypeOptions = [
  ...new Set(orders.map(o => o.materialType).filter(Boolean))
];
const printingTypeOptions = [
  ...new Set(printingOrders.map(o => o.materialType).filter(Boolean))
];
const customerOptions = [
  ...new Set(
    workOrders
      .map(wo => wo.customer?.name || wo.customer)
      .filter(Boolean)
  )
];

  // Filtered Work Orders
const filteredWorkOrders = workOrders
  .filter(wo => {

   const customerName =
      wo.customer?.name || wo.customer || "";

    const matchCustomer =
      filterCustomer === "" ||
      customerName === filterCustomer;


    const matchWo =
      filterWoNo === "" ||
      String(wo.efiWoNumber).includes(filterWoNo);

const matchMachine =
  filterMachine === "" ||
  wo.machines?.some(
    m =>
      String(m.machineId?._id || m.machineId) ===
      String(filterMachine)
  );

    const matchLocation =
      filterUserLocation === "" ||
      wo.userLocations?.includes(filterUserLocation);

    const woDateString = new Date(wo.createdAt).toISOString().split("T")[0];
    const matchFrom = dateFrom === "" || woDateString >= dateFrom;
    const matchTo = dateTo === "" || woDateString <= dateTo;

    return matchCustomer && matchWo && matchMachine && matchLocation && matchFrom && matchTo;
  })
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// ✅ LIMIT ONLY WHEN NO FILTERS
const displayedWorkOrders =
  filterWoNo || filterMachine || dateFrom || dateTo || filterCustomer
    ? filteredWorkOrders
    : filteredWorkOrders.slice(0,50);

  // Excel download
  const downloadExcel = () => {
  if (!filteredWorkOrders.length) return showAlert("No data to download!");

  const data = filteredWorkOrders.map(wo => ({
    "SL No": wo.slNo,
    "WO NO": wo.efiWoNumber,
    "PO number":wo.purchaseOrderNo,
    "Priority": wo.priority,
    "Customer": wo.customer?.name || wo.customer,
    "Job Description": wo.description || wo.productName || "-" ,
    "WO Date": new Date(wo.createdAt).toLocaleDateString("en-IN"),
    "Qty In LVS":  wo.qtyInLvs || 0,
    "Location": wo.location?.locationName || wo.location,
    "Activity": wo.machines?.map(pair => {
      const act = activities.find(a => a._id === pair.activityId);
      return act?.activityName || "-";
    }).join(", "),
    "Machines": wo.machines?.map(pair => {
      const mac = machines.find(m => m._id === pair.machineId);
      return mac?.machineName || "-";
    }).join(", "),
    "Color Front": wo.colorFront,
    "Color Back": wo.colorBack,
    "Paper Code": wo.materials?.map(m => m.materialCode).join(", ") || "-",
    "Paper Description": wo.materials?.map(m => m.materialDescription).join(", ") || "-",
    "Paper Group Description": wo.materials?.map(m => m.materialGroupDescription).join(", ") || "-",
    "Mill": wo.materials?.map(m => m.mill).join(", ") || "-",
    "GSM": wo.materials?.map(m => m.gsm).join(", ") || "-",
    "Paper Size": wo.materials?.map(m => m.paperSize).join(", ") || "-",
    "Paper Qty": wo.materials?.map(m => m.paperQty).join(", ") || "-",
    "Order Qty": wo.orderQty,
    "Waste Qty": wo.wasteQty,
    "Total Qty": wo.totalQty,
    "Job Size": wo.jobSize,
    "UPS": wo.UPS,
    "IMP Front": wo.impFront,
    "IMP Back": wo.impBack,
    "Total IMP": wo.totalImp,
    "Ink Details": wo.inkDetails,
    "Remarks": wo.remarks,
    "Planning": wo.planningUser
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "WorkOrders");
  const woNo =
  filteredWorkOrders.length === 1
    ? filteredWorkOrders[0].efiWoNumber
    : "ALL";
XLSX.writeFile(workbook, `WorkOrders-${woNo}.xlsx`);
};

   

  // PDF download using html2pdf.js
  const downloadPDF = () => {
    const element = document.getElementById("planned-workorders-table");
    if (!element) return showAlert("No table to download!");

    const clonedTable = element.cloneNode(true);
    clonedTable.style.width = "100%";
    clonedTable.style.borderCollapse = "collapse";
    clonedTable.querySelectorAll("th, td").forEach(cell => {
      cell.style.border = "1px solid #000";
      cell.style.padding = "4px";
      cell.style.whiteSpace = "normal";
      cell.style.wordBreak = "break-word";
      cell.style.fontSize = "10px";
    });

    const container = document.createElement("div");
    container.appendChild(clonedTable);

    const opt = {
      margin: 0.2,
      filename: "WorkOrders.pdf",
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, scrollY: -window.scrollY },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(container).save();
  };

  const getBase64ImageFromURL = async (url) => {
  const data = await fetch(url);
  const blob = await data.blob();

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      resolve(reader.result);
    };
  });
};
// Company Format PDF
const downloadFormattedPDF = async () => {
  try {
    const isFilterApplied = filterWoNo || filterMachine || dateFrom || dateTo || filterUserLocation;
    let dataToDownload = [];

    if (!activities.length || !machines.length) {
      showAlert("Please wait, activities or machines are still loading...");
      return;
    }

    if (isFilterApplied) {
      dataToDownload = filteredWorkOrders;
    } else {
      const res = await axios.get(`${BASE_URL}/api/workorders`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      dataToDownload = res.data || [];
    }

    if (!dataToDownload.length) {
      showAlert("No data to download!");
      return;
    }

    const DOCUMENT_ID = "MPi_SP_QS_PLAN_T086_V1.00";
    const doc = new jsPDF("p", "mm", "a4");


    const plainStyle = {
      theme: "grid",
      styles: {
        fontSize: 9,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
        fillColor: false
      },
      headStyles: {
        fillColor: false,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0]
      },
      bodyStyles: {
        fillColor: false
      },
      alternateRowStyles: {
        fillColor: false
      }
    };
  dataToDownload.forEach((wo, index) => {
      if (index !== 0) doc.addPage();

      doc.setDrawColor(0);
      doc.setLineWidth(0.8);
      doc.rect(5, 5, 200, 287);

      let y = 12;

      // HEADER
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Manipal Payment and Identity Solutions Limited", 105, y, { align: "center" });

      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Internal Document", 14, y);

      y += 5;
      doc.text(`Document ID: ${DOCUMENT_ID}`, 14, y);

      y += 5;
doc.text(`Request Location: ${wo.location ?? "-"}`, 14, y);
 y += 5;
doc.text(
  `Printing Location: ${
    wo.userLocations && wo.userLocations.length > 0
      ? wo.userLocations.join(", ")
      : "-"
  }`,
  14,
  y
);
      y += 8;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("WORK ORDER SHEET", 105, y, { align: "center" });

      y += 8;

      // BASIC DETAILS
   // BASIC DETAILS
autoTable(doc, {
  ...plainStyle,
  startY: y,
  body: [
    ["PO NO", wo.purchaseOrderNo ??"-", "Priority", wo.priority ?? "-"],
    ["WO NO",
    { content: wo.efiWoNumber ?? "-", styles: { fontStyle: "bold" } }, "Customer",
      wo.customer?.name ?? wo.customer ?? "-"],
    ["WO Date",
      wo.createdAt ? new Date(wo.createdAt).toLocaleDateString("en-IN") : "-",
      "Job Description",
    { content: wo.productName ?? "-", styles: { fontStyle: "bold" } }
    ],
   [
  "Product Code",
  { content: wo.productCode ?? "-",  styles: { fontStyle: "bold" } ,colSpan: 3 }
]
  ],
  didParseCell: function (data) {
    // Bold only label columns (1st and 3rd)
    if (data.section === "body" && (data.column.index === 0 || data.column.index === 2)) {
      data.cell.styles.fontStyle = "bold";
    }
  }
});

      y = doc.lastAutoTable.finalY + 8;

      // MATERIAL DETAILS
      doc.setFont("helvetica", "bold");
      doc.text("PAPER DETAILS", 14, y);
      y += 4;

      autoTable(doc, {
        ...plainStyle,
        startY: y,
        head: [["Paper Code", "Description", "Group", "Mill Name", "GSM", "Paper Size","Paper Qty(in KG/Sheets)"]],
        body: (wo.materials || []).length
          ? wo.materials.map(m => [
              m.materialCode ?? "-",
              m.materialDescription ?? "-",
              m.materialGroupDescription ?? "-",
              m.mill ?? "-",
              m.gsm ?? "-",
              m.paperSize ?? "-",
              m.paperQty ?? "-"   
            ])
          : [["-", "No Materials", "-", "-", "-", "-"]]
      });

      y = doc.lastAutoTable.finalY + 8;

      // ACTIVITY & MACHINE
doc.text("ACTIVITY & MACHINE DETAILS", 14, y);
y += 4;

// 🔍 Check if activity contains "Offset"
const activityNames = (wo.machines || []).map(pair => {
  const act = activities.find(
    a =>
      String(a._id) ===
      String(pair.activityId?._id || pair.activityId)
  );

  return act?.activityName || "-";
});

const machineNames = (wo.machines || []).map(pair => {
  const mac = machines.find(
    m =>
      String(m._id) ===
      String(pair.machineId?._id || pair.machineId)
  );

  return mac?.machineName || "-";
});

// If any activity is Offset
const isOffset = activityNames.some(name =>
  name.toLowerCase().includes("offset")
);

autoTable(doc, {
  ...plainStyle,
  startY: y,
  head: isOffset
    ? [["Activity", "Machines", "Color Fall", "Impression"]]
    : [["Activity", "Machines", "Color Fall", "Impression", "Total IMP"]],
  body: [
    isOffset
      ? [
          activityNames.join(", "),
          machineNames.join(", "),
          `${wo.colorFront ?? 0} / ${wo.colorBack ?? 0}`,
          `${wo.impFront ?? 0} / ${wo.impBack ?? 0}`
        ]
      : [
          activityNames.join(", "),
          machineNames.join(", "),
          `${wo.colorFront ?? 0} / ${wo.colorBack ?? 0}`,
          `${wo.impFront ?? 0} / ${wo.impBack ?? 0}`,
          wo.totalImp ?? "-"
        ]
  ]
});

      y = doc.lastAutoTable.finalY + 8;

      // QUANTITY
      doc.text("QUANTITY DETAILS", 14, y);
      y += 4;

      autoTable(doc, {
        ...plainStyle,
        startY: y,
        head: [["Order Qty", "Waste %", "Total Qty", "Job Size", "UPS"]],
        body: [[
         {content: wo.orderQty ?? "-", styles: { fontStyle: "bold" }} ,
          wo.wasteQty ?? "-",
         {content: wo.totalQty ?? "-",styles: { fontStyle: "bold" }} ,
          wo.jobSize ?? "-",
          wo.UPS ?? "-"
        ]]
      });

      y = doc.lastAutoTable.finalY + 8;

      // INK DETAILS
      doc.text("INK DETAILS", 14, y);
      y += 4;

      autoTable(doc, {
        ...plainStyle,
        startY: y,
        body: [[wo.inkDetails ?? "-"]]
      });

      y = doc.lastAutoTable.finalY + 8;

      // REMARKS
      doc.text("REMARKS", 14, y);
      y += 4;

      autoTable(doc, {
        ...plainStyle,
        startY: y,
        body: [[wo.remarks ?? "-"]]
      });

      y = doc.lastAutoTable.finalY + 12;

      // APPROVAL
      doc.setFont("helvetica", "normal");
      doc.text("Work Order Approved and Signed By:", 14, y);
      y += 6;
      doc.text(`Name: ${wo.planningUser ?? "-"}`, 14, y);
      y += 6;
      doc.text(`Work Order Date: ${
        wo.createdAt ? new Date(wo.createdAt).toLocaleDateString("en-IN") : "-"
      }`, 14, y);
      y += 10;
      doc.text("Signature: ________________________________", 14, y);

      doc.setFontSize(8);
      doc.text(`Page ${index + 1} of ${dataToDownload.length}`, 105, 290, { align: "center" });
    });
    
const firstWo = dataToDownload[0];
const woNo = firstWo?.efiWoNumber || "ALL";

doc.save(`MPI_WorkOrder_${woNo}.pdf`);

  } catch (error) {
    console.error("PDF generation error:", error);
    showAlert("Error generating PDF");
  }
};

  return (
    <div style={{ padding: "20px" }}>
      <div className="dashboard-container">
      <h1 className="text-center fw-bold">Planner Dashboard</h1>
       <div className="dashboard-actions" style={{ marginBottom: "15px", display: "flex", gap: "10px" ,border: "1px solid #8a8a8a" }}>
  
</div>
<div className="d-flex justify-content-between align-items-center mb-3">

  <select
    value={statusFilter}
    onChange={(e) => {
      setStatusFilter(e.target.value);
      setSelectedOrder(null);
    }}
    style={{ padding: "8px", borderRadius: "6px", width: "200px" }}
  >
    <option value="">All</option>
    <option value="ORDER_RECEIVED">Order Received</option>
    <option value="PLANNED">Planned Work Orders</option>
  </select>

  <button onClick={cust} className="btn btn-primary">
    Purchase Order
  </button>

</div>
{(statusFilter === "ORDER_RECEIVED" || statusFilter === "") && orders.length > 0 && (
  <div style={{ marginTop: "20px" }}>
    <h4 className="text-center fw-semibold">Purchase Order Received</h4>

    {/* ✅ FILTER BAR */}
    <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <label style={{ fontSize: "11px", fontWeight: "600", color: "#1a6bbd" }}>
          <i className="bi bi-filter me-1"></i>Product Type
        </label>
        <select
          className="form-control"
          style={{ width: "200px", borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px" }}
          value={productTypeFilter}
          onChange={(e) => setProductTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {productTypeOptions.map((type, i) => (
            <option key={i} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {productTypeFilter && (
        <button
          className="btn btn-sm"
          style={{ marginTop: "16px", background: "#6c757d", color: "#fff", borderRadius: "8px", fontSize: "12px" }}
          onClick={() => setProductTypeFilter("")}
        >
          <i className="bi bi-x-circle me-1"></i>Clear
        </button>
      )}
    </div>

    <div className="table-container">
      <table className="table-modern">
        <thead>
          <tr>
            <th>PO No</th>
            <th>Customer Name</th>
            <th>Job Description</th>
            <th>Order Quantity</th>
            <th>Location</th>
            <th>Product Type</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders
            .filter(order =>
              productTypeFilter
                ? order.materialType === productTypeFilter
                : true
            )
            .sort((a, b) => {
              const aAllowed = a.userLocations?.some(loc =>
                userLocations.includes(loc)
              ) ? 1 : 0;
              const bAllowed = b.userLocations?.some(loc =>
                userLocations.includes(loc)
              ) ? 1 : 0;
              return bAllowed - aAllowed;
            })
            .map(order => (
              <tr key={order._id}>
                <td>{order.purchaseOrderNo || "-"}</td>
                <td>{order.customer?.name || order.customerName}</td>
                <td>{order.description || order.productName || "-"}</td>
                <td>{order.quantity}</td>
                <td>{order.location?.locationName || order.location || "N/A"}</td>
                <td>{order.materialType || "-"}</td>
                <td>{order.status}</td>
                <td>
                  {order.userLocations?.some(loc =>
                    userLocations.includes(loc)
                  ) && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleSelectOrder(order)}
                    >
                      Convert to Work Order
                    </button>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  </div>
)}
       {(statusFilter === "ORDER_RECEIVED" || statusFilter === "") && printingOrders.length > 0 && (
  <>
    <h4 className="text-center fw-semibold mt-4">Printing Orders Received</h4>

    {/* ✅ FILTER BAR */}
    <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <label style={{ fontSize: "11px", fontWeight: "600", color: "#1a6bbd" }}>
          <i className="bi bi-filter me-1"></i>Product Type
        </label>
        <select
          className="form-control"
          style={{ width: "200px", borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px" }}
          value={printingTypeFilter}
          onChange={(e) => setPrintingTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {printingTypeOptions.map((type, i) => (
            <option key={i} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {printingTypeFilter && (
        <button
          className="btn btn-sm"
          style={{ marginTop: "16px", background: "#6c757d", color: "#fff", borderRadius: "8px", fontSize: "12px" }}
          onClick={() => setPrintingTypeFilter("")}
        >
          <i className="bi bi-x-circle me-1"></i>Clear
        </button>
      )}
    </div>

    <table className="table-modern table-bordered">
      <thead>
        <tr>
          <th>PO No</th>
          <th>Customer</th>
          <th>Job Description</th>
          <th>Order Quantity</th>
          <th>Location</th>
          <th>Work Order</th>
          <th>Product Type</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {printingOrders
          .filter(order => !hiddenOrders.includes(order._id))
          .filter(order =>
            printingTypeFilter
              ? order.materialType === printingTypeFilter
              : true
          )
          .sort((a, b) => {
            const aAllowed = a.userLocations?.some(loc =>
              userLocations.includes(loc)
            ) ? 1 : 0;
            const bAllowed = b.userLocations?.some(loc =>
              userLocations.includes(loc)
            ) ? 1 : 0;
            return bAllowed - aAllowed;
          })
          .map(order => (
            <tr key={order._id}>
              <td>{order.purchaseOrderNo || "-"}</td>
              <td>{order.customerName || "-"}</td>
              <td>{order.description || "-"}</td>
              <td>{order.quantity || "-"}</td>
              <td>{order.location || "-"}</td>
              <td>{order.workorder2 || "-"}</td>
              <td>{order.materialType || "-"}</td>
              <td style={{ color: "blue", fontWeight: "bold" }}>
                {order.status}
              </td>
              <td>
                {order.userLocations?.some(loc =>
                  userLocations.includes(loc)
                ) && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() =>
                      handleSelectOrder({
                        ...order,
                        isPrinting: true
                      })
                    }
                  >
                    Convert to Work Order
                  </button>
                )}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  </>
)}
     {selectedOrder && (
  <div
    ref={formRef}
    className="card shadow mt-4 text-center"
    style={{ padding: "20px",  background: "#e9f8f7" }}
  >
    <h3>{selectedOrder.status === "PLANNED" ? "Edit Work Order" : "Create Work Order"}</h3>
    <form onSubmit={handleSubmitWorkOrder} className="container-fluid">

<form
  className="p-3 rounded"
  style={{ border: "2px solid #000", padding: "15px" }}
>
  {/* ===== First Row: Customer → Expected Date ===== */}
 <div
  className="card shadow-lg border-0 mb-3"
  style={{ background: "#c8d9eaf0", borderRadius: "12px" }}
>
  <div className="card-body">
    <div className="row g-3 text-center">

      <div className="col-md-3">
  <div className="p-2 border border-dark rounded bg-light">
    <small className="text-black"><b>Customer Name:</b></small>
    <h6>{selectedOrder.customer || selectedOrder.customerName || "-"}</h6>
  </div>
</div>

      <div className="col-md-4">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Job Description:</b></small>
          <h6>{selectedOrder.productName || selectedOrder.description || "-"}</h6>
        </div>
      </div>

      <div className="col-md-2">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Location:</b></small>
          <h6>{selectedOrder.location?.locationName || selectedOrder.location || "-"}</h6>
        </div>
      </div>

      <div className="col-md-2">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Expected Date:</b></small>
          <h6>
            {selectedOrder?.expectedDeliveryDate
              ? selectedOrder.expectedDeliveryDate.split("T")[0]
              : "-"}
          </h6>
        </div>
      </div>

    </div>
  </div>
</div>
 
<div className="row g-2 mb-3 align-items-end mt-4">
  {/* Priority */}
  <div className="col-md-2">
    <label className="small text-black">Priority</label>
    <select
      name="priority"
      value={workOrderForm.priority}
      onChange={handleFormChange}
      className="form-select form-select-sm"
      style={{ borderColor: "black" }}
    >
      <option value="">Select</option>
      {priorities.map((p) => (
        <option key={p._id} value={p.name}>{p.name}</option>
      ))} required
    </select>
  </div>
  <div className="col-md-1 mb-0">
    <label className="small text-black">UPS</label>
    <input
      type="number"
      name="UPS"
      value={workOrderForm.UPS}
      onChange={handleFormChange}
      className="form-control form-control-sm"
      style={{ borderColor: "black" }}
      onKeyDown={(e) => {
        if (e.key === "-" || e.key === "e" || e.key === "+" || e.key === ".") {
          e.preventDefault();
          showAlert("Special characters are not allowed");
        }
      }}
      required
    />
  </div>
  <div className="col-md-2">
      <label className="small text-black">Remarks</label>
      <input
        type="text"
        name="remarks"
        value={workOrderForm.remarks}
        onChange={handleFormChange}
        className="form-control form-control-sm"
        style={{ borderColor: "black" }}
      />
    </div>

  {/* Activity + Machine Pairs */}
  {activityMachinePairs.map((pair, index) => (
    <div key={index} className="col-md-6 d-flex align-items-end gap-3">
      {/* Activity */}
      <div className="flex-fill">
        <label className="small  text-black">Activity</label>
        <select
          className="form-select form-select-sm"
          value={pair.activityId}
          onChange={(e) => handleActivityChange(index, e.target.value)}
          required
          style={{ borderColor: "black" }}
        >
          <option value="">Select Activity</option>
          {activities.map((a) => (
            <option key={a._id} value={a._id}>{a.activityName}</option>
          ))}
        </select>
      </div>

      {/* Machine */}
      <div className="flex-fill">
        <label className="small  text-black">Machine</label>
        <select
          className="form-select form-select-sm"
          value={pair.machineId}
          onChange={(e) => handleMachineChangeForPair(index, e.target.value)}
          disabled={!pair.activityId}
          required
          style={{ borderColor: "black" }}
        >
          <option value="">Select Machine</option>
          {filteredMachinesForPair(pair.activityId).map((m) => (
            <option key={m._id} value={m._id}>{m.machineName}</option>
          ))}
        </select>
      </div>

      {/* Buttons */}
      <div className="d-flex gap-1" style={{ marginTop: "22px" }}>
        {index === activityMachinePairs.length - 1 && (
          <button type="button" className="btn btn-sm btn-dark" onClick={addActivityMachinePair}>+</button>
        )}
        {activityMachinePairs.length > 1 && (
          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeActivityMachinePair(index)}>-</button>
        )}
      </div>
    </div>
  ))}
   
</div>

  
  {/* ===== Materials ===== */}
  {!(selectedOrder?.isPrinting && selectedOrder?.workorder2) && (
  <>
 <h5 className="mt-2">Materials</h5>
{materialRows.map((row, index) => (
  <div key={index} className="row g-0 align-items-end mb-10">
    {/* Paper Code */}
    <div className="col-md-2">
      <label className="small text-black">Paper Code</label>
     <input
  type="text"
  className="form-control form-control-sm"
  value={row.materialCode}
        onChange={(e) => handleMaterialChange(index, "materialCode", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "-" || e.key === "e" || e.key === "+") {
            e.preventDefault();
            showAlert("Special characters are not allowed");
          }
        }}
        style={{ borderColor: "black" }}  required
      />
    </div>

    {/* Description */}
    <div className="col-md-2">
      <label className="small text-black">Description</label>
      <input
        type="text"
        className="form-control form-control-sm"
        value={row.materialDescription}
        readOnly
        style={{ borderColor: "black" }}
      />
    </div>

    {/* Group Description */}
    <div className="col-md-2">
      <label className="small text-black">Group Desc</label>
      <input
        type="text"
        className="form-control form-control-sm"
        value={row.materialGroupDescription}
        readOnly
        style={{ borderColor: "black" }}
      />
    </div>

    {/* Mill */}
    <div className="col-md-1">
      <label className="small text-black">Mill Name</label>
      <input
        type="text"
        className="form-control form-control-sm"
        value={row.mill}
        readOnly
        style={{ borderColor: "black" }}
      />
    </div>

    {/* GSM */}
    <div className="col-md-1">
      <label className="small text-black">GSM</label>
      <input
        type="text"
        className="form-control form-control-sm"
        value={row.gsm}
        readOnly
        style={{ borderColor: "black" }}
      />
    </div>
    <div className="col-md-1">
  <label className="small text-black">Paper Size</label>
  <input
    type="text"
    className="form-control form-control-sm"
    value={row.paperSize}
    readOnly
    style={{ borderColor: "black" }}
  />
</div>
     <div className="col-md-1">
<label className="small text-black">Paper Qty(in KG/Sheets)</label>
<input
  type="number"
  value={row.paperQty}
  onChange={(e) =>
    handleMaterialChange(index, "paperQty", e.target.value)
  }
className="form-control form-control-sm border-dark"
style={{
      fontSize: "12px",
     fontStyle:"normal" }}
min="0"
  onKeyDown={(e) => {
          if (e.key === "-" || e.key === "e" || e.key === "+") {
            e.preventDefault();
            showAlert("Special characters are not allowed");
          }
        }} 
required
/>
</div>

      {/* Add/Remove Buttons */}
      <div className="col-md-1 d-flex gap-1" style={{ marginTop: "22px" }}>
      {index === materialRows.length - 1 && (
        <button type="button" className="btn btn-sm btn-dark" onClick={addMaterialRow}>+</button>
      )}
      {materialRows.length > 1 && (
        <button type="button" className="btn btn-sm btn-danger" onClick={() => removeMaterialRow(index)}>-</button>
      )}
    </div>
  </div>
))}
</>
  )}
 

 <div className="card shadow-lg border-0 mb-3"  style={{ background: "#c8d9eaf0", borderRadius: "12px" }}>
  <div className="card-body">
    <div className="row g-1 text-center">

  <div className="col-md-2">
  <div className="p-2 border border-dark rounded bg-light">
    <small className="text-black"><b>Order Qty:</b></small>

    <input
      type="number"
      name="orderQty"
      value={workOrderForm.orderQty}
      onChange={handleFormChange}
      className="form-control form-control-sm text-center fw-bold"
      style={{
        border: "none",
        background: "transparent",
        outline: "none"
      }}
      min="0"
      onKeyDown={(e) => {
        if (e.key === "-" || e.key === "e" || e.key === "+") {
          e.preventDefault();
          showAlert("Special characters are not allowed");
        }
      }}
      required
    />
  </div>
</div>

      <div className="col-md-2">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Waste %:</b></small>
          <h6>{workOrderForm.wasteQty}</h6>
        </div>
      </div>

      <div className="col-md-2">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Total Qty:</b></small>
          <h6>{workOrderForm.totalQty}</h6>
        </div>
      </div>

      <div className="col-md-3">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-text"><b>Job Size:</b></small>
          <h6>{workOrderForm.jobSize}</h6>
        </div>
      </div>

      <div className="col-md-2">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Color Front:</b></small>
          <h6>{workOrderForm.colorFront}</h6>
        </div>
      </div>

      <div className="col-md-2">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Color Back:</b></small>
          <h6>{workOrderForm.colorBack}</h6>
        </div>
      </div>

      <div className="col-md-3">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Impression Front:</b></small>
          <h6>{workOrderForm.impFront}</h6>
        </div>
      </div>

      <div className="col-md-3">
        <div className="p-2 border border-dark rounded bg-light">
          <small className="text-black"><b>Impression Back:</b></small>
          <h6>{workOrderForm.impBack}</h6>
        </div>
      </div>

      <div className="col-md-3">
        <div className="p-2 border border-dark rounded bg-light text-black">
          <small className="text-black"><b>Total Impression:</b></small>
          <h6>{workOrderForm.totalImp}</h6>
        </div>
      </div>
 <div className="col-md-15">
  <div className="p-2 border border-dark rounded bg-light">
      <small className="text-black"><b>Ink Details:</b></small>
  <h6>{workOrderForm.inkDetails || "-"}</h6>
</div>
    </div>
  </div>

   
</div>
  </div>
</form>

            <div style={{ marginTop: "10px" }}>
              <div className="form-actions" style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
  <button type="submit" className="btn btn-success">Save Work Order</button>
 <button
  type="button"
  onClick={() => {
    if (selectedOrder?._id) {
      setHiddenOrders(prev =>
        prev.filter(id => id !== selectedOrder._id)
      );
    }

    setSelectedOrder(null);
    setActivityMachinePairs([{ activityId: "", machineId: "" }]);
  }}
  className="btn btn-secondary"
>
  Cancel
</button>
</div>
            </div>
          </form>
        </div>
      )}

      {(statusFilter === "PLANNED" || statusFilter === "") && workOrders.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h4 className="text-center fw-semibold mb-3">Planned Work Orders</h4>
<div className="premium-toolbar" style={{ border: "1px solid #000", borderRadius: "8px", padding: "10px", marginBottom: "15px" }}>

<div className="toolbar-row">

  {/* LEFT: ACTION BUTTONS */}
  <div className="toolbar-actions">
    <button className="btn btn-success" onClick={downloadExcel}>📊 Download Excel</button>
    <button className="btn btn-secondary" onClick={downloadFormattedPDF}>🏢 Download PDF</button>
  </div>

  {/* RIGHT: FILTERS */}
  <div className="toolbar-filters">
    <div className="input-group">
      <input
        type="text"
        placeholder="🔍 WO Number"
        value={filterWoNo}
        onChange={(e) => setFilterWoNo(e.target.value)}
      />
    </div>

    <select
      value={filterMachine}
      onChange={(e) => setFilterMachine(e.target.value)}
      className="premium-select border-dark"
    >
      <option value="">All Machines</option>
      {machines.map(m => (
        <option key={m._id} value={m._id}>{m.machineName}</option>
      ))}
    </select>
    
<select
  value={filterCustomer}
  onChange={(e) => setFilterCustomer(e.target.value)}
  className="premium-select border-dark"
>
  <option value="">All Customers</option>

  {customerOptions.map((cust, index) => (
    <option key={index} value={cust}>
      {cust}
    </option>
  ))}
</select>

    <select
  value={filterUserLocation}
  onChange={(e) => setFilterUserLocation(e.target.value)}
  className="premium-select border-dark"
>
  <option value="">User Locations</option>

  {[...new Set(workOrders.flatMap(wo => wo.userLocations || []))].map(loc => (
    <option key={loc} value={loc}>{loc}</option>
  ))}
</select>

    <input
      type="date"
      value={dateFrom}
      onChange={(e) => setDateFrom(e.target.value)}
      className="premium-date border-dark"
    />

    <input
      type="date"
      value={dateTo}
      onChange={(e) => setDateTo(e.target.value)}
      className="premium-date border-dark"
    />

    <button
      className="clear-btn"
      onClick={() => {
        setFilterCustomer("");
        setFilterWoNo("");
        setFilterMachine("");
        setFilterUserLocation("");
        setDateFrom("");
        setDateTo("");
      }}
    >
      Clear
    </button>
  </div>
</div>
</div>

                 <div className="scrollable-table-container">
  <table className="planned-workorders-table" id="planned-workorders-table">
            <thead>
              <tr>
                <th>SL No</th>
                <th>WO NO</th>
                <th>Product Code</th>
                <th>PO No</th>
                <th>Priority</th>
                <th>Customer Name</th>
                <th>Job Description</th>
                <th>WO Date</th>
                <th>Location</th>
                <th>Activity</th>
                <th>Machines</th>
                <th>Color Front</th>
                <th>Color Back</th>
                <th>Paper Code</th>
                <th>Description</th>
                <th>Group Description</th>
                <th>Mill name</th>       
                <th>GSM</th>  
                <th>Paper Size</th>    
                <th>Paper Qty(in KG/Sheets)</th>
                <th>Order Qty</th>
                <th>Waste %</th>
                <th>Total Qty</th>
                <th>Job Size</th>
                <th>UPS</th>
                <th>Impression Front</th>
                <th>Impression Back</th>
                <th>Total Impression</th>
                <th>Ink Details</th>
                <th>Remarks</th>
                <th>Planning</th>
                <th>User Locations</th>
                <th>Edit</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedWorkOrders.map(wo => (
                <tr key={wo._id}>
                  <td>{wo.slNo}</td>
                  <td>{wo.efiWoNumber}</td>
                  <td>{wo.productCode}</td>
                  <td>{wo.purchaseOrderNo ||"--"}</td>
                  <td>{wo.priority}</td>
                  <td>{wo.customer?.name || wo.customer}</td>
                  <td
  className={expandedCell === wo._id + "job" ? "expanded" : "truncate"}
  onClick={() =>
    setExpandedCell(
      expandedCell === wo._id + "job" ? null : wo._id + "job"
    )
  }
>
  {wo.productName || "-"}
</td>
                  <td>{new Date(wo.createdAt).toLocaleDateString("en-IN")}</td>
                  <td>{wo.location}</td>
                 <td>
  {wo.machines?.map(pair => {
const activity = activities.find(
  a =>
    String(a._id) ===
    String(pair.activityId?._id || pair.activityId)
);
    return activity?.activityName || "-";
  }).join(", ")}
</td>
<td>
  {wo.machines?.map(pair => {
  const machine = machines.find(
  m =>
    String(m._id) ===
    String(pair.machineId?._id || pair.machineId)
);
    return machine?.machineName || "-";
  }).join(", ")}
</td>
                  <td>{wo.colorFront}</td>
                  <td>{wo.colorBack}</td>
                 <td>
  {wo.materials?.map(m => m.materialCode).join(", ")}
</td>

<td
  className={expandedCell === wo._id + "desc" ? "expanded" : "truncate"}
  onClick={() =>
    setExpandedCell(
      expandedCell === wo._id + "desc" ? null : wo._id + "desc"
    )
  }
>
  {wo.materials?.map(m => m.materialDescription).join(", ") || "-"}
</td>

<td
  className={expandedCell === wo._id + "group" ? "expanded" : "truncate"}
  onClick={() =>
    setExpandedCell(
      expandedCell === wo._id + "group" ? null : wo._id + "group"
    )
  }
>
  {wo.materials?.map(m => m.materialGroupDescription).join(", ") || "-"}
</td>

<td>
  {wo.materials?.map(m => m.mill).join(", ")}
</td>

<td>
  {wo.materials?.map(m => m.gsm).join(", ")}
</td>
<td>
  {wo.materials?.map(m => m.paperSize).join(", ")}
</td>
                <td>{wo.materials?.map(m => m.paperQty).join(", ")}</td>
                  <td>{wo.orderQty}</td>
                  <td>{wo.wasteQty}</td>
                  <td>{wo.totalQty}</td>
                  <td>{wo.jobSize}</td>
                  <td>{wo.UPS}</td>
                  <td>{wo.impFront}</td>
                  <td>{wo.impBack}</td>
                  <td>{wo.totalImp}</td>
                <td
  className={expandedCell === wo._id + "ink" ? "expanded" : "truncate"}
  onClick={() =>
    setExpandedCell(expandedCell === wo._id + "ink" ? null : wo._id + "ink")
  }
>
  {wo.inkDetails || "-"}
</td>

<td
  className={expandedCell === wo._id + "remarks" ? "expanded" : "truncate"}
  onClick={() =>
    setExpandedCell(expandedCell === wo._id + "remarks" ? null : wo._id + "remarks")
  }
>
  {wo.remarks || "-"}
</td>
<td>
  {wo.planningUser
    ? `${wo.planningUser} - ${new Date(wo.createdAt).toLocaleString("en-IN")}`
    : "-"
  }
</td>
<td>
  {wo.userLocations && wo.userLocations.length > 0
    ? wo.userLocations.join(", ")
    : "-"}
</td>
<td>
  {loggedInUser &&
   wo.planningUser &&
   wo.planningUser.trim() === loggedInUser.trim() ? (
    <button
      className="btn btn-primary"
      onClick={() => handleEditWorkOrder(wo)}
    >
      Edit
    </button>
  ) : (
    "-"
  )}
</td>
   


   <td>
  {loggedInUser &&
   wo.planningUser &&
   wo.planningUser.trim() === loggedInUser.trim() ? (
    <button
      className="btn btn-danger"
      onClick={() => handleDeleteWorkOrder(wo._id)}
    >
      Delete
    </button>
  ) : (
    "-"
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
    </div> 
  );
}
export default PlannerDashboard;