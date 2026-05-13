import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Select from "react-select";
import axios from "axios";
import BASE_URL from "../config/api";

function PrintingIns() {

  const [errors, setErrors] = useState({});
  const [showMaterial, setShowMaterial] = useState(false);
const [showPacking, setShowPacking] = useState(false);
const [showDispatch, setShowDispatch] = useState(false);
const [showBilling, setShowBilling] = useState(false);
const [showInstructions, setShowInstructions] = useState(false);
  const [locations, setLocations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderMode, setOrderMode] = useState("MASTER");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [innerPackingList, setInnerPackingList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [transportList, setTransportList] = useState([]);
  const [woList, setWoList] = useState([]);
  const [expandedCell, setExpandedCell] = useState(null);
const [selectedWO, setSelectedWO] = useState(null);
const [branchList, setBranchList] = useState([]);
const [baseRemaining, setBaseRemaining] = useState(0);
const [liveRemaining, setLiveRemaining] = useState(0);
const [freightChargeList, setFreightChargeList] = useState([]);
const [freightTypeList, setFreightTypeList] = useState([]);
const [filters, setFilters] = useState({
  wo: "",
    subWo: "",   
  customer: "",
  productCode: "",
  ticketId: "" 
});
const [form, setForm] = useState({
  productCode: "",
  materialType: "",
   branchCode: "",
  description: "",
  customerName: "",
workorder2: "",
  colorFront: "",
  colorBack: "",
  wasteQty: 0,
  jobSize: "",
  inkDetails: "",

  materialCode: "",
materialDescription: "",
materialGsm: "",
materialMill: "",
paperSize: "",
innerPackingType: "",
leavesPerInner: "",
innerPack: "",
outerPack: "",
innerPerOuter: "",
 deliveryDate: "",
freightChargeType: "",
modeOfTransport: "",
freightType: "",
address: "",
prefix: "",
accountNumber: "",
nonMicrDigits: "",
  quantity: "",
  location: "",
  specialInstruction: "",
planningInstruction: "",
billingType: "",
quotationRefNo: "",

purchaseOrderNo: "",
poDate: "",

ratePerUnit: "",
totalBillableAmount: "",
accountCode: "",
sortCode: "",
transactionCode: "",
billSend: "",
kam: "",
kamBranch: "",
paymentTerms: "",
advancePayment: "",
taxType: "",
chequeFrom: "",
chequeTo: "",
  orderType: "Inhouse",
  remarks: "",
  numberingRemarks: "",
packingRemarks: "",
dispatchRemarks: "",
billingRemarks: "",
instructionRemarks: "",
});

useEffect(() => {
  if (!woList.length || !form.workorder2) return;

  const found = woList.find(
    w =>
      w.workorder2 === form.workorder2 ||
      w.efiWoNumber === form.workorder2
  );

  if (found) {
    setSelectedWO({
      value: found._id,
      label: `WO: ${found.workorder2 || found.efiWoNumber}`
    });
  }
}, [woList, form.workorder2]);
  // ✅ Get logged user
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name || decoded.username);
    }
  }, []);

 useEffect(() => {
  fetchLocations();
  fetchOrders();
    fetchBranches();
  fetchInnerPacking();

  // ✅ NEW
  fetchTransport();
  fetchFreightMasters();

}, []);
const isPersow = orderMode === "PERSOW";
const truncateText = (text, maxLength = 20) => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};
const thStyle = {
  padding: "10px 12px",
  fontWeight: "600",
  fontSize: "12px",
  color: "#ffffff",
  whiteSpace: "nowrap",
  borderBottom: "2px solid #1a6bbd",
  borderRight: "1px solid #3a85d4",
  background: "linear-gradient(135deg, #1a6bbd, #2196f3)",
  textAlign: "center",
  letterSpacing: "0.4px"
};

useEffect(() => {
  const filtered = orders.filter((order) => {
    const woMatch = filters.wo
      ? order.workOrders?.some((wo) => {
          let woValue = "";
          if (!wo.workorder2 || wo.workorder2 === "") {
            woValue = wo.efiWoNumber;
          } else if (Number(wo.workorder2) < Number(wo.efiWoNumber)) {
            woValue = wo.workorder2;
          } else {
            woValue = wo.efiWoNumber;
          }
          return woValue?.toString().toLowerCase().includes(filters.wo.toLowerCase());
        })
      : true;

    const subWoMatch = filters.subWo
      ? order.workOrders?.some((wo) => {
          let subWoValue = "";
          if (!wo.workorder2 || wo.workorder2 === "") {
            subWoValue = "";
          } else if (Number(wo.workorder2) < Number(wo.efiWoNumber)) {
            subWoValue = wo.efiWoNumber;
          } else {
            subWoValue = wo.workorder2;
          }
          return subWoValue?.toString().toLowerCase().includes(filters.subWo.toLowerCase());
        })
      : true;

    const customerMatch = filters.customer
      ? order.customerName === filters.customer
      : true;

    const productMatch = order.productCode
      ?.toString()
      .toLowerCase()
      .includes(filters.productCode.toLowerCase());

    // ✅ ADD THIS
    const ticketMatch = filters.ticketId
      ? order.ticketId?.toLowerCase().includes(filters.ticketId.toLowerCase())
      : true;

    // ✅ ADD ticketMatch HERE
    return woMatch && subWoMatch && customerMatch && productMatch && ticketMatch;
  });

  setFilteredOrders(filtered);
}, [filters, orders]);

const customerOptions = [
  ...new Set(orders.map(o => o.customerName).filter(Boolean))
];

  const fetchLocations = async () => {
    const res = await axios.get(`${BASE_URL}/api/master/locations`);
    setLocations(res.data);
  };
  const fetchInnerPacking = async () => {
  try {
    const res = await axios.get(
      `${BASE_URL}/api/master/inner-packing`
    );
    setInnerPackingList(res.data);
  } catch (err) {
    console.log("Error fetching inner packing");
  }
};
const fetchTransport = async () => {
  const res = await axios.get(`${BASE_URL}/api/master/transportations`);
  setTransportList(res.data);
};

const fetchBranches = async () => {

  try {

    const res = await axios.get(
      `${BASE_URL}/api/master/branch`
    );

    setBranchList(res.data);

  } catch (err) {

    console.log("Branch fetch failed");

  }

};
const fetchFreightMasters = async () => {
  const [charge, type] = await Promise.all([
    axios.get(`${BASE_URL}/api/master/freight-charge-types`),
    axios.get(`${BASE_URL}/api/master/freight-types`)
  ]);

  setFreightChargeList(charge.data);
  setFreightTypeList(type.data);
};

  const fetchMaterialDetails = async (code) => {
  if (!code) return;

  try {
    const res = await axios.get(
      `${BASE_URL}/api/printing-instructions/materials/${code}`
    );

    setForm(prev => ({
      ...prev,
      materialCode: res.data.code || "",
      materialDescription: res.data.description || "",
      materialGsm: res.data.gsm || "",
      materialMill: res.data.mill || "",
      paperSize: res.data.paperSize || ""
    }));

  } catch (err) {
    console.log("Material not found");
  }
}; 

useEffect(() => {
  if (!showBankDetails) {
    setForm(prev => ({
      ...prev,
      prefix: "",
      accountNumber: "",
      nonMicrDigits: "",
      accountCode: "",
      sortCode: "",
      transactionCode: ""
    }));
  }
}, [showBankDetails]);

useEffect(() => {
  if (orderMode === "MASTER") {
   setSelectedWO(null);
    setLiveRemaining(0);

    setForm(prev => ({
  ...prev,
  workorder2: ""
}));

setLiveRemaining(0);
  }
}, [orderMode]);


