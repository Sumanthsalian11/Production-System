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

// ============================================================================
// 🎨 UI HELPERS (presentation only – no business logic)
// ============================================================================
function Field({ col = "col-md-2", icon, label, error, children }) {
  return (
    <div className={col}>
      <label className="pi-label">
        {icon && <i className={`bi bi-${icon} me-1`}></i>}
        {label}
      </label>
      {children}
      {error}
    </div>
  );
}

function SectionHead({ icon, title }) {
  return (
    <div className="pi-sec-head">
      <span className="pi-sec-icon"><i className={`bi bi-${icon}`}></i></span>
      <h5 className="pi-sec-title">{title}</h5>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="pi-toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <i className="bi bi-eye"></i> {label}
    </label>
  );
}

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "38px",
    borderRadius: "10px",
    fontSize: "14px",
    background: "rgba(255,255,255,0.88)",
    borderColor: state.isFocused ? "#4b83b8" : "rgba(110,140,170,0.28)",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(75,131,184,0.18)" : "none",
    "&:hover": { borderColor: "#4b83b8" }
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px" }),
  indicatorsContainer: (base) => ({ ...base, height: "32px" }),
  menu: (base) => ({ ...base, borderRadius: "12px", overflow: "hidden", fontSize: "14px", zIndex: 50 }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? "#3b6fa8" : state.isFocused ? "rgba(75,131,184,0.12)" : "#fff",
    color: state.isSelected ? "#fff" : "#1b2a3c"
  })
};

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
const [showAddBranch, setShowAddBranch] = useState(false);
const [newBranch, setNewBranch] = useState({ branchCode: "", dispatchAddress: "" });
const [savingBranch, setSavingBranch] = useState(false);
const [baseRemaining, setBaseRemaining] = useState(0);
const [liveRemaining, setLiveRemaining] = useState(0);
const [freightChargeList, setFreightChargeList] = useState([]);
const [freightTypeList, setFreightTypeList] = useState([]);
const [materialList, setMaterialList] = useState([]);
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
itemPdfPath: "",
materialGroup: "",
materialGsm: "",
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
  fetchMaterialList();

}, []);

