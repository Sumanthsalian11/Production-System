import { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import * as XLSX from "xlsx";
 import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import { saveAs } from "file-saver";
  import BASE_URL from "../config/api";

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

<div className="container mt-2 " style={{maxWidth:"1150px",fontSize:"14px",background: "#f2fbfb",border:"2px solid black",borderRadius:"20px"}}>

<h1 className="text-center mb-4 mt-2"><b>Dispatch Entry</b></h1>


{/* WORK ORDER CARD */}

<div className="card shadow-lg mb-4 p-3" style={{border:"2px solid black",borderRadius:"10px", background: "#bfeeec9c", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}>

<div className="row g-3">

<div className="col-md-9">

<label className="form-label text-black">Work Order Number</label>

<input
type="number"
name="efiWoNumber"
value={form.efiWoNumber}
onChange={handleChange}
className="form-control border-dark"
/>

</div>
 <div className="col-md-2 d-flex align-items-end">
<button
className="btn btn-primary w-100"
type="button"
onClick={fetchWorkOrder}>
Fetch Details
</button>

</div>

</div>
</div>


{/* WO SUMMARY */}

{form.customer && (

<div className="card shadow-sm mb-4" style={{background: "#bfeeec9c", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}>

<h6 className="mb-0 fw-bold text-black text-center">
Work Order Summary
</h6>


<div className="card-body">

 <div className="row g-3">

  <div className="col-md-3">
    <div className="border rounded p-2 bg-light">
      <small className="text-black">Customer Name:</small>
      <div className="fw-semibold">{form.customer}</div>
    </div>
  </div>

  <div className="col-md-5">
    <div className="border rounded p-2 bg-light">
      <small className="text-black">Product Name:</small>
      <div className="fw-semibold">{form.productName}</div>
    </div>
  </div>
  <div className="col-md-3">
    <div className="border rounded p-2 bg-light">
      <small className="text-black">Po No:</small>
      <div className="fw-semibold">{form.purchaseOrderNo}</div>
    </div>
  </div>

  </div>
  </div>  
  </div>
)}



{/* DISPATCH FORM */}
{form.customer && (

<form
className="card p-3"
onSubmit={handleSubmit}
style={{background: "#c7efec5e",boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}
>

  <h6 className="mb-3 fw-bold text-black text-center">
Dispatch Entry
</h6>
<div className="card shadow-lg mb-3 mt-0 " style={{background: "#c7efec", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}>


<div className="row g-3">

<div className="col-md-2">

<label className="form-label text-black">Total Order Qty</label>

<input
value={form.totalQty}
className="form-control border-dark"
readOnly
/>

</div>

<div className="col-md-2">

<label className="form-label text-black">Dispatch Qty</label>

<input
type="text"
name="dispatchQty"
value={form.dispatchQty}
onChange={handleChange}
className="form-control border-dark"
/>

</div>

<div className="col-md-2">

<label className="form-label text-black">Balance Qty to dispatch</label>

<input
value={form.balanceQty}
className="form-control border-dark"
readOnly
/>

</div>

<div className="col-md-2">
  <label className="form-label text-black">Extra Qty</label>
  <input
    type="number"
    min={0}
    name="extraQty"
    value={form.extraQty}
    onChange={handleChange}
     onKeyDown={(e) => {
              if (e.key === "-" ||e.key === "+" || e.key === "e") {
                e.preventDefault();
                showAlert("Negative values are not allowed","error");
              }
            }}
    className="form-control border-dark"
  />
</div>
<div className="col-md-2">

<label className="form-label text-black">Expected Delivery</label>

<input
type="date"
value={form.expectedDeliveryDate}
className="form-control border-dark"
readOnly
/>

</div>

<div className="col-md-2">

<label className="form-label text-black">Dispatch Date</label>

<input
type="date"
name="dispatchDate"
value={form.dispatchDate}
onChange={handleChange}
className="form-control border-dark"
/>

</div>
<div className="col-md-2">

<label className="form-label text-black">TAT</label>
<input
value={form.delayLabel}
className={`form-control ${
form.delayDays > 0
? "border-danger text-danger fw-bold"
: form.delayDays < 0
? "border-success text-success fw-bold"
: "border-primary"
}`}
readOnly
/>

</div>

<div className="col-md-3">

<label className="form-label text-black">Transportation</label>

<select
name="courier"
value={form.courier}
onChange={handleChange}
className="form-select border-dark"
required>

<option value="">Select Transportation</option>

{transportations.map(t=>(
<option key={t._id} value={t.name}>{t.name}</option>
))}

</select>

</div>


<div className="col-md-2">

<label className="form-label text-black">Tracking Number</label>

<input
name="trackingNumber"
value={form.trackingNumber}
onChange={handleChange}
className="form-control border-dark"
/>

</div>
<div className="col-md-2">
<label className="form-label text-black">Invoice No</label>
<input
name="invoiceNo"
value={form.invoiceNo}
onChange={handleChange}
className="form-control border-dark"
/>
</div>

<div className="col-md-2">
<label className="form-label text-black">Invoice Date</label>
<input
type="date"
name="invoiceDate"
value={form.invoiceDate}
onChange={handleChange}
className="form-control border-dark"
/>
</div>

<div className="col-md-2">
  <label className="form-label text-black">Location</label>

  <select
    name="location"
    value={form.location}
    onChange={handleChange}
    className="form-select border-dark"
  >
    <option value="">Select Location</option>

    {locations.map((loc) => (
      <option key={loc._id} value={loc._id.toString()}>
  {loc.locationName}
</option>
    ))}
  </select>
</div>

<div className="col-md-4 ">

<label className="form-label text-black">Delivery Address</label>

<textarea
  rows="2"
  name="deliveryAddress"
  value={form.deliveryAddress}
  readOnly={form.location !== ""}
  className="form-control border-dark"
/>

</div>



<div className="col-md-4">

<label className="form-label text-black">Remarks</label>

<textarea
name="remarks"
value={form.remarks}
onChange={handleChange}
className="form-control border-dark"
/>

</div>

<div className="col-md-10 d-flex justify-content-center mt-3">
  <button className="btn btn-success px-4" type="submit">
    {editingId ? "Update" : "Save"}
  </button>
</div>
</div>
</div>
</form>
)}

{/* FILTERS */}

<div className="card mt-4 p-3"style={{background: "#c7efec",boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"}}>

<h6 className="fw-bold mb-3 text-center">Filters</h6>

<div className="row g-0">

<div className="col-md-2">
<label className="form-label text-black">WO Number</label>
<input
type="text"
name="woNumber"
value={filters.woNumber}
onChange={handleFilterChange}
placeholder="Search WO"
className="form-control border-dark"
/>
</div>

<div className="col-md-2">
<label className="form-label text-black">Customer</label>
<select
name="customer"
value={filters.customer}
onChange={handleFilterChange}
className="form-select border-dark"
>
<option value="">All Customers</option>

{uniqueCustomers.map((customer, index) => (
  <option key={index} value={customer}>
    {customer}
  </option>
))}

</select>
</div>
<div className="col-md-2">
<label className="form-label text-black">Dispatch Date</label>
<input
type="date"
name="dispatchDate"
value={filters.dispatchDate}
onChange={handleFilterChange}
className="form-control border-dark"
/>
</div>

<div className="col-md-2">
  <label className="form-label text-black">User Location</label>
  <select
    className="form-select border-dark"
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

 <div className="col-md-1 d-flex align-items-end">
<button
className="btn btn-secondary w-100"
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
</div>
 <div className="col-md-2 d-flex align-items-end">
<button
className="btn btn-success mb-0"
onClick={exportExcel}
>
Export Excel
</button>
</div>

</div>

</div>

{/* DISPATCH TABLE */}

<div className="card mt-4 shadow-lg" style={{background: "#c7efec5e"}}>

<div className="card-header bg-primary text-white text-center">
<strong>Dispatch Records</strong>
</div>



  <div className="table-responsive bg-dark" style={{ maxHeight: "350px", overflowY: "auto" }}>
      <table className="table table-striped table-bordered table-hover mb-0 border-black">
<thead className="table-dark sticky-top">
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
      <small className="text-muted">
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
    <div className="d-flex gap-2">
      <button
        className="btn btn-sm btn-warning"
        onClick={() => handleEdit(d)}
      >
        Edit
      </button>

      <button
        className="btn btn-sm btn-danger"
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
);
}