const fetchWOList = async (code) => {
  try {
    const res = await axios.get(
      `${BASE_URL}/api/printing-instructions/workorders/${code}`
    );

    const data = res.data;
    setWoList(data);

   if (!data || data.length === 0) {
  // ✅ DO NOT TOUCH remaining
  return;
}
  } catch (err) {
    console.log("WO fetch error", err);
  }
};

  const fetchOrders = async () => {
    const res = await axios.get(`${BASE_URL}/api/printing-instructions`);
    setOrders(res.data);
    setFilteredOrders(res.data);
  };

 const fetchInnerPackingDetails = async (type) => {
   // ✅ CLEAR ALL FIELDS
  if (!type) {
    setForm(prev => ({
      ...prev,
      innerPackingType: "",
      leavesPerInner: "",
      innerPack: "",
      outerPack: "",
      innerPerOuter: ""
    }));

    return;
  }


  try {
    const res = await axios.get(
      `${BASE_URL}/api/master/inner-packing/${type}`
    );

    setForm(prev => ({
      ...prev,

      innerPackingType: res.data.type || "",

      leavesPerInner: res.data.leavesPerInner || "",
      innerPack: res.data.innerPack || "",
      outerPack: res.data.outerPack || "",
      innerPerOuter: res.data.innerPerOuter || ""
    }));

  } catch (err) {
    console.log("Inner packing not found");
  }
};
const fetchRemainingQty = async (code) => {
  if (!code) return;

  try {
    const res = await axios.get(
      `${BASE_URL}/api/printing-instructions/remaining/${code}`
    );

    const remaining = Number(res.data.remainingQty || 0);
    setBaseRemaining(remaining);   // ✅ ADD
setLiveRemaining(remaining);   // keep
  } catch (err) {
    console.log("Remaining fetch error");
  }
};

  // 🔥 AUTO-FETCH PRODUCT DETAILS
  const fetchProductDetails = async (code) => {
    if (!code) return;

    try {
      const res = await axios.get(
        `${BASE_URL}/api/master/items/${code}`
      );

     setForm(prev => ({
  ...prev,
  materialType: res.data.materialType || "",
  description: res.data.description || "",
  customerName: res.data.customerName || "",


  // ✅ FORCE STRING
  colorFront: String(res.data.colorFront || ""),
  colorBack: String(res.data.colorBack || ""),
  wasteQty: Number(res.data.wasteQty || 0),
  jobSize: res.data.jobSize || "",
  inkDetails: res.data.inkDetails || ""
}));

    } catch (err) {
      setForm(prev => ({
        ...prev,
        materialType: "",
        description: "",
        customerName: ""
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setErrors(prev => ({ ...prev, [name]: "" }));

    setForm(prev => ({
      ...prev,
      [name]: value
    }));
if (name === "innerPackingType") {
  fetchInnerPackingDetails(value);
}

if (name === "quantity" && orderMode === "PERSOW") {

  // 🔥 HANDLE BACKSPACE
  if (value === "") {
    setForm(prev => ({
      ...prev,
      quantity: ""
    }));

    setLiveRemaining(baseRemaining);
    return;
  }

  const enteredQty = Number(value);
  const originalRemaining = Number(baseRemaining || 0);  // ✅ FIX

  if (enteredQty > originalRemaining) {
    Swal.fire("Error", "Qty cannot be greater than remaining", "error");
    return;
  }

  const updatedRemaining = originalRemaining - enteredQty;

  setForm(prev => ({
    ...prev,
    quantity: value
  }));

  setLiveRemaining(updatedRemaining);

  return;
}
// ✅ PRODUCT CODE
if (name === "productCode") {

  // 🔥 RESET OLD DATA
  setSelectedWO(null); 
  setLiveRemaining(0);  

  setForm(prev => ({
    ...prev,
    productCode: value,
    workorder2: "",
    colorFront: "",
    colorBack: ""
  }));
  fetchProductDetails(value);

  fetchRemainingQty(value);

// ✅ ADD THESE 2 LINES (ONLY FIX)
if (orderMode === "PERSOW") {
  fetchWOList(value);
}

  return;
}
// ✅ MATERIAL
if (name === "materialCode") {
  fetchMaterialDetails(value);
}
  };

  const validateForm = () => {
    let newErrors = {};

    if (!form.productCode) newErrors.productCode = "Required";
    if (!form.quantity) newErrors.quantity = "Required";
  
    if (!form.location) newErrors.location = "Required";
    if (!form.orderType) newErrors.orderType = "Required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  if (saving) {
    console.log("Blocked duplicate click");
    return;
  }
 if (orderMode === "PERSOW") {
  if (!selectedWO) {
    Swal.fire("Error", "Please select WO", "error");
    setSaving(false);
    return;
  }

  if (Number(form.quantity) > Number(baseRemaining))  {
    Swal.fire("Error", "Quantity exceeds remaining qty", "error");
    setSaving(false);
    return;
  }
}

  setSaving(true); // move this BEFORE validation

  if (!validateForm()) {
    setSaving(false);
    return;
  }

  try {
      if (orderMode === "MASTER") {
    form.workorder2 = "";
  }
const token = localStorage.getItem("token");
const decoded = jwtDecode(token);   
const data = {
  ...form,
  orderMode,
  user: loggedInUser,
    userLocations: decoded.locations || [],
  workorder2: orderMode === "MASTER" ? "" : (form.workorder2 || "")
};

    if (editingId) {
      await axios.put(`${BASE_URL}/api/printing-instructions/${editingId}`, data);
    } else {
      await axios.post(`${BASE_URL}/api/printing-instructions`, data);
    }

    Swal.fire("Success", "Saved Successfully", "success");

// ✅ SAFE REFRESH (SEPARATE TRY)
try {
  await fetchRemainingQty(form.productCode);

  if (selectedWO) {
    const res = await axios.get(
      `${BASE_URL}/api/printing-instructions/remaining-by-wo/${selectedWO.value}`
    );

    const remaining = Number(res.data.remainingQty || 0);

    setBaseRemaining(remaining);
    setLiveRemaining(remaining);
  }

} catch (refreshErr) {
  console.log("Refresh error ignored", refreshErr);
}
    fetchOrders();
    // reset form
    setForm({
      productCode: "",
      materialType: "",
      description: "",
      customerName: "",
      colorFront: "",
      colorBack: "",
      wasteQty: 0,
      jobSize: "",
      inkDetails: "",
      materialCode: "",
      materialDescription: "",
      materialGsm: "",
      materialMill: "",
      paperSize: "",
      innerPackingType: "",
      leavesPerInner: "",
      innerPack: "",
      outerPack: "",
      innerPerOuter: "",
      prefix: "",
      accountNumber: "",
      nonMicrDigits: "",
      quantity: "",
      location: "",
      deliveryDate: "",
      freightType: "",
      address: "",
      specialInstruction: "",
      planningInstruction: "",
      quotationRefNo: "",
      purchaseOrderNo: "",
      poDate: "",
      ratePerUnit: "",
      totalBillableAmount: "",
      freightChargeType: "",
      modeOfTransport: "",
      accountCode: "",
sortCode: "",
transactionCode: "",
billSend: "",
kam: "",
kamBranch: "",
paymentTerms: "",
advancePayment: "",
taxType: "",
chequeFrom: "",
chequeTo: "",
billingType: "",
numberingRemarks:"",
packingRemarks:"",
billingRemarks:"",
instructionRemarks:"",
dispatchRemarks:"",
      orderType: "Inhouse",
      remarks: ""
    });

    setEditingId(null);

  } catch (err) {
    Swal.fire("Error", "Save failed", "error");
  } finally {
    setSaving(false); // 🔓 unlock
  }
};
const handleEdit = async (order) => {
  setEditingId(order._id);

  const isPerso = order.workorder2 && order.workorder2 !== "";

  // ✅ set mode FIRST
  setOrderMode(isPerso ? "PERSOW" : "MASTER");

  setForm({
    productCode: order.productCode,
    materialType: order.materialType || "",
    description: order.description || "",
    customerName: order.customerName || "",
    jobSize: order.jobSize || "",
    quantity: order.quantity,
    materialCode: order.materialCode || "",
    materialDescription: order.materialDescription || "",
    materialGsm: order.materialGsm || "",
    materialMill: order.materialMill || "",
    paperSize: order.paperSize || "",
    prefix: order.prefix || "",
    accountNumber: order.accountNumber || "",
    nonMicrDigits: order.nonMicrDigits || "",
    colorFront: order.colorFront || "",
    colorBack: order.colorBack || "",
    specialInstruction: order.specialInstruction || "",
    planningInstruction: order.planningInstruction || "",
    quotationRefNo: order.quotationRefNo || "",
    purchaseOrderNo: order.purchaseOrderNo || "",
    poDate: order.poDate?.substring(0,10) || "",
    ratePerUnit: order.ratePerUnit || "",
    totalBillableAmount: order.totalBillableAmount || "",
    deliveryDate: order.deliveryDate?.substring(0,10) || "",
    address: order.address || "",
    freightChargeType: order.freightChargeType || "",
    modeOfTransport: order.modeOfTransport || "",
    freightType: order.freightType || "",
    innerPackingType: order.innerPackingType || "",
    leavesPerInner: order.leavesPerInner || "",
    innerPack: order.innerPack || "",
    outerPack: order.outerPack || "",
    innerPerOuter: order.innerPerOuter || "",
    location: order.location,
    orderType: order.orderType,
    accountCode: order.accountCode || "",
    sortCode: order.sortCode || "",
    transactionCode: order.transactionCode || "",
    billSend: order.billSend || "",
    kam: order.kam || "",
    kamBranch: order.kamBranch || "",
    paymentTerms: order.paymentTerms || "",
    advancePayment: order.advancePayment || "",
    taxType: order.taxType || "",
    chequeFrom: order.chequeFrom || "",
    chequeTo: order.chequeTo || "",
    billingType: order.billingType || "",
    remarks: order.remarks,
    workorder2: order.workorder2 || "" // ✅ important
  });
    if (isPerso) {
  const res = await axios.get(
    `${BASE_URL}/api/printing-instructions/workorders/${order.productCode}`
  );

  const data = res.data;
  setWoList(data);

  const found = data.find(
    w =>
      w.workorder2 === order.workorder2 ||
      w.efiWoNumber === order.workorder2
  );

  if (found) {
    setSelectedWO({
      value: found._id,
      label: `WO: ${found.workorder2 || found.efiWoNumber}`
    });

    // ✅ CORRECT remaining API
    // 🔥 GET CORRECT PREVIOUS REMAINING (BEFORE CURRENT ENTRY)

const resAll = await axios.get(
  `${BASE_URL}/api/printing-instructions`
);

const all = resAll.data
  .filter(x =>
    x.productCode === order.productCode &&
    String(x.workorder2 || "") === String(order.workorder2 || "") &&
    x._id !== order._id
  )
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// ✅ find entry BEFORE current
let previousRemaining;

if (all.length > 0) {
  previousRemaining = all[0].remainingQty;
} else {
  // fallback MASTER
  const master = resAll.data
    .filter(x =>
      x.productCode === order.productCode &&
      (!x.workorder2 || x.workorder2 === "")
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  previousRemaining = master ? master.remainingQty : 0;
}

// ✅ SET CORRECT BASE
setBaseRemaining(previousRemaining);
setLiveRemaining(previousRemaining);
  }
}


  window.scrollTo({ top: 0, behavior: "smooth" });
};


  const handleDelete = async (id) => {
    try {
    await axios.delete(`${BASE_URL}/api/printing-instructions/${id}`);
     Swal.fire("Deleted!", "Record removed", "success");
    fetchOrders();
     } catch (err) {
    Swal.fire("Error", "Delete failed", "error");
  }
  };

  const exportToExcel = () => {
    const data = filteredOrders.map(order => ({
      "Ticket ID": order.ticketId || "--",
      "Product Code": order.productCode,
      "Material": order.materialType,
      "Description": order.description,
      "Customer": order.customerName,
      "Color Front": order.colorFront,
      "Color Back": order.colorBack,
        "Material Code": order.materialCode,
"Material Desc": order.materialDescription,
"Material GSM": order.materialGsm,
"Material Mill": order.materialMill,
"Paper Size": order.paperSize,
"Location": order.location,
"Quantity": order.quantity,
"Job Size": order.jobSize,
"Prefix": order.prefix,
"Account Number": order.accountNumber,
"Non MICR Digits": order.nonMicrDigits,
"Transport Mode": order.modeOfTransport,
"Freight Charge Type": order.freightChargeType,
"Freight Type": order.freightType,
"Address": order.address,
"Special Instruction": order.specialInstruction,
"Bill To": order.planningInstruction,
"Bill Send": order.billSend,
"Quotation Ref No": order.quotationRefNo,
"KAM": order.kam,
"KAM Branch": order.kamBranch,
"Payment Terms": order.paymentTerms,
"Advance Payment": order.advancePayment,
"Tax Type": order.taxType,
"Cheque From": order.chequeFrom,
"Cheque To": order.chequeTo,
"Billing Type": order.billingType,

      "Remarks": order.remarks,
      "User": order.user
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Printing Instructions");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer]), "PrintingInstructions.xlsx");
  };

const viewPDF = () => {
  const doc = new jsPDF("p", "mm", "a4");
  const data = filteredOrders.length ? filteredOrders : orders;

  data.forEach((order, index) => {
    if (index !== 0) doc.addPage();

    const PAGE_WIDTH = 210;
    const PAGE_HEIGHT = 297;
    let y = 10;

    // ── PAGE BORDER ──
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(5, 5, 200, 287);

    const compactStyle = {
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
        overflow: "linebreak",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255]
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        lineColor: [0, 0, 0],
        lineWidth: 0.3
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [0, 0, 0] },
        2: { fontStyle: "bold", textColor: [0, 0, 0] }
      }
    };

    // ── HEADER: Company name ──
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Manipal Payment and Identity Solutions Limited", PAGE_WIDTH / 2, y, { align: "center" });
    y += 4;

    // ── Sub-header block ──
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Internal Document", 10, y);
    y += 4;
    doc.text("Document ID: MPi_SP_QS_PLAN_T125_V1.00", 10, y);
    y += 4;
    doc.text(`Request Location: ${order.location || ""}`, 10, y);
    y += 4;

    // ── Printing Instruction centered title ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Printing Instruction", PAGE_WIDTH / 2, y, { align: "center" });
    y += 2;

    const addSection = (title, dataRows) => {
      if (y > PAGE_HEIGHT - 25) return;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(title, 10, y);
      y += 2;

      autoTable(doc, {
        ...compactStyle,
        startY: y,
        body: dataRows,
        margin: { left: 10, right: 10 },
        didParseCell: (data) => {
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.fillColor = [255, 255, 255];
        }
      });

      y = doc.lastAutoTable.finalY + 4;
    };

    addSection("PRODUCT DETAILS", [
      ["Product Code", order.productCode || "", "Customer", order.customerName || ""],
      ["Desc", order.description || "", "Qty", order.quantity || ""],
      ["Job Size", order.jobSize || "", "Color", `${order.colorFront || ""}/${order.colorBack || ""}`]
    ]);
const hasMaterial = order.materialCode || order.materialDescription || order.materialGsm || order.materialMill || order.paperSize;

if (order.orderMode !== "PERSOW" && hasMaterial) {
  addSection("MATERIAL DETAILS", [
    ["Material Code", order.materialCode || "", "GSM", order.materialGsm || ""],
    ["Desc", order.materialDescription || "", "Mill", order.materialMill || ""],
    ["Paper", order.paperSize || "", "", ""]
  ]);
}

    addSection("PACKING DETAILS", [
      ["Inner", order.innerPackingType || "", "Leaves", order.leavesPerInner || ""],
      ["Inner Pack", order.innerPack || "", "Outer", order.outerPack || ""],
      ["Remarks", order.packingRemarks || "", "Inner/Outer", order.innerPerOuter || ""]
    ]);

    addSection("DISPATCH DETAILS", [
      ["Date", order.deliveryDate?.substring(0, 10) || "", "Transport", order.modeOfTransport || ""],
      ["Freight", order.freightChargeType || "", "Type", order.freightType || ""],
      ["Address", order.address || "", "Remarks", order.dispatchRemarks || ""]
    ]);

    addSection("BILLING", [
      ["Quotation", order.quotationRefNo || "", "PO", order.purchaseOrderNo || ""],
      ["PO Date", order.poDate?.substring(0, 10) || "", "Rate", order.ratePerUnit || ""],
      ["Total", order.totalBillableAmount || "", "Bill To", order.planningInstruction || ""],
      ["Bill Send", order.billSend || "", "Remarks", order.billingRemarks || ""]
    ]);

    if (order.accountNumber) {
      addSection("BANK", [
        ["Prefix", order.prefix || "", "Account", order.accountNumber || ""],
        ["MICR", order.sortCode || "", "Code", order.accountCode || ""],
        ["Transaction code", order.transactionCode || "", "Non MICR", order.nonMicrDigits || ""],
        ["Cheque From", order.chequeFrom || "", "Cheque To", order.chequeTo || ""],
        ["Remarks", order.numberingRemarks || "", "", ""]
      ]);
    }

    addSection("INSTRUCTIONS", [
      ["KAM", order.kam || "", "Branch", order.kamBranch || ""],
      ["Payment", order.paymentTerms || "", "Advance", order.advancePayment || ""],
      ["Tax", order.taxType || "", "", ""],
      ["Special", order.specialInstruction || "", "", ""],
      ["Remarks", order.instructionRemarks || "", "", ""]
    ]);

    // ── FOOTER ──
    y += 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Printing Instruction approved and signed by:", 10, y);
    y += 5;
    doc.text(`Name: ${order.user || ""}`, 10, y);
    y += 5;

    const createdDate = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "numeric",
          year: "numeric"
        })
      : "";
    doc.text(`Printing Instruction created date: ${createdDate}`, 10, y);
    y += 5;
    doc.text("Signature: _____________________________", 10, y);
  });

  doc.save("Printing.pdf");
};
  return (
<div className="container mt-4">

  {/* PAGE TITLE */}
  <div style={{
    background: "linear-gradient(135deg, #1a6bbd, #2196f3)",
    borderRadius: "12px",
    padding: "14px 24px",
    marginBottom: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    boxShadow: "0 4px 18px rgba(33,150,243,0.2)"
  }}>
    <i className="bi bi-printer-fill" style={{ color: "#fff", fontSize: "22px" }}></i>
    <h3 className="mb-0 fw-bold" style={{ color: "#fff", letterSpacing: "0.5px" }}>
      Printing Instruction Entry
    </h3>
  </div>

  <form onSubmit={handleSubmit}>

    {/* MASTER / PERSO TOGGLE */}
    <div className="d-flex justify-content-center mb-4">
      <div style={{
        background: "linear-gradient(135deg, #f0f6ff, #e8f0fe)",
        borderRadius: "50px",
        border: "1.5px solid #c9d8f0",
        padding: "6px 20px",
        display: "flex",
        gap: "24px",
        boxShadow: "0 2px 8px rgba(33,150,243,0.08)"
      }}>
        <div className="form-check mb-0">
          <input
            type="radio"
            className="form-check-input"
            name="orderMode"
            value="MASTER"
            checked={orderMode === "MASTER"}
            onChange={(e) => setOrderMode(e.target.value)}
            style={{ cursor: "pointer" }}
          />
          <label className="form-check-label fw-bold" style={{ color: orderMode === "MASTER" ? "#1a6bbd" : "#6c757d", cursor: "pointer" }}>
            <i className="bi bi-journal-text me-1"></i> Master
          </label>
        </div>
        <div className="form-check mb-0">
          <input
            type="radio"
            className="form-check-input"
            name="orderMode"
            value="PERSOW"
            checked={orderMode === "PERSOW"}
            onChange={(e) => setOrderMode(e.target.value)}
            style={{ cursor: "pointer" }}
          />
          <label className="form-check-label fw-bold" style={{ color: orderMode === "PERSOW" ? "#1a6bbd" : "#6c757d", cursor: "pointer" }}>
            <i className="bi bi-person-vcard me-1"></i> Perso
          </label>
        </div>
      </div>
    </div>

    {/* MAIN PRODUCT CARD */}
    <div style={{
      background: "linear-gradient(135deg, #f0f6ff, #e8f0fe)",
      borderRadius: "14px",
      border: "1.5px solid #c9d8f0",
      boxShadow: "0 4px 18px rgba(33,150,243,0.08)",
      padding: "20px",
      marginBottom: "24px"
    }}>
      <div className="row g-3">

        {/* Product Code */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-upc-scan me-1"></i> Product Code
          </label>
          <input
            type="number"
            min={0}
            name="productCode"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.productCode}
            onChange={handleChange}
          />
        </div>

        {/* Material */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-box-seam me-1"></i> Material
          </label>
          <input
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
            value={form.materialType}
            readOnly
          />
        </div>

        {/* Description */}
        <div className="col-md-3">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-card-text me-1"></i> Description
          </label>
          <input
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
            value={form.description}
            readOnly
          />
        </div>

        {/* Customer */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-person me-1"></i> Customer
          </label>
          <input
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
            value={form.customerName}
            readOnly
          />
        </div>

        {/* Job Size */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-aspect-ratio me-1"></i> Job Size
          </label>
          <input
            name="jobSize"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
            value={form.jobSize}
            readOnly
          />
        </div>

        {/* Color Front */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-palette me-1"></i> Color Front
          </label>
          <input
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
            value={form.colorFront}
            readOnly
          />
        </div>

        {/* Color Back */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-palette-fill me-1"></i> Color Back
          </label>
          <input
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
            value={form.colorBack}
            readOnly
          />
        </div>

        {/* Material Code — MASTER ONLY */}
        {orderMode === "MASTER" && (
          <>
            <div className="col-md-2">
              <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
                <i className="bi bi-123 me-1"></i> Material Code
              </label>
              <input
                name="materialCode"
                min={0}
                className="form-control"
                style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                value={form.materialCode}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
                Material Desc
              </label>
              <input
                className="form-control"
                style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
                value={form.materialDescription}
                readOnly
              />
            </div>

            <div className="col-md-2">
              <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
                GSM
              </label>
              <input
                className="form-control"
                style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
                value={form.materialGsm}
                readOnly
              />
            </div>

            <div className="col-md-2">
              <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
                Mill
              </label>
              <input
                className="form-control"
                style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
                value={form.materialMill}
                readOnly
              />
            </div>

            <div className="col-md-2">
              <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
                Paper Size
              </label>
              <input
                className="form-control"
                style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
                value={form.paperSize}
                readOnly
              />
            </div>
          </>
        )}

        {/* Order Type */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-tag me-1"></i> Order Type
          </label>
          <input
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", background: "#eef4ff", color: "#1a6bbd", fontWeight: "600" }}
            value="Inhouse"
            readOnly
          />
        </div>

        {/* Quantity */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-123 me-1"></i> Quantity
          </label>
          <input
            type="number"
            min={0}
            name="quantity"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            disabled={orderMode === "PERSOW" && !selectedWO}
            value={form.quantity}
            onChange={handleChange}
          />
        </div>

        {/* Select WO — PERSOW ONLY */}
        {orderMode === "PERSOW" && (
          <div className="col-md-3">
            <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
              <i className="bi bi-list-check me-1"></i> Select WO
            </label>
            <Select
              value={selectedWO}
              options={woList.map(wo => ({
                value: wo._id,
                label: `WO: ${wo.workorder2 || wo.efiWoNumber}`
              }))}
              onChange={async (selected) => {
                if (!selected) return;
                const selectedData = woList.find(w => w._id === selected.value);
                const exactOption = woList.map(wo => ({
                  value: wo._id,
                  label: `WO: ${wo.workorder2 || wo.efiWoNumber}`
                })).find(opt => opt.value === selected.value);
                setSelectedWO(exactOption);
                setForm(prev => ({
                  ...prev,
                  workorder2: selectedData.workorder2 || selectedData.efiWoNumber
                }));
                const res = await axios.get(
                  `${BASE_URL}/api/printing-instructions/remaining-by-wo/${selected.value}`
                );
                const remaining = Number(res.data.remainingQty || 0);
                setBaseRemaining(remaining);
                setLiveRemaining(remaining);
              }}
              styles={{
                control: (base) => ({
                  ...base,
                  borderRadius: "8px",
                  border: "1.5px solid #c9d8f0",
                  fontSize: "13px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  minHeight: "38px"
                })
              }}
            />
          </div>
        )}

        {/* Location */}
        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-geo-alt me-1"></i> Location
          </label>
          <select
            name="location"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.location}
            onChange={handleChange}
          >
            <option value="">Select</option>
            {locations.map(loc => (
              <option key={loc._id} value={loc.locationName}>
                {loc.locationName}
              </option>
            ))}
          </select>
        </div>

        {/* Remarks */}
        <div className="col-md-4">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-chat-left-text me-1"></i> Remarks
          </label>
          <textarea
            name="remarks"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
            value={form.remarks}
            onChange={handleChange}
          />
        </div>

      </div>
    </div>


     <div className="col-12 mt-5">
  <div style={{
    background: "linear-gradient(135deg, #1a6bbd, #2196f3)",
    borderRadius: "10px",
    padding: "10px 20px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center", 
    gap: "10px"
  }}>
    <i className="bi bi-hash" style={{ color: "#fff", fontSize: "18px" }}></i>
    <h5 className="mb-0 fw-bold" style={{ color: "#fff", letterSpacing: "0.5px" }}>
      Numbering Details
    </h5>
  </div>
</div>

{orderMode !== "PERSOW" && (
  <div className="d-flex align-items-center gap-2 mb-3 px-1">
    <input
      type="checkbox"
      checked={showBankDetails}
      onChange={(e) => setShowBankDetails(e.target.checked)}
      className="form-check-input border-dark"
      style={{ width: "16px", height: "16px", cursor: "pointer" }}
    />
    <label className="form-check-label fw-semibold" style={{ fontSize: "13px", color: "#1a6bbd", cursor: "pointer" }}>
      <i className="bi bi-eye me-1"></i> Show Details
    </label>
  </div>
)}

{(orderMode === "PERSOW" || showBankDetails) && (
  <>
    <div style={{
      background: "linear-gradient(135deg, #f0f6ff, #e8f0fe)",
      borderRadius: "14px",
      border: "1.5px solid #c9d8f0",
      boxShadow: "0 4px 18px rgba(33,150,243,0.08)",
      padding: "20px",
      marginBottom: "24px"
    }}>
      <div className="row g-3">

        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-type me-1"></i> Prefix
          </label>
          <input
            name="prefix"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.prefix}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-credit-card me-1"></i> Account Number
          </label>
          <input
            name="accountNumber"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.accountNumber}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-123 me-1"></i> Cheque From
          </label>
          <input
            type="text"
            name="chequeFrom"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.chequeFrom}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-123 me-1"></i> Cheque To
          </label>
          <input
            type="text"
            name="chequeTo"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.chequeTo}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-upc me-1"></i> Non MICR Digits
          </label>
          <input
            name="nonMicrDigits"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.nonMicrDigits}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-code me-1"></i> Account Code
          </label>
          <input
            name="accountCode"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.accountCode}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-qr-code me-1"></i> Sort Code / MICR
          </label>
          <input
            name="sortCode"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.sortCode}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-2">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-arrow-left-right me-1"></i> Transaction Code
          </label>
          <input
            name="transactionCode"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            value={form.transactionCode}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-4">
          <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
            <i className="bi bi-chat-left-text me-1"></i> Remarks
          </label>
          <textarea
            name="numberingRemarks"
            className="form-control"
            style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
            value={form.numberingRemarks}
            onChange={handleChange}
          />
        </div>

      </div>
    </div>
  </>
)}

{/* 🔹 HEADING (ALWAYS VISIBLE) */}
<div className="col-12 mt-5">
  <div style={{
    background: "linear-gradient(135deg, #1a6bbd, #2196f3)",
    borderRadius: "10px",
    padding: "10px 20px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center", 
    gap: "10px"
  }}>
    <i className="bi bi-boxes" style={{ color: "#fff", fontSize: "18px" }}></i>
    <h5 className="mb-0 fw-bold" style={{ color: "#fff", letterSpacing: "0.5px" }}>
      Packing Standard
    </h5>
  </div>
</div>

{/* 🔹 CHECKBOX (ONLY MASTER) */}
{!isPersow && (
  <div className="d-flex align-items-center gap-2 mb-3 px-1">
    <input
      type="checkbox"
      checked={showPacking}
      onChange={(e) => setShowPacking(e.target.checked)}
      className="form-check-input border-dark"
      style={{ width: "16px", height: "16px", cursor: "pointer" }}
    />
    <label className="form-check-label fw-semibold" style={{ fontSize: "13px", color: "#1a6bbd", cursor: "pointer" }}>
      <i className="bi bi-eye me-1"></i> Show Packing Details
    </label>
  </div>
)}

{/* 🔹 PACKING SECTION */}
{(isPersow || showPacking) && (
  <div style={{
    background: "linear-gradient(135deg, #f0f6ff, #e8f0fe)",
    borderRadius: "14px",
    border: "1.5px solid #c9d8f0",
    boxShadow: "0 4px 18px rgba(33,150,243,0.08)",
    padding: "20px",
    marginBottom: "24px"
  }}>
    <div className="row g-3">

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-box-seam me-1"></i> Type of Inner Packing
        </label>
        <select
          name="innerPackingType"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.innerPackingType}
          onChange={handleChange}
        >
          <option value="">Select</option>
          {innerPackingList.map(item => (
            <option key={item._id} value={item.type}>
              {item.type}
            </option>
          ))}
        </select>
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-layers me-1"></i> No. of Leaves per Inner Pack
        </label>
        <input
          type="number"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0",color: "#1a6bbd",fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", background: "#f8fbff" }}
          value={form.leavesPerInner}
          readOnly
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-box me-1"></i> No. of Inner Pack
        </label>
        <input
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", background: "#fafcff", color: "#1a6bbd" }}
          value={form.innerPack}
          readOnly
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-archive me-1"></i> No. of Outer Pack
        </label>
        <input
          type="number"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",color: "#1a6bbd", background: "#f8fbff" }}
          value={form.outerPack}
          readOnly
        />
      </div>

      <div className="col-md-3">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-diagram-3 me-1"></i> No. of Inner Pack per Outer Pack
        </label>
        <input
          type="number"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0",color: "#1a6bbd", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", background: "#f8fbff" }}
          value={form.innerPerOuter}
          readOnly
        />
      </div>

      <div className="col-md-4">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-chat-left-text me-1"></i> Remarks
        </label>
        <textarea
          name="packingRemarks"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
          value={form.packingRemarks}
          onChange={handleChange}
        />
      </div>

    </div>
  </div>
)}
{/* 🔹 HEADING (ALWAYS VISIBLE) */}
<div className="col-12 mt-5">
  <div style={{
    background: "linear-gradient(135deg, #1a6bbd, #2196f3)",
    borderRadius: "10px",
    padding: "10px 20px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center", 
    gap: "10px"
  }}>
    <i className="bi bi-truck" style={{ color: "#fff", fontSize: "18px" }}></i>
    <h5 className="mb-0 fw-bold" style={{ color: "#fff", letterSpacing: "0.5px" }}>
      Dispatch Details
    </h5>
  </div>
</div>

{/* 🔹 CHECKBOX (ONLY MASTER) */}
{!isPersow && (
  <div className="d-flex align-items-center gap-2 mb-3 px-1">
    <input
      type="checkbox"
      checked={showDispatch}
      onChange={(e) => setShowDispatch(e.target.checked)}
      className="form-check-input border-dark"
      style={{ width: "16px", height: "16px", cursor: "pointer" }}
    />
    <label className="form-check-label fw-semibold" style={{ fontSize: "13px", color: "#1a6bbd", cursor: "pointer" }}>
      <i className="bi bi-eye me-1"></i> Show Dispatch Details
    </label>
  </div>
)}

{/* 🔹 DISPATCH SECTION */}
{(isPersow || showDispatch) && (
  <div style={{
    background: "linear-gradient(135deg, #f0f6ff, #e8f0fe)",
    borderRadius: "14px",
    border: "1.5px solid #c9d8f0",
    boxShadow: "0 4px 18px rgba(33,150,243,0.08)",
    padding: "20px",
    marginBottom: "24px"
  }}>
    <div className="row g-3">

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-calendar-event me-1"></i> Delivery Date
        </label>
        <input
          type="date"
          name="deliveryDate"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.deliveryDate}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-truck-front me-1"></i> Mode of Transport
        </label>
        <select
          name="modeOfTransport"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.modeOfTransport}
          onChange={handleChange}
        >
          <option value="">Select</option>
          {transportList.map(t => (
            <option key={t._id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-cash-stack me-1"></i> Freight Charge Type
        </label>
        <select
          name="freightChargeType"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.freightChargeType}
          onChange={handleChange}
        >
          <option value="">Select</option>
          {freightChargeList.map(f => (
            <option key={f._id} value={f.name}>{f.name}</option>
          ))}
        </select>
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-box-arrow-right me-1"></i> Freight Type
        </label>
        <select
          name="freightType"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.freightType}
          onChange={handleChange}
        >
          <option value="">Select</option>
          {freightTypeList.map(f => (
            <option key={f._id} value={f.name}>{f.name}</option>
          ))}
        </select>
      </div>
<div className="col-md-2">
  <label
    className="fw-semibold"
    style={{
      fontSize: "12px",
      color: "#1a6bbd"
    }}
  >
    <i className="bi bi-building me-1"></i>
    Branch Code
  </label>

  <select
    name="branchCode"
    className="form-control"
    style={{
      borderRadius: "8px",
      border: "1.5px solid #c9d8f0",
      fontSize: "13px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
    }}
    value={form.branchCode}
    onChange={async (e) => {

      const value = e.target.value;

      // ✅ CLEAR
      if (!value) {

        setForm(prev => ({
          ...prev,
          branchCode: "",
          address: ""
        }));

        return;
      }

      try {

        // ✅ FETCH ADDRESS
        const res = await axios.get(
          `${BASE_URL}/api/master/branch/${value}`
        );

        setForm(prev => ({
          ...prev,

          branchCode: value,

          // ✅ AUTO FILL ADDRESS
          address: res.data.dispatchAddress || ""

        }));

      } catch (err) {

        console.log("Branch not found");

      }

    }}
  >

    <option value="">
      Select
    </option>

    {branchList.map(branch => (

      <option
        key={branch._id}
        value={branch.branchCode}
      >
        {branch.branchCode}
      </option>

    ))}

  </select>
</div>
      <div className="col-md-3">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-geo-alt me-1"></i> Dispatch Address
        </label>
        <textarea
          name="address"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
          value={form.address}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-4">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-chat-left-text me-1"></i> Remarks
        </label>
        <textarea
          name="dispatchRemarks"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
          value={form.dispatchRemarks}
          onChange={handleChange}
        />
      </div>

    </div>
  </div>
)}
{/* 🔹 HEADING (ALWAYS VISIBLE) */}
<div className="col-12 mt-5">
  <div style={{
    background: "linear-gradient(135deg, #1a6bbd, #2196f3)",
    borderRadius: "10px",
    padding: "10px 20px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center", 
    gap: "10px"
  }}>
    <i className="bi bi-receipt-cutoff" style={{ color: "#fff", fontSize: "18px" }}></i>
    <h5 className="mb-0 fw-bold" style={{ color: "#fff", letterSpacing: "0.5px" }}>
      Billing Instructions
    </h5>
  </div>
</div>

{/* 🔹 CHECKBOX (ONLY MASTER) */}
{!isPersow && (
  <div className="d-flex align-items-center gap-2 mb-3 px-1">
    <input
      type="checkbox"
      checked={showBilling}
      onChange={(e) => setShowBilling(e.target.checked)}
      className="form-check-input border-dark"
      style={{ width: "16px", height: "16px", cursor: "pointer" }}
    />
    <label className="form-check-label fw-semibold" style={{ fontSize: "13px", color: "#1a6bbd", cursor: "pointer" }}>
      <i className="bi bi-eye me-1"></i> Show Billing Details
    </label>
  </div>
)}

{/* 🔹 BILLING SECTION */}
{(isPersow || showBilling) && (
  <div style={{
    background: "linear-gradient(135deg, #f0f6ff, #e8f0fe)",
    borderRadius: "14px",
    border: "1.5px solid #c9d8f0",
    boxShadow: "0 4px 18px rgba(33,150,243,0.08)",
    padding: "20px",
    marginBottom: "24px"
  }}>
    <div className="row g-3">

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-file-earmark-text me-1"></i> Quotation/Contract Ref No
        </label>
        <input
          name="quotationRefNo"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.quotationRefNo}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-receipt me-1"></i> PO Number
        </label>
        <input
          name="purchaseOrderNo"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.purchaseOrderNo}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-calendar-date me-1"></i> PO Date
        </label>
        <input
          type="date"
          name="poDate"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.poDate}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-currency-rupee me-1"></i> Rate / Unit
        </label>
        <input
          type="number"
          min={0}
          name="ratePerUnit"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.ratePerUnit}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-calculator me-1"></i> Total Billable Amount
        </label>
        <input
          type="number"
          min={0}
          name="totalBillableAmount"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.totalBillableAmount}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          Billing Type
        </label>
        <select
          name="billingType"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.billingType}
          onChange={handleChange}
        >
          <option value="">Select</option>
          <option value="INTERNAL">INTERNAL</option>
          <option value="EXTERNAL">EXTERNAL</option>
        </select>
      </div>

      <div className="col-md-3">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-person-lines-fill me-1"></i> Bill To
        </label>
        <textarea
          name="planningInstruction"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
          value={form.planningInstruction}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-3">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-send me-1"></i> Bill Send
        </label>
        <textarea
          name="billSend"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
          value={form.billSend}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-4">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-chat-left-text me-1"></i> Remarks
        </label>
        <textarea
          name="billingRemarks"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
          value={form.billingRemarks}
          onChange={handleChange}
        />
      </div>

    </div>
  </div>
)}
{/* 🔹 HEADING (ALWAYS VISIBLE) */}
<div className="col-12 mt-5">
  <div style={{
    background: "linear-gradient(135deg, #1a6bbd, #2196f3)",
    borderRadius: "10px",
    padding: "10px 20px",
    marginBottom: "16px",
    display: "flex",
     alignItems: "center",
    justifyContent: "center", 
    gap: "10px"
  }}>
    <i className="bi bi-clipboard-check" style={{ color: "#fff", fontSize: "18px" }}></i>
    <h5 className="mb-0 fw-bold" style={{ color: "#fff", letterSpacing: "0.5px" }}>
      Instructions
    </h5>
  </div>
