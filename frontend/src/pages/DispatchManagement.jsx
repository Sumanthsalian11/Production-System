import { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import { saveAs } from "file-saver";
import BASE_URL from "../config/api";

/* ---------- small inline icons (presentation only) ---------- */
const svgProps = {
  width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round",
};
const IconTruck = (p) => (
  <svg {...svgProps} {...p}>
    <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const IconUser = (p) => (
  <svg {...svgProps} {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconBox = (p) => (
  <svg {...svgProps} {...p}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const IconHash = (p) => (
  <svg {...svgProps} {...p}>
    <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);
const IconSearch = (p) => (
  <svg {...svgProps} {...p}>
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconList = (p) => (
  <svg {...svgProps} {...p}>
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconFilter = (p) => (
  <svg {...svgProps} {...p}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const IconEdit = (p) => (
  <svg {...svgProps} width={14} height={14} {...p}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconTrash = (p) => (
  <svg {...svgProps} width={14} height={14} {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const IconSave = (p) => (
  <svg {...svgProps} {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);

const CLEARED = {
  purchaseOrderNo: "", poDate: "", customer: "", productName: "",
  totalQty: "", dispatchQty: "", balanceQty: "", dispatchDate: "",
  location: "", deliveryAddress: "", expectedDeliveryDate: "",
  delayDays: "", delayLabel: "", courier: "", trackingNumber: "",
  invoiceNo: "", invoiceDate: "", extraQty: "", remarks: "",
  noOfPackets: "", noOfBoxes: "", attachment: "", attachmentName: "", productType: "", splitLocation: ""
};

export default function DispatchManagement() {

const [transportations, setTransportations] = useState([]);
const [dispatchList, setDispatchList] = useState([]);
const [editingId, setEditingId] = useState(null);
const [fetchBy, setFetchBy] = useState("wo"); // "wo" | "ticket"
const [loggedInUser, setLoggedInUser] = useState("");
const [isAdmin, setIsAdmin] = useState(false);
const [expandedCell, setExpandedCell] = useState(null);
const [originalBalance, setOriginalBalance] = useState(0);
const [attachmentFile, setAttachmentFile] = useState(null);
const [fileInputKey, setFileInputKey] = useState(0);
const [fetchLocOptions, setFetchLocOptions] = useState([]);
const [fetchLocation, setFetchLocation] = useState("");
const resetAttachment = () => {
  setAttachmentFile(null);
  setFileInputKey((k) => k + 1);
  setFetchLocOptions([]);
  setFetchLocation("");
};
const [locations, setLocations] = useState([]);
const [locationFilter, setLocationFilter] = useState("");
const [locationOptions, setLocationOptions] = useState([]);
const [filters, setFilters] = useState({
  woNumber: "",
  customer: "",
  dispatchDate: "",
  fromDate: "",
  toDate: ""
});

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
productType:"",
noOfPackets:"",
noOfBoxes:"",
attachment:"",
attachmentName:"",
efiWoNumber:"",
ticketNo:"",
purchaseOrderNo:"",
poDate:"", 
customer:"",
productName:"",
totalQty:"",
dispatchQty:"",
balanceQty:"",
dispatchDate:"",
location: "",   // 👈 ADD
  deliveryAddress: "",
expectedDeliveryDate:"",
delayDays:"",
delayLabel:"",
courier:"",
trackingNumber:"",
invoiceNo:"",
invoiceDate:"",
extraQty:"",
remarks:"",
enteredBy:""
});


// JWT USER
useEffect(() => {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name);
      setIsAdmin(String(decoded.role || "").toUpperCase() === "ADMIN");

      // ✅ Store locations in state for later use
      setForm(prev => ({ ...prev, userLocations: decoded.locations || [] }));
    } catch {
      console.error("Invalid token");
    }
  }
}, []);


// FETCH TRANSPORT
useEffect(()=>{
fetchTransportations();
fetchDispatches();
fetchLocations(); 
},[]);

const fetchTransportations = async ()=>{
try{
const res = await axios.get(`${BASE_URL}/api/master/transportations`);
setTransportations(res.data);
}catch{
console.error("Error fetching transportation master");
}
};
const truncateText = (text, length = 25) => {
  if (!text) return "-";
  return text.length > length ? text.substring(0, length) + "..." : text;
};

const fetchLocations = async () => {
  try {
   const res = await axios.get(`${BASE_URL}/api/master/locations`);
    setLocations(res.data);
  } catch {
    console.error("Error fetching locations");
  }
};
const handleDelete = async (id) => {
  try {
    await axios.delete(`${BASE_URL}/api/dispatch/${id}`);
    showAlert("Deleted successfully", "success");
    fetchDispatches();
  } catch {
    showAlert("Error deleting record", "error");
  }
};

const fetchDispatches = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/dispatch/list`);
    setDispatchList(res.data);

    // ✅ Extract unique userLocations
    setLocationOptions([
      ...new Set(
        res.data
          .flatMap(item => item.userLocations || [])
          .filter(Boolean)
      )
    ]);

  } catch {
    console.error("Error fetching dispatch records");
  }
};

 const handleFilterChange = (e) => {
  const { name, value } = e.target;
  setFilters(prev => ({
    ...prev,
    [name]: value
  }));
};

// EDIT
const handleEdit = (dispatch)=>{

setFetchBy(dispatch.ticketNo ? "ticket" : "wo");
setForm({
efiWoNumber: dispatch.efiWoNumber ?? "",
ticketNo: dispatch.ticketNo || "",
customer:dispatch.customer,
productName:dispatch.productName,
totalQty:dispatch.totalQty,
dispatchQty:dispatch.dispatchQty,
balanceQty:dispatch.balanceQty,
extraQty: dispatch.extraQty || "",
dispatchDate:dispatch.dispatchDate,
expectedDeliveryDate: dispatch.expectedDeliveryDate,
delayDays: dispatch.delayDays,
delayLabel: dispatch.delayLabel,
courier:dispatch.courier,
trackingNumber:dispatch.trackingNumber,
invoiceNo: dispatch.invoiceNo || "",
invoiceDate: dispatch.invoiceDate || "",
  location: dispatch.location || "",
deliveryAddress:dispatch.deliveryAddress,
remarks:dispatch.remarks,
enteredBy:dispatch.enteredBy || "",
userLocations: form.userLocations || [],
productType: dispatch.productType || "",
noOfPackets: dispatch.noOfPackets ?? "",
noOfBoxes: dispatch.noOfBoxes ?? "",
attachment: dispatch.attachment || "",
attachmentName: dispatch.attachmentName || "",
splitLocation: dispatch.splitLocation || ""
});

setOriginalBalance(
  Number(dispatch.balanceQty) + Number(dispatch.dispatchQty)
);
setEditingId(dispatch._id);
resetAttachment();

window.scrollTo({top:0,behavior:"smooth"});
};


// FETCH WO
const fetchWorkOrder = async (selLoc = fetchLocation) => {

if(!form.efiWoNumber){
showAlert("Please enter Work Order Number","warning");
return;
}

try{

const res = await axios.get(
  `${BASE_URL}/api/dispatch/workorder/${form.efiWoNumber}`,
  { params: selLoc ? { location: selLoc } : {} }
);

const wo = res.data;

if (wo.needsLocation) {
  setFetchLocation("");
  setEditingId(null);
  setOriginalBalance(0);
  setForm(prev => ({ ...prev, ...CLEARED }));
  setFetchLocOptions(wo.locations);
  showAlert("This order has multiple locations. Please select a location","info");
  return;
}

setForm(prev => ({
...prev,
customer: wo.customer,
productName: wo.productName,
productType: wo.productType || "",
splitLocation: wo.selectedLocation || "",
totalQty: wo.qtyInLvs,
dispatchQty: "",
balanceQty: wo.balanceQty || 0,
purchaseOrderNo: wo.purchaseOrderNo || "",
poDate: wo.poDate ? wo.poDate.split("T")[0] : "",
expectedDeliveryDate: wo.expectedDeliveryDate
? wo.expectedDeliveryDate.split("T")[0]
: ""
}));
setOriginalBalance(wo.balanceQty || 0);

}catch(err){

if(err.response && err.response.status === 404){
showAlert("Work Order not found","warning");
}else{
showAlert("Error fetching Work Order","error");
}

}

};

const switchFetchBy = (mode) => {
  setFetchBy(mode);
  setEditingId(null);
  setOriginalBalance(0);
  setForm(prev => ({ ...prev, ...CLEARED, efiWoNumber: "", ticketNo: "" }));
  resetAttachment();
};

// FETCH BY TICKET (Out Source / PMS)
const fetchByTicket = async (selLoc = fetchLocation) => {
  const t = String(form.ticketNo || "").trim();
  if (!t) {
    showAlert("Please enter Ticket ID", "warning");
    return;
  }
  try {
    const res = await axios.get(
      `${BASE_URL}/api/dispatch/ticket/${encodeURIComponent(t)}`,
      { params: selLoc ? { location: selLoc } : {} }
    );
    const o = res.data;

    if (o.needsLocation) {
      setFetchLocation("");
      setEditingId(null);
      setOriginalBalance(0);
      setForm(prev => ({ ...prev, ...CLEARED }));
      setFetchLocOptions(o.locations);
      showAlert("This order has multiple locations. Please select a location", "info");
      return;
    }

    setForm(prev => ({
      ...prev,
      ticketNo: o.ticketNo,
      customer: o.customer,
      productName: o.productName,
      productType: o.productType || "",
      splitLocation: o.selectedLocation || "",
      totalQty: o.totalQty,
      dispatchQty: "",
      balanceQty: o.balanceQty || 0,
      purchaseOrderNo: o.purchaseOrderNo || "",
      poDate: o.poDate ? String(o.poDate).split("T")[0] : "",
      expectedDeliveryDate: o.expectedDeliveryDate
        ? String(o.expectedDeliveryDate).split("T")[0]
        : ""
    }));
    setOriginalBalance(o.balanceQty || 0);
  } catch (err) {
    if (err.response?.status === 404) showAlert("Ticket not found", "warning");
    else if (err.response?.status === 400)
      showAlert(err.response.data.message, "warning");
    else showAlert("Error fetching Ticket", "error");
  }
};

// VALIDATION
const isValidInput = (value)=>{
const regex = /^[a-zA-Z0-9\s.,]*$/;
return regex.test(value);
};


// HANDLE CHANGE
const handleChange = (e) => {
  const { name, value } = e.target;

  if (["trackingNumber","deliveryAddress","remarks","invoiceNo"].includes(name)) {
    if (!isValidInput(value)) {
      showAlert("Special characters are not allowed","error");
      return;
    }
  }

  // WO number changed -> clear fetched details, Fetch Details must be clicked again
  if (name === "efiWoNumber" || name === "ticketNo") {
    const clean = name === "ticketNo" ? value.replace(/[^a-zA-Z0-9_]/g, "") : value;
    resetAttachment();
    setForm(prev => ({
      ...prev,
      ...CLEARED,
      efiWoNumber: name === "efiWoNumber" ? clean : "",
      ticketNo: name === "ticketNo" ? clean : ""
    }));
    setEditingId(null);
    setOriginalBalance(0);
    return;
  }

  // ✅ DEFINE FIRST
  let updatedForm = { ...form, [name]: value };

  // ✅ AUTO FILL ADDRESS (NOW WORKS)
  if (name === "location") {
  if (value === "") {
    // ✅ When location is cleared → reset address
    updatedForm.deliveryAddress = "";
  } else {
    const selectedLocation = locations.find(
      (loc) => loc._id.toString() === value
    );

    if (selectedLocation) {
      updatedForm.deliveryAddress = selectedLocation.address || "";
    }
  }
}

  if (["noOfPackets", "noOfBoxes"].includes(name)) {
    if (!/^[0-9]*$/.test(value)) {
      showAlert("Only numbers are allowed","warning");
      return;
    }
  }

  // 🔹 Dispatch validation (same)
  if (name === "dispatchQty") {
    const numberRegex = /^[0-9]*$/;

    if (!numberRegex.test(value)) {
      showAlert("Special characters not allowed in Dispatch Qty","warning");
      return;
    }

    const total = Number(form.totalQty) || 0;
    const dispatch = Number(value) || 0;

    if (dispatch < 0) return showAlert("Dispatch Qty cannot be negative","warning");
    if (dispatch > originalBalance) return showAlert("Dispatch Qty cannot exceed Balance Qty","warning");
    if (dispatch > total) return showAlert("Dispatch Qty cannot exceed Total Qty","warning");
  }

  // 🔹 Balance + delay logic
  const total = Number(updatedForm.totalQty) || 0;
  const dispatch = Number(updatedForm.dispatchQty) || 0;

  updatedForm.balanceQty =
    originalBalance - dispatch >= 0 ? originalBalance - dispatch : 0;

  if (updatedForm.dispatchDate && updatedForm.expectedDeliveryDate) {
    const dispatchDate = new Date(updatedForm.dispatchDate);
    const expectedDate = new Date(updatedForm.expectedDeliveryDate);

    const diffDays = Math.round(
      (dispatchDate - expectedDate) / (1000 * 60 * 60 * 24)
    );

    updatedForm.delayDays = diffDays;

    if (diffDays === 0) updatedForm.delayLabel = "On Time";
    else if (diffDays > 0) updatedForm.delayLabel = diffDays + " days delay";
    else updatedForm.delayLabel = Math.abs(diffDays) + " days early";
  }

  setForm(updatedForm);
};


// SUBMIT
const handleSubmit = async (e)=>{

e.preventDefault();

// REQUIRED FIELD VALIDATION
if (!form.dispatchQty) {
  showAlert("Dispatch Qty is required","warning");
  return;
}

if (!form.dispatchDate) {
  showAlert("Dispatch Date is required (dd-mm-yyyy)","warning");
  return;
}

if (fetchBy === "wo" && !form.courier) {
  showAlert("Transportation is required","warning");
  return;
}

if (fetchBy === "wo" && !form.trackingNumber) {
  showAlert("Vehicle Number is required","warning");
  return;
}

if (fetchBy === "wo" && !form.deliveryAddress) {
  showAlert("Delivery Address is required","warning");
  return;
}
if(fetchBy === "wo" && !form.extraQty)
{showAlert("Extra Qty is required","warning");
return;
} 


if(!loggedInUser){
showAlert("Session expired. Please login again.","warning");
return;
}



if(fetchBy === "wo" && !form.invoiceNo)
{
   showAlert("Invoice No is required","warning");
  return;
}

const today = new Date().toISOString().split("T")[0];



try{

const payloadObj = {
...form,
delayDays: form.delayDays,
delayLabel: form.delayLabel,
dispatchDate: form.dispatchDate
? new Date(form.dispatchDate).toISOString().split("T")[0]
: "",
enteredBy: loggedInUser,
efiWoNumber: form.efiWoNumber || undefined,
ticketNo: form.ticketNo || undefined,
userLocations: form.userLocations || [] 
};

const payload = new FormData();
Object.entries(payloadObj).forEach(([k, v]) => {
  if (v === undefined || v === null) return;
  if (k === "attachment" || k === "attachmentName") return;
  if (k === "userLocations") payload.append(k, JSON.stringify(v));
  else payload.append(k, v);
});
if (attachmentFile) payload.append("attachment", attachmentFile);

if(editingId){

await axios.put(
  `${BASE_URL}/api/dispatch/${editingId}`,
  payload
);

showAlert("Dispatch Updated Successfully","success");
resetAttachment();

setEditingId(null);

}else{

await axios.post(
  `${BASE_URL}/api/dispatch/create`,
  payload
);

showAlert("Dispatch Created Successfully","success");
resetAttachment();

}

setForm({
  ...CLEARED,
  efiWoNumber: "",
  ticketNo: "",
  enteredBy: "",
  userLocations: form.userLocations || []
});
setOriginalBalance(0);
setFetchLocation("");
setFetchLocOptions([]);

fetchDispatches();

}catch{
showAlert("Error saving dispatch","error");
}

};


// EXPORT EXCEL
const exportExcel = ()=>{

if(dispatchList.length===0) return showAlert("No records to export","warning");

const excelData = filteredDispatchList.map((item,index)=>({

"SL NO": index+1,
"Work Order": item.efiWoNumber || item.ticketNo,
"Customer": item.customer,
"Product": item.productName,
"Product Type": item.productType || "",
"Total Qty": item.totalQty,
"Dispatch Qty": item.dispatchQty,
"Balance Qty": item.balanceQty,
"Extra Qty": item.extraQty,
"Dispatch Date": item.dispatchDate,
"Transportation": item.courier,
"Vehicle Number": item.trackingNumber,
"Invoice No": item.invoiceNo,
"Invoice Date": item.invoiceDate,
"Delivery Address": item.deliveryAddress,
"User":item.enteredBy,
"Remarks": item.remarks,
"No of Packets": item.noOfPackets ?? 0,
"No of Boxes": item.noOfBoxes ?? 0,
"Attachment": item.attachment ? `${BASE_URL}${item.attachment}` : ""

}));

const worksheet = XLSX.utils.json_to_sheet(excelData);

const workbook = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(workbook,worksheet,"Dispatch");

const excelBuffer = XLSX.write(workbook,{bookType:"xlsx",type:"array"});

const data = new Blob([excelBuffer],{type:"application/octet-stream"});

saveAs(data,"DispatchList.xlsx");

};


// ---------- IMPORT EXCEL ----------
const pad2 = (n) => String(n).padStart(2, "0");

const toYMD = (v) => {
  if (v === "" || v == null) return "";
  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    return p ? `${p.y}-${pad2(p.m)}-${pad2(p.d)}` : null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null; // invalid
};

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");

const COLUMN_MAP = {
  job: ["wo", "woticket", "workorder", "workorderno", "ticketno", "ticketid"],
  purchaseOrderNo: ["pono", "purchaseorderno"],
  poDate: ["orderdate", "podate"],
  customer: ["customer"],
  productName: ["productname", "product"],
  totalQty: ["totalorderqty", "totalqty"],
  dispatchQty: ["dispatchqty"],
  extraQty: ["extraqty"],
  dispatchDate: ["dispatchdate"],
  expectedDeliveryDate: ["expected", "expecteddelivery", "expecteddeliverydate"],
  courier: ["courier", "transportation"],
  trackingNumber: ["vehicle", "vehicleno", "vehiclenumber", "tracking", "trackingnumber", "trackingno"],
  invoiceNo: ["invoiceno", "invoicenumber"],
  invoiceDate: ["invoicedate"],
  location: ["location"],
  deliveryAddress: ["address", "deliveryaddress"],
  remarks: ["remarks"],
  noOfPackets: ["noofpackets", "packets"],
  noOfBoxes: ["noofboxes", "boxes"]
};

const downloadTemplate = () => {
  const headers = [
    "WO", "Dispatch Qty", "Extra Qty", "Dispatch Date", "Expected",
    "Courier", "Vehicle No", "Invoice No", "Invoice Date", "Location", "Address", "Remarks",
    "No. of Packets", "No. of Boxes"
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dispatch");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), "DispatchImportTemplate.xlsx");
};

const handleImportExcel = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = ""; // allow re-selecting the same file
  if (!file) return;

  if (!loggedInUser) {
    showAlert("Session expired. Please login again.", "warning");
    return;
  }

  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

    if (raw.length === 0) {
      showAlert("Excel file is empty", "warning");
      return;
    }

    const validRows = [];
    const rowErrors = [];

    raw.forEach((rawRow, idx) => {
      const rowNo = idx + 2; // header is row 1

      const row = {};
      Object.keys(rawRow).forEach((k) => {
        const nk = normKey(k);
        for (const field in COLUMN_MAP) {
          if (COLUMN_MAP[field].includes(nk)) row[field] = rawRow[k];
        }
      });

      const txt = (v) => String(v ?? "").trim();
      const num = (v) => Number(String(v ?? "").replace(/,/g, ""));
      const fail = (msg) => rowErrors.push({ rowNo, message: msg });

      if (!txt(row.job)) return fail("WO / Ticket is missing");
      if (!txt(row.dispatchQty)) return fail("Dispatch Qty is required");
      if (!txt(row.dispatchDate)) return fail("Dispatch Date is required");
      if (!txt(row.courier)) return fail("Transportation (Courier) is required");
      if (!txt(row.trackingNumber)) return fail("Vehicle Number is required");
      if (!txt(row.invoiceNo)) return fail("Invoice No is required");

      const dispatchDate = toYMD(row.dispatchDate);
      if (!dispatchDate) return fail("Dispatch Date format is invalid (use dd-mm-yyyy)");

      const invoiceDate = toYMD(row.invoiceDate);
      if (invoiceDate === null) return fail("Invoice Date format is invalid (use dd-mm-yyyy)");

      const poDate = toYMD(row.poDate);
      const expectedDeliveryDate = toYMD(row.expectedDeliveryDate);

      const courierMaster = transportations.find(
        (t) => t.name.toLowerCase() === txt(row.courier).toLowerCase()
      );
      if (!courierMaster) return fail(`Transportation "${txt(row.courier)}" not found in master`);

      let locationId = "";
      let address = txt(row.deliveryAddress);
      if (txt(row.location)) {
        const loc = locations.find(
          (l) => l.locationName.toLowerCase() === txt(row.location).toLowerCase()
        );
        if (!loc) return fail(`Location "${txt(row.location)}" not found in master`);
        locationId = loc._id.toString();
        if (!address) address = loc.address || "";
      }
      if (!address) return fail("Delivery Address is required (or give a valid Location)");
      const packets = txt(row.noOfPackets) === "" ? 0 : num(row.noOfPackets);
      const boxes = txt(row.noOfBoxes) === "" ? 0 : num(row.noOfBoxes);
      if (!Number.isInteger(packets) || packets < 0) return fail("No. of Packets must be a whole number");
      if (!Number.isInteger(boxes) || boxes < 0) return fail("No. of Boxes must be a whole number");
      validRows.push({
        rowNo,
        job: txt(row.job),
        purchaseOrderNo: txt(row.purchaseOrderNo),
        poDate: poDate || "",
        customer: txt(row.customer),
        productName: txt(row.productName),
        totalQty: num(row.totalQty) || 0,
        dispatchQty: num(row.dispatchQty),
        extraQty: txt(row.extraQty) === "" ? 0 : num(row.extraQty),
        dispatchDate,
        expectedDeliveryDate: expectedDeliveryDate || "",
        courier: courierMaster.name,
        trackingNumber: txt(row.trackingNumber),
        invoiceNo: txt(row.invoiceNo),
        invoiceDate: invoiceDate || "",
        location: locationId,
        deliveryAddress: address,
        remarks: txt(row.remarks),
        noOfPackets: packets,
        noOfBoxes: boxes
      });
    });

    let inserted = 0;
    let skipped = 0;
    const allErrors = [...rowErrors];
    const CHUNK = 100;

    for (let i = 0; i < validRows.length; i += CHUNK) {
      const res = await axios.post(`${BASE_URL}/api/dispatch/bulk-import`, {
        rows: validRows.slice(i, i + CHUNK),
        enteredBy: loggedInUser,
        userLocations: form.userLocations || []
      });
      inserted += res.data.inserted;
      skipped += res.data.skipped;
      allErrors.push(...res.data.errors);
    }

    allErrors.sort((a, b) => a.rowNo - b.rowNo);

    const errorHtml = allErrors.length
      ? `<div style="text-align:left;max-height:220px;overflow:auto;font-size:13px;margin-top:8px">
          ${allErrors
            .slice(0, 50)
            .map((er) => `Row ${er.rowNo}: ${er.message}`)
            .join("<br/>")}
          ${allErrors.length > 50 ? `<br/>...and ${allErrors.length - 50} more` : ""}
        </div>`
      : "";

    Swal.fire({
      icon: allErrors.length ? (inserted ? "warning" : "error") : "success",
      title: "Import Completed",
      html: `Imported: <b>${inserted}</b> &nbsp; Duplicates skipped: <b>${skipped}</b> &nbsp; Failed: <b>${allErrors.length}</b>${errorHtml}`
    });

    fetchDispatches();
  } catch (err) {
    console.error(err);
    showAlert("Error importing Excel file", "error");
  }
};

const today = new Date().toISOString().split("T")[0];

const filteredDispatchList = dispatchList.filter((item) => {
  const jobKey = String(item.efiWoNumber ?? item.ticketNo ?? "").toLowerCase();
  if (filters.woNumber && !jobKey.includes(filters.woNumber.toLowerCase())) {
    return false;
  }

  if (
    filters.customer &&
    !item.customer
      ?.toLowerCase()
      .includes(filters.customer.toLowerCase())
  ) {
    return false;
  }

  if (
    filters.dispatchDate &&
    item.dispatchDate?.split("T")[0] !== filters.dispatchDate
  ) {
    return false;
  }

  const dDate = item.dispatchDate?.split("T")[0] || "";
  if (filters.fromDate && (!dDate || dDate < filters.fromDate)) {
    return false;
  }
  if (filters.toDate && (!dDate || dDate > filters.toDate)) {
    return false;
  }
   if (locationFilter) {
    const matchLocation = item.userLocations?.some(
      loc => loc === locationFilter
    );

    if (!matchLocation) return false;
  }


  return true;
});
const uniqueCustomers = [
  ...new Set(dispatchList.map(item => item.customer))
];

return(

<div className="pd-root">
<style>{`
  /* ---------- Theme tokens (same as Production page) ---------- */
  .pd-root {
    --brand: #e4572e;
    --brand-dark: #c9461f;
    --brand-soft: #fdeee8;
    --teal: #0b3a45;
    --teal-mid: #0f5560;
    --teal-soft: #e3f1f4;
    --ink: #000000;
    --line: #d1d5db;
    --line-soft: #e5e7eb;
    --field-line: #9ca3af;
    --surface: #ffffff;
    --page: #f4f6f8;
    --ok: #1f9d6b;
    --warn: #d98a00;
    --danger: #d64545;
  }

  /* ---------- Page ---------- */
  .pd-root {
    min-height: 100vh;
    padding: 14px 18px 28px;
    box-sizing: border-box;
    font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: #000000;
    background: var(--page);
  }
  .pd-root * { box-sizing: border-box; }
  .pd-shell { max-width: 100%; margin: 0 auto; }

  /* ---------- Cards ---------- */
  .pd-glass {
    position: relative;
    border-radius: 8px;
    padding: 14px 20px;
    margin-bottom: 10px;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
    overflow: hidden;
  }

  .pd-edit-chip {
    display: inline-block; margin: 4px 0 0;
    font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 4px;
    color: #8a5a00; background: #fff3d6;
    border: 1px solid #f2d291;
  }

  /* ---------- Section headings ---------- */
  .card-heading-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line);
  }
  .heading-with-icon { display: flex; align-items: center; gap: 10px; }
  .heading-icon-badge {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: var(--brand) !important;
    background: var(--brand-soft) !important;
    border: 1px solid #f7d3c6;
    box-shadow: none;
  }
  .card-heading-row h2 { font-size: 15px; font-weight: 700; margin: 0; color: #000000; }
  .section-pill-tag {
    font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 4px;
    text-transform: uppercase; letter-spacing: 0.5px;
    background: var(--teal-soft); color: var(--teal-mid); border: 1px solid #bdd9df;
  }

  /* ---------- fetch-by switch ---------- */
  .pd-fetchby { display: flex; gap: 18px; margin: 0 0 10px; }
  .pd-fetchby label {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; font-weight: 700; color: #000000; cursor: pointer; margin: 0;
  }
  .pd-fetchby input { accent-color: var(--brand); }

  /* ---------- lookup ---------- */
  .wo-search-flex { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
  .wo-input-box { flex: 0 1 320px; min-width: 220px; }

  /* ---------- Inputs & Labels ---------- */
  .field-3d-wrapper { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .label-3d {
    font-size: 11px; font-weight: 700; color: #000000; letter-spacing: 0.3px; text-transform: uppercase;
    display: flex; justify-content: space-between; align-items: center; margin: 0;
  }
  .input-inset-3d, .select-inset-3d, .textarea-inset-3d {
    width: 100%; padding: 8px 12px; border-radius: 6px;
    border: 1px solid var(--field-line); background: #ffffff;
    font-family: inherit; font-size: 13.5px; font-weight: 600; color: #000000; outline: none; box-sizing: border-box;
    box-shadow: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .textarea-inset-3d { resize: vertical; line-height: 1.35; }
  .select-inset-3d { cursor: pointer; }
  .input-inset-3d:focus, .select-inset-3d:focus, .textarea-inset-3d:focus {
    border-color: var(--teal-mid);
    box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.18);
  }
  .input-inset-3d[readonly], .textarea-inset-3d[readonly] {
    background: #f3f4f6;
    color: #1f2937; border-color: var(--line); cursor: not-allowed;
    font-weight: 700;
  }
  .input-inset-3d::placeholder { color: #6b7280; font-weight: 400; }
  .dm-muted { color: #374151; }

  .dm-tat-late  { border-color: #f3c1c1 !important; color: #b42323 !important; font-weight: 800 !important; background: #fdecec !important; }
  .dm-tat-early { border-color: #b7e4d0 !important; color: #167a52 !important; font-weight: 800 !important; background: #e4f6ee !important; }
  .dm-tat-ontime{ border-color: #bdd9df !important; }

  /* ---------- Buttons ---------- */
  .push-btn-3d {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 9px 18px; border-radius: 6px; font-family: inherit; font-size: 13px; font-weight: 600;
    border: 1px solid transparent; cursor: pointer; outline: none; user-select: none; white-space: nowrap;
    transition: all 0.15s ease;
  }
  .push-btn-3d:disabled { opacity: 0.5; cursor: not-allowed; }
  .push-btn-primary {
    color: #ffffff; text-shadow: none;
    background: var(--brand); border-color: var(--brand);
    box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
  }
  .push-btn-primary:hover:not(:disabled) { background: var(--brand-dark); border-color: var(--brand-dark); }
  .push-btn-teal {
    color: #ffffff; background: var(--teal); border-color: var(--teal);
  }
  .push-btn-teal:hover:not(:disabled) { background: #072a33; border-color: #072a33; }
  .push-btn-green {
    color: #ffffff; background: var(--ok); border-color: var(--ok);
  }
  .push-btn-green:hover:not(:disabled) { background: #187d55; border-color: #187d55; }
  .push-btn-gray {
    color: #000000; background: #ffffff; border-color: var(--field-line);
  }
  .push-btn-gray:hover:not(:disabled) { background: #f3f4f6; }
  .push-btn-hero-save {
    width: 100%; max-width: 260px; padding: 10px 18px; font-size: 13.5px; color: #ffffff;
    background: var(--brand); border-color: var(--brand);
    box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
  }
  .push-btn-hero-save:hover { background: var(--brand-dark); border-color: var(--brand-dark); }
  .push-btn-edit-mode { background: var(--teal); border-color: var(--teal); }
  .push-btn-edit-mode:hover { background: #072a33 !important; border-color: #072a33 !important; }

  /* ---------- Filters ---------- */
  .pd-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 14px; }
  .pd-filters .field-3d-wrapper { width: 170px; }

  /* ---------- Table ---------- */
  .table-scroll-container-3d {
    width: 100%; overflow: auto; border-radius: 8px; border: 1px solid var(--line); background: #fff;
    box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
  }
  .colorful-3d-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; min-width: 1100px; background: #ffffff; margin: 0; }
  .colorful-3d-table thead th {
    position: sticky; top: 0; z-index: 3;
    background: #dbe5ed !important;
    color: #000000 !important;
    padding: 11px 8px; text-align: center; font-weight: 700; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.4px;
    border-bottom: 1px solid #b2c4d4 !important;
    border-right: 1px solid #b2c4d4 !important;
    white-space: nowrap;
  }
  .colorful-3d-table tbody td {
    padding: 8px 8px; text-align: center; vertical-align: middle;
    border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;
    font-weight: 600; color: #000000 !important; background: #ffffff;
  }
  .colorful-3d-table tbody tr:nth-child(even) td { background: #fafbfc; }
  .colorful-3d-table tbody tr:hover td { background: var(--brand-soft); }

  .reel-tag-3d {
    display: inline-block; white-space: nowrap; padding: 3px 9px; border-radius: 4px; font-weight: 700; color: #000000;
    background: var(--teal-soft); border: 1px solid #bdd9df;
  }
  .btn-table-action-3d {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 5px;
    font-family: inherit; font-size: 11.5px; font-weight: 700; border: 1px solid transparent; cursor: pointer; transition: all 0.15s ease;
  }
  .btn-table-action-3d.edit { background: #ffffff; color: var(--teal-mid); border-color: var(--teal-mid); }
  .btn-table-action-3d.edit:hover { background: var(--teal-mid); color: #ffffff; }
  .btn-table-action-3d.delete { background: #fdecec; color: #b42323; border-color: #f3c1c1; }
  .btn-table-action-3d.delete:hover { background: #f9d4d4; }

  /* ---------- Split form: teal left, white right ---------- */
  .pd-split {
    display: grid; grid-template-columns: minmax(320px, 34%) 1fr;
    border-radius: 8px; overflow: hidden; margin-bottom: 12px; background: #ffffff;
    border: 1px solid var(--line);
    box-shadow: 0 2px 8px rgba(16, 24, 40, 0.07);
  }
  .pd-split-left {
    position: relative; overflow: hidden; padding: 16px 20px 14px; color: #ffffff;
    background: linear-gradient(170deg, #0b3a45 0%, #0f5560 100%);
  }
  .pd-left-brand { display: inline-flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #ffb59c; }
  .pd-left-hero { margin: 8px 0 6px; }
  .pd-left-kicker { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #c9dde1; }
  .pd-left-big { font-size: 32px; font-weight: 700; line-height: 1.05; letter-spacing: -1px; word-break: break-all; }
  .pd-left-sub { margin-top: 2px; font-size: 13px; font-weight: 500; color: #c9dde1; }
  .pd-left-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
  .pd-lchip {
    font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 4px;
    background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.28); color: #fff;
  }
  .pd-lchip.ok { background: rgba(31, 157, 107, 0.35); border-color: rgba(120, 220, 175, 0.5); }
  .pd-lchip.warn { background: rgba(228, 87, 46, 0.35); border-color: rgba(255, 181, 156, 0.55); }
  .pd-left-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
  .pd-lrow { display: flex; align-items: flex-start; gap: 9px; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.14); }
  .pd-lrow.wide { grid-column: span 2; }
  .pd-licon {
    flex: 0 0 26px; width: 26px; height: 26px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center; color: #ffb59c;
    background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18);
  }
  .pd-licon svg { width: 13px; height: 13px; }
  .pd-lbody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .pd-llabel { font-size: 9px; font-weight: 600; text-transform: uppercase; color: #9fc0c7; }
  .pd-lvalue { font-size: 12.5px; font-weight: 600; color: #ffffff; word-break: break-word; }

  .pd-split-right { background: #ffffff; padding: 14px 22px 16px; }
  .pd-right-title { margin: 0; font-size: 16px; font-weight: 800; color: #000000; }
  .pd-right-rule { height: 1px; margin: 6px auto 2px; width: 100%; background: var(--line); }
  .pd-sub-head {
    margin: 10px 0 6px; font-size: 12px; font-weight: 800; color: #000000;
    padding-left: 8px; border-left: 3px solid var(--brand);
  }
  .pd-form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px; }
  .pd-span-2 { grid-column: span 2; }
  .pd-actions { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 14px; }

  @media (max-width: 1100px) {
    .pd-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 900px) {
    .pd-split { grid-template-columns: 1fr; }
    .pd-split-right { padding: 16px 14px; }
  }
  @media (max-width: 600px) {
    .pd-form-grid { grid-template-columns: 1fr; }
    .pd-span-2 { grid-column: span 1; }
  }

  /* =====================================================================
     page entrance animation (css only, same as Production page)
     ===================================================================== */
  @keyframes pgfadeup {
    from { opacity: 0; transform: translatey(18px); }
    to   { opacity: 1; transform: translatey(0); }
  }
  @keyframes pgpop {
    from { opacity: 0; transform: translatey(16px) scale(0.98); }
    to   { opacity: 1; transform: translatey(0) scale(1); }
  }
  @keyframes pgslideright {
    from { opacity: 0; transform: translatex(-18px); }
    to   { opacity: 1; transform: translatex(0); }
  }
  @keyframes pgfade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pgrow {
    from { opacity: 0; transform: translatey(8px); }
    to   { opacity: 1; transform: translatey(0); }
  }

  .pd-root { animation: pgfade 0.45s ease-out backwards; }
  .pd-root .pd-glass { animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.12s backwards; }
  .pd-root .pd-split { animation: pgpop 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s backwards; }
  .pd-root .pd-split-left { animation: pgslideright 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards; }
  .pd-root .pd-split-right .pd-right-title,
  .pd-root .pd-split-right .pd-sub-head,
  .pd-root .pd-split-right .pd-form-grid,
  .pd-root .pd-split-right .pd-actions {
    animation: pgfadeup 0.45s ease-out backwards;
  }
  .pd-root .pd-split-right .pd-right-title { animation-delay: 0.25s; }
  .pd-root .pd-split-right .pd-sub-head    { animation-delay: 0.30s; }
  .pd-root .pd-split-right .pd-form-grid   { animation-delay: 0.36s; }
  .pd-root .pd-split-right .pd-actions     { animation-delay: 0.50s; }
  .pd-root .pd-split ~ .pd-glass { animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.35s backwards; }

  .pd-root .colorful-3d-table tbody tr { animation: pgrow 0.35s ease-out backwards; }
  .pd-root .colorful-3d-table tbody tr:nth-child(1)  { animation-delay: 0.50s; }
  .pd-root .colorful-3d-table tbody tr:nth-child(2)  { animation-delay: 0.55s; }
  .pd-root .colorful-3d-table tbody tr:nth-child(3)  { animation-delay: 0.60s; }
  .pd-root .colorful-3d-table tbody tr:nth-child(4)  { animation-delay: 0.65s; }
  .pd-root .colorful-3d-table tbody tr:nth-child(5)  { animation-delay: 0.70s; }
  .pd-root .colorful-3d-table tbody tr:nth-child(6)  { animation-delay: 0.75s; }
  .pd-root .colorful-3d-table tbody tr:nth-child(7)  { animation-delay: 0.80s; }
  .pd-root .colorful-3d-table tbody tr:nth-child(8)  { animation-delay: 0.85s; }
  .pd-root .colorful-3d-table tbody tr:nth-child(n+9) { animation-delay: 0.90s; }

  @media (prefers-reduced-motion: reduce) {
    .pd-root, .pd-root * { animation: none !important; }
  }
`}</style>

<div className="pd-shell">


{/* WORK ORDER CARD */}

<section className="pd-glass">

<div className="card-heading-row">
  <div className="heading-with-icon">
    <div className="heading-icon-badge">
      <IconSearch />
    </div>
    <h2>Search Work Order / Ticket</h2>
  </div>
  <span className="section-pill-tag">Step 1</span>
</div>

<div className="pd-fetchby">
  <label>
    <input type="radio" checked={fetchBy === "wo"} onChange={() => switchFetchBy("wo")} />
    Work Order No
  </label>
  <label>
    <input type="radio" checked={fetchBy === "ticket"} onChange={() => switchFetchBy("ticket")} />
    Ticket ID (Out Source)
  </label>
</div>

<div className="wo-search-flex">
  {fetchBy === "wo" ? (
    <div className="wo-input-box field-3d-wrapper">
      <label className="label-3d">Work Order Number</label>
      <input
        type="number"
        name="efiWoNumber"
        value={form.efiWoNumber}
        onChange={handleChange}
        placeholder="Enter WO Number (e.g. 104523)"
        className="input-inset-3d"
      />
    </div>
  ) : (
    <div className="wo-input-box field-3d-wrapper">
      <label className="label-3d">Ticket ID</label>
      <input
        type="text"
        name="ticketNo"
        value={form.ticketNo}
        onChange={handleChange}
        placeholder="e.g. OS_01"
        className="input-inset-3d"
      />
    </div>
  )}

  {fetchLocOptions.length > 1 && (
    <div className="wo-input-box field-3d-wrapper">
      <label className="label-3d">Select Location</label>
      <select
        className="select-inset-3d"
        key={`${fetchBy}-${form.efiWoNumber || form.ticketNo}-${fetchLocOptions.length}`}
        value={fetchLocation}
        onChange={(e) => {
          const v = e.target.value;
          setFetchLocation(v);
          if (v) (fetchBy === "wo" ? fetchWorkOrder(v) : fetchByTicket(v));
        }}
      >
        <option value="">Select Location</option>
        {fetchLocOptions.map((l) => (
          <option key={l.key} value={l.key}>
            {locations.find((x) => String(x._id) === String(l.location))?.locationName || l.location} (Qty: {l.qty})
          </option>
        ))}
      </select>
    </div>
  )}

  <button
    className="push-btn-3d push-btn-primary"
    type="button"
    onClick={() => (fetchBy === "wo" ? fetchWorkOrder("") : fetchByTicket(""))}>
    <IconSearch width={14} height={14} /> Fetch Details
  </button>
</div>
</section>


{/* SPLIT FORM: teal = fetched Work Order, white = dispatch entry */}
{form.customer && (

<form className="pd-split" onSubmit={handleSubmit}>

  {/* LEFT: FETCHED WORK ORDER */}
  <aside className="pd-split-left">
    <div className="pd-left-brand">
      <IconTruck /> <span>Work Order</span>
    </div>

    <div className="pd-left-hero">
      <div className="pd-left-kicker">{form.ticketNo ? "Active Ticket" : "Active WO"}</div>
      <div className="pd-left-big">#{form.efiWoNumber || form.ticketNo}</div>
      <div className="pd-left-sub">{form.customer}</div>
    </div>

    <div className="pd-left-chips">
      <span className="pd-lchip ok">Verified Record</span>
      {editingId && <span className="pd-lchip warn">Editing</span>}
      {form.splitLocation && (
        <span className="pd-lchip">
          {locations.find((x) => String(x._id) === String(form.splitLocation).split("#")[0])?.locationName || form.splitLocation}
        </span>
      )}
    </div>

    <div className="pd-left-list">
      <div className="pd-lrow wide">
        <span className="pd-licon"><IconBox /></span>
        <div className="pd-lbody">
          <span className="pd-llabel">Product Name</span>
          <span className="pd-lvalue">{form.productName}</span>
        </div>
      </div>

      <div className="pd-lrow">
        <span className="pd-licon"><IconHash /></span>
        <div className="pd-lbody">
          <span className="pd-llabel">PO No</span>
          <span className="pd-lvalue">{form.purchaseOrderNo || "-"}</span>
        </div>
      </div>

      <div className="pd-lrow">
        <span className="pd-licon"><IconTruck /></span>
        <div className="pd-lbody">
          <span className="pd-llabel">Product Type</span>
          <span className="pd-lvalue">{form.productType || "-"}</span>
        </div>
      </div>

    </div>
  </aside>

  {/* RIGHT: ENTRY FIELDS */}
  <section className="pd-split-right">
    <h2 className="pd-right-title">Dispatch Entry</h2>
    <div className="pd-right-rule"></div>

    {editingId && (
      <div className="pd-edit-chip">✎ Editing dispatch {form.efiWoNumber || form.ticketNo}</div>
    )}

    <div className="pd-sub-head">Dispatch Details</div>

    <div className="pd-form-grid">

      <div className="field-3d-wrapper">
        <label className="label-3d">Total Order Qty</label>
        <input value={form.totalQty} className="input-inset-3d" readOnly />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Dispatch Qty</label>
        <input
          type="text"
          name="dispatchQty"
          value={form.dispatchQty}
          onChange={handleChange}
          className="input-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Balance Qty to dispatch</label>
        <input value={form.balanceQty} className="input-inset-3d" readOnly />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Extra Qty</label>
        <input
          type="number"
          min={0}
          name="extraQty"
          value={form.extraQty}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "-" || e.key === "+" || e.key === "e") {
              e.preventDefault();
              showAlert("Negative values are not allowed","error");
            }
          }}
          className="input-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Expected Delivery</label>
        <input
          type="date"
          value={form.expectedDeliveryDate}
          className="input-inset-3d"
          readOnly
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Dispatch Date</label>
        <input
          type="date"
          name="dispatchDate"
          value={form.dispatchDate}
          onChange={handleChange}
          className="input-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">TAT</label>
        <input
          value={form.delayLabel}
          className={`input-inset-3d ${
            form.delayDays > 0
              ? "dm-tat-late"
              : form.delayDays < 0
              ? "dm-tat-early"
              : "dm-tat-ontime"
          }`}
          readOnly
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Transportation</label>
        <select
          name="courier"
          value={form.courier}
          onChange={handleChange}
          className="select-inset-3d"
          required={fetchBy === "wo"}>
          <option value="">Select Transportation</option>
          {transportations.map(t=>(
            <option key={t._id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Vehicle Number</label>
        <input
          name="trackingNumber"
          value={form.trackingNumber}
          onChange={handleChange}
          className="input-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Invoice No</label>
        <input
          name="invoiceNo"
          value={form.invoiceNo}
          onChange={handleChange}
          className="input-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Invoice Date</label>
        <input
          type="date"
          name="invoiceDate"
          value={form.invoiceDate}
          onChange={handleChange}
          className="input-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">Location</label>
        <select
          name="location"
          value={form.location}
          onChange={handleChange}
          className="select-inset-3d"
        >
          <option value="">Select Location</option>
          {locations.map((loc) => (
            <option key={loc._id} value={loc._id.toString()}>
              {loc.locationName}
            </option>
          ))}
        </select>
      </div>

      <div className="field-3d-wrapper pd-span-2">
        <label className="label-3d">Delivery Address</label>
        <textarea
          rows="2"
          name="deliveryAddress"
          value={form.deliveryAddress}
          onChange={handleChange}
          readOnly={form.location !== ""}
          className="textarea-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper pd-span-2">
        <label className="label-3d">Remarks</label>
        <textarea
          rows="2"
          name="remarks"
          value={form.remarks}
          onChange={handleChange}
          className="textarea-inset-3d"
        />
      </div>

    </div>

    <div className="pd-form-grid" style={{ marginTop: 8 }}>

      <div className="field-3d-wrapper">
        <label className="label-3d">No. of Packets</label>
        <input
          type="text"
          name="noOfPackets"
          value={form.noOfPackets}
          onChange={handleChange}
          className="input-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper">
        <label className="label-3d">No. of Boxes</label>
        <input
          type="text"
          name="noOfBoxes"
          value={form.noOfBoxes}
          onChange={handleChange}
          className="input-inset-3d"
        />
      </div>

      <div className="field-3d-wrapper pd-span-2">
        <label className="label-3d">Attachment</label>
        <input
          key={fileInputKey}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
          className="input-inset-3d"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            if (f && f.size > 50 * 1024 * 1024) {
              showAlert("File must be 50 MB or smaller", "warning");
              resetAttachment();
              return;
            }
            setAttachmentFile(f);
          }}
        />
        {editingId && form.attachment && !attachmentFile && (
          <small className="dm-muted">
            Current:{" "}
            <a href={`${BASE_URL}${form.attachment}`} target="_blank" rel="noreferrer">
              {form.attachmentName || "View file"}
            </a>{" "}
            (choose a new file to replace it)
          </small>
        )}
      </div>

    </div>

    <div className="pd-actions">
      <button
        className={`push-btn-3d push-btn-hero-save ${editingId ? "push-btn-edit-mode" : ""}`}
        type="submit"
      >
        {editingId ? <IconEdit /> : <IconSave />}
        <span>{editingId ? "Update" : "Save"}</span>
      </button>
    </div>
  </section>

</form>
)}

{/* FILTERS */}

<section className="pd-glass">

<div className="card-heading-row">
  <div className="heading-with-icon">
    <div className="heading-icon-badge">
      <IconFilter />
    </div>
    <h2>Filters</h2>
  </div>
</div>

<div className="pd-filters">

<div className="field-3d-wrapper">
<label className="label-3d">WO Number</label>
<input
type="text"
name="woNumber"
value={filters.woNumber}
onChange={handleFilterChange}
placeholder="Search WO / Ticket"
className="input-inset-3d"
/>
</div>

<div className="field-3d-wrapper">
<label className="label-3d">Customer</label>
<select
name="customer"
value={filters.customer}
onChange={handleFilterChange}
className="select-inset-3d"
>
<option value="">All Customers</option>

{uniqueCustomers.map((customer, index) => (
  <option key={index} value={customer}>
    {customer}
  </option>
))}

</select>
</div>
<div className="field-3d-wrapper">
<label className="label-3d">Dispatch Date</label>
<input
type="date"
name="dispatchDate"
value={filters.dispatchDate}
onChange={handleFilterChange}
className="input-inset-3d"
/>
</div>

<div className="field-3d-wrapper">
<label className="label-3d">From Date</label>
<input
type="date"
name="fromDate"
value={filters.fromDate}
max={filters.toDate || undefined}
onChange={handleFilterChange}
className="input-inset-3d"
/>
</div>

<div className="field-3d-wrapper">
<label className="label-3d">To Date</label>
<input
type="date"
name="toDate"
value={filters.toDate}
min={filters.fromDate || undefined}
onChange={handleFilterChange}
className="input-inset-3d"
/>
</div>

<div className="field-3d-wrapper">
  <label className="label-3d">User Location</label>
  <select
    className="select-inset-3d"
    value={locationFilter}
    onChange={(e) => setLocationFilter(e.target.value)}
  >
    <option value="">All Locations</option>
    {locationOptions.map((loc, i) => (
      <option key={i} value={loc}>
        {
          locations.find(l => l._id === loc)?.locationName || loc
        }
      </option>
    ))}
  </select>
</div>

<button
className="push-btn-3d push-btn-gray"
onClick={() => {
  setFilters({
    woNumber: "",
    customer: "",
    dispatchDate: "",
    fromDate: "",
    toDate: ""
  });
  setLocationFilter(""); // ✅ ADD THIS
}}
>
Clear
</button>

<button
className="push-btn-3d push-btn-green"
onClick={exportExcel}
>
Export Excel
</button>

<input
  id="dm-import-input"
  type="file"
  accept=".xlsx,.xls"
  style={{ display: "none" }}
  onChange={handleImportExcel}
/>

<button
  type="button"
  className="push-btn-3d push-btn-teal"
  onClick={() => document.getElementById("dm-import-input").click()}
>
  Import Excel
</button>



</div>

</section>

{/* DISPATCH TABLE */}

<section className="pd-glass">

<div className="card-heading-row">
  <div className="heading-with-icon">
    <div className="heading-icon-badge">
      <IconList />
    </div>
    <h2>Dispatch Records</h2>
  </div>
</div>

  <div className="table-scroll-container-3d" style={{ maxHeight: "350px", overflowY: "auto" }}>
      <table className="colorful-3d-table">
<thead>
      <tr>
        <th>WO / Ticket</th>
        <th>PO No</th> 
        <th>Order Date</th>
        <th>Customer</th>
        <th>Product name</th>
        <th>Product Type</th>
        <th>Total Order Qty</th>
        <th>Dispatch Qty</th>
        <th>Balance Qty to dispatch</th>
        <th>Extra Qty</th>
        <th>Dispatch Date</th>
        <th>Expected</th>
        <th>TAT</th>
        <th>Courier</th>
        <th>Vehicle No</th>
        <th>Invoice No</th>
<th>Invoice Date</th>
     <th>Location</th>
        <th>Address</th>
        <th>Remarks</th>
        <th>Packets</th>
        <th>Boxes</th>
        <th>Attachment</th>
        <th>User</th>
        <th>User location</th>
        <th>Action</th>
      </tr>
    </thead>

 
      <tbody>
        {filteredDispatchList
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 30)
          .map((d) => (
            <tr key={d._id}>
              <td><span className="reel-tag-3d">{d.efiWoNumber || d.ticketNo}</span></td>
              <td>{d.purchaseOrderNo || "-"}</td> 
           <td>
{d.poDate ? new Date(d.poDate).toLocaleDateString("en-IN") : "-"}
</td>
              <td>{d.customer}</td>
              <td
  style={{
    cursor: "pointer",
    maxWidth: "250px",
    whiteSpace: expandedCell === `product-${d._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `product-${d._id}` ? null : `product-${d._id}`
    )
  }
>
  {expandedCell === `product-${d._id}`
    ? d.productName
    : truncateText(d.productName)}
</td>
              <td>{d.productType || "-"}</td>
              <td>{d.totalQty}</td>
              <td>{d.dispatchQty}</td>
              <td>{d.balanceQty}</td>
              <td>{d.extraQty || 0}</td>
              <td>{d.dispatchDate}</td>
              <td>{d.expectedDeliveryDate}</td>
<td>
{d.delayDays === 0
? "On Time"
: d.delayDays > 0
? `${d.delayDays} days delay`
: `${Math.abs(d.delayDays)} days early`}
</td>
              <td
  style={{
    cursor: "pointer",
    maxWidth: "160px",
    whiteSpace: expandedCell === `courier-${d._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `courier-${d._id}` ? null : `courier-${d._id}`
    )
  }
>
  {expandedCell === `courier-${d._id}`
    ? d.courier
    : truncateText(d.courier)}
</td>
              <td>{d.trackingNumber}</td>
              <td>{d.invoiceNo}</td>
              <td>{d.invoiceDate}</td>
            <td>
  {locations.find(
    loc => loc._id.toString() === d.location?.toString()
  )?.locationName || "-"}
</td>
              <td
  style={{
    cursor: "pointer",
    maxWidth: "220px",
    whiteSpace: expandedCell === `address-${d._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `address-${d._id}` ? null : `address-${d._id}`
    )
  }
>
  {expandedCell === `address-${d._id}`
    ? d.deliveryAddress
    : truncateText(d.deliveryAddress)}
</td>
              <td
  style={{
    cursor: "pointer",
    maxWidth: "200px",
    whiteSpace: expandedCell === `remarks-${d._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `remarks-${d._id}` ? null : `remarks-${d._id}`
    )
  }
>
  {expandedCell === `remarks-${d._id}`
    ? d.remarks
    : truncateText(d.remarks)}
</td>

<td>{d.noOfPackets ?? 0}</td>
<td>{d.noOfBoxes ?? 0}</td>
<td>
  {d.attachment ? (
    <a
      href={`${BASE_URL}${d.attachment}`}
      target="_blank"
      rel="noreferrer"
      title={d.attachmentName}
    >
      View
    </a>
  ) : (
    "-"
  )}
</td>
         <td
  style={{ cursor: "pointer", maxWidth: "170px" }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `user-${d._id}` ? null : `user-${d._id}`
    )
  }
>
  {expandedCell === `user-${d._id}` ? (
    <div style={{ lineHeight: "1.2" }}>
      <div>{d.enteredBy}</div>
      <small className="dm-muted">
        {d.createdAt
          ? new Date(d.createdAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })
          : "-"}
      </small>
    </div>
  ) : (
    <span>
      {truncateText(d.enteredBy, 6)}
    </span>
  )}
</td>

<td>
  {d.userLocations && d.userLocations.length > 0
    ? d.userLocations
        .map(locId => {
          const loc = locations.find(l => l._id === locId);
          return loc ? loc.locationName : locId;
        })
        .join(", ")
    : "-"}
</td>
          <td>
  {isAdmin ? (
    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
      <button
        type="button"
        className="btn-table-action-3d edit"
        onClick={() => handleEdit(d)}
      >
        <IconEdit /> Edit
      </button>

      <button
        type="button"
        className="btn-table-action-3d delete"
        onClick={() => handleDelete(d._id)}
      >
        <IconTrash /> Del
      </button>
    </div>
  ) : (
    "-"
  )}
</td>
            </tr>
          ))}
      </tbody>
    </table>
  </div>
</section>

</div>
</div>
);
}