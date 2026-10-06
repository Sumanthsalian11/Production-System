import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import axios from "axios";
import BASE_URL from "../config/api";

// Outlined floating-label field with a leading icon (entry form styling)
function PoField({
  icon,
  label,
  required,
  error,
  filled,
  alwaysFloat,
  caret,
  area,
  className = "",
  children
}) {
  return (
    <div className={className}>
      <div
        className={`po-field ${filled || alwaysFloat ? "is-floated" : ""} ${
          area ? "po-area" : ""
        }`}
      >
        {icon && <i className={`bi ${icon} po-field-icon`}></i>}
        {children}
        <label className="po-field-label">
          {label}
          {required && <span className="po-req"> *</span>}
        </label>
        {caret && <i className="bi bi-chevron-down po-caret"></i>}
      </div>
      {error ? <div className="po-err">{error}</div> : null}
    </div>
  );
}

function CustomerDashboard() {
  const navigate = useNavigate();

  // ===== VIEW MODE =====
  const [viewMode, setViewMode] = useState("purchaseOrder");

  // ===== ENTRY FORM VISIBILITY (hidden on page open) =====
  const [showEntryForm, setShowEntryForm] = useState(false);

  // ===== NEW INDENT REQUESTS =====
  const [indentRequests, setIndentRequests] = useState([]);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [indentForm, setIndentForm] = useState({
    orderType: "",
    remarks: "",
    purchaseOrderNo: "",
    poDate: "",
    expectedDeliveryDate: ""
  });

  // ===== NORMAL PO STATES =====
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
  const [convertedOrderIds, setConvertedOrderIds] = useState([]);

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
      try {
        const decoded = jwtDecode(token);
        setLoginLocation(decoded.location || "");
        setLoggedInUser(decoded.name || decoded.username || "");
      } catch (e) {
        console.error("Token decoding error:", e);
      }
    }
  }, []);

  const [form, setForm] = useState({
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
    orderType: "",
    remarks: "",
    remarks2: "",
    itemPdfPath: ""
  });

  const getMinExpectedDate = () => {
    if (!form.poDate) return "";
    const date = new Date(form.poDate);
    date.setDate(date.getDate() + 14);
    return date.toISOString().split("T")[0];
  };

  useEffect(() => {
    fetchLocations();
    fetchOrders();
    fetchIndentRequests();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/locations`);
      setLocations(res.data || []);
    } catch {
      setLocations([]);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/customer-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data || []);
    } catch {
      setOrders([]);
    }
    fetchConvertedOrders();
  };

  const fetchConvertedOrders = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/workorders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const ids = (res.data || [])
        .map((wo) => wo.customerOrderId?._id || wo.customerOrderId)
        .filter(Boolean)
        .map((id) => String(id));
      setConvertedOrderIds(ids);
    } catch {
      setConvertedOrderIds([]);
    }
  };

  const fetchIndentRequests = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/newindent/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIndentRequests(res.data || []);
    } catch {
      setIndentRequests([]);
    }
  };

  useEffect(() => {
    const uniqueCustomers = [
      ...new Set(orders.map((o) => o.customerName))
    ].filter(Boolean);
    setCustomers(uniqueCustomers);
  }, [orders]);

  useEffect(() => {
    let filtered = [...orders];
    if (poSearch) {
      filtered = filtered.filter((order) =>
        order.purchaseOrderNo?.toString().includes(poSearch)
      );
    }
    if (productCodeSearch) {
      filtered = filtered.filter((order) =>
        order.productCode?.toString().includes(productCodeSearch)
      );
    }
    if (dateFilter) {
      filtered = filtered.filter(
        (order) => order.poDate?.slice(0, 10) === dateFilter
      );
    }
    if (customerFilter) {
      filtered = filtered.filter((order) =>
        order.customerName?.toLowerCase().includes(customerFilter.toLowerCase())
      );
    }
    setFilteredOrders(filtered);
  }, [poSearch, productCodeSearch, dateFilter, customerFilter, orders]);

  const onlyAlphaNumeric = (value) => value.replace(/[^a-zA-Z0-9]/g, "");

  const fetchProductDetails = async (code) => {
    if (!code) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/master/items/${code}`);
      setForm((prev) => ({
        ...prev,
        materialType: res.data.materialType,
        description: res.data.description,
        customerName: res.data.customerName,
        colorFront: res.data.colorFront,
        colorBack: res.data.colorBack,
        wasteQty: res.data.wasteQty,
        jobSize: res.data.jobSize,
        inkDetails: res.data.inkDetails,
        itemPdfPath: res.data.pdfPath || ""
      }));
    } catch {
      setForm((prev) => ({
        ...prev,
        materialType: "",
        description: "",
        customerName: "",
        itemPdfPath: ""
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "productCode") {
      newValue = onlyAlphaNumeric(value);
      fetchProductDetails(newValue);
    }
    if (name === "quantity" && value < 0) return;

    setErrors((prev) => ({ ...prev, [name]: "" }));
    setForm((prev) => ({ ...prev, [name]: newValue }));
  };

  const validateForm = () => {
    let newErrors = {};
    if (orderCategory === "Stationary") {
      if (!form.purchaseOrderNo) newErrors.purchaseOrderNo = "Required";
      if (!form.poDate) newErrors.poDate = "Required";
      if (!form.expectedDeliveryDate)
        newErrors.expectedDeliveryDate = "Required";
    }
    if (!form.productCode) newErrors.productCode = "Required";
    if (!form.quantity) newErrors.quantity = "Required";
    if (!form.location) newErrors.location = "Required";
    if (!form.orderType) newErrors.orderType = "Required";
    if (form.expectedDeliveryDate < form.poDate) {
      newErrors.expectedDeliveryDate = "Expected date must be after PO date";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      let res;
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
      formData.append("itemPdfPath", form.itemPdfPath || "");
      formData.append("user", loggedInUser);

      if (attachment) formData.append("attachment", attachment);

      if (orderCategory === "Stationary") {
        formData.append("purchaseOrderNo", form.purchaseOrderNo);
        formData.append("poDate", form.poDate);
        formData.append("expectedDeliveryDate", form.expectedDeliveryDate);
      }

      if (editingId) {
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

      if (res.status === 200 || res.status === 201) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: editingId
            ? "Order Updated Successfully"
            : "Order Saved Successfully",
          width: "350px",
          confirmButtonColor: "#3085d6"
        });

        fetchOrders();
        resetForm();
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

  const resetForm = () => {
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
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
    setEditingId(null);
    setErrors({});
  };

  const handleEdit = (order) => {
    setEditingId(order._id);
    setShowEntryForm(true);
    if (!order.purchaseOrderNo) {
      setOrderCategory("Security");
    } else {
      setOrderCategory("Stationary");
    }

    setForm({
      purchaseOrderNo: order.purchaseOrderNo || "",
      poDate: order.poDate?.slice(0, 10) || "",
      expectedDeliveryDate: order.expectedDeliveryDate?.slice(0, 10) || "",
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
      remarks2: order.remarks2 || "",
      itemPdfPath: order.itemPdfPath || ""
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
        headers: { Authorization: `Bearer ${token}` }
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

  // ============================
  // NEW INDENT REQUEST HANDLERS
  // ============================
  const handleSelectIndent = (indent) => {
    setSelectedIndent(indent);
    setIndentForm({
      orderType: "",
      remarks: "",
      purchaseOrderNo: "",
      poDate: "",
      expectedDeliveryDate: indent.items[0]?.deliveryDate?.slice(0, 10) || ""
    });
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleIndentFormChange = (e) => {
    const { name, value } = e.target;
    setIndentForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateIndentForm = () => {
    let newErrors = {};
    if (!indentForm.orderType) newErrors.orderType = "Required";

    if (indentForm.orderType) {
      if (!indentForm.expectedDeliveryDate)
        newErrors.expectedDeliveryDate = "Required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProcessIndent = async (e) => {
    e.preventDefault();
    if (!selectedIndent) return;
    if (!validateIndentForm()) return;

    try {
      const res = await axios.put(
        `${BASE_URL}/api/newindent/process/${selectedIndent._id}`,
        indentForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 200) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: `${res.data.ordersCreated} Order(s) Created from Indent ${res.data.indentNo}`,
          width: "350px",
          confirmButtonColor: "#3085d6"
        });

        setSelectedIndent(null);
        setIndentForm({
          orderType: "",
          remarks: "",
          purchaseOrderNo: "",
          poDate: "",
          expectedDeliveryDate: ""
        });
        fetchIndentRequests();
        fetchOrders();
      }
    } catch (err) {
      console.error("Process Indent Error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || "Error processing indent",
        confirmButtonColor: "#d33"
      });
    }
  };

  const exportToExcel = () => {
    const data = filteredOrders.map((order) => ({
      "PO Number": order.purchaseOrderNo,
      "Ticket Number": order.ticketNo,
      "PO Date": new Date(order.poDate).toLocaleDateString(),
      "Expected Date": order.expectedDeliveryDate
        ? new Date(order.expectedDeliveryDate).toLocaleDateString()
        : "",
      "Product Code": order.productCode,
      "Material": order.materialType,
      "Description": order.description,
      "Customer": order.customerName,
      "Quantity": order.quantity,
      "Location": order.location?.locationName || "",
      "Order Type": order.orderType || "",
      "Supplier Name": order.remarks || "",
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

  const has = (v) => v !== "" && v !== null && v !== undefined;

  const truncateText = (text, length = 25) => {
    if (!text) return "-";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  return (
    <div
      className="container mt-2 customer-dashboard-universe"
      style={{
        maxWidth: "100%",
        fontSize: "14px"
      }}
    >
      {/* ======================================================================
          🎨 GLOSSY AQUA-GLASS STYLES (same look as the Production dashboard)
          ====================================================================== */}
      <style>{`
        /* ---------- Page backdrop ---------- */
        .customer-dashboard-universe {
          min-height: 100vh;
          padding: 18px 20px 34px;
          color: #0b2f4f;
          font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
          background:
            radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 30%),
            radial-gradient(circle at 88% 18%, rgba(160, 222, 250, 0.7) 0, rgba(160, 222, 250, 0) 32%),
            radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
            linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%) !important;
          background-attachment: fixed !important;
          border: none !important;
          border-radius: 0 !important;
        }

        /* ---------- Glossy hero strip ---------- */
        .po-hero {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin: 0 0 16px;
          padding: 12px 22px;
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(222, 244, 254, 0.8) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 14px 30px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140, 210, 245, 0.2);
        }
        .po-hero-emblem {
          width: 46px; height: 46px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #0a6fb8; font-size: 21px;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 50%, #8fd0f0 100%);
          border: 1px solid #86c6e8;
          box-shadow: 0 6px 14px rgba(40, 120, 170, 0.18), inset 0 2px 3px rgba(255, 255, 255, 0.9);
        }
        .customer-dashboard-universe .dash-hero-title {
          margin: 0;
          color: #0a4f8c;
          letter-spacing: -0.3px;
          font-size: 26px;
          font-weight: 800;
        }
        .po-user-pill {
          position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
          display: flex; align-items: center; gap: 8px;
          padding: 7px 14px; border-radius: 30px;
          font-size: 13px; font-weight: 700; color: #0b2f4f;
          background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
          border: 1px solid #a9d9f2;
          box-shadow: 0 4px 12px rgba(40, 120, 170, 0.15), inset 0 1px 0 #fff;
        }
        .po-user-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; }

        /* ---------- Mode toggle (glass tab strip) ---------- */
        .mode-toggle-bar {
          display: flex;
          justify-content: center;
          gap: 8px;
          width: fit-content;
          margin: 0 auto 18px;
          padding: 6px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(214, 240, 252, 0.8));
          border: 1px solid #ffffff;
          box-shadow: 0 10px 24px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff;
        }
        .mode-pill-btn {
          border: 1px solid transparent;
          background: transparent;
          color: #0a4f8c;
          border-radius: 16px;
          padding: 8px 22px;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .mode-pill-btn:hover { background: rgba(255, 255, 255, 0.75); }
        .mode-pill-btn.active {
          color: #0a4f8c;
          background: linear-gradient(180deg, #d2eefc 0%, #8fd0f3 100%);
          border-color: #7fc3e8;
          box-shadow: 0 3px 0 #6fb5dc, 0 8px 16px rgba(40, 120, 170, 0.15), inset 0 1px 0 #fff;
        }
        .mode-pill-btn.warning-active {
          color: #8a5a00;
          background: linear-gradient(180deg, #ffefc2 0%, #fbd271 100%);
          border-color: #f3c35a;
          box-shadow: 0 3px 0 #e9b845, 0 8px 16px rgba(217, 119, 6, 0.14), inset 0 1px 0 #fff;
        }

        /* ---------- Glass cards ---------- */
        .customer-dashboard-universe .card {
          border: 1px solid rgba(255, 255, 255, 0.95) !important;
          border-radius: 22px !important;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(228, 246, 255, 0.9) 100%) !important;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 12px 28px rgba(40, 120, 170, 0.12), inset 0 1px 0 #fff !important;
          overflow: hidden;
        }
        .customer-dashboard-universe .card .card {
          background: rgba(255, 255, 255, 0.85) !important;
          box-shadow: 0 8px 20px rgba(40, 120, 170, 0.12) !important;
        }
        .customer-dashboard-universe .card-header {
          border: 0;
          border-bottom: 1px solid #86c6e8;
          border-radius: 0 !important;
          background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%) !important;
          color: #08406b !important;
          padding: 11px 18px;
          box-shadow: inset 0 1px 0 #fff;
        }
        .customer-dashboard-universe .card-header .badge { text-shadow: none; color: #0a4f8c !important; }

        .customer-dashboard-universe h4,
        .customer-dashboard-universe h5,
        .customer-dashboard-universe h6 {
          color: #0a4f8c !important;
          font-weight: 800;
          padding: 4px 0;
        }

        /* ---------- Inputs / labels ---------- */
        .customer-dashboard-universe .form-label,
        .customer-dashboard-universe small {
          color: #0b2f4f !important;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .customer-dashboard-universe .form-control,
        .customer-dashboard-universe .form-select,
        .customer-dashboard-universe textarea {
          min-height: 38px;
          border: 1.5px solid #9ccbe6 !important;
          border-radius: 12px;
          background-color: #ffffff !important;
          color: #0b2f4f;
          font-weight: 700;
          box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1);
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .customer-dashboard-universe .form-control:focus,
        .customer-dashboard-universe .form-select:focus,
        .customer-dashboard-universe textarea:focus {
          border-color: #1b9be0 !important;
          box-shadow: 0 0 0 4px rgba(27, 155, 224, 0.2), 0 6px 14px rgba(27, 155, 224, 0.14) !important;
        }
        .customer-dashboard-universe .bg-light {
          border-color: #cfe8f6 !important;
          background: linear-gradient(180deg, #ffffff 0%, #f1faff 100%) !important;
          border-radius: 16px !important;
        }

        /* ---------- Glossy buttons ---------- */
        .customer-dashboard-universe .btn {
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 12px;
          font-weight: 800;
          min-height: 36px;
          transition: all 0.14s ease;
        }
        .customer-dashboard-universe .btn:hover { transform: translateY(-1px); }
        .customer-dashboard-universe .btn:active { transform: translateY(2px); }
        .customer-dashboard-universe .btn-primary,
        .customer-dashboard-universe .btn-info {
          background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%) !important;
          color: #08406b !important;
          border-color: #7fc3e8 !important;
          box-shadow: 0 2px 0 #7fbbe0, 0 6px 12px rgba(40, 120, 170, 0.14), inset 0 1px 0 #fff;
        }
        .customer-dashboard-universe .btn-success {
          background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%) !important;
          color: #07583b !important;
          border-color: #7fd3ab !important;
          box-shadow: 0 2px 0 #84cba9, 0 6px 12px rgba(20, 168, 112, 0.14), inset 0 1px 0 #fff;
        }
        .customer-dashboard-universe .btn-secondary {
          background: linear-gradient(180deg, #eef5fa 0%, #cbdce8 100%) !important;
          color: #34526b !important;
          border-color: #aac3d4 !important;
          box-shadow: 0 2px 0 #b6cbd9, 0 6px 12px rgba(93, 124, 147, 0.12), inset 0 1px 0 #fff;
        }
        .customer-dashboard-universe .btn-warning {
          background: linear-gradient(180deg, #fff0c4 0%, #fcd477 100%) !important;
          color: #7a4f00 !important;
          border-color: #f3c35a !important;
          box-shadow: 0 2px 0 #e9b845, 0 6px 12px rgba(245, 158, 11, 0.14), inset 0 1px 0 #fff;
        }
        .customer-dashboard-universe .btn-danger {
          background: linear-gradient(180deg, #ffdcdc 0%, #f7a3a3 100%) !important;
          color: #8f1414 !important;
          border-color: #ee8f8f !important;
          box-shadow: 0 2px 0 #e08a8a, 0 6px 12px rgba(220, 38, 38, 0.12), inset 0 1px 0 #fff;
        }
        .customer-dashboard-universe .btn-sm { min-height: 28px; border-radius: 9px; }

        /* ---------- Tables ---------- */
        .customer-dashboard-universe .table-responsive {
          background: #ffffff !important;
          border-radius: 0;
        }
        .customer-dashboard-universe table { color: #0b2f4f; background: #ffffff; }
        .customer-dashboard-universe thead th {
          background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%) !important;
          color: #08406b !important;
          border-color: #7fbfe4 !important;
          font-size: 12.5px;
          font-weight: 800;
          vertical-align: middle;
          white-space: nowrap;
          text-align: center;
        }
        .customer-dashboard-universe tbody td {
          border-color: #d3e8f4 !important;
          vertical-align: middle;
          text-align: center;
          font-weight: 600;
          color: #0b2f4f;
          background: #ffffff;
        }
        .customer-dashboard-universe tbody tr:nth-child(even) td { background: #f3faff; }
        .customer-dashboard-universe tbody tr:hover td { background: #d9f2fc !important; }

        .cell-expandable {
          cursor: pointer;
          color: #0a6fb8;
          font-weight: 700;
          text-decoration: underline dotted;
        }
        .cell-expandable:hover { color: #064c73; }

        /* ===== Purchase Order Entry: split register-style form ===== */
        .po-split {
          display: flex;
          background: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 14px 32px rgba(40, 120, 180, 0.16);
          margin: 0 auto 20px;
          max-width: 1000px;
        }

        .po-side {
          flex: 0 0 31%;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 22px 22px;
          color: #08365a;
          background: linear-gradient(170deg, #8fd0f3 0%, #b0e1f8 52%, #d3eefb 100%);
          border-right: 1px solid #86c6e8;
        }
        .po-side::before {
          content: ''; position: absolute; width: 280px; height: 280px; border-radius: 50%;
          right: -110px; top: -90px; background: rgba(255, 255, 255, 0.35);
        }
        .po-side::after {
          content: ''; position: absolute; width: 220px; height: 220px; border-radius: 50%;
          left: -90px; bottom: -80px; background: rgba(255, 255, 255, 0.28);
        }
        .po-side > * { position: relative; z-index: 1; }

        .po-side-brand {
          font-weight: 800;
          font-size: 0.75rem;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .po-side-hero h2 {
          margin: 0;
          color: #07406b !important;
          font-size: 1.45rem;
          font-weight: 700;
          line-height: 1.1;
          padding: 0;
        }

        .po-side-hero h1 {
          margin: 0 0 12px;
          color: #07406b;
          font-size: 2.7rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -1px;
        }

        .po-side-hero p {
          margin: 0;
          max-width: 210px;
          font-size: 0.68rem;
          line-height: 1.5;
          color: #14507a;
        }

        .po-side-foot {
          color: #14507a;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }

        .po-main {
          flex: 1;
          min-width: 0;
          padding: 20px 28px 18px;
          background: #ffffff;
        }

        .po-heading {
          text-align: center;
          color: #2f4156;
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          padding-bottom: 8px;
          margin-bottom: 12px;
          border-bottom: 1px solid #dbeaf4;
        }

        .po-section {
          color: #3a8fc4;
          font-size: 0.74rem;
          font-weight: 800;
          margin: 12px 0 6px;
        }

        .po-radio-row {
          display: flex;
          gap: 20px;
          align-items: center;
          margin-bottom: 4px;
        }

        .po-radio-row label {
          color: #0b2f4f;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .po-field {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 34px;
          background: #ffffff;
          border: 1px solid #cfd9e4;
          border-radius: 6px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .po-field:focus-within {
          border-color: #35a2ea;
          box-shadow: 0 0 0 3px rgba(53, 162, 234, 0.18);
        }

        .po-field-icon {
          position: absolute;
          left: 9px;
          color: #6b7f93;
          font-size: 0.85rem;
          pointer-events: none;
        }

        .po-field .po-input {
          width: 100%;
          min-height: 32px;
          padding: 5px 8px 5px 30px;
          border: none !important;
          outline: none;
          background: transparent !important;
          box-shadow: none !important;
          color: #0b2f4f;
          font-size: 0.76rem;
          font-weight: 700;
          border-radius: 6px;
        }

        .po-field select.po-input {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          padding-right: 28px;
        }

        .po-field select.po-input:disabled {
          cursor: not-allowed;
          opacity: 0.75;
        }

        .po-field textarea.po-input {
          resize: vertical;
          padding-top: 9px;
        }

        .po-field input[type="file"].po-input {
          padding-top: 8px;
          font-weight: 500;
        }

        .po-caret {
          position: absolute;
          right: 10px;
          font-size: 0.7rem;
          color: #6b7f93;
          pointer-events: none;
        }

        .po-field-label {
          position: absolute;
          left: 30px;
          top: 50%;
          transform: translateY(-50%);
          padding: 0 4px;
          background: #ffffff;
          color: #4a6f8c;
          font-size: 0.74rem;
          font-weight: 600;
          pointer-events: none;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .po-field.po-area .po-field-label { top: 16px; }
        .po-field.po-area .po-field-icon { top: 9px; }

        .po-field:focus-within .po-field-label,
        .po-field.is-floated .po-field-label {
          top: 0;
          left: 24px;
          font-size: 0.62rem;
          font-weight: 800;
          color: #1b8fd6;
        }

        .po-req { color: #e11d48; }

        .po-err {
          color: #dc2626 !important;
          font-size: 0.7rem;
          font-weight: 700;
          margin-top: 3px;
        }

        .po-submit {
          display: block;
          width: 42%;
          min-width: 190px;
          margin: 16px auto 4px;
          padding: 9px;
          font-size: 0.82rem;
          border: 1px solid #7fd3ab;
          border-radius: 12px;
          color: #07583b;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%);
          box-shadow: 0 3px 0 #84cba9, 0 8px 14px rgba(20, 168, 112, 0.14), inset 0 1px 0 #fff;
          transition: all 0.12s ease;
        }

        .po-submit:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #b3e4cc, 0 10px 18px rgba(20, 168, 112, 0.2); }
        .po-submit:active { transform: translateY(2px); box-shadow: 0 1px 0 #b3e4cc; }

        @media (max-width: 992px) {
          .po-split { flex-direction: column; }
          .po-side { flex: none; min-height: 170px; padding: 20px; gap: 14px; }
          .po-side-hero h2 { font-size: 1.4rem; }
          .po-side-hero h1 { font-size: 2.4rem; margin-bottom: 6px; }
          .po-main { padding: 22px 16px; }
          .po-submit { width: 100%; }
        }

        /* ===== Filters bar ===== */
        .po-filter {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(228, 246, 255, 0.9) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          border-radius: 20px;
          box-shadow: 0 12px 28px rgba(40, 120, 170, 0.16), inset 0 1px 0 #fff;
          padding: 10px 16px 12px;
          margin-bottom: 16px;
        }

        .po-filter-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 8px;
          margin-bottom: 10px;
          border-bottom: 1px dashed rgba(10, 111, 184, 0.35);
        }

        .po-filter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #0a4f8c;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .po-filter-title i {
          width: 26px; height: 26px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          color: #0a6fb8; font-size: 0.75rem;
          background: radial-gradient(circle at 30% 25%, #ffffff, #bfe5f8 55%, #8fd0f0);
          border: 1px solid #86c6e8;
        }

        .po-filter-count {
          background: linear-gradient(180deg, #ffffff, #d6effc);
          color: #0a4f8c;
          border: 1px solid #a9d9f2;
          border-radius: 999px;
          padding: 3px 12px;
          font-size: 0.68rem;
          font-weight: 800;
        }

        .po-fbtn {
          flex: 1 1 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 34px;
          padding: 0 12px;
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 12px;
          color: #ffffff;
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          white-space: nowrap;
          transition: all 0.12s ease;
        }

        .po-fbtn:hover { transform: translateY(-1px); }
        .po-fbtn:active { transform: translateY(2px); }

        .po-fbtn.export {
          color: #07583b;
          background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%);
          border: 1px solid #7fd3ab;
          box-shadow: 0 2px 0 #84cba9, 0 6px 12px rgba(20, 168, 112, 0.12), inset 0 1px 0 #fff;
        }

        .po-fbtn.clear {
          background: linear-gradient(180deg, #ffffff, #e3f2fb);
          color: #0a4f8c;
          border: 1px solid #a9d9f2;
          box-shadow: 0 3px 8px rgba(40, 120, 170, 0.12);
        }

        .po-fbtn.clear:hover { color: #064c73; border-color: #35a2ea; }

        @media (max-width: 768px) {
          .customer-dashboard-universe { padding: 12px; }
          .customer-dashboard-universe .dash-hero-title { font-size: 21px; }
          .po-user-pill { position: static; transform: none; }
          .po-hero { flex-wrap: wrap; }
        }
      `}</style>

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

      {/* ======================================================================
          GLOSSY HERO HEADER
          ====================================================================== */}
      <div className="po-hero">
        <div className="po-hero-emblem">
          <i className="bi bi-receipt-cutoff"></i>
        </div>
        <h1 className="dash-hero-title m-0">
          <b>Purchase Order Management</b>
        </h1>
        {loggedInUser && (
          <div className="po-user-pill">
            <span className="po-user-dot"></span>
            <i className="bi bi-person"></i>
            <span>{loggedInUser}</span>
          </div>
        )}
      </div>

      {/* ======================================================================
          VIEW MODE TOGGLE BUTTONS
          ====================================================================== */}
      <div className="mode-toggle-bar">
        <button
          className={`mode-pill-btn ${
            viewMode === "purchaseOrder" && showEntryForm ? "active" : ""
          }`}
          onClick={() => {
            if (viewMode === "purchaseOrder") {
              // already on this view: toggle the entry form
              setShowEntryForm((prev) => !prev);
            } else {
              setViewMode("purchaseOrder");
              setShowEntryForm(true);
            }
            setSelectedIndent(null);
          }}
        >
          Purchase Order Entry
        </button>

        <button
          className={`mode-pill-btn position-relative ${
            viewMode === "orderRequests" ? "warning-active" : ""
          }`}
          onClick={() => {
            setViewMode("orderRequests");
            fetchIndentRequests();
            setSelectedIndent(null);
          }}
        >
          Order Requests
          {viewMode !== "orderRequests" && indentRequests.length > 0 && (
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger shadow">
              {indentRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* ======================================================================
          ORDER REQUESTS VIEW
          ====================================================================== */}
      {viewMode === "orderRequests" && (
        <>
          {/* Indent Request List */}
          {!selectedIndent && (
            <div className="card shadow-lg mb-4">
              <div className="card-header text-center">
                <strong>New Indent Requests</strong>
              </div>

              <div
                className="table-responsive"
                style={{ maxHeight: "400px", overflowY: "auto" }}
              >
                <table className="table table-striped table-bordered table-hover align-middle text-center mb-0">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th>Indent No</th>
                      <th>Product Code</th>
                      <th>Product Type</th>
                      <th>Description</th>
                      <th>Customer</th>
                      <th>Quantity</th>
                      <th>Location</th>
                      <th>Item PDF</th>
                      <th>Created By</th>
                      <th>Created Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indentRequests.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="p-4 text-center text-muted">
                          No New Indent Requests
                        </td>
                      </tr>
                    ) : (
                      indentRequests.map((indent) => (
                        <tr key={indent._id}>
                          <td className="fw-bold text-primary">
                            #{indent.indentNo}
                          </td>
                          <td className="fw-semibold">
                            {indent.items[0]?.productCode}
                          </td>
                          <td>{indent.items[0]?.materialType || "-"}</td>
                          <td
                            className="cell-expandable"
                            style={{
                              maxWidth: "280px",
                              whiteSpace:
                                expandedCell === `ind-desc-${indent._id}`
                                  ? "normal"
                                  : "nowrap"
                            }}
                            onClick={() =>
                              setExpandedCell(
                                expandedCell === `ind-desc-${indent._id}`
                                  ? null
                                  : `ind-desc-${indent._id}`
                              )
                            }
                          >
                            {expandedCell === `ind-desc-${indent._id}`
                              ? indent.items[0]?.description
                              : truncateText(indent.items[0]?.description)}
                          </td>
                          <td className="fw-semibold">
                            {indent.items[0]?.customerName || "-"}
                          </td>
                          <td className="fw-bold">{indent.items[0]?.quantity}</td>
                          <td>{indent.location?.locationName || "-"}</td>
                          <td>
                            {indent.items[0]?.itemPdfPath ? (
                              <a
                                href={`${BASE_URL}${indent.items[0].itemPdfPath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-info"
                              >
                                View
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>{indent.user || "-"}</td>
                          <td>
                            {indent.createdAt
                              ? new Date(indent.createdAt).toLocaleDateString(
                                  "en-IN"
                                )
                              : "-"}
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary px-3"
                              onClick={() => handleSelectIndent(indent)}
                            >
                              Select & Process
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Process Selected Indent */}
          {selectedIndent && (
            <div className="card shadow-lg mb-4">
              <div className="card-header d-flex align-items-center justify-content-between">
                <strong>Process Indent</strong>
                <span className="badge bg-light text-dark px-3 py-2 fw-bold">
                  {selectedIndent.indentNo}
                </span>
              </div>

              <div className="card-body p-4">
                {/* Order Info Display */}
                <div
                  className="rounded-3 mb-4 p-2 bg-light"
                  style={{ border: "1px solid rgba(14, 94, 135, 0.3)" }}
                >
                  <div className="row g-2">
                    {[
                      ["Indent No", selectedIndent.indentNo],
                      ["Product Code", selectedIndent.items[0]?.productCode],
                      [
                        "Product Type",
                        selectedIndent.items[0]?.materialType || "-"
                      ],
                      [
                        "Description",
                        selectedIndent.items[0]?.description || "-"
                      ],
                      [
                        "Customer",
                        selectedIndent.items[0]?.customerName || "-"
                      ],
                      ["Quantity", selectedIndent.items[0]?.quantity],
                      [
                        "Location",
                        selectedIndent.location?.locationName || "-"
                      ],
                      ["Unit Rate", selectedIndent.items[0]?.unitRate || "-"],
                      [
                        "Expected Date",
                        selectedIndent.items[0]?.deliveryDate
                          ? new Date(
                              selectedIndent.items[0].deliveryDate
                            ).toLocaleDateString("en-IN")
                          : "-"
                      ],
                      [
                        "Customer PO No",
                        selectedIndent.items[0]?.customerPoNo || "-"
                      ],
                      [
                        "Customer PO Date",
                        selectedIndent.items[0]?.customerPoDate
                          ? new Date(
                              selectedIndent.items[0].customerPoDate
                            ).toLocaleDateString("en-IN")
                          : "-"
                      ],
                      [
                        "Item PDF",
                        selectedIndent.items[0]?.itemPdfPath ? "Attached" : "-"
                      ]
                    ].map(([label, value], i) => (
                      <div key={i} className="col-6 col-md-4 col-lg-2">
                        <div className="p-2 border rounded bg-white text-center h-100">
                          <small className="text-uppercase fw-bold text-muted">
                            {label}
                          </small>
                          <div className="fw-bold mt-1 text-dark">
                            {value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleProcessIndent}>
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label">
                        Order Type <span className="text-danger">*</span>
                      </label>
                      <select
                        name="orderType"
                        className="form-select"
                        value={indentForm.orderType}
                        onChange={handleIndentFormChange}
                      >
                        <option value="">Select Order Type</option>
                        <option value="Inhouse">Inhouse</option>
                        <option value="Out Source">Out Source</option>
                        <option value="PMS">PMS</option>
                      </select>
                      <small className="text-danger">{errors.orderType}</small>
                    </div>

                    {indentForm.orderType && (
                      <div className="col-md-3">
                        <label className="form-label">PO Number</label>
                        <input
                          type="text"
                          name="purchaseOrderNo"
                          className="form-control"
                          value={indentForm.purchaseOrderNo}
                          onChange={handleIndentFormChange}
                        />
                        <small className="text-danger">
                          {errors.purchaseOrderNo}
                        </small>
                      </div>
                    )}

                    {indentForm.orderType && (
                      <div className="col-md-2">
                        <label className="form-label">PO Date</label>
                        <input
                          type="date"
                          name="poDate"
                          className="form-control"
                          value={indentForm.poDate}
                          onChange={handleIndentFormChange}
                        />
                        <small className="text-danger">{errors.poDate}</small>
                      </div>
                    )}

                    {indentForm.orderType &&
                      indentForm.orderType !== "Inhouse" && (
                        <div className="col-md-4">
                          <label className="form-label">Supplier Name</label>
                          <textarea
                            name="remarks"
                            className="form-control"
                            rows="2"
                            value={indentForm.remarks}
                            onChange={handleIndentFormChange}
                            placeholder="Enter remarks or supplier name"
                            required
                          />
                        </div>
                      )}

                    <div className="col-md-4">
                      <label className="form-label">Additional Remarks</label>
                      <textarea
                        name="remarks2"
                        className="form-control"
                        rows="2"
                        value={indentForm.remarks2 || ""}
                        onChange={handleIndentFormChange}
                        placeholder="Additional remarks"
                      />
                    </div>
                  </div>

                  <div className="d-flex justify-content-center gap-3 mt-4 pt-3 border-top">
                    <button type="submit" className="btn btn-success px-4">
                      {indentForm.orderType === "Inhouse"
                        ? "Process & Send to Planner"
                        : "Save Order"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary px-4"
                      onClick={() => setSelectedIndent(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================================
          PURCHASE ORDER ENTRY VIEW
          ====================================================================== */}
      {viewMode === "purchaseOrder" && (
        <>
          {/* Entry form: appears only after clicking "Purchase Order Entry" */}
          {showEntryForm && (
            <div className="po-split">
              {/* Left info panel */}
              <div className="po-side">
                <div className="po-side-brand">Purchase Order</div>

                <div className="po-side-hero">
                  <h2>Let's Get</h2>
                  <h1>Started</h1>
                  <p>
                    Fill in the order details to create a new purchase order.
                    Product details are filled automatically from the product
                    code.
                  </p>
                </div>

                <div className="po-side-foot">
                  {editingId ? "Updating Order" : "Order Entry"}
                </div>
              </div>

              {/* Right form panel */}
              <div className="po-main">
                <div className="po-heading">Purchase Order Entry Form</div>

                <form onSubmit={handleSubmit}>
                  {/* Order Category */}
                  <div className="po-radio-row mb-2">
                    <span className="po-section m-0">Order Category</span>
                    <div className="form-check m-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="orderCategory"
                        value="Stationary"
                        checked={orderCategory === "Stationary"}
                        onChange={(e) => {
                          setOrderCategory(e.target.value);
                          setForm((prev) => ({ ...prev, orderType: "" }));
                        }}
                      />
                      <label className="form-check-label">Stationary</label>
                    </div>
                    <div className="form-check m-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="orderCategory"
                        value="Security"
                        checked={orderCategory === "Security"}
                        onChange={(e) => {
                          setOrderCategory(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            orderType: "Inhouse"
                          }));
                        }}
                      />
                      <label className="form-check-label">Security</label>
                    </div>
                  </div>

                  <div className="row g-2">
                    {orderCategory === "Stationary" && (
                      <PoField
                        className="col-md-4"
                        icon="bi-receipt"
                        label="PO Number"
                        required
                        filled={has(form.purchaseOrderNo)}
                        error={errors.purchaseOrderNo}
                      >
                        <input
                          type="text"
                          name="purchaseOrderNo"
                          className="po-input"
                          value={form.purchaseOrderNo}
                          onChange={handleChange}
                        />
                      </PoField>
                    )}

                    {orderCategory === "Stationary" && (
                      <PoField
                        className="col-md-4"
                        icon="bi-calendar-event"
                        label="PO Date"
                        required
                        alwaysFloat
                        error={errors.poDate}
                      >
                        <input
                          type="date"
                          name="poDate"
                          className="po-input"
                          value={form.poDate}
                          onChange={handleChange}
                        />
                      </PoField>
                    )}

                    {orderCategory === "Stationary" && (
                      <PoField
                        className="col-md-4"
                        icon="bi-calendar-check"
                        label="Expected Date"
                        required
                        alwaysFloat
                        error={errors.expectedDeliveryDate}
                      >
                        <input
                          type="date"
                          name="expectedDeliveryDate"
                          className="po-input"
                          value={form.expectedDeliveryDate}
                          onChange={handleChange}
                          min={getMinExpectedDate()}
                        />
                      </PoField>
                    )}

                    <PoField
                      className="col-md-4"
                      icon="bi-upc-scan"
                      label="Product Code"
                      required
                      filled={has(form.productCode)}
                      error={errors.productCode}
                    >
                      <input
                        ref={productCodeRef}
                        type="text"
                        name="productCode"
                        className="po-input"
                        value={form.productCode}
                        onChange={handleChange}
                        onKeyDown={(e) =>
                          e.key === "Enter" && quantityRef.current?.focus()
                        }
                      />
                    </PoField>

                    <PoField
                      className="col-md-4"
                      icon="bi-123"
                      label="Order Quantity"
                      required
                      filled={has(form.quantity)}
                      error={errors.quantity}
                    >
                      <input
                        ref={quantityRef}
                        type="number"
                        name="quantity"
                        className="po-input"
                        value={form.quantity}
                        onChange={handleChange}
                        onKeyDown={(e) =>
                          e.key === "Enter" && locationRef.current?.focus()
                        }
                      />
                    </PoField>

                    <PoField
                      className="col-md-4"
                      icon="bi-geo-alt"
                      label="Location"
                      required
                      alwaysFloat
                      caret
                      error={errors.location}
                    >
                      <select
                        ref={locationRef}
                        name="location"
                        className="po-input"
                        value={form.location}
                        onChange={handleChange}
                      >
                        <option value="">Select Location</option>
                        {locations.map((loc) => (
                          <option key={loc._id} value={loc._id}>
                            {loc.locationName}
                          </option>
                        ))}
                      </select>
                    </PoField>
                  </div>

                  <div className="po-section">Product Information</div>

                  <div className="row g-2">
                    <PoField
                      className="col-md-4"
                      icon="bi-tag"
                      label="Product Type"
                      filled={has(form.materialType)}
                    >
                      <input
                        className="po-input"
                        value={form.materialType}
                        readOnly
                      />
                    </PoField>

                    <PoField
                      className="col-md-8"
                      icon="bi-person"
                      label="Customer"
                      filled={has(form.customerName)}
                    >
                      <input
                        className="po-input"
                        value={form.customerName}
                        readOnly
                      />
                    </PoField>

                    <PoField
                      className="col-12"
                      icon="bi-card-text"
                      label="Description"
                      filled={has(form.description)}
                    >
                      <input
                        className="po-input"
                        value={form.description}
                        readOnly
                      />
                    </PoField>
                  </div>

                  <div className="po-section">Other Information</div>

                  <div className="row g-2">
                    <PoField
                      className="col-md-4"
                      icon="bi-diagram-3"
                      label="Order Type"
                      required
                      alwaysFloat
                      caret
                      error={errors.orderType}
                    >
                      <select
                        name="orderType"
                        className="po-input"
                        value={form.orderType}
                        onChange={handleChange}
                        disabled={
                          editingId !== null || orderCategory === "Security"
                        }
                      >
                        <option value="">Select</option>
                        <option value="Inhouse">Inhouse</option>
                        <option value="Out Source">Out Source</option>
                        <option value="PMS">PMS</option>
                      </select>
                    </PoField>

                    {form.orderType === "Out Source" && (
                      <PoField
                        className="col-md-8"
                        icon="bi-truck"
                        label="Supplier Name"
                        area
                        filled={has(form.remarks)}
                      >
                        <textarea
                          name="remarks"
                          className="po-input"
                          rows="2"
                          value={form.remarks}
                          onChange={handleChange}
                          required
                          readOnly={editingId !== null}
                        />
                      </PoField>
                    )}

                    <PoField
                      className="col-12"
                      icon="bi-chat-left-text"
                      label="Remarks"
                      area
                      filled={has(form.remarks2)}
                    >
                      <textarea
                        name="remarks2"
                        className="po-input"
                        rows="2"
                        value={form.remarks2}
                        onChange={handleChange}
                      />
                    </PoField>

                    {orderCategory === "Stationary" && (
                      <PoField
                        className="col-12"
                        icon="bi-paperclip"
                        label="Upload File (PDF, XLS, XLSX)"
                        alwaysFloat
                      >
                        <input
                          type="file"
                          ref={fileRef}
                          className="po-input"
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
                                e.target.value = "";
                                setAttachment(null);
                                return;
                              }
                              setAttachment(file);
                            }
                          }}
                        />
                      </PoField>
                    )}
                  </div>

                  <button className="po-submit" type="submit">
                    {editingId ? "Update Order" : "Save Order"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ======================================================================
              FILTERS CARD
              ====================================================================== */}
          <div className="po-filter">
            <div className="po-filter-head">
              <div className="po-filter-title">
                <i className="bi bi-funnel-fill"></i>
                <span>Filters</span>
              </div>
              <span className="po-filter-count">
                {filteredOrders.length} / {orders.length} orders
              </span>
            </div>

            <div className="row g-2 align-items-end">
              <PoField
                className="col-6 col-lg-2"
                icon="bi-receipt"
                label="PO Number"
                filled={has(poSearch)}
              >
                <input
                  type="text"
                  className="po-input"
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                />
              </PoField>

              <PoField
                className="col-6 col-lg-2"
                icon="bi-calendar-event"
                label="Date"
                alwaysFloat
              >
                <input
                  type="date"
                  className="po-input"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </PoField>

              <PoField
                className="col-6 col-lg-2"
                icon="bi-upc-scan"
                label="Product Code"
                filled={has(productCodeSearch)}
              >
                <input
                  type="text"
                  className="po-input"
                  value={productCodeSearch}
                  onChange={(e) => setProductCodeSearch(e.target.value)}
                />
              </PoField>

              <PoField
                className="col-6 col-lg-3"
                icon="bi-person"
                label="Customer Name"
                alwaysFloat
                caret
              >
                <select
                  className="po-input"
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
              </PoField>

              <div className="col-12 col-lg-3 d-flex gap-2">
                <button
                  type="button"
                  className="po-fbtn export"
                  onClick={exportToExcel}
                >
                  <i className="bi bi-file-earmark-excel"></i> Export Excel
                </button>
                <button
                  type="button"
                  className="po-fbtn clear"
                  onClick={() => {
                    setPoSearch("");
                    setProductCodeSearch("");
                    setDateFilter("");
                    setCustomerFilter("");
                  }}
                >
                  <i className="bi bi-x-circle"></i> Clear
                </button>
              </div>
            </div>
          </div>

          {/* ======================================================================
              SAVED ORDERS TABLE
              ====================================================================== */}
          <div className="card shadow-lg mb-4">
            <div className="card-header text-center">
              <strong>Saved Customer Orders</strong>
            </div>

            <div
              className="table-responsive"
              style={{ maxHeight: "420px", overflowY: "auto" }}
            >
              <table
                className="table table-striped table-bordered table-hover align-middle text-center mb-0 small"
                style={{ minWidth: "1600px" }}
              >
                <thead className="table-dark sticky-top">
                  <tr>
                    <th>Ticket No</th>
                    <th>PO No</th>
                    <th>Order Date</th>
                    <th>Expected Date</th>
                    <th>Product Code</th>
                    <th>Product Type</th>
                    <th>Description</th>
                    <th>Customer</th>
                    <th>Order Qty</th>
                    <th>Location</th>
                    <th>Order Type</th>
                    <th>Supplier Name</th>
                    <th>Remarks</th>
                    <th>Attachment</th>
                    <th>User</th>
                    <th>User Location</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="17" className="p-4 text-center text-muted">
                        No Orders Found
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.slice(0, 30).map((order) => (
                      <tr key={order._id}>
                        <td className="fw-bold">{order.ticketNo || "-"}</td>
                        <td className="fw-bold text-primary">
                          {order.purchaseOrderNo || "-"}
                        </td>
                        <td>
                          {order.poDate
                            ? new Date(order.poDate).toLocaleDateString(
                                "en-IN"
                              )
                            : "-"}
                        </td>
                        <td>
                          {order.expectedDeliveryDate
                            ? new Date(
                                order.expectedDeliveryDate
                              ).toLocaleDateString("en-IN")
                            : "-"}
                        </td>
                        <td className="fw-semibold">{order.productCode}</td>
                        <td
                          className="cell-expandable"
                          style={{
                            maxWidth: "200px",
                            whiteSpace:
                              expandedCell === `material-${order._id}`
                                ? "normal"
                                : "nowrap"
                          }}
                          onClick={() =>
                            setExpandedCell(
                              expandedCell === `material-${order._id}`
                                ? null
                                : `material-${order._id}`
                            )
                          }
                        >
                          {expandedCell === `material-${order._id}`
                            ? order.materialType
                            : truncateText(order.materialType)}
                        </td>
                        <td
                          className="cell-expandable"
                          style={{
                            maxWidth: "320px",
                            whiteSpace:
                              expandedCell === `desc-${order._id}`
                                ? "normal"
                                : "nowrap"
                          }}
                          onClick={() =>
                            setExpandedCell(
                              expandedCell === `desc-${order._id}`
                                ? null
                                : `desc-${order._id}`
                            )
                          }
                        >
                          {expandedCell === `desc-${order._id}`
                            ? order.description
                            : truncateText(order.description)}
                        </td>
                        <td
                          className="cell-expandable"
                          style={{
                            maxWidth: "280px",
                            whiteSpace:
                              expandedCell === `cust-${order._id}`
                                ? "normal"
                                : "nowrap"
                          }}
                          onClick={() =>
                            setExpandedCell(
                              expandedCell === `cust-${order._id}`
                                ? null
                                : `cust-${order._id}`
                            )
                          }
                        >
                          {expandedCell === `cust-${order._id}`
                            ? order.customerName
                            : truncateText(order.customerName)}
                        </td>
                        <td className="fw-bold">{order.quantity}</td>
                        <td>{order.location?.locationName || "-"}</td>
                        <td>
                          <span
                            className={`badge ${
                              order.orderType === "Inhouse"
                                ? "bg-primary"
                                : order.orderType === "Out Source"
                                ? "bg-warning text-dark"
                                : "bg-info text-dark"
                            }`}
                          >
                            {order.orderType || "-"}
                          </span>
                        </td>
                        <td
                          className="cell-expandable"
                          style={{
                            maxWidth: "220px",
                            whiteSpace:
                              expandedCell === `remarks-${order._id}`
                                ? "normal"
                                : "nowrap"
                          }}
                          onClick={() =>
                            setExpandedCell(
                              expandedCell === `remarks-${order._id}`
                                ? null
                                : `remarks-${order._id}`
                            )
                          }
                        >
                          {expandedCell === `remarks-${order._id}`
                            ? order.remarks
                            : truncateText(order.remarks)}
                        </td>
                        <td
                          className="cell-expandable"
                          style={{
                            maxWidth: "220px",
                            whiteSpace:
                              expandedCell === `remarks2-${order._id}`
                                ? "normal"
                                : "nowrap"
                          }}
                          onClick={() =>
                            setExpandedCell(
                              expandedCell === `remarks2-${order._id}`
                                ? null
                                : `remarks2-${order._id}`
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
                          ) : (
                            "-"
                          )}
                        </td>
                        <td
                          style={{ cursor: "pointer", maxWidth: "200px" }}
                          onClick={() =>
                            setExpandedCell(
                              expandedCell === `user-${order._id}`
                                ? null
                                : `user-${order._id}`
                            )
                          }
                        >
                          {expandedCell === `user-${order._id}` ? (
                            <div style={{ lineHeight: "1.2" }}>
                              <div className="fw-bold">
                                {order.user || "System"}
                              </div>
                              <small className="text-muted">
                                {order.createdAt
                                  ? new Date(order.createdAt).toLocaleString(
                                      "en-IN"
                                    )
                                  : ""}
                              </small>
                            </div>
                          ) : (
                            <div>
                              <div>{truncateText(order.user || "System")}</div>
                              <small className="text-muted">
                                {truncateText(
                                  order.createdAt
                                    ? new Date(order.createdAt).toLocaleString(
                                        "en-IN"
                                      )
                                    : "",
                                  16
                                )}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          {order.userLocations?.length > 0
                            ? order.userLocations.join(", ")
                            : "-"}
                        </td>
                        <td className="text-center align-middle">
                          {order.user === loggedInUser ? (
                            <div className="d-flex gap-2 justify-content-center">
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => handleEdit(order)}
                                disabled={convertedOrderIds.includes(String(order._id))}
                                title={
                                  convertedOrderIds.includes(String(order._id))
                                    ? "Already converted to Work Order — cannot edit"
                                    : ""
                                }
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
        </>
      )}
    </div>
  );
}

export default CustomerDashboard;