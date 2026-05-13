import { useState, useEffect, useRef } from "react";
  import { useNavigate } from "react-router-dom";
  import { jwtDecode } from "jwt-decode";
  import Swal from "sweetalert2";
  import * as XLSX from "xlsx";
  import { saveAs } from "file-saver";
  import axios from "axios";
  import BASE_URL from "../config/api";

  function CustomerDashboard() {

    const navigate = useNavigate();
    const [orderCategory, setOrderCategory] = useState("Stationary");
    const [errors, setErrors] = useState({});
    const [showToast, setShowToast] = useState(false);
    const [locations, setLocations] = useState([]);
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [poSearch, setPoSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedCell, setExpandedCell] = useState(null);
  const [customerFilter, setCustomerFilter] = useState("");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loginLocation, setLoginLocation] = useState("");
  
  const [editingId, setEditingId] = useState(null);
  const [productCodeSearch, setProductCodeSearch] = useState("");
  const [attachment, setAttachment] = useState(null);
  

    const poDateRef = useRef();
    const productCodeRef = useRef();
    const quantityRef = useRef();
    const locationRef = useRef();
    const fileRef = useRef(); 
    const [loggedInUser, setLoggedInUser] = useState("");
    const token = localStorage.getItem("token");
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      const decoded = jwtDecode(token);
      setLoginLocation(decoded.location);

      console.log("Decoded User:", decoded); // debug

      setLoggedInUser(decoded.name || decoded.username);
    }
  }, []);


  const [form, setForm] = useState({
    purchaseOrderNo: "",
    poDate: "",
    expectedDeliveryDate :"",
    productCode: "",
    materialType: "",
    description: "",
    customerName: "",
    colorFront: "",
    colorBack: "",
    wasteQty: "",
    jobSize: "",
    inkDetails: "",
    quantity: "",
    location: "",
    orderType: "",
    remarks: "",
    remarks2: "", 
  });

  const getMinExpectedDate = () => {
    if (!form.poDate) return "";

    const date = new Date(form.poDate);
    date.setDate(date.getDate() + 14);

    return date.toISOString().split("T")[0];
  };


    // ✅ Fetch Locations + Orders
    useEffect(() => {
      fetchLocations();
      fetchOrders();
    }, []);

    const fetchLocations = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/master/locations`);
        setLocations(res.data);
      } catch {
        setLocations([]);
      }
    };

    const fetchOrders = async () => {
      try {
       const res = await axios.get(
  `${BASE_URL}/api/customer-orders`,
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);
        setOrders(res.data);
      } catch {
        setOrders([]);
      }
    };
    useEffect(() => {
    const uniqueCustomers = [...new Set(orders.map(o => o.customerName))];
    setCustomers(uniqueCustomers);
  }, [orders]);

    useEffect(() => {
  let filtered = [...orders];

  // PO Number Search
  if (poSearch) {
    filtered = filtered.filter(order =>
      order.purchaseOrderNo?.toString().includes(poSearch)
    );
  }

  // Product Code Search
  if (productCodeSearch) {
    filtered = filtered.filter(order =>
      order.productCode?.toString().includes(productCodeSearch)
    );
  }

  // Date Filter
  if (dateFilter) {
    filtered = filtered.filter(order =>
      order.poDate?.slice(0,10) === dateFilter
    );
  }

  // Customer Filter
  if (customerFilter) {
    filtered = filtered.filter(order =>
      order.customerName?.toLowerCase().includes(customerFilter.toLowerCase())
    );
  }

  setFilteredOrders(filtered);

}, [poSearch, productCodeSearch, dateFilter, customerFilter, orders]);

    const onlyAlphaNumeric = (value) =>
      value.replace(/[^a-zA-Z0-9]/g, "");

    // ✅ Fetch Product Details
    const fetchProductDetails = async (code) => {
      if (!code) return;

      try {
        const res = await axios.get(`${BASE_URL}/api/master/items/${code}`);

      setForm(prev => ({
    ...prev,
    materialType: res.data.materialType,
    description: res.data.description,
    customerName: res.data.customerName,

    colorFront: res.data.colorFront,
    colorBack: res.data.colorBack,
    wasteQty: res.data.wasteQty,
    jobSize: res.data.jobSize,
    inkDetails: res.data.inkDetails
  }));
      } catch {
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
      let newValue = value;

      if (name === "purchaseOrderNo") {
        let numbersOnly = value.replace(/\D/g, "");

        if (numbersOnly.length > 10) {
          setErrors(prev => ({
            ...prev,
            purchaseOrderNo: "PO Number cannot exceed 10 digits"
          }));
        } else {
          setErrors(prev => ({ ...prev, purchaseOrderNo: "" }));
        }

        newValue = numbersOnly.slice(0, 10);
      }
      if (name === "remarks2") {
  newValue = value.replace(/[^a-zA-Z0-9 ]/g, "");
}

      if (name === "productCode") {
        newValue = onlyAlphaNumeric(value);
        fetchProductDetails(newValue);
      }
      if (name === "remarks") {
    // allow only letters, numbers and spaces
    newValue = value.replace(/[^a-zA-Z0-9 ]/g, "");
  }

      if (name === "quantity" && value < 0) return;
      setErrors(prev => ({
    ...prev,
    [name]: ""
  }));

      setForm(prev => ({
        ...prev,
        [name]: newValue
      }));
    };

    const validateForm = () => {
      let newErrors = {};

    if (orderCategory === "Stationary") {

  if (!form.purchaseOrderNo)
  newErrors.purchaseOrderNo = "Required";

  if (!form.poDate)
  newErrors.poDate = "Required";

  if (!form.expectedDeliveryDate)
  newErrors.expectedDeliveryDate = "Required";

  }
      if (!form.productCode) newErrors.productCode = "Required";
      if (!form.quantity) newErrors.quantity = "Required";
      if (!form.location) newErrors.location = "Required";
      if (!form.orderType) newErrors.orderType = "Required";
    if (form.expectedDeliveryDate < form.poDate) {
    newErrors.expectedDeliveryDate =
      "Expected date must be after PO date";
  }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm())
      return;
    
  try {

    let res;

    if (editingId) {

  const formData = new FormData();

  formData.append("productCode", form.productCode);
  formData.append("materialType", form.materialType);
  formData.append("description", form.description);
  formData.append("customerName", form.customerName);
  formData.append("colorFront", form.colorFront);
  formData.append("colorBack", form.colorBack);
  formData.append("wasteQty", form.wasteQty);
  formData.append("jobSize", form.jobSize);
  formData.append("inkDetails", form.inkDetails);
  formData.append("quantity", form.quantity);
  formData.append("location", form.location);
  formData.append("orderType", form.orderType);
  formData.append("remarks", form.remarks);
  formData.append("remarks2", form.remarks2);
  formData.append("user", loggedInUser);


  if (attachment) {
    formData.append("attachment", attachment);
  }

  if (orderCategory === "Stationary") {
    formData.append("purchaseOrderNo", form.purchaseOrderNo);
    formData.append("poDate", form.poDate);
    formData.append("expectedDeliveryDate", form.expectedDeliveryDate);
  }

  res = await axios.put(
  `${BASE_URL}/api/customer-orders/${editingId}`,
  formData,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data"
    }
  }
);
  } else {

  const formData = new FormData();

  formData.append("productCode", form.productCode);
  formData.append("materialType", form.materialType);
  formData.append("description", form.description);
  formData.append("customerName", form.customerName);
  formData.append("colorFront", form.colorFront);
  formData.append("colorBack", form.colorBack);
  formData.append("wasteQty", form.wasteQty);
  formData.append("jobSize", form.jobSize);
  formData.append("inkDetails", form.inkDetails);
  formData.append("quantity", form.quantity);
  formData.append("location", form.location);
  formData.append("orderType", form.orderType);
  formData.append("remarks", form.remarks);
  formData.append("remarks2", form.remarks2);
  formData.append("user", loggedInUser);


  if (attachment) {
    formData.append("attachment", attachment);
  }

  if (orderCategory === "Stationary") {
    formData.append("purchaseOrderNo", form.purchaseOrderNo);
    formData.append("poDate", form.poDate);
    formData.append("expectedDeliveryDate", form.expectedDeliveryDate);
  }

  res = await axios.post(
  `${BASE_URL}/api/customer-orders`,
  formData,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data"
    }
  }
);

}

    // ✅ success check
    if (res.status === 200 || res.status === 201) {

 Swal.fire({
  icon: "success",
  title: "Success",
  text: editingId
    ? "Order Updated Successfully"
    : "Order Saved Successfully",
  width: "350px",        // 👈 reduce box width
  confirmButtonColor: "#3085d6"
});

      fetchOrders();

      setForm({
        purchaseOrderNo: "",
        poDate: "",
        expectedDeliveryDate: "",
        productCode: "",
        materialType: "",
        description: "",
        customerName: "",
        colorFront: "",
        colorBack: "",
        wasteQty: "",
        jobSize: "",
        inkDetails: "",
        quantity: "",
        location: "",
       orderType: orderCategory === "Security" ? "Inhouse" : "",
        remarks: "",
        remarks2: "" 
      });
       setAttachment(null);   // ✅ ADD THIS

if (fileRef.current) {
  fileRef.current.value = "";   // ✅ reset file input
}

      setEditingId(null);
      setErrors({});
    }

  } catch (err) {

    console.error("Save Error:", err);

   Swal.fire({
  icon: "error",
  title: "Error",
  text: err.response?.data?.message || "Server error while saving order",
  confirmButtonColor: "#d33"
});

  }
  };
  const handleEdit = (order) => {

  setEditingId(order._id);

  // 🔹 Detect category based on PO number
  if (!order.purchaseOrderNo) {
    setOrderCategory("Security");
  } else {
    setOrderCategory("Stationary");
  }

  setForm({
    purchaseOrderNo: order.purchaseOrderNo || "",
    poDate: order.poDate?.slice(0,10) || "",
    expectedDeliveryDate: order.expectedDeliveryDate?.slice(0,10) || "",

    productCode: order.productCode,
    materialType: order.materialType,
    description: order.description,
    customerName: order.customerName,

    colorFront: order.colorFront,
    colorBack: order.colorBack,
    wasteQty: order.wasteQty,
    jobSize: order.jobSize,
    inkDetails: order.inkDetails,

    quantity: order.quantity,
    location: order.location?._id,
    orderType: order.orderType || "",
    remarks: order.remarks || "",
    remarks2: order.remarks2 || ""
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
};
  const handleDelete = async (id) => {

  const result = await Swal.fire({
    title: "Are you sure?",
    text: "This order will be deleted permanently!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
      width: "350px",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it"
  });

  if (!result.isConfirmed) return;

  try {

   await axios.delete(`${BASE_URL}/api/customer-orders/${id}`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

    Swal.fire({
      icon: "success",
      title: "Deleted!",
      text: "Order deleted successfully",
        width: "350px",
      confirmButtonColor: "#3085d6"
    });

    fetchOrders();

  } catch (err) {

    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Error deleting order"
    });

  }
};
  const exportToExcel = () => {

    const data = filteredOrders.map(order => ({
      "PO Number": order.purchaseOrderNo,
      "Ticket Number":order.ticketNo,
      "PO Date": new Date(order.poDate).toLocaleDateString(),
      "Expected Date": order.expectedDeliveryDate
        ? new Date(order.expectedDeliveryDate).toLocaleDateString()
        : "",
      "Product Code": order.productCode,
      "Material": order.materialType,
      "Description":order.description,
      "Customer": order.customerName,
      "Quantity": order.quantity,
      "Location": order.location?.locationName || "",
      "Order Type": order.orderType || "",
      " Supllier Name": order.remarks || "",
      "User": order.user || "System"
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array"
    });

    const fileData = new Blob([excelBuffer], {
      type: "application/octet-stream"
    });

    saveAs(fileData, "Customer_Orders.xlsx");
  };

  const truncateText = (text, length = 25) => {
  if (!text) return "-";
  return text.length > length ? text.substring(0, length) + "..." : text;
};

    return (
    <div className="container mt-0 p-4 rounded" style={{ maxWidth: "1200px", background: "#f8f9fa" }}>

        {/* Toast */}
        <div
    className={`position-fixed top-0 start-50 translate-middle-x mt-3 ${
      showToast ? "show" : "d-none"
    }`}
    style={{ zIndex: 9999 }}
  >
    <div className="toast show">
      <div className="toast-body bg-success text-white rounded shadow text-center px-4">
        Saved Successfully
      </div>
    </div>
  </div>

       <div
  className="card shadow-lg rounded-4"
  style={{
    background: "#e8e5e7",       // light pink
    border: "2px solid #000",    // black border
    boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
  }}
>
          <div className="card-body">

     <div
  className="text-center py-4 mb-4 rounded-3"
  style={{
    background: "#fafcff", // light white
    border: "2px solid #000000",
    boxShadow: "0 4px 8px rgba(0,0,0,0.1)" // soft shadow
  }}
>
  <h2 className="fw-bold m-0" style={{ color: "#000", textShadow: "none" }}>
    Purchase Order Entry
  </h2>
</div>

            <form onSubmit={handleSubmit}>
              <div className="row g-2">
  <div className="col-12 mb-2">
  <label className="form-label fw-semibold text-black"><h6>Order Category</h6></label>

  <div className="d-flex gap-4">

  <div className="form-check">
 <input
  className="form-check-input text -black"
  type="radio"
  name="orderCategory"
  value="Stationary"
  checked={orderCategory === "Stationary"}
 onChange={(e)=>{
  const category = e.target.value;

  setOrderCategory(category);

  if(category === "Stationary"){
    setForm(prev => ({
      ...prev,
      orderType: ""
    }));
  }
}}
/>
  <label className="form-check-label text-black">
  Stationary
  </label>
  </div>

  <div className="form-check">
 <input
  className="form-check-input"
  type="radio"
  name="orderCategory"
  value="Security"
  checked={orderCategory === "Security"}
  onChange={(e)=>{
    setOrderCategory(e.target.value);

    setForm(prev => ({
      ...prev,
      orderType: "Inhouse"
    }));
  }}
/>
  <label className="form-check-label text-black">
  Security
  </label>
  </div>

  </div>
  </div>
                {orderCategory === "Stationary" && (

  <div className="col-md-2">
  <label className="form-label small fw-semibold text-black">PO Number</label>

  <input
  type="text"
  name="purchaseOrderNo"
  className="form-control border-dark"
  value={form.purchaseOrderNo}
  onChange={handleChange}
  />

  <small className="text-danger">{errors.purchaseOrderNo}</small>

  </div>

  )}
                {orderCategory === "Stationary" && (

  <div className="col-md-2">
  <label className="form-label small text-black fw-semibold">PO Date</label>

  <input
  type="date"
  name="poDate"
  className="form-control border-dark"
  value={form.poDate}
  onChange={handleChange}
  />

  <small className="text-danger">{errors.poDate}</small>

  </div>

  )}
        {orderCategory === "Stationary" && (

  <div className="col-md-2">
  <label className="form-label small text-black fw-semibold">
  Expected Date
  </label>

  <input
  type="date"
  name="expectedDeliveryDate"
  className="form-control border-dark"
  value={form.expectedDeliveryDate}
  onChange={handleChange}
  min={getMinExpectedDate()}
  />

  <small className="text-danger">
  {errors.expectedDeliveryDate}
  </small>

  </div>

  )}
    <div className="col-md-2">
                  <label className="form-label small text-black fw-semibold">Order Quantity</label>
                  <input
                    ref={quantityRef}
                    type="number"
                    name="quantity"
                    className="form-control border-dark"
                    value={form.quantity}
                    onChange={handleChange}
                    onKeyDown={(e)=> e.key==="Enter" && locationRef.current.focus()}
                  />
                  <small className="text-danger">{errors.quantity}</small>
                </div>
    
    
                <div className="col-md-2">
                  <label className="form-label small text-black fw-semibold">Location</label>
                <select
    ref={locationRef}
    name="location"
    className="form-control border-dark"
    value={form.location}
    onChange={handleChange}
  >
    <option value="">Select Location</option>
    {locations.map(loc => (
      <option key={loc._id} value={loc._id}>
        {loc.locationName}
      </option>
    ))}
  </select>
                  <small className="text-danger">{errors.location}</small>
                </div>

                <div className="col-md-2">
                  <label className="form-label text-black small fw-semibold">Product Code</label>
                  <input
                    ref={productCodeRef}
                    type="text"
                    name="productCode"
                    className="form-control border-dark"
                    value={form.productCode}
                    onChange={handleChange}
                    onKeyDown={(e)=> e.key==="Enter" && quantityRef.current.focus()}
                  />
                  <small className="text-danger">{errors.productCode}</small>
                </div>

                <div className="col-md-2">
                  <label className="form-label small text-black fw-semibold">Product Type</label>
                  <input className="form-control border-dark bg-light" value={form.materialType} readOnly />
                </div>

                <div className="col-md-2">
                  <label className="form-label small text-black fw-semibold">Customer</label>
                  <input className="form-control border-dark bg-light" value={form.customerName} readOnly />
                </div>

                <div className="col-md-3">
                  <label className="form-label small text-black fw-semibold">Description</label>
                  <input className="form-control border-dark bg-light" value={form.description} readOnly />
                </div>

            

                <div className="col-md-2">
    <label className="form-label small text-black fw-semibold">Order Type</label>
 <select
  name="orderType"
  className="form-control border-dark"
  value={form.orderType}
  onChange={handleChange}
  disabled={editingId !== null || orderCategory === "Security"}
>
      <option value="">Select</option>
      <option value="Inhouse">Inhouse</option>
      <option value="Out Source">Out Source</option>
      <option value="PMS">PMS</option>
    </select>

    <small className="text-danger">{errors.orderType}</small>
  {form.orderType === "Out Source" && (
  <div className="col-md-12 w-100 mt-2">
      <label className="form-label small text-black fw-semibold"> Suplier Name</label>
  <textarea
    name="remarks"
    className="form-control border-dark"
    rows="3"
    value={form.remarks}
    onChange={handleChange}
    required
    placeholder="Enter name"
    readOnly={editingId !== null}
  ></textarea>
    </div>
  )}
  </div>
  <div className="col-md-3">
  <label className="form-label small text-black fw-semibold">
   Remarks
  </label>
  <textarea
    name="remarks2"
    className="form-control border-dark"
    rows="2"
    value={form.remarks2}
    onChange={handleChange}
    placeholder="Remarks"
  />
</div>
        
  {orderCategory === "Stationary" && (
  <div className="col-md-3 mt-4">
    <div
      className="p-3 shadow-sm"
      style={{
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px solid #070a0e"
      }}
    > 
      <label className="form-label fw-semibold text-dark mb-2">
        📎 Upload File
      </label>

      <input
  type="file"
  ref={fileRef}
  className="form-control form-control-sm border-dark"
  accept=".pdf,.xls,.xlsx"
  onChange={(e) => {
    const file = e.target.files[0];

    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ];

      if (!allowedTypes.includes(file.type)) {
        Swal.fire({
          icon: "error",
          title: "Invalid File",
          text: "Only PDF and Excel files are allowed"
        });

        e.target.value = "";   // reset input
        setAttachment(null);
        return;
      }

      setAttachment(file);
    }
  }}
/>
      <small className="text-muted">
        Allowed: PDF, XLS, XLSX
      </small>
    </div>
  </div>
)}
</div>

              <div className="text-center mt-4">
                <button className="btn btn-primary px-4 fw-semibold rounded-3 shadow-sm">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>

       <div className="row mb-3 justify-content-center">
  <div className="col-12">
    <div
      className="card p-3 rounded-3 text-center"
      style={{
        background: "#e8e5e7", // pure white
        border: "2px solid #000",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)" // slightly stronger shadow
      }}
    >
      <h5 className="mb-3">Filters</h5>

      <div className="row g-3 align-items-end">

        {/* PO Search */}
        <div className="col-md-2">
          <label className="form-label text-black fw-semibold small">PO Number</label>
          <input
            type="text"
            placeholder="Search PO Number"
            className="form-control border-dark"
            value={poSearch}
            onChange={(e) => setPoSearch(e.target.value)}
          />
        </div>

        {/* Date Filter */}
        <div className="col-md-2">
          <label className="form-label text-black fw-semibold small">Date</label>
          <input
            type="date"
            className="form-control border-dark"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
        {/* Product Code Search */}
<div className="col-md-2">
  <label className="form-label text-black fw-semibold small">Product Code</label>
  <input
    type="text"
    placeholder="Search Product"
    className="form-control border-dark"
    value={productCodeSearch}
    onChange={(e) => setProductCodeSearch(e.target.value)}
  />
</div>

        {/* Customer Filter */}
        <div className="col-md-2">
          <label className="form-label text-black fw-semibold small">Customer name:</label>
          <select
            className="form-control border-dark"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="">All Customers</option>
            {customers.map((cust, index) => (
              <option key={index} value={cust}>
                {cust}
              </option>
            ))}
          </select>
        </div>

        {/* Excel Export */}
        <div className="col-md-1">
          <label className="form-label invisible">Excel</label>
          <button className="btn btn-success w-100" onClick={exportToExcel}>
            Excel
          </button>
        </div>

        {/* Reset Button */}
        <div className="col-md-1">
          <label className="form-label invisible">Clear</label>
          <button
            className="btn btn-secondary w-100"
           onClick={() => {
  setPoSearch("");
  setProductCodeSearch("");
  setDateFilter("");
  setCustomerFilter("");
}}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
      {/* SAVED ORDERS TABLE */}
<div
  className="card mt-4 p-4 rounded-4"
  style={{
    background: "#e8e5e7",               // light white background
    boxShadow: "0 4px 12px rgba(236, 229, 236, 0.15)", // subtle shadow
   border: "2px solid #000",                // remove any border if desired
  }}
>
  <div className="card-body text-center">
    <h5 className="fw-semibold mb-3">Saved Orders</h5>

    <div
      className="table-responsive"
      style={{ maxHeight: "400px", overflowY: "auto" }}
    >
      <table className="table border-black table-bordered table-hover align-middle text-center bg-white">
        <thead className="table-dark sticky-top">
  <tr>
    <th>Ticket No</th>
    <th>PO No</th>
    <th>Order Date</th>
    <th>Expected Date</th>
    <th>Product code</th>
    <th>Product Type</th>
    <th>Description</th>
    <th>Customer</th>
    <th>Order Qty</th>
    <th>Location</th>
    <th>Order Type</th>
    <th> Supllier Name</th>
    <th>Remarks</th>
    <th>Attachment File</th>
    <th>User</th>
   <th>User Location</th> 
    <th>Action</th>
  </tr>
</thead>
        <tbody>
  {filteredOrders.length === 0 ? (
    <tr>
      <td colSpan="14">No Orders Found</td>
    </tr>
  ) : (
    filteredOrders.slice(0, 30).map((order) => (
      <tr key={order._id}>
        <td>{order.ticketNo || "-"}</td>
        <td className="text-primary">{order.purchaseOrderNo || "-"}</td>
        <td>{order.poDate ? new Date(order.poDate).toLocaleDateString("en-IN") : "-"}</td>
        <td>{order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString("en-IN") : "-"}</td>
        <td>{order.productCode}</td>
       <td
  style={{
    cursor: "pointer",
    maxWidth: "200px",
    whiteSpace: expandedCell === `material-${order._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `material-${order._id}` ? null : `material-${order._id}`
    )
  }