</div>

{/* 🔹 CHECKBOX (ONLY MASTER) */}
{!isPersow && (
  <div className="d-flex align-items-center gap-2 mb-3 px-1">
    <input
      type="checkbox"
      checked={showInstructions}
      onChange={(e) => setShowInstructions(e.target.checked)}
      className="form-check-input border-dark"
      style={{ width: "16px", height: "16px", cursor: "pointer" }}
    />
    <label className="form-check-label fw-semibold" style={{ fontSize: "13px", color: "#1a6bbd", cursor: "pointer" }}>
      <i className="bi bi-eye me-1"></i> Show Instruction Details
    </label>
  </div>
)}

{/* 🔹 INSTRUCTIONS SECTION */}
{(isPersow || showInstructions) && (
  <div style={{
    background: "linear-gradient(135deg, #f0f6ff, #e8f0fe)",
    borderRadius: "14px",
    border: "1.5px solid #c9d8f0",
    boxShadow: "0 4px 18px rgba(33,150,243,0.08)",
    padding: "20px",
    marginBottom: "24px"
  }}>
    <div className="row g-3">

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-person-badge me-1"></i> KAM
        </label>
        <input
          name="kam"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.kam}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-diagram-2 me-1"></i> KAM Branch
        </label>
        <input
          name="kamBranch"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.kamBranch}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-file-earmark-text me-1"></i> Payment Terms
        </label>
        <input
          name="paymentTerms"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.paymentTerms}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-cash-coin me-1"></i> Advance Payment
        </label>
        <select
          name="advancePayment"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.advancePayment}
          onChange={handleChange}
        >
          <option value="">Select</option>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>
      </div>

      <div className="col-md-2">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-percent me-1"></i> Tax Type
        </label>
        <select
          name="taxType"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          value={form.taxType}
          onChange={handleChange}
        >
          <option value="">Select</option>
          <option value="TAX INCLUSIVE">TAX INCLUSIVE</option>
          <option value="TAX EXCLUSIVE">TAX EXCLUSIVE</option>
        </select>
      </div>

      <div className="col-md-3">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-exclamation-circle me-1"></i> Special Instruction
        </label>
        <textarea
          name="specialInstruction"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
          value={form.specialInstruction}
          onChange={handleChange}
        />
      </div>

      <div className="col-md-4">
        <label className="fw-semibold" style={{ fontSize: "12px", color: "#1a6bbd" }}>
          <i className="bi bi-chat-left-text me-1"></i> Remarks
        </label>
        <textarea
          name="instructionRemarks"
          className="form-control"
          style={{ borderRadius: "8px", border: "1.5px solid #c9d8f0", fontSize: "13px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", resize: "vertical" }}
          value={form.instructionRemarks}
          onChange={handleChange}
        />
      </div>

    </div>
  </div>
)}
<div className="d-flex justify-content-center mt-3">
  <button 
    type="submit"
    className="btn btn-primary px-4"
    disabled={saving}
    onClick={(e) => {
      if (saving) e.preventDefault();
    }}
  >
    Save
  </button>