const fetchMaterialList = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/master/materials`);
    setMaterialList(res.data);
  } catch (err) {
    console.log("Material list fetch failed");
  }
};

const materialGroupOptions = [...new Set(materialList.map(m => m.group).filter(Boolean))];

const handleMaterialGroupChange = (value) => {
  setErrors(prev => ({ ...prev, materialGroup: "" }));

  if (!value) {
    setForm(prev => ({
      ...prev,
      materialGroup: "",
      materialGsm: ""
    }));
    return;
  }

  const match = materialList.find(m => m.group === value);

  setForm(prev => ({
    ...prev,
    materialGroup: value,
    materialGsm: match?.gsm || ""
  }));
};
const isPersow = orderMode === "PERSOW";

const defaultProductRow = () => ({
  productCode: "",
  materialType: "",
  description: "",
  customerName: "",
  jobSize: "",
  colorFront: "",
  colorBack: "",
  wasteQty: 0,
  inkDetails: "",
  itemPdfPath: "",
});
const [productRows, setProductRows] = useState([defaultProductRow()]);
const addProductRow = () => setProductRows(prev => [...prev, defaultProductRow()]);

const removeProductRow = (index) => setProductRows(prev => prev.filter((_, i) => i !== index));

const updateProductRow = (index, field, value) => {
  setProductRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
};

const fetchProductDetailsForRow = async (code, index) => {
  if (!code) return;
  try {
    const res = await axios.get(`${BASE_URL}/api/master/items/${code}`);
    setProductRows(prev => prev.map((row, i) => i === index ? {
      ...row,
      materialType: res.data.materialType || "",
      description: res.data.description || "",
      customerName: res.data.customerName || "",
      colorFront: String(res.data.colorFront || ""),
      colorBack: String(res.data.colorBack || ""),
      jobSize: res.data.jobSize || "",
      wasteQty: Number(res.data.wasteQty || 0),
      inkDetails: res.data.inkDetails || "",
                itemPdfPath: res.data.pdfPath || ""
    } : row));
  } catch { }
};

const truncateText = (text, maxLength = 20) => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
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
      ? (order.customerName === filters.customer ||
         order.products?.some(p => p.customerName === filters.customer))
      : true;
const productMatch = filters.productCode
      ? (order.productCode?.toString().toLowerCase().includes(filters.productCode.toLowerCase()) ||
         order.products?.some(p => p.productCode?.toString().toLowerCase().includes(filters.productCode.toLowerCase())))
      : true;

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
  ...new Set(orders.flatMap(o =>
    o.products?.length
      ? o.products.map(p => p.customerName).filter(Boolean)
      : [o.customerName].filter(Boolean)
  ))
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
const addNewBranch = async () => {
  if (!newBranch.branchCode.trim() || !newBranch.dispatchAddress.trim()) {
    Swal.fire("Error", "Branch Code and Dispatch Address are required", "error");
    return;
  }

  setSavingBranch(true);
  try {
    await axios.post(`${BASE_URL}/api/master/branch`, newBranch);

    await fetchBranches(); // refresh dropdown so new branch appears

    // auto-select the branch you just added
    setForm(prev => ({
      ...prev,
      branchCode: newBranch.branchCode,
      address: newBranch.dispatchAddress
    }));
    setErrors(prev => ({ ...prev, branchCode: "", address: "" }));

    setNewBranch({ branchCode: "", dispatchAddress: "" });
    setShowAddBranch(false);

    Swal.fire("Success", "Branch added successfully", "success");
  } catch (err) {
    Swal.fire("Error", "Failed to add branch", "error");
  } finally {
    setSavingBranch(false);
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
      materialGroup: res.data.group || "",
      materialGsm: res.data.gsm || ""
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

const fetchWOListForMultipleProducts = async (rows) => {
  try {
    const productCodes = rows
      .map(r => r.productCode)
      .filter(Boolean);

    if (!productCodes.length) {
      setWoList([]);
      return;
    }

    const responses = await Promise.all(
      productCodes.map(code =>
        axios.get(
          `${BASE_URL}/api/printing-instructions/workorders/${code}`
        )
      )
    );

    const merged = responses.flatMap(r => r.data || []);

    const uniqueWO = merged.filter(
      (wo, index, self) =>
        index === self.findIndex(x => x._id === wo._id)
    );

    setWoList(uniqueWO);
  } catch (err) {
    console.log("WO fetch error", err);
    setWoList([]);
  }
};
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
  inkDetails: res.data.inkDetails || "",
    itemPdfPath: res.data.pdfPath || ""

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
useEffect(() => {
  if (orderMode === "PERSOW") {
    fetchWOListForMultipleProducts(productRows);
  }
}, [productRows, orderMode]);
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
  const updatedRows = productRows.map((r, i) =>
    i === index
      ? { ...r, productCode: val }
      : r
  );

  fetchWOListForMultipleProducts(updatedRows);
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
  let firstErrorField = null;
  const addRequiredError = (field, label) => {
    if (!form[field]) {
      newErrors[field] = `${label} is required`;
      firstErrorField = firstErrorField || field;
    }
  };

  productRows.forEach((row, index) => {
    if (!row.productCode) {
      newErrors[`productCode_${index}`] = "Product Code is required";
      if (index === 0) newErrors.productCode = "Product Code is required";
      firstErrorField = firstErrorField || "productCode";
    }
  });

  if (orderMode === "PERSOW" && !selectedWO) {
    newErrors.workorder2 = "Work Order is required";
    firstErrorField = firstErrorField || "workorder2";
  }

  if (orderMode === "MASTER" && !form.materialGroup) {
    newErrors.materialGroup = "Material Group is required";
    firstErrorField = firstErrorField || "materialGroup";
  }

  if (!form.quantity) {
    newErrors.quantity = "Quantity is required";
    firstErrorField = firstErrorField || "quantity";
  }

  if (!form.location) {
    newErrors.location = "Location is required";
    firstErrorField = firstErrorField || "location";
  }

  if (orderMode === "PERSOW") {
    // addRequiredError("remarks", "Remarks");
    addRequiredError("prefix", "Prefix");
    addRequiredError("accountNumber", "Account Number");
    addRequiredError("chequeFrom", "Cheque From");
    addRequiredError("chequeTo", "Cheque To");
    addRequiredError("nonMicrDigits", "Non MICR Digits");
    addRequiredError("accountCode", "Account Code");
    addRequiredError("sortCode", "Sort Code / MICR");
    addRequiredError("transactionCode", "Transaction Code");
    // addRequiredError("numberingRemarks", "Numbering Remarks");
    addRequiredError("innerPackingType", "Type of Inner Packing");
    // addRequiredError("packingRemarks", "Packing Remarks");
    addRequiredError("deliveryDate", "Delivery Date");
    addRequiredError("modeOfTransport", "Mode of Transport");
    addRequiredError("freightChargeType", "Freight Charge Type");
    addRequiredError("freightType", "Freight Type");
    addRequiredError("branchCode", "Branch Code");
    addRequiredError("address", "Dispatch Address");
    // addRequiredError("dispatchRemarks", "Dispatch Remarks");
    addRequiredError("quotationRefNo", "Quotation/Contract Ref No");
    addRequiredError("purchaseOrderNo", "PO Number");
    addRequiredError("poDate", "PO Date");
    addRequiredError("ratePerUnit", "Rate / Unit");
    addRequiredError("totalBillableAmount", "Total Billable Amount");
    addRequiredError("billingType", "Billing Type");
    addRequiredError("planningInstruction", "Bill To");
    addRequiredError("billSend", "Bill Send");
    // addRequiredError("billingRemarks", "Billing Remarks");
    addRequiredError("kam", "KAM");
    addRequiredError("kamBranch", "KAM Branch");
    addRequiredError("paymentTerms", "Payment Terms");
    addRequiredError("advancePayment", "Advance Payment");
    addRequiredError("taxType", "Tax Type");
    addRequiredError("specialInstruction", "Special Instruction");
    // addRequiredError("instructionRemarks", "Instruction Remarks");
  }

  setErrors(newErrors);

  if (firstErrorField) {
    const element = document.querySelector(
      `[name="${firstErrorField}"]`
    );

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      setTimeout(() => {
        element.focus();
      }, 300);
    }

    return false;
  }

  return true;
};
const handleSubmit = async (e) => {
  e.preventDefault();

  if (saving) {
    console.log("Blocked duplicate click");
    return;
  }
 if (orderMode === "PERSOW") {
  if (!selectedWO) {
    validateForm();
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
for (const row of productRows) {
  const data = {
  ...form,
  productCode: row.productCode,
  materialType: row.materialType,
  description: row.description,
  customerName: row.customerName,
  colorFront: row.colorFront,
  colorBack: row.colorBack,
  jobSize: row.jobSize,
  wasteQty: row.wasteQty,
  inkDetails: row.inkDetails,
  products: [row],
  itemPdfPath: row.itemPdfPath || form.itemPdfPath || "",

  remainingQty:
    orderMode === "PERSOW"
      ? liveRemaining
      : Number(form.quantity),

  orderMode,
  user: loggedInUser,
  userLocations: decoded.locations || [],
  workorder2:
    orderMode === "MASTER"
      ? ""
      : (form.workorder2 || "")
};
  if (editingId && productRows.length === 1) {
    await axios.put(`${BASE_URL}/api/printing-instructions/${editingId}`, data);
  } else {
    await axios.post(`${BASE_URL}/api/printing-instructions`, data);
  }
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
      materialGroup: "",
      materialGsm: "",
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
setProductRows([defaultProductRow()]);

  } catch (err) {
    Swal.fire("Error", "Save failed", "error");
  } finally {
    setSaving(false); // 🔓 unlock
  }
};
const handleEdit = async (order) => {
  try {
    setEditingId(order._id);

    // ✅ Correctly identify PERSO / MASTER
    const isPerso =
      order.orderMode === "PERSOW" ||
      (order.workorder2 && order.workorder2 !== "");

    const mode = isPerso ? "PERSOW" : "MASTER";

    // ✅ Set mode
    setOrderMode(mode);

    // ✅ Get product information from products[] first
    const firstProduct = order.products?.[0] || {};

    const productCode =
      firstProduct.productCode ??
      order.productCode ??
      "";

    // ✅ Set main form
    setForm({
      productCode: productCode,

      materialType:
        firstProduct.materialType ??
        order.materialType ??
        "",

      description:
        firstProduct.description ??
        order.description ??
        "",

      customerName:
        firstProduct.customerName ??
        order.customerName ??
        "",

      jobSize:
        firstProduct.jobSize ??
        order.jobSize ??
        "",

      quantity: order.quantity ?? "",

      itemPdfPath:
        firstProduct.itemPdfPath ??
        order.itemPdfPath ??
        "",

      materialGroup: order.materialGroup || "",
      materialGsm: order.materialGsm || "",

      prefix: order.prefix || "",
      accountNumber: order.accountNumber || "",
      nonMicrDigits: order.nonMicrDigits || "",

      colorFront:
        firstProduct.colorFront ??
        order.colorFront ??
        "",

      colorBack:
        firstProduct.colorBack ??
        order.colorBack ??
        "",

      wasteQty:
        firstProduct.wasteQty ??
        order.wasteQty ??
        0,

      inkDetails:
        firstProduct.inkDetails ??
        order.inkDetails ??
        "",

      specialInstruction: order.specialInstruction || "",
      planningInstruction: order.planningInstruction || "",

      quotationRefNo: order.quotationRefNo || "",
      purchaseOrderNo: order.purchaseOrderNo || "",

      poDate: order.poDate
        ? String(order.poDate).substring(0, 10)
        : "",

      ratePerUnit: order.ratePerUnit || "",
      totalBillableAmount: order.totalBillableAmount || "",

      deliveryDate: order.deliveryDate
        ? String(order.deliveryDate).substring(0, 10)
        : "",

      address: order.address || "",

      freightChargeType: order.freightChargeType || "",
      modeOfTransport: order.modeOfTransport || "",
      freightType: order.freightType || "",

      innerPackingType: order.innerPackingType || "",
      leavesPerInner: order.leavesPerInner || "",
      innerPack: order.innerPack || "",
      outerPack: order.outerPack || "",
      innerPerOuter: order.innerPerOuter || "",

      location: order.location || "",
      orderType: order.orderType || "Inhouse",

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

      remarks: order.remarks || "",

      workorder2: order.workorder2 || ""
    });

    // =====================================================
    // ✅ VERY IMPORTANT
    // Product Code field uses productRows, not form.productCode
    // =====================================================

    const rows = order.products?.length
      ? order.products.map((p) => ({
          productCode: p.productCode ?? "",
          materialType: p.materialType ?? "",
          description: p.description ?? "",
          customerName: p.customerName ?? "",
          jobSize: p.jobSize ?? "",
          colorFront: p.colorFront ?? "",
          colorBack: p.colorBack ?? "",
          wasteQty: Number(p.wasteQty ?? 0),
          inkDetails: p.inkDetails ?? "",
          itemPdfPath: p.itemPdfPath ?? ""
        }))
      : [
          {
            productCode: order.productCode ?? "",
            materialType: order.materialType ?? "",
            description: order.description ?? "",
            customerName: order.customerName ?? "",
            jobSize: order.jobSize ?? "",
            colorFront: order.colorFront ?? "",
            colorBack: order.colorBack ?? "",
            wasteQty: Number(order.wasteQty ?? 0),
            inkDetails: order.inkDetails ?? "",
            itemPdfPath: order.itemPdfPath ?? ""
          }
        ];

    // ✅ Set product rows
    setProductRows(rows);

    // =====================================================
    // PERSO ONLY
    // =====================================================

    if (isPerso && productCode) {

      // Fetch WO list using product code
      const res = await axios.get(
        `${BASE_URL}/api/printing-instructions/workorders/${productCode}`
      );

      const data = res.data || [];

      setWoList(data);

      // Find selected WO
      const found = data.find(
        w =>
          String(w.workorder2 || "") ===
            String(order.workorder2 || "") ||
          String(w.efiWoNumber || "") ===
            String(order.workorder2 || "")
      );

      if (found) {
        setSelectedWO({
          value: found._id,
          label: `WO: ${found.workorder2 || found.efiWoNumber}`
        });
      } else {
        setSelectedWO(null);
      }

      // ✅ Get remaining quantity
    // ✅ Get remaining quantity for the selected WO
if (found) {
  try {
    const remainingRes = await axios.get(
      `${BASE_URL}/api/printing-instructions/remaining-by-wo/${found._id}`
    );

    const remaining = Number(
      remainingRes.data?.remainingQty || 0
    );

    // ✅ Add back the quantity of the record being edited
    const currentQty = Number(order.quantity || 0);

    const editRemaining = remaining + currentQty;

    setBaseRemaining(editRemaining);   // cap used for validation
    setLiveRemaining(remaining);       // ✅ FIX: display = pool minus qty already filled in

  } catch (remainingErr) {
    console.log(
      "Remaining quantity fetch failed",
      remainingErr
    );
  }
}
    } else {

      // ✅ MASTER
      setSelectedWO(null);
      setWoList([]);
      setBaseRemaining(0);
      setLiveRemaining(0);
    }

    // Scroll to top
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }, 100);

  } catch (err) {
    console.error("Edit load error:", err);

    Swal.fire(
      "Error",
      "Unable to load the record for editing",
      "error"
    );
  }
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
    "Product Code": order.products?.length ? order.products.map(p => p.productCode).join(", ") : order.productCode,
      "Material": order.products?.length ? order.products.map(p => p.materialType).join(", ") : order.materialType,
      "Description": order.products?.length ? order.products.map(p => p.description).join(", ") : order.description,
      "Customer": order.products?.length ? order.products.map(p => p.customerName).join(", ") : order.customerName,
 "Color Front": order.products?.length ? order.products.map(p => p.colorFront).join(", ") : order.colorFront,
      "Color Back": order.products?.length ? order.products.map(p => p.colorBack).join(", ") : order.colorBack,
"Material Group": order.materialGroup,
"Material GSM": order.materialGsm,
"Location": order.location,
"Quantity": order.quantity,
"Remaining Qty": order.remainingQty,
"Job Size": order.products?.length ? order.products.map(p => p.jobSize).join(", ") : order.jobSize,
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
// Resolve WO and Sub WO from workOrders array
let woDisplay = "";
let subWoDisplay = "";

if (order.workOrders?.length) {
  const wo = order.workOrders[0];
  if (!wo.workorder2 || wo.workorder2 === "") {
    woDisplay = String(wo.efiWoNumber || "");
    subWoDisplay = "-";
  } else if (Number(wo.workorder2) < Number(wo.efiWoNumber)) {
    woDisplay = String(wo.workorder2 || "");
    subWoDisplay = String(wo.efiWoNumber || "");
  } else {
    woDisplay = String(wo.efiWoNumber || "");
    subWoDisplay = String(wo.workorder2 || "");
  }
}

const productRows = order.products?.length ? order.products : [{
  productCode: order.productCode,
  description: order.description,
  customerName: order.customerName,
  jobSize: order.jobSize,
  colorFront: order.colorFront,
  colorBack: order.colorBack,
}];

const productDataRows = [
  ["Ticket ID", String(order.ticketId || "--"), "Master Work Order", woDisplay],
  ["Sub Work Order", subWoDisplay, "Qty", String(order.quantity || "")],
  ...productRows.map((p, pi) => [
    `Product`,
    String(p.productCode || ""),
    "Desc",
    String(p.description || ""),
  ]),
  ...productRows.map((p, pi) => [
    `Customer`,
    String(p.customerName || ""),
    `Job Size`,
    String(p.jobSize || ""),
  ]),
  ...productRows.map((p, pi) => [
    `Color`,
    `${p.colorFront || ""}/${p.colorBack || ""}`,
  ]),
];

addSection("PRODUCT DETAILS", productDataRows);
const hasMaterial = order.materialGroup || order.materialGsm;

if (order.orderMode !== "PERSOW" && hasMaterial) {
  addSection("MATERIAL DETAILS", [
    ["Group", order.materialGroup || "", "GSM", order.materialGsm || ""]
  ]);
}

    addSection("PACKING DETAILS", [
      ["Inner", order.innerPackingType || "", "Leaves", order.leavesPerInner || ""],
      ["Inner Pack", order.innerPack || "", "Outer", order.outerPack || ""],
      ["Remarks", order.packingRemarks || "", "Inner Pack per Outer Pack", order.innerPerOuter || ""]
    ]);

    addSection("DISPATCH DETAILS", [
      [  "Date",
  order.deliveryDate
    ? new Date(order.deliveryDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "" || "", "Transport", order.modeOfTransport || ""],
      ["Freight", order.freightChargeType || "", "Type", order.freightType || ""],
      ["Address", order.address || "", "Remarks", order.dispatchRemarks || ""]
    ]);

    addSection("BILLING", [
      ["Quotation", order.quotationRefNo || "", "PO", order.purchaseOrderNo || ""],
      ["PO Date",
  order.poDate
    ? new Date(order.poDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "" || "", "Rate", order.ratePerUnit || ""],
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
const renderFieldError = (field) =>
  errors[field] ? (
    <small className="text-danger fw-semibold d-block mt-1">
      {errors[field]}
    </small>
  ) : null;

// 🎨 presentation helper: click-to-expand text cell used in the registry table
const expandTd = (order, key, value) => {
  const id = `${key}-${order._id}`;
  const open = expandedCell === id;
  return (
    <td
      className="pi-exp"
      style={{
        maxWidth: open ? "300px" : "150px",
        whiteSpace: open ? "normal" : "nowrap",
        overflow: open ? "visible" : "hidden",
        textOverflow: open ? "unset" : "ellipsis",
        wordBreak: open ? "break-word" : "normal"
      }}
      onClick={() => setExpandedCell(open ? null : id)}
      title={value}
    >
      {open ? value : truncateText(value, 15)}
    </td>
  );
};

  return (
<div className="pi-root">
  {/* ===================================================================== */}
  {/* 💅 SCOPED SKY-BLUE FROSTED-GLASS STYLES (no separate CSS file needed)  */}
  {/* ===================================================================== */}
  <style>{`
    .pi-root {
      background: radial-gradient(circle at 10% 20%, #d8f1fb 0%, #edf9fe 90.2%);
      min-height: 100vh;
      padding: 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1b2a3c;
    }
    .pi-container {
      max-width: 100%;
      margin: 0 auto;
      background: #d8f1fb;
      border: 1px solid rgba(12, 90, 130, 0.38);
      border-radius: 20px;
      padding: 20px 22px;
      box-shadow: 0 16px 36px rgba(4, 52, 78, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.85);
    }

    /* Page title */
    .pi-hero { text-align: center; margin-bottom: 14px; }
    .pi-hero h1 { margin: 0; font-size: 26px; font-weight: 700; color: #064c73; letter-spacing: -0.4px; }
    .pi-hero p { margin: 3px 0 0; font-size: 12.5px; color: #5f7487; }

    /* Master / Perso segmented control */
    .pi-seg {
      display: inline-flex; gap: 6px; padding: 4px;
      background: rgba(12, 90, 130, 0.08);
      border: 1px solid rgba(12, 90, 130, 0.25);
      border-radius: 14px;
    }
    .pi-seg-btn {
      position: relative;
      display: inline-flex; align-items: center; gap: 7px;
      padding: 7px 22px; margin: 0;
      border-radius: 10px;
      font-size: 13.5px; font-weight: 700; color: #0c4a6e;
      cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pi-seg-btn:hover { background: rgba(255, 255, 255, 0.6); }
    .pi-seg-btn input { position: absolute; opacity: 0; pointer-events: none; }
    .pi-seg-btn.on {
      background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%);
      color: #fff;
      box-shadow: 0 3px 0 #075985, 0 6px 14px rgba(3, 105, 161, 0.35);
    }

    /* Frosted glass panels */
    .pi-panel {
      background: rgba(255, 255, 255, 0.55);
      backdrop-filter: blur(18px) saturate(140%);
      -webkit-backdrop-filter: blur(18px) saturate(140%);
      border: 1px solid rgba(255, 255, 255, 0.85);
      border-radius: 20px;
      padding: 14px 16px;
      margin-bottom: 14px;
      box-shadow: 0 12px 30px rgba(40, 70, 110, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.95);
    }
    .pi-sub {
      background: rgba(255, 255, 255, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 14px;
      padding: 10px 12px;
      margin-bottom: 10px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 3px 10px rgba(40, 70, 110, 0.05);
    }
    .pi-sub-title { font-size: 13px; font-weight: 700; color: #2f5d8c; margin-bottom: 6px; }

    /* Section headers */
    .pi-sec-head {
      display: flex; align-items: center; gap: 10px;
      margin: 20px 4px 10px;
    }
    .pi-sec-icon {
      width: 32px; height: 32px; border-radius: 10px;
      display: inline-flex; align-items: center; justify-content: center;
      background: rgba(255, 255, 255, 0.85); color: #2f5d8c; font-size: 15px;
      box-shadow: 0 2px 8px rgba(40, 70, 110, 0.12), inset 0 1px 0 #fff;
    }
    .pi-sec-title { margin: 0; font-size: 16.5px; font-weight: 650; color: #064c73; letter-spacing: -0.1px; }
    .pi-sec-head::after {
      content: ""; flex: 1; height: 1px;
      background: linear-gradient(90deg, rgba(12, 90, 130, 0.25), transparent);
    }

    /* Show/Hide toggle chip */
    .pi-toggle {
      display: inline-flex; align-items: center; gap: 7px;
      margin: 0 0 10px 4px; padding: 5px 12px;
      font-size: 12px; font-weight: 600; color: #2f5d8c;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(110, 140, 170, 0.28);
      border-radius: 999px; cursor: pointer;
    }
    .pi-toggle input { width: 15px; height: 15px; cursor: pointer; accent-color: #3b6fa8; margin: 0; }
    .pi-toggle-wrap { display: block; }

    /* Labels + inputs */
    .pi-label {
      display: block; margin: 0 0 3px 2px;
      font-size: 13.5px; font-weight: 600; color: #000;
    }
    .pi-input {
      display: block; width: 100%;
      min-height: 38px; padding: 7px 10px;
      font-size: 14px; color: #1b2a3c;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(110, 140, 170, 0.28);
      border-radius: 10px; outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    textarea.pi-input { min-height: 34px; resize: vertical; line-height: 1.35; }
    .pi-input:focus { border-color: #4b83b8; box-shadow: 0 0 0 3px rgba(75, 131, 184, 0.18); }
    .pi-input:disabled { opacity: 0.55; cursor: not-allowed; }
    .pi-input[readonly] {
      background: rgba(255, 255, 255, 0.45);
      color: #2f5d8c; font-weight: 600;
    }
    .pi-input::placeholder { color: #9aa8b6; }

    /* Buttons */
    .pi-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      height: 32px; padding: 0 14px;
      font-size: 13.5px; font-weight: 600;
      border-radius: 10px; border: 1px solid transparent;
      cursor: pointer; white-space: nowrap; transition: all 0.15s ease;
    }
    .pi-btn:active { transform: translateY(1px); }
    .pi-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .pi-btn-lg { height: 38px; padding: 0 34px; font-size: 13.5px; }
    .pi-btn-primary {
      background: linear-gradient(180deg, #3b6fa8 0%, #2c527f 100%); color: #fff;
      box-shadow: 0 4px 12px rgba(44, 82, 127, 0.28);
    }
    .pi-btn-primary:hover:not(:disabled) { box-shadow: 0 6px 16px rgba(44, 82, 127, 0.38); }
    .pi-btn-soft { background: rgba(255, 255, 255, 0.85); color: #2f5d8c; border-color: rgba(110, 140, 170, 0.28); }
    .pi-btn-soft:hover { background: #fff; }
    .pi-btn-ghost { background: rgba(255, 255, 255, 0.55); color: #4a5b6e; border-color: rgba(110, 140, 170, 0.28); }
    .pi-btn-ghost:hover { background: rgba(255, 255, 255, 0.9); }
    .pi-btn-danger { background: rgba(255, 255, 255, 0.85); color: #c0392b; border-color: rgba(192, 57, 43, 0.3); }
    .pi-btn-danger:hover { background: #fff1f0; }
    .pi-btn-success { background: linear-gradient(180deg, #10b981 0%, #059669 100%); color: #fff; box-shadow: 0 3px 10px rgba(16, 185, 129, 0.28); }
    .pi-btn-red { background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%); color: #fff; box-shadow: 0 3px 10px rgba(239, 68, 68, 0.28); }
    .pi-btn-icon { width: 32px; padding: 0; font-size: 18px; line-height: 1; }
    .pi-btn-xs { height: 24px; padding: 0 9px; font-size: 11px; border-radius: 8px; }
    .pi-linkbtn {
      background: none; border: none; padding: 0; margin-top: 4px;
      font-size: 12.5px; font-weight: 700; color: #2f5d8c;
      text-decoration: underline; cursor: pointer;
    }
    .pi-addbranch {
      background: rgba(255, 255, 255, 0.75);
      border: 1px dashed #4b83b8; border-radius: 12px; padding: 10px;
    }

    /* Filter bar */
    .pi-filter {
      display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px;
      padding: 12px 14px; margin: 18px 0 12px;
      background: rgba(255, 255, 255, 0.55);
      backdrop-filter: blur(18px);
      border: 1px solid rgba(255, 255, 255, 0.85);
      border-radius: 16px;
      box-shadow: 0 8px 22px rgba(40, 70, 110, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95);
    }
    .pi-filter .pi-fgroup { width: 170px; }

    /* Registry table */
    .pi-table-wrap {
      overflow: auto; max-height: 450px;
      border-radius: 14px;
      border: 1px solid rgba(12, 90, 130, 0.32);
      background: #fff;
      box-shadow: 0 8px 20px rgba(4, 52, 78, 0.08);
    }
    .pi-table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 13px; margin: 0; }
    .pi-table thead th {
      position: sticky; top: 0; z-index: 5;
      background: #064c73; color: #fff;
      font-weight: 700; font-size: 12.5px; letter-spacing: 0.3px;
      padding: 9px 12px; text-align: center; white-space: nowrap;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .pi-table tbody td {
      padding: 7px 10px; color: #0f172a; white-space: nowrap; vertical-align: middle;
      border: 1px solid #dce8ef;
    }
    .pi-table tbody tr:nth-child(even) td { background: #f3faff; }
    .pi-table tbody tr:hover td { background: #d9f2fc; }
    /* ===== Customer-page look ===== */
    .pi-root {
      background:
        radial-gradient(circle at 12% 6%, rgba(255,255,255,.9) 0, rgba(255,255,255,0) 30%),
        radial-gradient(circle at 88% 18%, rgba(160,222,250,.7) 0, rgba(160,222,250,0) 32%),
        radial-gradient(circle at 50% 100%, rgba(255,255,255,.7) 0, rgba(255,255,255,0) 45%),
        linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%);
      background-attachment: fixed;
      color: #0b2f4f;
    }
    .pi-container { background: none; border: none; box-shadow: none; padding: 0; }

    /* Hero */
    .pi-hero {
      position: relative; z-index: 0;
      display: flex; align-items: center; justify-content: center; gap: 14px;
      margin: 0 0 16px; padding: 12px 22px; text-align: left;
    }
    .pi-hero::before {
      content: ""; position: absolute; inset: 0; z-index: -1;
      transform: skewX(-20deg); border-radius: 14px;
      background: linear-gradient(180deg, #c9eafb 0%, #b5dff6 100%);
      border: 1px solid #6fb5dc;
      box-shadow: 0 8px 20px rgba(40,120,170,.25);
    }
    .pi-hero-emblem {
      width: 46px; height: 46px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #0a6fb8; font-size: 21px;
      background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 50%, #8fd0f0 100%);
      border: 1px solid #86c6e8;
      box-shadow: 0 6px 14px rgba(40,120,170,.18), inset 0 2px 3px rgba(255,255,255,.9);
    }
    .pi-hero-title { margin: 0; color: #0a4f8c; letter-spacing: -0.3px; font-size: 26px; font-weight: 800; }
    .pi-user-pill {
      position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
      display: flex; align-items: center; gap: 8px;
      padding: 7px 14px; border-radius: 30px;
      font-size: 13px; font-weight: 700; color: #0b2f4f;
      background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
      border: 1px solid #a9d9f2;
      box-shadow: 0 4px 12px rgba(40,120,170,.15), inset 0 1px 0 #fff;
    }
    .pi-user-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; }
    @media (max-width: 768px) {
      .pi-user-pill { position: static; transform: none; }
      .pi-hero { flex-wrap: wrap; }
    }

    /* Master / Perso toggle */
    .pi-seg {
      border-radius: 22px; padding: 6px; gap: 8px;
      background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(214,240,252,.8));
      border: 1px solid #ffffff;
      box-shadow: 0 10px 24px rgba(40,120,170,.18), inset 0 1px 0 #fff;
    }
    .pi-seg-btn { color: #0a4f8c; font-weight: 800; border-radius: 16px; border: 1px solid transparent; }
    .pi-seg-btn.on {
      color: #0a4f8c;
      background: linear-gradient(180deg, #d2eefc 0%, #8fd0f3 100%);
      border-color: #7fc3e8;
      box-shadow: 0 3px 0 #6fb5dc, 0 8px 16px rgba(40,120,170,.15), inset 0 1px 0 #fff;
    }

    /* Glass panels */
    .pi-panel, .pi-filter {
      background: linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(228,246,255,.9) 100%);
      border: 1px solid rgba(255,255,255,.95);
      border-radius: 22px;
      box-shadow: 0 12px 28px rgba(40,120,170,.12), inset 0 1px 0 #fff;
    }
    .pi-sub { background: rgba(255,255,255,.85); border-radius: 16px; }
    .pi-sub-title, .pi-sec-title { color: #0a4f8c; font-weight: 800; }
    .pi-sec-icon {
      color: #0a6fb8;
      background: radial-gradient(circle at 30% 25%, #ffffff, #bfe5f8 55%, #8fd0f0);
      border: 1px solid #86c6e8;
    }
    .pi-label { color: #0b2f4f; font-weight: 700; }

    /* Inputs */
    .pi-input {
      border: 1.5px solid #9ccbe6; border-radius: 12px;
      background: #ffffff; color: #0b2f4f; font-weight: 600;
      box-shadow: inset 0 2px 5px rgba(10,80,130,.1);
    }
    .pi-input:focus { border-color: #1b9be0; box-shadow: 0 0 0 4px rgba(27,155,224,.2); }
    .pi-input[readonly] { background: #f1faff; color: #0a6fb8; }
    .pi-toggle { background: linear-gradient(180deg, #ffffff, #e3f2fb); border: 1px solid #a9d9f2; color: #0a4f8c; font-weight: 800; }

    /* Glossy light buttons */
    .pi-btn { border-radius: 12px; font-weight: 800; border: 1px solid rgba(255,255,255,.6); }
    .pi-btn-primary, .pi-btn-primary:hover:not(:disabled) {
      background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%);
      color: #08406b; border-color: #7fc3e8;
      box-shadow: 0 2px 0 #7fbbe0, 0 6px 12px rgba(40,120,170,.14), inset 0 1px 0 #fff;
    }
    .pi-btn-success {
      background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%);
      color: #07583b; border-color: #7fd3ab;
      box-shadow: 0 2px 0 #84cba9, 0 6px 12px rgba(20,168,112,.14), inset 0 1px 0 #fff;
    }
    .pi-btn-red, .pi-btn-danger {
      background: linear-gradient(180deg, #ffdcdc 0%, #f7a3a3 100%);
      color: #8f1414; border-color: #ee8f8f;
      box-shadow: 0 2px 0 #e08a8a, 0 6px 12px rgba(220,38,38,.12), inset 0 1px 0 #fff;
    }
    .pi-btn-soft, .pi-btn-ghost {
      background: linear-gradient(180deg, #ffffff, #e3f2fb);
      color: #0a4f8c; border-color: #a9d9f2;
      box-shadow: 0 3px 8px rgba(40,120,170,.12);
    }

    /* Light table header */
    .pi-table thead th {
      background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%);
      color: #08406b; border: 1px solid #7fbfe4; font-weight: 800;
    }
    .pi-exp { cursor: pointer; transition: all 0.2s ease; }
    .pi-strong { font-weight: 600; }
    .pi-accent { font-weight: 600; color: #0369a1; }
    .pi-pos { font-weight: 600; color: #15803d; }
    .pi-neg { font-weight: 600; color: #dc2626; }
    .pi-badge {
      display: inline-block; padding: 2px 9px; border-radius: 999px;
      font-size: 12px; font-weight: 700; border: 1px solid transparent;
    }
    .pi-badge-blue { background: #e0f2fe; color: #0369a1; border-color: #7dd3fc; }
    .pi-badge-gray { background: #eef2f6; color: #475569; border-color: #cbd5e1; }
    .pi-badge-green { background: #dcfce7; color: #15803d; border-color: #86efac; }
    .pi-badge-red { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
    .pi-badge-purple { background: #ede9fe; color: #6d28d9; border-color: #c4b5fd; }
    .pi-badge-orange { background: #ffedd5; color: #c2410c; border-color: #fdba74; }

    @media (max-width: 768px) {
      .pi-root { padding: 8px; }
      .pi-container { padding: 12px; }
      .pi-filter .pi-fgroup { width: 100%; }
    }
  `}</style>

  <div className="pi-container">

  {/* PAGE TITLE */}
  <div className="pi-hero">
    <div className="pi-hero-emblem">
      <i className="bi bi-printer-fill"></i>
    </div>
    <h1 className="pi-hero-title">
      <b>Printing Instruction Entry</b>
    </h1>
    {loggedInUser && (
      <div className="pi-user-pill">
        <span className="pi-user-dot"></span>
        <i className="bi bi-person"></i>
        <span>{loggedInUser}</span>
      </div>
    )}
  </div>

  <form onSubmit={handleSubmit}>

    {/* MASTER / PERSO TOGGLE */}
    <div className="d-flex justify-content-center mb-3">
      <div className="pi-seg">
        <label className={`pi-seg-btn ${orderMode === "MASTER" ? "on" : ""}`}>
          <input
            type="radio"
            name="orderMode"
            value="MASTER"
            checked={orderMode === "MASTER"}
            onChange={(e) => setOrderMode(e.target.value)}
          />
          <i className="bi bi-journal-text"></i> Master
        </label>
        <label className={`pi-seg-btn ${orderMode === "PERSOW" ? "on" : ""}`}>
          <input
            type="radio"
            name="orderMode"
            value="PERSOW"
            checked={orderMode === "PERSOW"}
            onChange={(e) => setOrderMode(e.target.value)}
          />
          <i className="bi bi-person-vcard"></i> Perso
        </label>
      </div>
    </div>

    {/* MAIN PRODUCT CARD */}
    <div className="pi-panel">

      {/* ── PRODUCT ROWS ── */}
      {productRows.map((row, index) => (
        <div key={index} className="pi-sub">
          <div className="pi-sub-title">Product {index + 1}</div>
          <div className="row g-2 align-items-end">

            <Field col="col-md-2" icon="upc-scan" label="Product Code" error={renderFieldError(`productCode_${index}`)}>
              <input
                type="number" min={0}
                name="productCode"
                className="pi-input"
                value={row.productCode}
                onChange={(e) => {
                  const val = e.target.value;
                  setErrors(prev => ({
                    ...prev,
                    productCode: "",
                    [`productCode_${index}`]: ""
                  }));
                  updateProductRow(index, "productCode", val);

                  fetchProductDetailsForRow(val, index);

                  const updatedRows = productRows.map((r, i) =>
                    i === index
                      ? { ...r, productCode: val }
                      : r
                  );

                  if (orderMode === "PERSOW") {
                    fetchWOListForMultipleProducts(updatedRows);
                  }
                }}
              />
            </Field>

            <Field col="col-md-2" icon="box-seam" label="Material">
              <input className="pi-input" value={row.materialType} readOnly />
            </Field>

            <Field col="col-md-3" icon="card-text" label="Description">
              <input className="pi-input" value={row.description} readOnly />
            </Field>

            <Field col="col-md-2" icon="person" label="Customer">
              <input className="pi-input" value={row.customerName} readOnly />
            </Field>

            <Field col="col-md-1" icon="aspect-ratio" label="Job Size">
              <input className="pi-input" value={row.jobSize} readOnly />
            </Field>

            {productRows.length > 1 && (
              <div className="col-md-auto d-flex align-items-end">
                <button type="button" onClick={() => removeProductRow(index)}
                  className="pi-btn pi-btn-danger pi-btn-icon" title="Remove product">×</button>
              </div>
            )}

          </div>
        </div>
      ))}

      {/* Add Product Row button */}
      <button type="button" onClick={addProductRow} className="pi-btn pi-btn-soft mb-3">
        + Add Product
      </button>

      {/* ── REMAINING SINGLE FIELDS ── */}
      <div className="row g-2">

        {orderMode === "MASTER" && (
          <>
            <Field col="col-md-2" label="Material Group" error={errors.materialGroup && <small className="text-danger">{errors.materialGroup}</small>}>
              <select
                name="materialGroup"
                className="pi-input"
                value={form.materialGroup}
                onChange={(e) => handleMaterialGroupChange(e.target.value)}>
                <option value="">Select</option>
                {materialGroupOptions.map((g, i) => (
                  <option key={i} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field col="col-md-2" label="GSM">
              <input className="pi-input" value={form.materialGsm} readOnly />
            </Field>
          </>
        )}

        <Field col="col-md-2" icon="tag" label="Order Type">
          <input className="pi-input" value="Inhouse" readOnly />
        </Field>

        {orderMode === "PERSOW" && (
          <Field col="col-md-3" icon="list-check" label="Select WO" error={renderFieldError("workorder2")}>
            <Select
              value={selectedWO}
              options={woList.map(wo => ({ value: wo._id, label: `WO: ${wo.workorder2 || wo.efiWoNumber}` }))}
              onChange={async (selected) => {
                if (!selected) return;
                setErrors(prev => ({ ...prev, workorder2: "" }));
                const selectedData = woList.find(w => w._id === selected.value);
                const exactOption = woList.map(wo => ({ value: wo._id, label: `WO: ${wo.workorder2 || wo.efiWoNumber}` })).find(opt => opt.value === selected.value);
                setSelectedWO(exactOption);
                setForm(prev => ({ ...prev, workorder2: selectedData.workorder2 || selectedData.efiWoNumber }));
                const res = await axios.get(`${BASE_URL}/api/printing-instructions/remaining-by-wo/${selected.value}`);
                const remaining = Number(res.data.remainingQty || 0);
                setBaseRemaining(remaining);
                setLiveRemaining(remaining);
              }}
              styles={selectStyles}
            />
          </Field>
        )}

        <Field col="col-md-2" icon="123" label="Quantity" error={errors.quantity && <small className="text-danger">{errors.quantity}</small>}>
          <input type="number" min={0} name="quantity" className="pi-input"
            disabled={orderMode === "PERSOW" && !selectedWO}
            value={form.quantity} onChange={handleChange} />
        </Field>

        {orderMode === "PERSOW" && (
          <Field col="col-md-2" icon="calculator" label="Remaining Qty">
            <input type="number" className="pi-input" value={liveRemaining} readOnly />
          </Field>
        )}

        <Field col="col-md-2" icon="geo-alt" label="Location" error={errors.location && <small className="text-danger">{errors.location}</small>}>
          <select name="location" className="pi-input"
            value={form.location} onChange={handleChange}>
            <option value="">Select</option>
            {locations.map(loc => <option key={loc._id} value={loc.locationName}>{loc.locationName}</option>)}
          </select>
        </Field>

        <Field col="col-md-4" icon="chat-left-text" label="Remarks" error={renderFieldError("remarks")}>
          <textarea name="remarks" className="pi-input"
            value={form.remarks} onChange={handleChange} />
        </Field>

      </div>
    </div>


{/* ───────────────── NUMBERING DETAILS ───────────────── */}
<SectionHead icon="hash" title="Numbering Details" />

{orderMode !== "PERSOW" && (
  <div className="pi-toggle-wrap">
    <Toggle
      checked={showBankDetails}
      onChange={(e) => setShowBankDetails(e.target.checked)}
      label="Show Details"
    />
  </div>
)}

{(orderMode === "PERSOW" || showBankDetails) && (
  <div className="pi-panel">
    <div className="row g-2">

      <Field col="col-md-2" icon="type" label="Prefix" error={renderFieldError("prefix")}>
        <input name="prefix" className="pi-input" value={form.prefix} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="credit-card" label="Account Number" error={renderFieldError("accountNumber")}>
        <input name="accountNumber" className="pi-input" value={form.accountNumber} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="123" label="Cheque From" error={renderFieldError("chequeFrom")}>
        <input type="text" name="chequeFrom" className="pi-input" value={form.chequeFrom} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="123" label="Cheque To" error={renderFieldError("chequeTo")}>
        <input type="text" name="chequeTo" className="pi-input" value={form.chequeTo} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="upc" label="Non MICR Digits" error={renderFieldError("nonMicrDigits")}>
        <input name="nonMicrDigits" className="pi-input" value={form.nonMicrDigits} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="code" label="Account Code" error={renderFieldError("accountCode")}>
        <input name="accountCode" className="pi-input" value={form.accountCode} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="qr-code" label="Sort Code / MICR" error={renderFieldError("sortCode")}>
        <input name="sortCode" className="pi-input" value={form.sortCode} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="arrow-left-right" label="Transaction Code" error={renderFieldError("transactionCode")}>
        <input name="transactionCode" className="pi-input" value={form.transactionCode} onChange={handleChange} />
      </Field>

      <Field col="col-md-4" icon="chat-left-text" label="Remarks" error={renderFieldError("numberingRemarks")}>
        <textarea name="numberingRemarks" className="pi-input" value={form.numberingRemarks} onChange={handleChange} />
      </Field>

    </div>
  </div>
)}

{/* ───────────────── PACKING STANDARD ───────────────── */}
<SectionHead icon="boxes" title="Packing Standard" />

{!isPersow && (
  <div className="pi-toggle-wrap">
    <Toggle
      checked={showPacking}
      onChange={(e) => setShowPacking(e.target.checked)}
      label="Show Packing Details"
    />
  </div>
)}

{(isPersow || showPacking) && (
  <div className="pi-panel">
    <div className="row g-2">

      <Field col="col-md-2" icon="box-seam" label="Type of Inner Packing" error={renderFieldError("innerPackingType")}>
        <select name="innerPackingType" className="pi-input" value={form.innerPackingType} onChange={handleChange}>
          <option value="">Select</option>
          {innerPackingList.map(item => (
            <option key={item._id} value={item.type}>
              {item.type}
            </option>
          ))}
        </select>
      </Field>

      <Field col="col-md-2" icon="layers" label="Leaves per Inner Pack">
        <input type="number" className="pi-input" value={form.leavesPerInner} readOnly />
      </Field>

      <Field col="col-md-2" icon="box" label="No. of Inner Pack">
        <input className="pi-input" value={form.innerPack} readOnly />
      </Field>

      <Field col="col-md-2" icon="archive" label="No. of Outer Pack">
        <input type="number" className="pi-input" value={form.outerPack} readOnly />
      </Field>

      <Field col="col-md-3" icon="diagram-3" label="Inner Pack per Outer Pack">
        <input type="number" className="pi-input" value={form.innerPerOuter} readOnly />
      </Field>

      <Field col="col-md-4" icon="chat-left-text" label="Remarks" error={renderFieldError("packingRemarks")}>
        <textarea name="packingRemarks" className="pi-input" value={form.packingRemarks} onChange={handleChange} />
      </Field>

    </div>
  </div>
)}

{/* ───────────────── DISPATCH DETAILS ───────────────── */}
<SectionHead icon="truck" title="Dispatch Details" />

{!isPersow && (
  <div className="pi-toggle-wrap">
    <Toggle
      checked={showDispatch}
      onChange={(e) => setShowDispatch(e.target.checked)}
      label="Show Dispatch Details"
    />
  </div>
)}

{(isPersow || showDispatch) && (
  <div className="pi-panel">
    <div className="row g-2">

      <Field col="col-md-2" icon="calendar-event" label="Delivery Date" error={renderFieldError("deliveryDate")}>
        <input type="date" name="deliveryDate" className="pi-input" value={form.deliveryDate} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="truck-front" label="Mode of Transport" error={renderFieldError("modeOfTransport")}>
        <select name="modeOfTransport" className="pi-input" value={form.modeOfTransport} onChange={handleChange}>
          <option value="">Select</option>
          {transportList.map(t => (
            <option key={t._id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </Field>

      <Field col="col-md-2" icon="cash-stack" label="Freight Charge Type" error={renderFieldError("freightChargeType")}>
        <select name="freightChargeType" className="pi-input" value={form.freightChargeType} onChange={handleChange}>
          <option value="">Select</option>
          {freightChargeList.map(f => (
            <option key={f._id} value={f.name}>{f.name}</option>
          ))}
        </select>
      </Field>

      <Field col="col-md-2" icon="box-arrow-right" label="Freight Type" error={renderFieldError("freightType")}>
        <select name="freightType" className="pi-input" value={form.freightType} onChange={handleChange}>
          <option value="">Select</option>
          {freightTypeList.map(f => (
            <option key={f._id} value={f.name}>{f.name}</option>
          ))}
        </select>
      </Field>

      <div className="col-md-2">
        <label className="pi-label">
          <i className="bi bi-building me-1"></i>Branch Code
        </label>

        <select
          name="branchCode"
          className="pi-input"
          value={form.branchCode}
          onChange={async (e) => {

            const value = e.target.value;
            setErrors(prev => ({ ...prev, branchCode: "", address: "" }));

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
        {renderFieldError("branchCode")}
        <button
          type="button"
          onClick={() => setShowAddBranch(!showAddBranch)}
          className="pi-linkbtn"
        >
          {showAddBranch ? "Cancel New Branch" : "+ Add New Branch"}
        </button>
      </div>

      {showAddBranch && (
        <div className="col-md-4">
          <div className="pi-addbranch">
            <label className="pi-label">New Branch Code</label>
            <input
              className="pi-input mb-2"
              placeholder="Branch Code"
              value={newBranch.branchCode}
              onChange={(e) => setNewBranch(prev => ({ ...prev, branchCode: e.target.value }))}
            />
            <label className="pi-label">New Dispatch Address</label>
            <textarea
              className="pi-input mb-2"
              placeholder="Dispatch Address"
              value={newBranch.dispatchAddress}
              onChange={(e) => setNewBranch(prev => ({ ...prev, dispatchAddress: e.target.value }))}
            />
            <div className="d-flex gap-2">
              <button
                type="button"
                onClick={addNewBranch}
                disabled={savingBranch}
                className="pi-btn pi-btn-primary pi-btn-xs"
              >
                {savingBranch ? "Saving..." : "Save Branch"}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddBranch(false); setNewBranch({ branchCode: "", dispatchAddress: "" }); }}
                className="pi-btn pi-btn-ghost pi-btn-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Field col="col-md-3" icon="geo-alt" label="Dispatch Address" error={renderFieldError("address")}>
        <textarea name="address" className="pi-input" value={form.address} onChange={handleChange} />
      </Field>

      <Field col="col-md-4" icon="chat-left-text" label="Remarks" error={renderFieldError("dispatchRemarks")}>
        <textarea name="dispatchRemarks" className="pi-input" value={form.dispatchRemarks} onChange={handleChange} />
      </Field>

    </div>
  </div>
)}

{/* ───────────────── BILLING INSTRUCTIONS ───────────────── */}
<SectionHead icon="receipt-cutoff" title="Billing Instructions" />

{!isPersow && (
  <div className="pi-toggle-wrap">
    <Toggle
      checked={showBilling}
      onChange={(e) => setShowBilling(e.target.checked)}
      label="Show Billing Details"
    />
  </div>
)}

{(isPersow || showBilling) && (
  <div className="pi-panel">
    <div className="row g-2">

      <Field col="col-md-2" icon="file-earmark-text" label="Quotation/Contract Ref No" error={renderFieldError("quotationRefNo")}>
        <input name="quotationRefNo" className="pi-input" value={form.quotationRefNo} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="receipt" label="PO Number" error={renderFieldError("purchaseOrderNo")}>
        <input name="purchaseOrderNo" className="pi-input" value={form.purchaseOrderNo} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="calendar-date" label="PO Date" error={renderFieldError("poDate")}>
        <input type="date" name="poDate" className="pi-input" value={form.poDate} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="currency-rupee" label="Rate / Unit" error={renderFieldError("ratePerUnit")}>
        <input type="number" min={0} step="any" name="ratePerUnit" className="pi-input" value={form.ratePerUnit} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="calculator" label="Total Billable Amount" error={renderFieldError("totalBillableAmount")}>
        <input type="number" min={0} name="totalBillableAmount" className="pi-input" value={form.totalBillableAmount} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" label="Billing Type" error={renderFieldError("billingType")}>
        <select name="billingType" className="pi-input" value={form.billingType} onChange={handleChange}>
          <option value="">Select</option>
          <option value="INTERNAL">INTERNAL</option>
          <option value="EXTERNAL">EXTERNAL</option>
        </select>
      </Field>

      <Field col="col-md-3" icon="person-lines-fill" label="Bill To" error={renderFieldError("planningInstruction")}>
        <textarea name="planningInstruction" className="pi-input" value={form.planningInstruction} onChange={handleChange} />
      </Field>

      <Field col="col-md-3" icon="send" label="Bill Send" error={renderFieldError("billSend")}>
        <textarea name="billSend" className="pi-input" value={form.billSend} onChange={handleChange} />
      </Field>

      <Field col="col-md-4" icon="chat-left-text" label="Remarks" error={renderFieldError("billingRemarks")}>
        <textarea name="billingRemarks" className="pi-input" value={form.billingRemarks} onChange={handleChange} />
      </Field>

    </div>
  </div>
)}

{/* ───────────────── INSTRUCTIONS ───────────────── */}
<SectionHead icon="clipboard-check" title="Instructions" />

{!isPersow && (
  <div className="pi-toggle-wrap">
    <Toggle
      checked={showInstructions}
      onChange={(e) => setShowInstructions(e.target.checked)}
      label="Show Instruction Details"
    />
  </div>
)}

{(isPersow || showInstructions) && (
  <div className="pi-panel">
    <div className="row g-2">

      <Field col="col-md-2" icon="person-badge" label="KAM" error={renderFieldError("kam")}>
        <input name="kam" className="pi-input" value={form.kam} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="diagram-2" label="KAM Branch" error={renderFieldError("kamBranch")}>
        <input name="kamBranch" className="pi-input" value={form.kamBranch} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="file-earmark-text" label="Payment Terms" error={renderFieldError("paymentTerms")}>
        <input name="paymentTerms" className="pi-input" value={form.paymentTerms} onChange={handleChange} />
      </Field>

      <Field col="col-md-2" icon="cash-coin" label="Advance Payment" error={renderFieldError("advancePayment")}>
        <select name="advancePayment" className="pi-input" value={form.advancePayment} onChange={handleChange}>
          <option value="">Select</option>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>
      </Field>

      <Field col="col-md-2" icon="percent" label="Tax Type" error={renderFieldError("taxType")}>
        <select name="taxType" className="pi-input" value={form.taxType} onChange={handleChange}>
          <option value="">Select</option>
          <option value="TAX INCLUSIVE">TAX INCLUSIVE</option>
          <option value="TAX EXCLUSIVE">TAX EXCLUSIVE</option>
        </select>
      </Field>

      <Field col="col-md-3" icon="exclamation-circle" label="Special Instruction" error={renderFieldError("specialInstruction")}>
        <textarea name="specialInstruction" className="pi-input" value={form.specialInstruction} onChange={handleChange} />
      </Field>

      <Field col="col-md-4" icon="chat-left-text" label="Remarks" error={renderFieldError("instructionRemarks")}>
        <textarea name="instructionRemarks" className="pi-input" value={form.instructionRemarks} onChange={handleChange} />
      </Field>

    </div>
  </div>
)}

<div className="d-flex justify-content-center mt-3">
  <button
    type="submit"
    className="pi-btn pi-btn-primary pi-btn-lg"
    disabled={saving}
    onClick={(e) => {
      if (saving) e.preventDefault();
    }}
  >
    Save
  </button>
</div>
  </form>

  {/* ───────────────── FILTER BAR ───────────────── */}
  <div className="pi-filter">

    {/* WO Number */}
    <div className="pi-fgroup">
      <label className="pi-label"><i className="bi bi-hash me-1"></i>WO Number</label>
      <input
        type="text"
        placeholder="Search WO..."
        className="pi-input"
        value={filters.wo}
        onChange={(e) => setFilters({ ...filters, wo: e.target.value })}
      />
    </div>

    {/* Sub WO */}
    <div className="pi-fgroup">
      <label className="pi-label"><i className="bi bi-diagram-2 me-1"></i>Sub WO</label>
      <input
        type="text"
        placeholder="Search Sub WO..."
        className="pi-input"
        value={filters.subWo}
        onChange={(e) => setFilters({ ...filters, subWo: e.target.value })}
      />
    </div>

    {/* Customer */}
    <div className="pi-fgroup">
      <label className="pi-label"><i className="bi bi-person me-1"></i>Customer</label>
      <select
        className="pi-input"
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
    <div className="pi-fgroup">
      <label className="pi-label"><i className="bi bi-upc-scan me-1"></i>Product Code</label>
      <input
        type="text"
        placeholder="Search code..."
        className="pi-input"
        value={filters.productCode}
        onChange={(e) => setFilters({ ...filters, productCode: e.target.value })}
      />
    </div>

    {/* Ticket ID */}
    <div className="pi-fgroup">
      <label className="pi-label"><i className="bi bi-ticket-perforated me-1"></i>Ticket ID</label>
      <input
        type="text"
        placeholder="Ticket ID"
        className="pi-input"
        value={filters.ticketId || ""}
        onChange={(e) => setFilters({ ...filters, ticketId: e.target.value })}
      />
    </div>

    {/* Buttons */}
    <div className="d-flex gap-2">
      <button
        className="pi-btn pi-btn-ghost"
        onClick={() => setFilters({ wo: "", subWo: "", customer: "", productCode: "", ticketId: "" })}
      >
        <i className="bi bi-x-circle"></i> Clear
      </button>

      <button className="pi-btn pi-btn-success" onClick={exportToExcel}>
        <i className="bi bi-file-earmark-excel"></i> Excel
      </button>

      <button className="pi-btn pi-btn-red" onClick={viewPDF}>
        <i className="bi bi-file-earmark-pdf"></i> PDF
      </button>
    </div>

  </div>

  {/* ───────────────── TABLE ───────────────── */}
  <div className="pi-table-wrap">
    <table className="pi-table">

      <thead>
        <tr>
          <th>Ticket ID</th>
          <th>Work order</th>
          <th>Sub work order</th>
          <th>Product</th>
          <th>Material</th>
          <th>Description</th>
          <th>Customer</th>

          <th>Color Front</th>
          <th>Color Back</th>
          <th>Waste Qty</th>
          <th>Job Size</th>
          <th>Ink</th>

          <th>Qty</th>
          <th>Remaining Qty</th>
          <th>Location</th>

          <th>Material Group</th>
          <th>GSM</th>

          <th>Inner Type</th>
          <th>Leaves</th>
          <th>Inner Pack</th>
          <th>Outer Pack</th>
          <th>Inner/Outer</th>

          <th>Delivery</th>
          <th>Transport</th>
          <th>Freight Charge</th>
          <th>Freight Type</th>
          <th>Dispatch Address</th>

          <th>Quotation</th>
          <th>PO No</th>
          <th>PO Date</th>
          <th>Rate</th>
          <th>Total</th>

          <th>Prefix</th>
          <th>Non MICR Digit</th>
          <th>Account No</th>
          <th>MICR</th>
          <th>Account Code</th>
          <th>Transaction Code</th>

          <th>Cheque From</th>
          <th>Cheque To</th>

          <th>Bill Send</th>
          <th>Bill To</th>
          <th>KAM</th>
          <th>KAM Branch</th>
          <th>Payment</th>
          <th>Advance</th>
          <th>Tax</th>
          <th>Billing Type</th>

          <th>Special</th>

          <th>Type</th>
          <th>Remarks</th>
          <th>User Locations</th>
          <th>User</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {filteredOrders.map((order) => (
          <tr key={order._id}>
            <td>
              <span className="pi-badge pi-badge-blue">{order.ticketId || "--"}</span>
            </td>

            <td>
              {order.workOrders?.map((wo, i) => {
                if (!wo.workorder2 || wo.workorder2 === "") return <div key={i}>{wo.efiWoNumber}</div>;
                if (Number(wo.workorder2) < Number(wo.efiWoNumber)) return <div key={i}>{wo.workorder2}</div>;
                return <div key={i}>{wo.efiWoNumber}</div>;
              })}
            </td>

            <td>
              {order.workOrders?.map((wo, i) => {
                if (!wo.workorder2 || wo.workorder2 === "") return <div key={i}>-</div>;
                if (Number(wo.workorder2) < Number(wo.efiWoNumber)) return <div key={i}>{wo.efiWoNumber || "--"}</div>;
                return <div key={i}>{wo.workorder2 || "--"}</div>;
              })}
            </td>

            {/* Product Code — show all from products array, fallback to top-level */}
            <td className="pi-accent">
              {order.products?.length
                ? order.products.map((p, pi) => <div key={pi}>{p.productCode || "--"}</div>)
                : order.productCode || "--"}
            </td>

            {/* Material */}
            <td>
              {order.products?.length
                ? order.products.map((p, pi) => <div key={pi}>{p.materialType || "--"}</div>)
                : order.materialType || "--"}
            </td>

            {/* Description */}
            <td
              className="pi-exp"
              style={{
                maxWidth: expandedCell === `desc-${order._id}` ? "350px" : "180px",
                whiteSpace: expandedCell === `desc-${order._id}` ? "normal" : "nowrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere"
              }}
              onClick={() =>
                setExpandedCell(
                  expandedCell === `desc-${order._id}`
                    ? null
                    : `desc-${order._id}`
                )
              }
            >
              {order.products?.length
                ? order.products.map((p, pi) => (
                    <div key={pi}>{expandedCell === `desc-${order._id}` ? p.description : truncateText(p.description || "--")}</div>
                  ))
                : (expandedCell === `desc-${order._id}` ? order.description : truncateText(order.description || "--"))}
            </td>

            {/* Customer */}
            <td
              className="pi-exp"
              style={{
                maxWidth: expandedCell === `customer-${order._id}` ? "300px" : "150px",
                whiteSpace: expandedCell === `customer-${order._id}` ? "normal" : "nowrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere"
              }}
              onClick={() => setExpandedCell(expandedCell === `customer-${order._id}` ? null : `customer-${order._id}`)}>
              {order.products?.length
                ? order.products.map((p, pi) => (
                    <div key={pi}>{expandedCell === `customer-${order._id}` ? p.customerName : truncateText(p.customerName || "--")}</div>
                  ))
                : (expandedCell === `customer-${order._id}` ? order.customerName : truncateText(order.customerName || "--"))}
            </td>

            {/* Color Front */}
            <td>
              {order.products?.length
                ? order.products.map((p, pi) => <div key={pi}>{p.colorFront || "--"}</div>)
                : order.colorFront || "--"}
            </td>

            {/* Color Back */}
            <td>
              {order.products?.length
                ? order.products.map((p, pi) => <div key={pi}>{p.colorBack || "--"}</div>)
                : order.colorBack || "--"}
            </td>

            {/* Waste Qty */}
            <td>
              {order.products?.length
                ? order.products.map((p, pi) => <div key={pi}>{p.wasteQty ?? "--"}</div>)
                : order.wasteQty ?? "--"}
            </td>

            {/* Job Size */}
            <td>
              {order.products?.length
                ? order.products.map((p, pi) => <div key={pi}>{p.jobSize || "--"}</div>)
                : order.jobSize || "--"}
            </td>

            {/* Ink Details */}
            <td
              className="pi-exp"
              style={{
                maxWidth: expandedCell === `ink-${order._id}` ? "350px" : "150px",
                whiteSpace: expandedCell === `ink-${order._id}` ? "normal" : "nowrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere"
              }}
              onClick={() => setExpandedCell(expandedCell === `ink-${order._id}` ? null : `ink-${order._id}`)}>
              {order.products?.length
                ? order.products.map((p, pi) => (
                    <div key={pi}>{expandedCell === `ink-${order._id}` ? p.inkDetails : truncateText(p.inkDetails || "--")}</div>
                  ))
                : (expandedCell === `ink-${order._id}` ? order.inkDetails : truncateText(order.inkDetails || "--"))}
            </td>

            <td className="pi-strong">{order.quantity || "--"}</td>
            <td className={Number(order.remainingQty) > 0 ? "pi-pos" : "pi-neg"}>
              {order.remainingQty ?? "--"}
            </td>
            <td>
              <span className="pi-badge pi-badge-gray">{order.location || "--"}</span>
            </td>

            <td>{order.materialGroup || "--"}</td>
            <td>{order.materialGsm || "--"}</td>

            <td>{order.innerPackingType || "--"}</td>
            <td>{order.leavesPerInner || "--"}</td>
            <td>{order.innerPack || "--"}</td>
            <td>{order.outerPack || "--"}</td>
            <td>{order.innerPerOuter || "--"}</td>

            <td>{order.deliveryDate?.substring(0, 10) || "--"}</td>
            <td>{order.modeOfTransport || "--"}</td>
            <td>{order.freightChargeType || "--"}</td>
            <td>{order.freightType || "--"}</td>

            {expandTd(order, "address", order.address)}

            <td>{order.quotationRefNo || "--"}</td>
            <td>{order.purchaseOrderNo || "--"}</td>
            <td>{order.poDate?.substring(0, 10) || "--"}</td>
            <td>{order.ratePerUnit || "--"}</td>
            <td className="pi-strong">{order.totalBillableAmount || "--"}</td>

            <td>{order.prefix || "--"}</td>
            <td>{order.nonMicrDigits || "--"}</td>
            <td>{order.accountNumber || "--"}</td>
            <td>{order.sortCode || "--"}</td>
            <td>{order.accountCode || "--"}</td>
            <td>{order.transactionCode || "--"}</td>
            <td>{order.chequeFrom || "--"}</td>
            <td>{order.chequeTo || "--"}</td>

            {expandTd(order, "billsend", order.billSend)}
            {expandTd(order, "billto", order.planningInstruction)}

            <td>{order.kam || "--"}</td>
            <td>{order.kamBranch || "--"}</td>
            <td>{order.paymentTerms || "--"}</td>
            <td>
              {order.advancePayment && (
                <span className={`pi-badge ${order.advancePayment === "YES" ? "pi-badge-green" : "pi-badge-red"}`}>
                  {order.advancePayment}
                </span>
              )}
            </td>
            <td>{order.taxType || "--"}</td>
            <td>
              {order.billingType && (
                <span className={`pi-badge ${order.billingType === "INTERNAL" ? "pi-badge-purple" : "pi-badge-orange"}`}>
                  {order.billingType || "--"}
                </span>
              )}
            </td>

            {expandTd(order, "special", order.specialInstruction)}

            <td>{order.orderType || "--"}</td>

            {expandTd(order, "remarks", order.remarks)}

            <td>{order.userLocations?.join(", ") || "--"}</td>
            <td className="pi-strong">{order.user}</td>

            <td>
              <span title={order.status === "PLANNED" ? "Work order already created" : ""} style={{ cursor: order.status === "PLANNED" ? "not-allowed" : "pointer" }}>
                <button
                  onClick={() => handleEdit(order)}
                  className="pi-btn pi-btn-soft pi-btn-xs me-1"
                  disabled={order.workOrders && order.workOrders.length > 0}
                  style={{
                    cursor:
                      order.workOrders && order.workOrders.length > 0
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      order.workOrders && order.workOrders.length > 0 ? 0.5 : 1
                  }}
                >
                  <i className="bi bi-pencil-fill"></i>
                  Edit
                </button>
              </span>
              <button
                className="pi-btn pi-btn-danger pi-btn-xs"
                onClick={() => handleDelete(order._id)}
              >
                <i className="bi bi-trash-fill"></i>Del
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  </div>
</div>
  );
}
export default PrintingIns;