>
  {expandedCell === `material-${order._id}`
    ? order.materialType
    : truncateText(order.materialType)}
</td>
     <td
  style={{
    cursor: "pointer",
    maxWidth: "350px",
    whiteSpace: expandedCell === `desc-${order._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `desc-${order._id}` ? null : `desc-${order._id}`
    )
  }
>
  {expandedCell === `desc-${order._id}`
    ? order.description
    : truncateText(order.description)}
</td>
       <td
  style={{
    cursor: "pointer",
    maxWidth: "300px",
    whiteSpace: expandedCell === `cust-${order._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `cust-${order._id}` ? null : `cust-${order._id}`
    )
  }
>
  {expandedCell === `cust-${order._id}`
    ? order.customerName
    : truncateText(order.customerName)}
</td>
        <td>{order.quantity}</td>
        <td>{order.location?.locationName || "-"}</td>
        <td>{order.orderType || "-"}</td>
      <td
  style={{
    cursor: "pointer",
    maxWidth: "250px",
    whiteSpace: expandedCell === `remarks-${order._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `remarks-${order._id}` ? null : `remarks-${order._id}`
    )
  }
>
  {expandedCell === `remarks-${order._id}`
    ? order.remarks
    : truncateText(order.remarks)}
</td>
<td
  style={{
    cursor: "pointer",
    maxWidth: "250px",
    whiteSpace: expandedCell === `remarks2-${order._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `remarks2-${order._id}` ? null : `remarks2-${order._id}`
    )
  }
>
  {expandedCell === `remarks2-${order._id}`
    ? order.remarks2
    : truncateText(order.remarks2)}
</td>
        <td>
  {order.attachment ? (
    <a
      href={`${BASE_URL}/uploads/${order.attachment}`}
      target="_blank"
      rel="noreferrer"
      className="btn btn-sm btn-info"
    >
      View
    </a>
  ) : "-"}
</td>

        <td
  style={{
    cursor: "pointer",
    maxWidth: "220px",
    whiteSpace: expandedCell === `user-${order._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `user-${order._id}` ? null : `user-${order._id}`
    )
  }
>
  {expandedCell === `user-${order._id}` ? (
    <>
      {order.user || "System"}
      <br />
      <small className="text-muted">
        {order.createdAt
          ? new Date(order.createdAt).toLocaleString("en-IN")
          : ""}
      </small>
    </>
  ) : (
    <>
      {truncateText(order.user || "System")}
      <br />
      <small className="text-muted">
        {truncateText(
          order.createdAt
            ? new Date(order.createdAt).toLocaleString("en-IN")
            : "",
          18
        )}
      </small>
    </>
  )}
</td>
<td>
  {order.userLocations?.length > 0
    ? order.userLocations.join(", ")
    : "-"}
</td>
<td className="text-center align-middle">
  {order.user === loggedInUser ? (
    <div className="d-flex flex-column gap-2 align-items-center">
      <button
        className="btn btn-sm btn-warning"
        onClick={() => handleEdit(order)}
      >
        Edit
      </button>

      <button
        className="btn btn-sm btn-danger"
        onClick={() => handleDelete(order._id)}
      >
        Delete
      </button>
    </div>
  ) : (
    <span className="fw-bold text-muted">-</span>
  )}
</td>
      </tr>
    ))
  )}
</tbody>
      </table>
    </div>
  </div>
</div>
      </div>
    );
  }

  export default CustomerDashboard;