</div>
      </form>

      <hr />
 <div className="d-flex flex-wrap align-items-end gap-2 mb-3 p-3"
  style={{
    background: "linear-gradient(135deg, #f0f6ff, #e8f0fe)",
    borderRadius: "12px",
    border: "1.5px solid #c9d8f0",
    boxShadow: "0 2px 10px rgba(33,150,243,0.08)"
  }}
>
  {/* WO Number */}
  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    <label style={{ fontSize: "11px", fontWeight: "600", color: "#1a6bbd", marginBottom: "2px" }}>
      <i className="bi bi-hash me-1"></i>WO Number
    </label>
    <input
      type="text"
      placeholder="Search WO..."
      className="form-control border-0"
      style={{ width: "170px", fontSize: "12px", borderRadius: "8px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
      value={filters.wo}
      onChange={(e) => setFilters({ ...filters, wo: e.target.value })}
    />
  </div>

  {/* Sub WO */}
  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
    <label style={{ fontSize: "11px", fontWeight: "600", color: "#1a6bbd", marginBottom: "2px" }}>
      <i className="bi bi-diagram-2 me-1"></i>Sub WO
    </label>
    <input
      type="text"
      placeholder="Search Sub WO..."
      className="form-control border-0"
      style={{ width: "170px", fontSize: "12px", borderRadius: "8px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
      value={filters.subWo}
      onChange={(e) => setFilters({ ...filters, subWo: e.target.value })}
    />
  </div>

  {/* Customer */}
  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
    <label style={{ fontSize: "11px", fontWeight: "600", color: "#1a6bbd", marginBottom: "2px" }}>
      <i className="bi bi-person me-1"></i>Customer
    </label>
    <select
      className="form-control border-0"
      style={{ width: "170px", fontSize: "12px", borderRadius: "8px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
      value={filters.customer}
      onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
    >
      <option value="">All Customers</option>
      {customerOptions.map((cust, i) => (
        <option key={i} value={cust}>{cust}</option>
      ))}
    </select>
  </div>

  {/* Product Code */}
  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
    <label style={{ fontSize: "11px", fontWeight: "600", color: "#1a6bbd", marginBottom: "2px" }}>
      <i className="bi bi-upc-scan me-1"></i>Product Code
    </label>
    <input
      type="text"
      placeholder="Search code..."
      className="form-control border-0"
      style={{ width: "170px", fontSize: "12px", borderRadius: "8px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
      value={filters.productCode}
      onChange={(e) => setFilters({ ...filters, productCode: e.target.value })}
    />
  </div>

  {/* Ticket ID */}
  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
    <label style={{ fontSize: "11px", fontWeight: "600", color: "#1a6bbd", marginBottom: "2px" }}>
      <i className="bi bi-ticket-perforated me-1"></i>Ticket ID
    </label>
    <input
      type="text"
      placeholder="Ticket ID "
      className="form-control border-0"
      style={{ width: "170px", fontSize: "12px", borderRadius: "8px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
      value={filters.ticketId || ""}
      onChange={(e) => setFilters({ ...filters, ticketId: e.target.value })}
    />
  </div>

  {/* Buttons */}
  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
    <label style={{ fontSize: "11px", fontWeight: "600", color: "#1a6bbd", marginBottom: "2px" }}>
      &nbsp;
    </label>
    <div className="d-flex gap-2">
      <button
        className="btn btn-sm"
        style={{ background: "#6c757d", color: "#fff", borderRadius: "8px", fontSize: "12px", padding: "6px 14px", fontWeight: "600" }}
        onClick={() => setFilters({ wo: "", subWo: "", customer: "", productCode: "", ticketId: "" })}
      >
        <i className="bi bi-x-circle me-1"></i>Clear
      </button>

      <button
        className="btn btn-sm"
        style={{ background: "linear-gradient(135deg, #198754, #20c997)", color: "#fff", borderRadius: "8px", fontSize: "12px", padding: "6px 14px", fontWeight: "600" }}
        onClick={exportToExcel}
      >
        <i className="bi bi-file-earmark-excel me-1"></i>Excel
      </button>

      <button
        className="btn btn-sm"
        style={{ background: "linear-gradient(135deg, #dc3545, #e8636f)", color: "#fff", borderRadius: "8px", fontSize: "12px", padding: "6px 14px", fontWeight: "600" }}
        onClick={viewPDF}
      >
        <i className="bi bi-file-earmark-pdf me-1"></i>PDF
      </button>
    </div>
  </div>

</div>
    {/* TABLE */}
<div style={{
  overflowX: "auto",
  maxHeight: "450px",
  borderRadius: "12px",
  border: "1.5px solid #c9d8f0",
  boxShadow: "0 4px 18px rgba(33,150,243,0.10)"
}}>
  <table className="table table-bordered align-middle mb-0" style={{ fontSize: "12px", minWidth: "max-content" }}>

    <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
      <tr>
        <th style={thStyle}>Ticket ID</th>
        <th style={thStyle}>Work order</th>
          <th style={thStyle}>Sub work order</th>
        <th style={thStyle}>Product</th>
        <th style={thStyle}>Material</th>
        <th style={thStyle}>Description</th>
        <th style={thStyle}>Customer</th>

        <th style={thStyle}>Color Front</th>
        <th style={thStyle}>Color Back</th>
        <th style={thStyle}>Waste Qty</th>
        <th style={thStyle}>Job Size</th>
        <th style={thStyle}>Ink</th>

        <th style={thStyle}>Qty</th>
        <th style={thStyle}>Remaining Qty</th>
        <th style={thStyle}>Location</th>

        <th style={thStyle}>Material Code</th>
        <th style={thStyle}>Material Desc</th>
        <th style={thStyle}>GSM</th>
        <th style={thStyle}>Mill</th>
        <th style={thStyle}>Paper Size</th>

        <th style={thStyle}>Inner Type</th>
        <th style={thStyle}>Leaves</th>
        <th style={thStyle}>Inner Pack</th>
        <th style={thStyle}>Outer Pack</th>
        <th style={thStyle}>Inner/Outer</th>

        <th style={thStyle}>Delivery</th>
        <th style={thStyle}>Transport</th>
        <th style={thStyle}>Freight Charge</th>
        <th style={thStyle}>Freight Type</th>
        <th style={thStyle}>Dispatch Address</th>

        <th style={thStyle}>Quotation</th>
        <th style={thStyle}>PO No</th>
        <th style={thStyle}>PO Date</th>
        <th style={thStyle}>Rate</th>
        <th style={thStyle}>Total</th>

        <th style={thStyle}>Prefix</th>
        <th style={thStyle}>Non MICR Digit</th>
        <th style={thStyle}>Account No</th>
        <th style={thStyle}>MICR</th>
        <th style={thStyle}>Account Code</th>
        <th style={thStyle}>Transaction Code</th>
        
        <th style={thStyle}>Cheque From</th>
        <th style={thStyle}>Cheque To</th>

        <th style={thStyle}>Bill Send</th>
         <th style={thStyle}>Bill To</th>
        <th style={thStyle}>KAM</th>
        <th style={thStyle}>KAM Branch</th>
        <th style={thStyle}>Payment</th>
        <th style={thStyle}>Advance</th>
        <th style={thStyle}>Tax</th>
        <th style={thStyle}>Billing Type</th>

        <th style={thStyle}>Special</th>
       

        <th style={thStyle}>Type</th>
        <th style={thStyle}>Remarks</th>
        <th style={thStyle}>User Locations</th>
        <th style={thStyle}>User</th>
        <th style={thStyle}>Action</th>
      </tr>
    </thead>

<tbody>
      {filteredOrders.map((order, idx) => {

        const rowStyle = {
          backgroundColor: idx % 2 === 0 ? "#f4f8ff" : "#ffffff",
          transition: "background-color 0.2s"
        };

        const tdStyle = {
          padding: "8px 10px",
          color: "#2c3e50",
          borderColor: "#dce8f8",
          whiteSpace: "nowrap",
          verticalAlign: "middle"
        };

        const badgeStyle = (color) => ({
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "12px",
          fontSize: "11px",
          fontWeight: "600",
          backgroundColor: color,
          color: "#fff"
        });

        return (
          <tr
            key={order._id}
            style={rowStyle}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#ddeeff"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#f4f8ff" : "#ffffff"}
          >
            <td style={tdStyle}>
              <span style={badgeStyle("#0d6efd")}>{order.ticketId || "--"}</span>
            </td>

            <td style={tdStyle}>
              {order.workOrders?.map((wo, i) => {
                if (!wo.workorder2 || wo.workorder2 === "") return <div key={i}>{wo.efiWoNumber}</div>;
                if (Number(wo.workorder2) < Number(wo.efiWoNumber)) return <div key={i}>{wo.workorder2}</div>;
                return <div key={i}>{wo.efiWoNumber}</div>;
              })}
            </td>

            <td style={tdStyle}>
              {order.workOrders?.map((wo, i) => {
                if (!wo.workorder2 || wo.workorder2 === "") return <div key={i}>-</div>;
                if (Number(wo.workorder2) < Number(wo.efiWoNumber)) return <div key={i}>{wo.efiWoNumber}</div>;
                return <div key={i}>{wo.workorder2}</div>;
              })}
            </td>

            <td style={{ ...tdStyle, fontWeight: "600", color: "#1a6bbd" }}>{order.productCode}</td>
            <td style={tdStyle}>{order.materialType}</td>

            <td
              style={{ ...tdStyle, cursor: "pointer", maxWidth: "180px", whiteSpace: expandedCell === `desc-${order._id}` ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              onClick={() => setExpandedCell(expandedCell === `desc-${order._id}` ? null : `desc-${order._id}`)}
              title={order.description}
            >
              {expandedCell === `desc-${order._id}` ? order.description : truncateText(order.description)}
            </td>

            <td
              style={{ ...tdStyle, cursor: "pointer", maxWidth: "150px", whiteSpace: expandedCell === `customer-${order._id}` ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              onClick={() => setExpandedCell(expandedCell === `customer-${order._id}` ? null : `customer-${order._id}`)}
              title={order.customerName}
            >
              {expandedCell === `customer-${order._id}` ? order.customerName : truncateText(order.customerName)}
            </td>

            <td style={tdStyle}>{order.colorFront}</td>
            <td style={tdStyle}>{order.colorBack}</td>
            <td style={tdStyle}>{order.wasteQty}</td>
            <td style={tdStyle}>{order.jobSize}</td>

            <td
              style={{ ...tdStyle, cursor: "pointer", maxWidth: "150px", whiteSpace: expandedCell === `ink-${order._id}` ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              onClick={() => setExpandedCell(expandedCell === `ink-${order._id}` ? null : `ink-${order._id}`)}
              title={order.inkDetails}
            >
              {expandedCell === `ink-${order._id}` ? order.inkDetails : truncateText(order.inkDetails)}
            </td>

            <td style={{ ...tdStyle, fontWeight: "600" }}>{order.quantity}</td>
            <td style={{ ...tdStyle, fontWeight: "600", color: order.remainingQty > 0 ? "#198754" : "#dc3545" }}>
              {order.remainingQty}
            </td>
            <td style={tdStyle}>
              <span style={badgeStyle("#6c757d")}>{order.location}</span>
            </td>

            <td style={tdStyle}>{order.materialCode || "-"}</td>
            <td
              style={{ ...tdStyle, cursor: "pointer", maxWidth: "150px", whiteSpace: expandedCell === `matdesc-${order._id}` ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              onClick={() => setExpandedCell(expandedCell === `matdesc-${order._id}` ? null : `matdesc-${order._id}`)}
              title={order.materialDescription}
            >
              {expandedCell === `matdesc-${order._id}` ? order.materialDescription : truncateText(order.materialDescription) || "-"}
            </td>
            <td style={tdStyle}>{order.materialGsm || "-"}</td>
            <td style={tdStyle}>{order.materialMill || "-"}</td>
            <td style={tdStyle}>{order.paperSize || "-"}</td>

            <td style={tdStyle}>{order.innerPackingType}</td>
            <td style={tdStyle}>{order.leavesPerInner}</td>
            <td style={tdStyle}>{order.innerPack}</td>
            <td style={tdStyle}>{order.outerPack}</td>
            <td style={tdStyle}>{order.innerPerOuter}</td>

            <td style={tdStyle}>{order.deliveryDate?.substring(0, 10)}</td>
            <td style={tdStyle}>{order.modeOfTransport}</td>
            <td style={tdStyle}>{order.freightChargeType}</td>
            <td style={tdStyle}>{order.freightType}</td>
  <td
  style={{
    ...tdStyle,
    cursor: "pointer",
    maxWidth: expandedCell === `address-${order._id}` ? "300px" : "150px",
    whiteSpace: expandedCell === `address-${order._id}` ? "normal" : "nowrap",
    overflow: expandedCell === `address-${order._id}` ? "visible" : "hidden",
    textOverflow: expandedCell === `address-${order._id}` ? "unset" : "ellipsis",
    wordBreak: expandedCell === `address-${order._id}` ? "break-word" : "normal",
    transition: "all 0.2s ease"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `address-${order._id}` ? null : `address-${order._id}`
    )
  }
  title={order.address}
>
  {expandedCell === `address-${order._id}`
    ? order.address
    : truncateText(order.address, 15)}
</td>

            <td style={tdStyle}>{order.quotationRefNo}</td>
            <td style={tdStyle}>{order.purchaseOrderNo}</td>
            <td style={tdStyle}>{order.poDate?.substring(0, 10)}</td>
            <td style={tdStyle}>{order.ratePerUnit}</td>
            <td style={{ ...tdStyle, fontWeight: "600" }}>{order.totalBillableAmount}</td>

            <td style={tdStyle}>{order.prefix || "--"}</td>
            <td style={tdStyle}>{order.nonMicrDigits || "--"}</td>
            <td style={tdStyle}>{order.accountNumber || "--"}</td>
            <td style={tdStyle}>{order.sortCode || "--"}</td>
            <td style={tdStyle}>{order.accountCode || "--"}</td>
            <td style={tdStyle}>{order.transactionCode || "--"}</td>
            <td style={tdStyle}>{order.chequeFrom || "--"}</td>
            <td style={tdStyle}>{order.chequeTo || "--"}</td>

            <td
  style={{
    ...tdStyle,
    cursor: "pointer",
    maxWidth: expandedCell === `billsend-${order._id}` ? "300px" : "150px",
    whiteSpace: expandedCell === `billsend-${order._id}` ? "normal" : "nowrap",
    overflow: expandedCell === `billsend-${order._id}` ? "visible" : "hidden",
    textOverflow: expandedCell === `billsend-${order._id}` ? "unset" : "ellipsis",
    wordBreak: expandedCell === `billsend-${order._id}` ? "break-word" : "normal",
    transition: "all 0.2s ease"
  }}
  onClick={() => setExpandedCell(expandedCell === `billsend-${order._id}` ? null : `billsend-${order._id}`)}
  title={order.billSend}
>
  {expandedCell === `billsend-${order._id}` ? order.billSend : truncateText(order.billSend, 15)}
</td>
         <td
  style={{
    ...tdStyle,
    cursor: "pointer",
    maxWidth: expandedCell === `billto-${order._id}` ? "300px" : "150px",
    whiteSpace: expandedCell === `billto-${order._id}` ? "normal" : "nowrap",
    overflow: expandedCell === `billto-${order._id}` ? "visible" : "hidden",
    textOverflow: expandedCell === `billto-${order._id}` ? "unset" : "ellipsis",
    wordBreak: expandedCell === `billto-${order._id}` ? "break-word" : "normal",
    transition: "all 0.2s ease"
  }}
  onClick={() => setExpandedCell(expandedCell === `billto-${order._id}` ? null : `billto-${order._id}`)}
  title={order.planningInstruction}
>
  {expandedCell === `billto-${order._id}` ? order.planningInstruction : truncateText(order.planningInstruction, 15)}
</td>
            <td style={tdStyle}>{order.kam}</td>
            <td style={tdStyle}>{order.kamBranch}</td>
            <td style={tdStyle}>{order.paymentTerms}</td>
            <td style={tdStyle}>
              {order.advancePayment && (
                <span style={badgeStyle(order.advancePayment === "YES" ? "#198754" : "#dc3545")}>
                  {order.advancePayment}
                </span>
              )}
            </td>
            <td style={tdStyle}>{order.taxType}</td>
            <td style={tdStyle}>
              {order.billingType && (
                <span style={badgeStyle(order.billingType === "INTERNAL" ? "#6f42c1" : "#fd7e14")}>
                  {order.billingType}
                </span>
              )}
            </td>

            <td
  style={{
    ...tdStyle,
    cursor: "pointer",
    maxWidth: expandedCell === `special-${order._id}` ? "300px" : "150px",
    whiteSpace: expandedCell === `special-${order._id}` ? "normal" : "nowrap",
    overflow: expandedCell === `special-${order._id}` ? "visible" : "hidden",
    textOverflow: expandedCell === `special-${order._id}` ? "unset" : "ellipsis",
    wordBreak: expandedCell === `special-${order._id}` ? "break-word" : "normal",
    transition: "all 0.2s ease"
  }}
  onClick={() => setExpandedCell(expandedCell === `special-${order._id}` ? null : `special-${order._id}`)}
  title={order.specialInstruction}
>
  {expandedCell === `special-${order._id}` ? order.specialInstruction : truncateText(order.specialInstruction, 15)}
</td>
   
            <td style={tdStyle}>{order.orderType}</td>
            <td
  style={{
    ...tdStyle,
    cursor: "pointer",
    maxWidth: expandedCell === `remarks-${order._id}` ? "300px" : "150px",
    whiteSpace: expandedCell === `remarks-${order._id}` ? "normal" : "nowrap",
    overflow: expandedCell === `remarks-${order._id}` ? "visible" : "hidden",
    textOverflow: expandedCell === `remarks-${order._id}` ? "unset" : "ellipsis",
    wordBreak: expandedCell === `remarks-${order._id}` ? "break-word" : "normal",
    transition: "all 0.2s ease"
  }}
  onClick={() => setExpandedCell(expandedCell === `remarks-${order._id}` ? null : `remarks-${order._id}`)}
  title={order.remarks}
>
  {expandedCell === `remarks-${order._id}` ? order.remarks : truncateText(order.remarks, 15)}
</td>
            <td style={tdStyle}>{order.userLocations?.join(", ") || "--"}</td>
            <td style={{ ...tdStyle, fontWeight: "600" }}>{order.user}</td>

            <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
              <button
                className="btn btn-sm btn-outline-primary me-1"
                onClick={() => handleEdit(order)}
                style={{ fontSize: "11px", padding: "3px 8px" }}
              >
                <i className="bi bi-pencil-fill me-1"></i>Edit
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleDelete(order._id)}
                style={{ fontSize: "11px", padding: "3px 8px" }}
              >
                <i className="bi bi-trash-fill me-1"></i>Del
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
    </div>
  );
}
export default PrintingIns;