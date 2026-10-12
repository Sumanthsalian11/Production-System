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
      <label className="pi-label">{label}</label>
      <div className={icon ? "pi-ifield" : ""}>
        {icon && <i className={`bi bi-${icon} pi-ficon`}></i>}
        {children}
      </div>
      {error}
    </div>
  );
}

function SectionHead({ icon, title, chip, required }) {
  return (
    <div className="pi-sec-head">
      <span className="pi-sec-icon"><i className={`bi bi-${icon}`}></i></span>
      <h5 className="pi-sec-title">{title}</h5>
      {chip && (
        <span className={`pi-chip ${required ? "req" : ""}`}>
          <span className="dot"></span>{chip}
        </span>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="pi-toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="pi-switch"></span>
      {label}
    </label>
  );
}

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "38px",
    borderRadius: "6px",
    fontSize: "14px",
    fontFamily: "inherit",
    background: "#fff",
    borderColor: state.isFocused ? "#0e7c86" : "#d3dbe0",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(14,124,134,0.15)" : "none",
    "&:hover": { borderColor: state.isFocused ? "#0e7c86" : "#b9c5cc" }
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px 0 33px" }),
  indicatorsContainer: (base) => ({ ...base, height: "36px" }),
  indicatorSeparator: () => ({ display: "none" }),
  placeholder: (base) => ({ ...base, color: "#a3afb5" }),
  menu: (base) => ({
    ...base,
    borderRadius: "8px",
    overflow: "hidden",
    fontSize: "14px",
    zIndex: 50,
    border: "1px solid #e3e8eb",
    boxShadow: "0 8px 24px rgba(16,40,48,0.12)"
  }),
  option: (base, state) => ({
    ...base,
    cursor: "pointer",
    background: state.isSelected ? "#0e7c86" : state.isFocused ? "#e8f4f5" : "#fff",
    color: state.isSelected ? "#fff" : "#000"
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
    <small className="pi-err">
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

// 🎨 presentation only
const userInitials = String(loggedInUser || "U")
  .split(" ")
  .filter(Boolean)
  .map(s => s[0])
  .join("")
  .slice(0, 2)
  .toUpperCase();
const sectionChip = isPersow ? "Required" : "Optional";

  return (
<div className="pi-root">
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    .pi-root {
      --teal-900: #0f3d47;
      --teal: #0e7c86;
      --teal-50: #e8f4f5;
      --accent: #e8622c;
      --accent-d: #cf5220;
      --ink: #000000;
      --muted: #000000;
      --line: #e3e8eb;
      --line-2: #d3dbe0;
      --bg: #f3f5f7;
      background: var(--bg);
      min-height: 100vh;
      padding: 20px 24px 32px;
      font-family: "Inter", -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 14px;
      color: var(--ink);
    }
    .pi-container { max-width: 1600px; margin: 0 auto; }

    /* Top bar */
    .pi-topbar {
      display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
      background: #fff; border: 1px solid var(--line); border-left: 4px solid var(--teal-900);
      border-radius: 10px; padding: 14px 20px; margin-bottom: 18px;
      box-shadow: 0 1px 2px rgba(16,40,48,.04);
    }
    .pi-brand { display: flex; align-items: center; gap: 12px; }
    .pi-logo {
      width: 40px; height: 40px; border-radius: 8px;
      background: var(--teal-900); color: #fff; font-size: 18px;
      display: flex; align-items: center; justify-content: center;
    }
    .pi-brand h1 { margin: 0; font-size: 20px; font-weight: 700; color: var(--ink); letter-spacing: -0.2px; }
    .pi-brand p { margin: 2px 0 0; font-size: 12.5px; color: var(--muted); }
    .pi-userchip { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; }
    .pi-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--accent); color: #fff; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }

    /* Cards */
    .pi-card {
      background: #fff; border: 1px solid var(--line); border-radius: 10px;
      margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,40,48,.04);
    }
    .pi-card-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; flex-wrap: wrap; padding: 14px 20px;
    }
    .pi-card-body { padding: 16px 20px 18px; border-top: 1px solid var(--line); }
    .pi-sec-head { display: flex; align-items: center; gap: 10px; }
    .pi-sec-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--teal-50); color: var(--teal); font-size: 15px;
      display: flex; align-items: center; justify-content: center;
    }
    .pi-sec-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); }
    .pi-chip {
      display: inline-flex; align-items: center; gap: 6px; margin-left: 6px;
      font-size: 12px; font-weight: 500; color: var(--muted);
    }
    .pi-chip .dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; }
    .pi-chip.req { color: var(--accent); }
    .pi-chip.req .dot { background: currentColor; }
    .pi-count {
      font-size: 12px; font-weight: 600; color: var(--teal);
      background: var(--teal-50); padding: 4px 10px; border-radius: 999px;
    }

    /* Master / Perso segmented control */
    .pi-seg {
      display: inline-flex; gap: 2px; padding: 3px;
      background: var(--bg); border: 1px solid var(--line-2); border-radius: 8px;
    }
    .pi-seg-btn {
      position: relative; display: inline-flex; align-items: center; gap: 6px;
      margin: 0; padding: 6px 16px; border-radius: 6px;
      font-size: 13px; font-weight: 600; color: var(--muted);
      cursor: pointer; transition: all .15s ease;
    }
    .pi-seg-btn input { position: absolute; opacity: 0; pointer-events: none; }
    .pi-seg-btn:hover { color: var(--ink); }
    .pi-seg-btn.on { background: #fff; color: var(--teal); box-shadow: 0 1px 3px rgba(16,40,48,.14); }

    /* Product sub-blocks */
    .pi-sub {
      border: 1px solid var(--line); border-radius: 8px;
      background: #fcfdfd; padding: 12px 14px 14px; margin-bottom: 12px;
    }
    .pi-sub-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; min-height: 30px; }
    .pi-sub-title { font-size: 13.5px; font-weight: 600; color: var(--ink); }

    /* Labels + inputs */
    .pi-label {
      display: block; margin: 0 0 5px;
      font-size: 11px; font-weight: 600; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.45px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .pi-ifield { position: relative; }
    .pi-ficon {
      position: absolute; left: 11px; top: 12px; z-index: 2;
      font-size: 14px; line-height: 1; color: #8a99a1;
      pointer-events: none; transition: color .15s ease;
    }
    .pi-ifield:focus-within .pi-ficon { color: var(--teal); }
    .pi-input {
      display: block; width: 100%; min-height: 38px; padding: 8px 10px;
      font-family: inherit; font-size: 14px; color: var(--ink);
      background: #fff; border: 1px solid var(--line-2); border-radius: 6px;
      outline: none; transition: border-color .15s ease, box-shadow .15s ease;
    }
    .pi-ifield .pi-input { padding-left: 33px; }
    select.pi-input {
      appearance: none; -webkit-appearance: none; padding-right: 30px; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%235f6f77' stroke-width='2' d='M3 6l5 5 5-5'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 10px center; background-size: 12px;
    }
    textarea.pi-input { min-height: 38px; resize: vertical; line-height: 1.4; }
    .pi-input:hover:not(:disabled):not([readonly]) { border-color: #b9c5cc; }
    .pi-input:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(14,124,134,.15); }
    .pi-input:disabled { background: #f0f3f5; color: #9aa7ad; cursor: not-allowed; }
    .pi-input[readonly] { background: #f5f7f8; color: var(--ink); }
    .pi-input::placeholder { color: #a3afb5; }
    .pi-err { display: block; margin-top: 4px; font-size: 12px; font-weight: 500; color: #c0392b; }

    /* Switch toggle */
    .pi-toggle {
      position: relative; display: inline-flex; align-items: center; gap: 8px; margin: 0;
      font-size: 13px; font-weight: 500; color: var(--muted); cursor: pointer; user-select: none;
    }
    .pi-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
    .pi-switch {
      position: relative; flex-shrink: 0; width: 34px; height: 20px;
      border-radius: 999px; background: #cfd8dc; transition: background .2s ease;
    }
    .pi-switch::after {
      content: ""; position: absolute; top: 2px; left: 2px;
      width: 16px; height: 16px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .2s ease;
    }
    .pi-toggle input:checked + .pi-switch { background: var(--teal); }
    .pi-toggle input:checked + .pi-switch::after { transform: translateX(14px); }
    .pi-toggle input:focus-visible + .pi-switch { box-shadow: 0 0 0 3px rgba(14,124,134,.25); }

    /* Buttons */
    .pi-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      height: 36px; padding: 0 14px;
      font-family: inherit; font-size: 13.5px; font-weight: 600;
      border-radius: 6px; border: 1px solid transparent;
      cursor: pointer; white-space: nowrap; transition: all .15s ease;
    }
    .pi-btn:disabled { opacity: .55; cursor: not-allowed; }
    .pi-btn-lg { height: 40px; padding: 0 32px; font-size: 14px; }
    .pi-btn-primary { background: var(--accent); color: #fff; }
    .pi-btn-primary:hover:not(:disabled) { background: var(--accent-d); }
    .pi-btn-soft { background: #fff; color: var(--ink); border-color: var(--line-2); }
    .pi-btn-soft:hover:not(:disabled) { border-color: var(--teal); color: var(--teal); }
    .pi-btn-ghost { background: #fff; color: var(--muted); border-color: var(--line-2); }
    .pi-btn-ghost:hover:not(:disabled) { color: var(--ink); background: var(--bg); }
    .pi-btn-danger, .pi-btn-red { background: #fff; color: #c0392b; border-color: #f1c8c3; }
    .pi-btn-danger:hover:not(:disabled), .pi-btn-red:hover:not(:disabled) { background: #fdf1ef; }
    .pi-btn-success { background: #fff; color: #1e7a46; border-color: #bfe3cd; }
    .pi-btn-success:hover:not(:disabled) { background: #eef8f2; }
    .pi-btn-icon { width: 30px; height: 30px; padding: 0; font-size: 15px; border-radius: 50%; }
    .pi-btn-xs { height: 28px; padding: 0 10px; font-size: 12px; gap: 4px; }
    .pi-linkbtn {
      display: inline-flex; align-items: center; gap: 5px;
      background: none; border: none; padding: 0; margin-top: 6px;
      font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--teal); cursor: pointer;
    }
    .pi-linkbtn:hover { text-decoration: underline; }
    .pi-addbranch { background: #fafcfc; border: 1px dashed var(--line-2); border-radius: 8px; padding: 12px; }

    /* Save bar */
    .pi-actions {
      display: flex; justify-content: flex-end; align-items: center; gap: 10px;
      background: #fff; border: 1px solid var(--line); border-radius: 10px;
      padding: 12px 20px; margin-bottom: 20px;
    }

    /* Filter bar */
    .pi-filter {
      display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px;
      padding: 14px 20px 16px; border-top: 1px solid var(--line);
    }
    .pi-filter .pi-fgroup { width: 180px; }
    .pi-filter-actions { display: flex; gap: 8px; margin-left: auto; }

    /* Table */
    .pi-table-wrap {
      overflow: auto; max-height: 480px;
      border-top: 1px solid var(--line); border-radius: 0 0 10px 10px;
    }
    .pi-table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; margin: 0; }
    .pi-table thead th {
      position: sticky; top: 0; z-index: 5;
      background: #f5f7f8; color: var(--muted);
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.45px;
      padding: 10px 12px; text-align: left; white-space: nowrap;
      border-bottom: 1px solid var(--line-2); border-right: 1px solid var(--line);
    }
    .pi-table tbody td {
      padding: 9px 12px; color: var(--ink); white-space: nowrap; vertical-align: middle;
      background: #fff; border-bottom: 1px solid var(--line); border-right: 1px solid #eef1f3;
    }
    .pi-table tbody tr:hover td { background: #f2f9f9; }
    .pi-table th:last-child, .pi-table td:last-child {
      position: sticky; right: 0; box-shadow: -4px 0 6px -4px rgba(16,40,48,.12);
    }
    .pi-table th:last-child { z-index: 6; }
    .pi-exp { cursor: pointer; transition: all .2s ease; }
    .pi-strong { font-weight: 600; }
    .pi-accent { font-weight: 600; color: var(--teal); }
    .pi-pos { font-weight: 600; color: #1e7a46; }
    .pi-neg { font-weight: 600; color: #c0392b; }

    /* Badges */
    .pi-badge {
      display: inline-block; padding: 2px 9px; border-radius: 999px;
      font-size: 12px; font-weight: 600; border: 1px solid transparent;
    }
    .pi-badge-blue { background: #e8f4f5; color: #0e7c86; border-color: #b9dfe2; }
    .pi-badge-gray { background: #f1f4f6; color: #4a5a63; border-color: #d9e0e4; }
    .pi-badge-green { background: #eaf7ef; color: #1e7a46; border-color: #bfe3cd; }
    .pi-badge-red { background: #fdf0ee; color: #c0392b; border-color: #f1c8c3; }
    .pi-badge-purple { background: #f1eefb; color: #5b3fb5; border-color: #d6cdf3; }
    .pi-badge-orange { background: #fdf0e9; color: #c4511f; border-color: #f6cdb7; }

    @media (max-width: 768px) {
      .pi-root { padding: 10px; }
      .pi-card-head, .pi-card-body, .pi-filter, .pi-actions { padding-left: 14px; padding-right: 14px; }
      .pi-filter .pi-fgroup { width: 100%; }
      .pi-filter-actions { margin-left: 0; flex-wrap: wrap; }
      .pi-actions { justify-content: stretch; }
      .pi-actions .pi-btn { width: 100%; }
    }
  `}</style>

  <div className="pi-container">

  {/* PAGE HEADER */}
  <div className="pi-topbar">
    <div className="pi-brand">
      <span className="pi-logo"><i className="bi bi-printer"></i></span>
      <div>
        <h1>Printing Instruction</h1>
        <p>Create, edit and track printing instructions</p>
      </div>
    </div>
    {loggedInUser && (
      <div className="pi-userchip">
        <span className="pi-avatar">{userInitials}</span>
        {loggedInUser}
      </div>
    )}
  </div>

  <form onSubmit={handleSubmit}>

    {/* ───────────────── PRODUCT DETAILS ───────────────── */}
    <div className="pi-card">
      <div className="pi-card-head">
        <SectionHead icon="box-seam" title="Product Details" chip="Required" required />

        {/* MASTER / PERSO TOGGLE */}
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

      <div className="pi-card-body">

        {/* ── PRODUCT ROWS ── */}
        {productRows.map((row, index) => (
          <div key={index} className="pi-sub">
            <div className="pi-sub-head">
              <div className="pi-sub-title">Product {index + 1}</div>
              {productRows.length > 1 && (
                <button type="button" onClick={() => removeProductRow(index)}
                  className="pi-btn pi-btn-danger pi-btn-icon" title="Remove product">
                  <i className="bi bi-dash-lg"></i>
                </button>
              )}
            </div>
            <div className="row g-2 align-items-start">

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

              <Field col="col-md-4" icon="card-text" label="Description">
                <input className="pi-input" value={row.description} readOnly />
              </Field>

              <Field col="col-md-2" icon="person" label="Customer">
                <input className="pi-input" value={row.customerName} readOnly />
              </Field>

              <Field col="col-md-2" icon="aspect-ratio" label="Job Size">
                <input className="pi-input" value={row.jobSize} readOnly />
              </Field>

            </div>
          </div>
        ))}

        {/* Add Product Row button */}
        <button type="button" onClick={addProductRow} className="pi-btn pi-btn-soft mb-3">
          <i className="bi bi-plus-circle"></i> Add Product
        </button>

        {/* ── REMAINING SINGLE FIELDS ── */}
        <div className="row g-2">

          {orderMode === "MASTER" && (
            <>
              <Field col="col-md-2" icon="collection" label="Material Group" error={errors.materialGroup && <small className="pi-err">{errors.materialGroup}</small>}>
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
              <Field col="col-md-2" icon="layers-half" label="GSM">
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

          <Field col="col-md-2" icon="123" label="Quantity" error={errors.quantity && <small className="pi-err">{errors.quantity}</small>}>
            <input type="number" min={0} name="quantity" className="pi-input"
              disabled={orderMode === "PERSOW" && !selectedWO}
              value={form.quantity} onChange={handleChange} />
          </Field>

          {orderMode === "PERSOW" && (
            <Field col="col-md-2" icon="hourglass-split" label="Remaining Qty">
              <input type="number" className="pi-input" value={liveRemaining} readOnly />
            </Field>
          )}

          <Field col="col-md-2" icon="geo-alt" label="Location" error={errors.location && <small className="pi-err">{errors.location}</small>}>
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
    </div>

    {/* ───────────────── NUMBERING DETAILS ───────────────── */}
    <div className="pi-card">
      <div className="pi-card-head">
        <SectionHead icon="hash" title="Numbering Details" chip={sectionChip} required={isPersow} />
        {orderMode !== "PERSOW" && (
          <Toggle
            checked={showBankDetails}
            onChange={(e) => setShowBankDetails(e.target.checked)}
            label="Show Details"
          />
        )}
      </div>

      {(orderMode === "PERSOW" || showBankDetails) && (
        <div className="pi-card-body">
          <div className="row g-2">

            <Field col="col-md-2" icon="type" label="Prefix" error={renderFieldError("prefix")}>
              <input name="prefix" className="pi-input" value={form.prefix} onChange={handleChange} />
            </Field>

            <Field col="col-md-2" icon="credit-card" label="Account Number" error={renderFieldError("accountNumber")}>
              <input name="accountNumber" className="pi-input" value={form.accountNumber} onChange={handleChange} />
            </Field>

            <Field col="col-md-2" icon="journal-arrow-down" label="Cheque From" error={renderFieldError("chequeFrom")}>
              <input type="text" name="chequeFrom" className="pi-input" value={form.chequeFrom} onChange={handleChange} />
            </Field>

            <Field col="col-md-2" icon="journal-arrow-up" label="Cheque To" error={renderFieldError("chequeTo")}>
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
    </div>

    {/* ───────────────── PACKING STANDARD ───────────────── */}
    <div className="pi-card">
      <div className="pi-card-head">
        <SectionHead icon="boxes" title="Packing Standard" chip={sectionChip} required={isPersow} />
        {!isPersow && (
          <Toggle
            checked={showPacking}
            onChange={(e) => setShowPacking(e.target.checked)}
            label="Show Packing Details"
          />
        )}
      </div>

      {(isPersow || showPacking) && (
        <div className="pi-card-body">
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

            <Field col="col-md-2" icon="diagram-3" label="Inner Pack per Outer Pack">
              <input type="number" className="pi-input" value={form.innerPerOuter} readOnly />
            </Field>

            <Field col="col-md-4" icon="chat-left-text" label="Remarks" error={renderFieldError("packingRemarks")}>
              <textarea name="packingRemarks" className="pi-input" value={form.packingRemarks} onChange={handleChange} />
            </Field>

          </div>
        </div>
      )}
    </div>

    {/* ───────────────── DISPATCH DETAILS ───────────────── */}
    <div className="pi-card">
      <div className="pi-card-head">
        <SectionHead icon="truck" title="Dispatch Details" chip={sectionChip} required={isPersow} />
        {!isPersow && (
          <Toggle
            checked={showDispatch}
            onChange={(e) => setShowDispatch(e.target.checked)}
            label="Show Dispatch Details"
          />
        )}
      </div>

      {(isPersow || showDispatch) && (
        <div className="pi-card-body">
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
              <label className="pi-label">Branch Code</label>

              <div className="pi-ifield">
                <i className="bi bi-building pi-ficon"></i>
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
              </div>
              {renderFieldError("branchCode")}
              <button
                type="button"
                onClick={() => setShowAddBranch(!showAddBranch)}
                className="pi-linkbtn"
              >
                <i className={`bi bi-${showAddBranch ? "x-circle" : "plus-circle"}`}></i>
                {showAddBranch ? "Cancel New Branch" : "Add New Branch"}
              </button>
            </div>

            {showAddBranch && (
              <div className="col-md-4">
                <div className="pi-addbranch">
                  <label className="pi-label">New Branch Code</label>
                  <div className="pi-ifield mb-2">
                    <i className="bi bi-signpost pi-ficon"></i>
                    <input
                      className="pi-input"
                      placeholder="Branch Code"
                      value={newBranch.branchCode}
                      onChange={(e) => setNewBranch(prev => ({ ...prev, branchCode: e.target.value }))}
                    />
                  </div>
                  <label className="pi-label">New Dispatch Address</label>
                  <div className="pi-ifield mb-2">
                    <i className="bi bi-geo pi-ficon"></i>
                    <textarea
                      className="pi-input"
                      placeholder="Dispatch Address"
                      value={newBranch.dispatchAddress}
                      onChange={(e) => setNewBranch(prev => ({ ...prev, dispatchAddress: e.target.value }))}
                    />
                  </div>
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
    </div>

    {/* ───────────────── BILLING INSTRUCTIONS ───────────────── */}
    <div className="pi-card">
      <div className="pi-card-head">
        <SectionHead icon="receipt-cutoff" title="Billing Instructions" chip={sectionChip} required={isPersow} />
        {!isPersow && (
          <Toggle
            checked={showBilling}
            onChange={(e) => setShowBilling(e.target.checked)}
            label="Show Billing Details"
          />
        )}
      </div>

      {(isPersow || showBilling) && (
        <div className="pi-card-body">
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

            <Field col="col-md-2" icon="tags" label="Billing Type" error={renderFieldError("billingType")}>
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
    </div>

    {/* ───────────────── INSTRUCTIONS ───────────────── */}
    <div className="pi-card">
      <div className="pi-card-head">
        <SectionHead icon="clipboard-check" title="Instructions" chip={sectionChip} required={isPersow} />
        {!isPersow && (
          <Toggle
            checked={showInstructions}
            onChange={(e) => setShowInstructions(e.target.checked)}
            label="Show Instruction Details"
          />
        )}
      </div>

      {(isPersow || showInstructions) && (
        <div className="pi-card-body">
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
    </div>

    {/* SAVE BAR */}
    <div className="pi-actions">
      <button
        type="submit"
        className="pi-btn pi-btn-primary pi-btn-lg"
        disabled={saving}
        onClick={(e) => {
          if (saving) e.preventDefault();
        }}
      >
        <i className="bi bi-check2-circle"></i> Save
      </button>
    </div>
  </form>

  {/* ───────────────── RECORDS (FILTER + TABLE) ───────────────── */}
  <div className="pi-card">
    <div className="pi-card-head">
      <SectionHead icon="table" title="Printing Instruction Records" />
      <span className="pi-count">{filteredOrders.length} records</span>
    </div>

    <div className="pi-filter">

      {/* WO Number */}
      <div className="pi-fgroup">
        <label className="pi-label">WO Number</label>
        <div className="pi-ifield">
          <i className="bi bi-hash pi-ficon"></i>
          <input
            type="text"
            placeholder="Search WO..."
            className="pi-input"
            value={filters.wo}
            onChange={(e) => setFilters({ ...filters, wo: e.target.value })}
          />
        </div>
      </div>

      {/* Sub WO */}
      <div className="pi-fgroup">
        <label className="pi-label">Sub WO</label>
        <div className="pi-ifield">
          <i className="bi bi-diagram-2 pi-ficon"></i>
          <input
            type="text"
            placeholder="Search Sub WO..."
            className="pi-input"
            value={filters.subWo}
            onChange={(e) => setFilters({ ...filters, subWo: e.target.value })}
          />
        </div>
      </div>

      {/* Customer */}
      <div className="pi-fgroup">
        <label className="pi-label">Customer</label>
        <div className="pi-ifield">
          <i className="bi bi-person pi-ficon"></i>
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
      </div>

      {/* Product Code */}
      <div className="pi-fgroup">
        <label className="pi-label">Product Code</label>
        <div className="pi-ifield">
          <i className="bi bi-upc-scan pi-ficon"></i>
          <input
            type="text"
            placeholder="Search code..."
            className="pi-input"
            value={filters.productCode}
            onChange={(e) => setFilters({ ...filters, productCode: e.target.value })}
          />
        </div>
      </div>

      {/* Ticket ID */}
      <div className="pi-fgroup">
        <label className="pi-label">Ticket ID</label>
        <div className="pi-ifield">
          <i className="bi bi-ticket-perforated pi-ficon"></i>
          <input
            type="text"
            placeholder="Ticket ID"
            className="pi-input"
            value={filters.ticketId || ""}
            onChange={(e) => setFilters({ ...filters, ticketId: e.target.value })}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="pi-filter-actions">
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
</div>
  );
}
export default PrintingIns;