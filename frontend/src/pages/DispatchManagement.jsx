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

export default function DispatchManagement() {

const [transportations, setTransportations] = useState([]);
const [dispatchList, setDispatchList] = useState([]);
const [editingId, setEditingId] = useState(null);
const [loggedInUser, setLoggedInUser] = useState("");
const [expandedCell, setExpandedCell] = useState(null);
const [originalBalance, setOriginalBalance] = useState(0);
const [locations, setLocations] = useState([]);
const [locationFilter, setLocationFilter] = useState("");
const [locationOptions, setLocationOptions] = useState([]);
const [filters, setFilters] = useState({
  woNumber: "",
  customer: "",
  dispatchDate: ""
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
efiWoNumber:"",
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

setForm({
efiWoNumber:dispatch.efiWoNumber,
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
userLocations: dispatch.userLocations || []
});

setOriginalBalance(
  Number(dispatch.balanceQty) + Number(dispatch.dispatchQty)
);
setEditingId(dispatch._id);

window.scrollTo({top:0,behavior:"smooth"});
};


// FETCH WO
const fetchWorkOrder = async () => {

if(!form.efiWoNumber){
showAlert("Please enter Work Order Number","warning");
return;
}

try{

const res = await axios.get(
  `${BASE_URL}/api/dispatch/workorder/${form.efiWoNumber}`
);

const wo = res.data;

setForm(prev => ({
...prev,
customer: wo.customer,
productName: wo.productName,
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

if (!form.courier) {
  showAlert("Transportation is required","warning");
  return;
}

if (!form.trackingNumber) {
  showAlert("Tracking Number is required","warning");
  return;
}

if (!form.deliveryAddress) {
  showAlert("Delivery Address is required","warning");
  return;
}
if(!form.extraQty)
{showAlert("Extra Qty is required","warning");
return;
} 

if (!form.remarks) {
  showAlert("Remarks is required","warning");
  return;
}
if(!loggedInUser){
showAlert("Session expired. Please login again.","warning");
return;
}



if(!form.invoiceNo)
{
   showAlert("Invoice No is required","warning");
  return;
}

const today = new Date().toISOString().split("T")[0];



try{

const payload = {
...form,
delayDays: form.delayDays,
delayLabel: form.delayLabel,
dispatchDate: form.dispatchDate
? new Date(form.dispatchDate).toISOString().split("T")[0]
: "",
enteredBy: loggedInUser,
userLocations: form.userLocations || [] 
};

if(editingId){

await axios.put(
  `${BASE_URL}/api/dispatch/${editingId}`,
  payload
);

showAlert("Dispatch Updated Successfully","success");

setEditingId(null);

}else{

await axios.post(
  `${BASE_URL}/api/dispatch/create`,
  payload
);

showAlert("Dispatch Created Successfully","success");

}

setForm({
efiWoNumber:"",
customer:"",
productName:"",
totalQty:"",
dispatchQty:"",
balanceQty:"",
dispatchDate:"",
expectedDeliveryDate:"",
delayDays:"",
delayLabel:"",
courier:"",
trackingNumber:"",
invoiceNo:"",
invoiceDate:"",
location:"",
deliveryAddress:"",
remarks:"",
enteredBy:""
});

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
"Work Order": item.efiWoNumber,
"Customer": item.customer,
"Product": item.productName,
"Total Qty": item.totalQty,
"Dispatch Qty": item.dispatchQty,
"Balance Qty": item.balanceQty,
"Extra Qty": item.extraQty,
"Dispatch Date": item.dispatchDate,
"Transportation": item.courier,
"Tracking Number": item.trackingNumber,
"Invoice No": item.invoiceNo,
"Invoice Date": item.invoiceDate,
"Delivery Address": item.deliveryAddress,
"User":item.enteredBy,
"Remarks": item.remarks

}));

const worksheet = XLSX.utils.json_to_sheet(excelData);

const workbook = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(workbook,worksheet,"Dispatch");

const excelBuffer = XLSX.write(workbook,{bookType:"xlsx",type:"array"});

const data = new Blob([excelBuffer],{type:"application/octet-stream"});

saveAs(data,"DispatchList.xlsx");

};


const today = new Date().toISOString().split("T")[0];

const filteredDispatchList = dispatchList.filter((item) => {
  if (
    filters.woNumber &&
    !String(item.efiWoNumber).includes(filters.woNumber)
  ) {
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

<div className="dm-wrap">
<style>{`
  /* ---------- Light aqua-glass design (same family as Reel Register) ---------- */
  .dm-wrap {
    --ink: #0b2f4f; --muted: #4a6f8c; --hint: #8fb0c8;
    min-height: 100vh;
    padding: 10px 20px 30px;
    font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
    font-size: 13px;
    color: var(--ink);
    background:
      radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 30%),
      radial-gradient(circle at 88% 18%, rgba(160, 222, 250, 0.7) 0, rgba(160, 222, 250, 0) 32%),
      radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
      linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%);
    background-attachment: fixed;
  }
  .dm-wrap * { box-sizing: border-box; }
  .dm-inner { max-width: 1500px; margin: 0 auto; }

  /* header */
  .dm-header {
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
    padding: 8px 20px; margin-bottom: 10px; border-radius: 28px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(222, 244, 254, 0.8) 100%);
    border: 1px solid rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 14px 30px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140, 210, 245, 0.2);
  }
  .dm-brand { display: flex; align-items: center; gap: 14px; }
  .dm-emblem {
    width: 40px; height: 40px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: #0a6fb8;
    background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 50%, #8fd0f0 100%);
    border: 1px solid #86c6e8;
    box-shadow: 0 6px 14px rgba(40, 120, 170, 0.22), inset 0 2px 3px rgba(255, 255, 255, 0.9);
  }
  .dm-header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.4px; color: #0a4f8c; }
  .dm-header p { margin: 0; font-size: 11.5px; font-weight: 600; color: var(--muted); }
  .dm-user-chip {
    display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 30px;
    background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%); color: #0a4f8c;
    border: 1px solid #a9d9f2; font-size: 13px; font-weight: 800;
    box-shadow: 0 4px 12px rgba(40, 120, 170, 0.15), inset 0 1px 0 #fff;
  }
  .dm-user-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; }

  /* glass card */
  .dm-card {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(228, 246, 255, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.95); border-radius: 20px;
    box-shadow: 0 14px 32px rgba(40, 120, 170, 0.16), inset 0 1px 0 #fff;
    padding: 10px 16px 12px; margin-bottom: 12px; position: relative; overflow: hidden;
  }
  .dm-pill {
    display: inline-flex; align-items: center; gap: 9px; margin: 0 0 8px;
    padding: 4px 16px 4px 12px; font-size: 11.5px; font-weight: 800; color: #0a4f8c;
    text-transform: uppercase; letter-spacing: 0.7px;
    background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%);
    border: 1px solid #a9d9f2; border-radius: 999px;
    box-shadow: 0 3px 8px rgba(40, 120, 170, 0.12), inset 0 1px 0 #fff;
  }
  .dm-pill::before {
    content: ""; width: 9px; height: 9px; border-radius: 50%;
    background: radial-gradient(circle at 30% 25%, #b6ecff, #2a9be0 70%);
    box-shadow: 0 0 0 3px rgba(42, 155, 224, 0.2);
  }

  /* lookup */
  .dm-lookup { display: flex; gap: 12px; align-items: flex-end; max-width: 620px; flex-wrap: wrap; }
  .dm-lookup .dm-field { flex: 1; min-width: 220px; }

  /* fields */
  .dm-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .dm-label { font-size: 11.5px; font-weight: 800; color: var(--ink); margin: 0 0 0 2px; }
  .dm-input, .dm-select, .dm-textarea {
    width: 100%; min-height: 34px; padding: 6px 11px;
    border: 1.5px solid #9ccbe6; border-radius: 12px; background: #fff; color: var(--ink);
    font-size: 13.5px; font-weight: 600; outline: none; font-family: inherit;
    box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1);
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .dm-textarea { resize: vertical; line-height: 1.35; }
  .dm-input:hover, .dm-select:hover, .dm-textarea:hover { border-color: #5fb4de; }
  .dm-input:focus, .dm-select:focus, .dm-textarea:focus {
    border-color: #1b9be0; box-shadow: 0 0 0 4px rgba(27, 155, 224, 0.2), 0 6px 14px rgba(27, 155, 224, 0.12);
  }
  .dm-input[readonly], .dm-textarea[readonly] {
    background: linear-gradient(180deg, #eaf7ff 0%, #d6effc 100%); color: #0a4f8c; border-color: #86c6e8; font-weight: 800;
  }
  .dm-tat-late  { border-color: #ee8f8f !important; color: #b91c1c !important; font-weight: 800 !important; background: #fff1f1 !important; }
  .dm-tat-early { border-color: #7fd3ab !important; color: #07583b !important; font-weight: 800 !important; background: #effcf5 !important; }
  .dm-tat-ontime{ border-color: #5fb4de !important; }

  /* WO info cards */
  .dm-info-grid { display: grid; grid-template-columns: 1fr 1.6fr 1fr; gap: 10px; margin-bottom: 10px; }
  .dm-info {
    display: flex; align-items: center; gap: 11px; min-width: 0; padding: 7px 12px;
    background: linear-gradient(180deg, #ffffff 0%, #f6fcff 100%);
    border: 1px solid #dcedf8; border-radius: 18px;
    box-shadow: 0 6px 16px rgba(40, 120, 170, 0.1), inset 0 1px 0 #fff;
  }
  .dm-bubble {
    width: 38px; height: 38px; border-radius: 13px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 5px 10px rgba(40, 90, 130, 0.16), inset 0 2px 3px rgba(255, 255, 255, 0.85), inset 0 -3px 5px rgba(0, 0, 0, 0.06);
  }
  .dm-bubble.lavender { background: linear-gradient(145deg, #efe7ff, #c9b8fb); color: #6d4fd6; }
  .dm-bubble.peach    { background: linear-gradient(145deg, #fff0d1, #ffc978); color: #c2650a; }
  .dm-bubble.mint     { background: linear-gradient(145deg, #dcf9ea, #8fe0b8); color: #107a4d; }
  .dm-info-text { min-width: 0; }
  .dm-info-label { font-size: 10.5px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .dm-info-value { font-size: 13.5px; font-weight: 800; color: var(--ink); word-break: break-word; }

  /* form grid (6 columns so the whole form sits on the first screen) */
  .dm-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px 12px; }
  .dm-span-3 { grid-column: span 3; }
  .dm-actions { display: flex; justify-content: center; margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(10, 111, 184, 0.35); }

  /* buttons */
  .dm-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 34px; padding: 6px 20px; border-radius: 12px; border: 1px solid transparent;
    font-size: 13px; font-weight: 800; cursor: pointer; white-space: nowrap; font-family: inherit;
    transition: all 0.15s ease;
  }
  .dm-btn:hover { transform: translateY(-1px); }
  .dm-btn:active { transform: translateY(2px); }
  .dm-btn-blue {
    background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%); color: #08406b; border-color: #7fc3e8;
    box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40, 120, 170, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
  .dm-btn-green {
    background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%); color: #07583b; border-color: #7fd3ab;
    box-shadow: 0 3px 0 #84cba9, 0 7px 12px rgba(20, 168, 112, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
  .dm-btn-gray {
    background: linear-gradient(180deg, #ffffff 0%, #dcebf5 100%); color: #34526b; border-color: #aac3d4;
    box-shadow: 0 3px 0 #b6cbd9, 0 7px 12px rgba(93, 124, 147, 0.14), inset 0 1px 0 #fff;
  }
  .dm-btn-amber {
    background: linear-gradient(180deg, #fff0c4 0%, #fcd477 100%); color: #7a4f00; border-color: #f3c35a;
    box-shadow: 0 3px 0 #e9b845, 0 7px 12px rgba(245, 158, 11, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
  .dm-btn-red {
    background: linear-gradient(180deg, #ffdcdc 0%, #f7a3a3 100%); color: #8f1414; border-color: #ee8f8f;
    box-shadow: 0 3px 0 #e08a8a, 0 7px 12px rgba(220, 38, 38, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
  .dm-btn-sm { min-height: 28px; padding: 3px 12px; font-size: 12px; border-radius: 10px; }

  /* filters */
  .dm-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 14px; }
  .dm-filters .dm-field { width: 170px; }

  /* table */
  .dm-table-wrap {
    border-radius: 18px; border: 1px solid #a9d9f2; background: #fff; overflow: auto;
    box-shadow: 0 10px 24px rgba(40, 120, 170, 0.14);
  }
  .dm-table-wrap::-webkit-scrollbar { height: 8px; width: 8px; }
  .dm-table-wrap::-webkit-scrollbar-track { background: #eaf7ff; }
  .dm-table-wrap::-webkit-scrollbar-thumb { background: #96d3f2; border-radius: 4px; }
  .dm-table { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; margin: 0; }
  .dm-table th {
    position: sticky; top: 0; z-index: 3;
    background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%); color: #08406b;
    padding: 9px 12px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.3px;
    white-space: nowrap; text-align: left; border: 1px solid #7fbfe4;
  }
  .dm-table td { padding: 7px 12px; border: 1px solid #d3e8f4; color: var(--ink); font-weight: 600; vertical-align: middle; background: #fff; }
  .dm-table tbody tr:nth-child(even) td { background: #f3faff; }
  .dm-table tbody tr:hover td { background: #d9f2fc; }
  .dm-muted { color: var(--muted); }

  /* ---------- Split form: blue (fetched WO) | white (entry) ---------- */
  .dm-split {
    display: grid; grid-template-columns: minmax(300px, 32%) 1fr;
    border-radius: 20px; overflow: hidden; margin-bottom: 12px; background: #ffffff;
    box-shadow: 0 18px 42px rgba(40, 120, 180, 0.28);
  }
  .dm-split-left {
    position: relative; overflow: hidden; padding: 16px 20px 14px; color: #ffffff;
    background: linear-gradient(170deg, #35a2ea 0%, #4f9cf0 48%, #86cbf8 100%);
  }
  .dm-split-left::before {
    content: ''; position: absolute; width: 280px; height: 280px; border-radius: 50%;
    right: -110px; top: -90px; background: rgba(255, 255, 255, 0.13);
  }
  .dm-split-left::after {
    content: ''; position: absolute; width: 220px; height: 220px; border-radius: 50%;
    left: -90px; bottom: -80px; background: rgba(255, 255, 255, 0.1);
  }
  .dm-split-left > * { position: relative; z-index: 1; }
  .dm-left-brand { display: inline-flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; }
  .dm-left-hero { margin: 8px 0 6px; }
  .dm-left-kicker { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; }
  .dm-left-big { font-size: 32px; font-weight: 900; line-height: 1.05; letter-spacing: -1px; word-break: break-all; }
  .dm-left-sub { margin-top: 2px; font-size: 13px; font-weight: 600; opacity: 0.95; }
  .dm-left-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
  .dm-lchip {
    font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 14px;
    background: rgba(255, 255, 255, 0.22); border: 1px solid rgba(255, 255, 255, 0.5); color: #fff;
  }
  .dm-lchip.ok { background: rgba(16, 185, 129, 0.35); }
  .dm-lchip.warn { background: rgba(251, 191, 36, 0.4); }
  .dm-left-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
  .dm-lrow { display: flex; align-items: flex-start; gap: 9px; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.22); }
  .dm-lrow.wide { grid-column: span 2; }
  .dm-licon {
    flex: 0 0 26px; width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: #fff;
    background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35);
  }
  .dm-licon svg { width: 13px; height: 13px; }
  .dm-lbody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .dm-llabel { font-size: 9px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: rgba(255, 255, 255, 0.8); }
  .dm-lvalue { font-size: 12.5px; font-weight: 700; color: #ffffff; word-break: break-word; }

  .dm-split-right { background: #ffffff; padding: 14px 22px 16px; }
  .dm-right-title { margin: 0; text-align: center; font-size: 15px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: #2f4156; }
  .dm-right-rule { height: 2px; margin: 6px auto 2px; width: 100%; background: linear-gradient(90deg, transparent, #cfe6f5, transparent); }
  .dm-sub-head { margin: 10px 0 6px; font-size: 12px; font-weight: 800; color: #1b8fd6; }
  .dm-edit-chip {
    display: inline-block; margin: 4px 0 0; padding: 3px 12px; font-size: 11px; font-weight: 800; border-radius: 999px;
    color: #0a4f8c; background: linear-gradient(180deg, #fff7d6, #ffe9a3); border: 1px solid #fde68a;
  }
  .dm-form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px; }
  .dm-span-2 { grid-column: span 2; }
  .dm-span-4 { grid-column: span 4; }
  .dm-split-right .dm-label { font-size: 10px; font-weight: 700; color: #5b6f82; }
  .dm-split-right .dm-input,
  .dm-split-right .dm-select,
  .dm-split-right .dm-textarea {
    border-radius: 4px; border: 1px solid #cfd9e4; box-shadow: none; padding: 7px 10px; font-size: 12.5px;
  }
  .dm-split-right .dm-input:focus,
  .dm-split-right .dm-select:focus,
  .dm-split-right .dm-textarea:focus { border-color: #35a2ea; box-shadow: 0 0 0 3px rgba(53, 162, 234, 0.18); }
  .dm-split-right .dm-input[readonly],
  .dm-split-right .dm-textarea[readonly] { background: #f1f5f9; color: #0b2f4f; border-color: #cfd9e4; font-weight: 700; }
  .dm-split-right .dm-actions { border-top: none; margin-top: 12px; padding-top: 0; }
  .dm-save { width: 100%; max-width: 340px; }

  @media (max-width: 1100px) {
    .dm-split { grid-template-columns: 1fr; }
    .dm-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dm-span-4 { grid-column: span 2; }
  }
  @media (max-width: 640px) {
    .dm-form-grid { grid-template-columns: 1fr; }
    .dm-span-2, .dm-span-4 { grid-column: span 1; }
  }

  @media (max-width: 1100px) {
    .dm-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .dm-info-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .dm-wrap { padding: 8px; }
    .dm-grid { grid-template-columns: 1fr; }
    .dm-span-3 { grid-column: span 1; }
    .dm-header { border-radius: 20px; }
  }
`}</style>

<div className="dm-inner">


{/* WORK ORDER CARD */}

<div className="dm-card">

<div className="dm-pill">Search Work Order</div>

<div className="dm-lookup">

<div className="dm-field">

<label className="dm-label">Work Order Number</label>

<input
type="number"
name="efiWoNumber"
value={form.efiWoNumber}
onChange={handleChange}
className="dm-input"
/>

</div>

<button
className="dm-btn dm-btn-blue"
type="button"
onClick={fetchWorkOrder}>
<IconSearch width={14} height={14} /> Fetch Details
</button>

</div>
</div>


{/* SPLIT FORM: blue = fetched Work Order, white = dispatch entry */}
{form.customer && (

<form className="dm-split" onSubmit={handleSubmit}>

  {/* LEFT (BLUE): FETCHED WORK ORDER */}
  <aside className="dm-split-left">
    <div className="dm-left-brand">
      <IconTruck /> <span>Work Order</span>
    </div>

    <div className="dm-left-hero">
      <div className="dm-left-kicker">Active WO</div>
      <div className="dm-left-big">#{form.efiWoNumber}</div>
      <div className="dm-left-sub">{form.customer}</div>
    </div>

    <div className="dm-left-chips">
      <span className="dm-lchip ok">Verified Record</span>
      {editingId && <span className="dm-lchip warn">Editing</span>}
    </div>

    <div className="dm-left-list">
      <div className="dm-lrow wide">
        <span className="dm-licon"><IconBox /></span>
        <div className="dm-lbody">
          <span className="dm-llabel">Product Name</span>
          <span className="dm-lvalue">{form.productName}</span>
        </div>
      </div>

      <div className="dm-lrow">
        <span className="dm-licon"><IconHash /></span>
        <div className="dm-lbody">
          <span className="dm-llabel">PO No</span>
          <span className="dm-lvalue">{form.purchaseOrderNo || "-"}</span>
        </div>
      </div>

    </div>
  </aside>

  {/* RIGHT (WHITE): ENTRY FIELDS */}
  <section className="dm-split-right">
    <h2 className="dm-right-title">Dispatch Entry</h2>
    <div className="dm-right-rule"></div>

    {editingId && (
      <div className="dm-edit-chip">✎ Editing dispatch {form.efiWoNumber}</div>
    )}

    <div className="dm-sub-head">Dispatch Details</div>

    <div className="dm-form-grid">

      <div className="dm-field">
        <label className="dm-label">Total Order Qty</label>
        <input value={form.totalQty} className="dm-input" readOnly />
      </div>

      <div className="dm-field">
        <label className="dm-label">Dispatch Qty</label>
        <input
          type="text"
          name="dispatchQty"
          value={form.dispatchQty}
          onChange={handleChange}
          className="dm-input"
        />
      </div>

      <div className="dm-field">
        <label className="dm-label">Balance Qty to dispatch</label>
        <input value={form.balanceQty} className="dm-input" readOnly />
      </div>

      <div className="dm-field">
        <label className="dm-label">Extra Qty</label>
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
          className="dm-input"
        />
      </div>

      <div className="dm-field">
        <label className="dm-label">Expected Delivery</label>
        <input
          type="date"
          value={form.expectedDeliveryDate}
          className="dm-input"
          readOnly
        />
      </div>

      <div className="dm-field">
        <label className="dm-label">Dispatch Date</label>
        <input
          type="date"
          name="dispatchDate"
          value={form.dispatchDate}
          onChange={handleChange}
          className="dm-input"
        />
      </div>

      <div className="dm-field">
        <label className="dm-label">TAT</label>
        <input
          value={form.delayLabel}
          className={`dm-input ${
            form.delayDays > 0
              ? "dm-tat-late"
              : form.delayDays < 0
              ? "dm-tat-early"
              : "dm-tat-ontime"
          }`}
          readOnly
        />
      </div>

      <div className="dm-field">
        <label className="dm-label">Transportation</label>
        <select
          name="courier"
          value={form.courier}
          onChange={handleChange}
          className="dm-select"
          required>
          <option value="">Select Transportation</option>
          {transportations.map(t=>(
            <option key={t._id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="dm-field">
        <label className="dm-label">Tracking Number</label>
        <input
          name="trackingNumber"
          value={form.trackingNumber}
          onChange={handleChange}
          className="dm-input"
        />
      </div>

      <div className="dm-field">
        <label className="dm-label">Invoice No</label>
        <input
          name="invoiceNo"
          value={form.invoiceNo}
          onChange={handleChange}
          className="dm-input"
        />
      </div>

      <div className="dm-field">
        <label className="dm-label">Invoice Date</label>
        <input
          type="date"
          name="invoiceDate"
          value={form.invoiceDate}
          onChange={handleChange}
          className="dm-input"
        />
      </div>

      <div className="dm-field">
        <label className="dm-label">Location</label>
        <select
          name="location"
          value={form.location}
          onChange={handleChange}
          className="dm-select"
        >
          <option value="">Select Location</option>
          {locations.map((loc) => (
            <option key={loc._id} value={loc._id.toString()}>
              {loc.locationName}
            </option>
          ))}
        </select>
      </div>

      <div className="dm-field dm-span-2">
        <label className="dm-label">Delivery Address</label>
        <textarea
          rows="2"
          name="deliveryAddress"
          value={form.deliveryAddress}
          readOnly={form.location !== ""}
          className="dm-textarea"
        />
      </div>

      <div className="dm-field dm-span-2">
        <label className="dm-label">Remarks</label>
        <textarea
          rows="2"
          name="remarks"
          value={form.remarks}
          onChange={handleChange}
          className="dm-textarea"
        />
      </div>

    </div>

    <div className="dm-actions">
      <button className="dm-btn dm-btn-green dm-save" type="submit">
        {editingId ? "Update" : "Save"}
      </button>
    </div>
  </section>

</form>
)}

{/* FILTERS */}

<div className="dm-card">

<div className="dm-pill">Filters</div>

<div className="dm-filters">

<div className="dm-field">
<label className="dm-label">WO Number</label>
<input
type="text"
name="woNumber"
value={filters.woNumber}
onChange={handleFilterChange}
placeholder="Search WO"
className="dm-input"
/>
</div>

<div className="dm-field">
<label className="dm-label">Customer</label>
<select
name="customer"
value={filters.customer}
onChange={handleFilterChange}
className="dm-select"
>
<option value="">All Customers</option>

{uniqueCustomers.map((customer, index) => (
  <option key={index} value={customer}>
    {customer}
  </option>
))}

</select>
</div>
<div className="dm-field">
<label className="dm-label">Dispatch Date</label>
<input
type="date"
name="dispatchDate"
value={filters.dispatchDate}
onChange={handleFilterChange}
className="dm-input"
/>
</div>

<div className="dm-field">
  <label className="dm-label">User Location</label>
  <select
    className="dm-select"
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
className="dm-btn dm-btn-gray"
onClick={() => {
  setFilters({
    woNumber: "",
    customer: "",
    dispatchDate: ""
  });
  setLocationFilter(""); // ✅ ADD THIS
}}
>
Clear
</button>

<button
className="dm-btn dm-btn-green"
onClick={exportExcel}
>
Export Excel
</button>

</div>

</div>

{/* DISPATCH TABLE */}

<div className="dm-card">

<div className="dm-pill">Dispatch Records</div>

  <div className="dm-table-wrap" style={{ maxHeight: "350px", overflowY: "auto" }}>
      <table className="dm-table">
<thead>
      <tr>
        <th>WO</th>
        <th>PO No</th> 
        <th>Order Date</th>
        <th>Customer</th>
        <th>Product name</th>
        <th>Total Order Qty</th>
        <th>Dispatch Qty</th>
        <th>Balance Qty to dispatch</th>
        <th>Extra Qty</th>
        <th>Dispatch Date</th>
        <th>Expected</th>
        <th>TAT</th>
        <th>Courier</th>
        <th>Tracking</th>
        <th>Invoice No</th>
<th>Invoice Date</th>
     <th>Location</th>
        <th>Address</th>
        <th>Remarks</th>
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
              <td>{d.efiWoNumber}</td>
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
  {d.enteredBy === loggedInUser ? (
    <div style={{ display: "flex", gap: "8px" }}>
      <button
        className="dm-btn dm-btn-sm dm-btn-amber"
        onClick={() => handleEdit(d)}
      >
        Edit
      </button>

      <button
        className="dm-btn dm-btn-sm dm-btn-red"
        onClick={() => handleDelete(d._id)}
      >
        Delete
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
</div>

</div>
</div>
);
}