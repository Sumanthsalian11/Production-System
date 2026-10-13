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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

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
    if (submitLockRef.current) return;
    if (!validateForm()) return;

    submitLockRef.current = true;
    setIsSubmitting(true);

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
          confirmButtonColor: "#3085d6",
          allowEnterKey: false,
          returnFocus: false
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
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
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
    if (submitLockRef.current) return;
    if (!validateIndentForm()) return;

    submitLockRef.current = true;
    setIsSubmitting(true);

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
          confirmButtonColor: "#3085d6",
          allowEnterKey: false,
          returnFocus: false
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
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
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
      className="container customer-dashboard-universe"
      style={{
        maxWidth: "100%",
        fontSize: "12.5px"
      }}
    >
      {/* ======================================================================
          PROFESSIONAL TEAL / ORANGE ENTERPRISE THEME
          ====================================================================== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');

        /* ---------- Theme tokens ---------- */
        .customer-dashboard-universe {
          --brand: #e4572e;
          --brand-dark: #c9461f;
          --brand-soft: #fdeee8;
          --teal: #0b3a45;
          --teal-mid: #0f5560;
          --ink: #1f2937;
          --ink-soft: #5b6676;
          --ink-mute: #8a94a3;
          --line: #e3e7ec;
          --line-soft: #eef1f4;
          --surface: #ffffff;
          --page: #f4f6f8;
          --ok: #1f9d6b;
          --warn: #d98a00;
          --danger: #d64545;
        }

        /* ---------- Page backdrop ---------- */
        .customer-dashboard-universe {
          min-height: 100vh;
          padding: 24px 28px 40px;
          color: var(--ink);
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
          font-size: 14px;
          background: var(--page) !important;
          border: none !important;
          border-radius: 0 !important;
        }

        /* ---------- Hero strip ---------- */
        .po-hero {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 14px;
          margin: 0 0 18px;
          padding: 14px 22px;
          border-radius: 8px;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
        }
        .po-hero-emblem {
          width: 40px; height: 40px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: var(--brand); font-size: 20px;
          background: var(--brand-soft);
          border: 1px solid #f7d3c6;
        }
        .customer-dashboard-universe .dash-hero-title {
          margin: 0;
          color: var(--ink);
          letter-spacing: -0.2px;
          font-size: 20px;
          font-weight: 700;
        }
        .po-user-pill {
          position: absolute; right: 20px; top: 50%; transform: translateY(-50%);
          display: flex; align-items: center; gap: 8px;
          padding: 5px 12px; border-radius: 30px;
          font-size: 13px; font-weight: 600; color: var(--ink);
          background: var(--surface);
          border: 1px solid var(--line);
        }
        .po-user-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); }

        /* ---------- Mode toggle (segmented tabs) ---------- */
        .mode-toggle-bar {
          display: flex;
          justify-content: center;
          gap: 4px;
          width: fit-content;
          margin: 0 auto 22px;
          padding: 4px;
          border-radius: 8px;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
        }
        .mode-pill-btn {
          border: 1px solid transparent;
          background: transparent;
          color: var(--ink-soft);
          border-radius: 6px;
          padding: 8px 22px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mode-pill-btn:hover { background: var(--page); color: var(--ink); }
        .mode-pill-btn.active {
          color: #ffffff;
          background: var(--brand);
          border-color: var(--brand);
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .mode-pill-btn.warning-active {
          color: #ffffff;
          background: var(--teal);
          border-color: var(--teal);
          box-shadow: 0 1px 2px rgba(11, 58, 69, 0.35);
        }

        /* ---------- Cards ---------- */
        .customer-dashboard-universe .card {
          border: 1px solid var(--line) !important;
          border-radius: 8px !important;
          background: var(--surface) !important;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06) !important;
          overflow: hidden;
        }
        .customer-dashboard-universe .card .card {
          box-shadow: none !important;
        }
        .customer-dashboard-universe .card-header {
          border: 0;
          border-bottom: 1px solid var(--line);
          border-radius: 0 !important;
          background: var(--surface) !important;
          color: var(--ink) !important;
          padding: 14px 20px;
          font-size: 16px;
          font-weight: 700;
          text-align: left !important;
        }
        .customer-dashboard-universe .card-header strong { font-weight: 700; }
        .customer-dashboard-universe .card-header .badge {
          color: var(--brand-dark) !important;
          background: var(--brand-soft) !important;
          border: 1px solid #f7d3c6;
          font-weight: 700;
        }

        .customer-dashboard-universe h4,
        .customer-dashboard-universe h5,
        .customer-dashboard-universe h6 {
          color: var(--ink) !important;
          font-weight: 700;
          padding: 4px 0;
        }

        /* ---------- Inputs / labels ---------- */
        .customer-dashboard-universe .form-label,
        .customer-dashboard-universe small {
          color: var(--ink-soft) !important;
          font-weight: 600;
          font-size: 11.5px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .customer-dashboard-universe small.text-danger { text-transform: none; font-size: 12px; }
        .customer-dashboard-universe .form-control,
        .customer-dashboard-universe .form-select,
        .customer-dashboard-universe textarea {
          min-height: 38px;
          border: 1px solid #cfd6de !important;
          border-radius: 6px;
          background-color: #ffffff !important;
          color: var(--ink);
          font-size: 14px;
          font-weight: 500;
          box-shadow: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .customer-dashboard-universe .form-control:focus,
        .customer-dashboard-universe .form-select:focus,
        .customer-dashboard-universe textarea:focus {
          border-color: var(--teal-mid) !important;
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15) !important;
        }
        .customer-dashboard-universe .bg-light {
          border-color: var(--line) !important;
          background: #fafbfc !important;
          border-radius: 8px !important;
        }
        .customer-dashboard-universe .bg-light .border {
          border-color: var(--line) !important;
        }
        .customer-dashboard-universe .text-primary { color: var(--teal-mid) !important; }
        .customer-dashboard-universe .text-muted { color: var(--ink-mute) !important; }

        /* ---------- Buttons ---------- */
        .customer-dashboard-universe .btn {
          border-radius: 6px;
          font-weight: 600;
          font-size: 13.5px;
          min-height: 36px;
          transition: all 0.15s ease;
        }
        .customer-dashboard-universe .btn:hover { transform: none; }
        .customer-dashboard-universe .btn-primary {
          background: var(--brand) !important;
          color: #ffffff !important;
          border: 1px solid var(--brand) !important;
          box-shadow: none;
        }
        .customer-dashboard-universe .btn-primary:hover {
          background: var(--brand-dark) !important;
          border-color: var(--brand-dark) !important;
        }
        .customer-dashboard-universe .btn-info {
          background: #ffffff !important;
          color: var(--teal-mid) !important;
          border: 1px solid var(--teal-mid) !important;
          box-shadow: none;
        }
        .customer-dashboard-universe .btn-info:hover {
          background: var(--teal-mid) !important;
          color: #ffffff !important;
        }
        .customer-dashboard-universe .btn-success {
          background: var(--brand) !important;
          color: #ffffff !important;
          border: 1px solid var(--brand) !important;
          box-shadow: none;
        }
        .customer-dashboard-universe .btn-success:hover {
          background: var(--brand-dark) !important;
          border-color: var(--brand-dark) !important;
        }
        .customer-dashboard-universe .btn-secondary {
          background: #ffffff !important;
          color: var(--ink) !important;
          border: 1px solid #cfd6de !important;
          box-shadow: none;
        }
        .customer-dashboard-universe .btn-secondary:hover { background: var(--page) !important; }
        .customer-dashboard-universe .btn-warning {
          background: #fff7e6 !important;
          color: #9a6200 !important;
          border: 1px solid #f2d291 !important;
          box-shadow: none;
        }
        .customer-dashboard-universe .btn-warning:hover { background: #ffecc2 !important; }
        .customer-dashboard-universe .btn-warning:disabled { opacity: 0.5; }
        .customer-dashboard-universe .btn-danger {
          background: #fdecec !important;
          color: #b42323 !important;
          border: 1px solid #f3c1c1 !important;
          box-shadow: none;
        }
        .customer-dashboard-universe .btn-danger:hover { background: #f9d4d4 !important; }
        .customer-dashboard-universe .btn-sm { min-height: 28px; font-size: 12.5px; border-radius: 6px; }

        /* ---------- Tables ---------- */
        .customer-dashboard-universe .table-responsive {
          background: #ffffff !important;
          border-radius: 0;
        }
        .customer-dashboard-universe table { color: var(--ink); background: #ffffff; margin-bottom: 0; }
        .customer-dashboard-universe thead th {
          background: #f7f9fb !important;
          color: var(--ink-soft) !important;
          border-color: var(--line) !important;
          border-bottom: 1px solid var(--line) !important;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          vertical-align: middle;
          white-space: nowrap;
          text-align: center;
          padding: 12px 10px;
        }
        .customer-dashboard-universe tbody td {
          border-color: var(--line-soft) !important;
          vertical-align: middle;
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
          background: #ffffff;
          padding: 10px;
        }
        .customer-dashboard-universe .table-striped > tbody > tr:nth-of-type(odd) > * {
          --bs-table-accent-bg: transparent;
          background: #ffffff;
        }
        .customer-dashboard-universe tbody tr:nth-child(even) td { background: #fafbfc; }
        .customer-dashboard-universe tbody tr:hover td { background: var(--brand-soft) !important; }

        .customer-dashboard-universe .badge.bg-primary { background: var(--teal-mid) !important; color: #fff !important; }
        .customer-dashboard-universe .badge.bg-warning { background: #fff3d6 !important; color: #8a5a00 !important; }
        .customer-dashboard-universe .badge.bg-info { background: #e3f1f4 !important; color: var(--teal-mid) !important; }
        .customer-dashboard-universe .badge { font-weight: 600; border-radius: 4px; padding: 5px 9px; }

        .cell-expandable {
          cursor: pointer;
          color: var(--teal-mid);
          font-weight: 600;
          text-decoration: underline dotted;
        }
        .cell-expandable:hover { color: var(--brand); }

        /* ===== Purchase Order Entry: split form ===== */
        .po-split {
          display: flex;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--line);
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.07);
          margin: 0 auto 22px;
          max-width: 1000px;
        }

        .po-side {
          flex: 0 0 31%;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px 24px;
          color: #ffffff;
          background: linear-gradient(170deg, #0b3a45 0%, #0f5560 100%);
        }
        .po-side::before {
          content: ''; position: absolute; width: 260px; height: 260px; border-radius: 50%;
          right: -110px; top: -90px; background: rgba(255, 255, 255, 0.06);
        }
        .po-side::after {
          content: ''; position: absolute; width: 200px; height: 200px; border-radius: 50%;
          left: -90px; bottom: -80px; background: rgba(228, 87, 46, 0.18);
        }
        .po-side > * { position: relative; z-index: 1; }

        .po-side-brand {
          font-weight: 700;
          font-size: 0.72rem;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #ffb59c;
        }

        .po-side-hero h2 {
          margin: 0;
          color: #ffffff !important;
          font-size: 1.35rem;
          font-weight: 600;
          line-height: 1.15;
          padding: 0;
        }

        .po-side-hero h1 {
          margin: 0 0 12px;
          color: #ffffff;
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.5px;
        }

        .po-side-hero p {
          margin: 0;
          max-width: 210px;
          font-size: 0.72rem;
          line-height: 1.55;
          color: #c9dde1;
        }

        .po-side-foot {
          color: #ffb59c;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .po-main {
          flex: 1;
          min-width: 0;
          padding: 22px 28px 20px;
          background: #ffffff;
        }

        .po-heading {
          text-align: left;
          color: var(--ink);
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: none;
          padding-bottom: 10px;
          margin-bottom: 14px;
          border-bottom: 1px solid var(--line);
        }

        .po-section {
          color: var(--ink);
          font-size: 0.8rem;
          font-weight: 700;
          margin: 14px 0 8px;
          padding-left: 8px;
          border-left: 3px solid var(--brand);
        }

        .po-radio-row {
          display: flex;
          gap: 20px;
          align-items: center;
          margin-bottom: 6px;
        }

        .po-radio-row label {
          color: var(--ink);
          font-size: 0.8rem;
          font-weight: 600;
        }
        .po-radio-row .po-section { margin: 0; }
        .customer-dashboard-universe .form-check-input:checked {
          background-color: var(--brand);
          border-color: var(--brand);
        }
        .customer-dashboard-universe .form-check-input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(228, 87, 46, 0.18);
        }

        .po-field {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 38px;
          background: #ffffff;
          border: 1px solid #cfd6de;
          border-radius: 6px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .po-field:focus-within {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }

        .po-field-icon {
          position: absolute;
          left: 10px;
          color: var(--ink-mute);
          font-size: 0.88rem;
          pointer-events: none;
        }

        .po-field .po-input {
          width: 100%;
          min-height: 36px;
          padding: 6px 8px 6px 32px;
          border: none !important;
          outline: none;
          background: transparent !important;
          box-shadow: none !important;
          color: var(--ink);
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 500;
          border-radius: 6px;
        }
        .po-field .po-input[readonly] { color: var(--ink-soft); background: #f7f9fb !important; }

        .po-field select.po-input {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          padding-right: 28px;
        }

        .po-field select.po-input:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .po-field textarea.po-input {
          resize: vertical;
          padding-top: 10px;
        }

        .po-field input[type="file"].po-input {
          padding-top: 8px;
          font-weight: 500;
        }

        .po-caret {
          position: absolute;
          right: 10px;
          font-size: 0.7rem;
          color: var(--ink-mute);
          pointer-events: none;
        }

        .po-field-label {
          position: absolute;
          left: 32px;
          top: 50%;
          transform: translateY(-50%);
          padding: 0 4px;
          background: #ffffff;
          color: var(--ink-mute);
          font-size: 0.78rem;
          font-weight: 500;
          pointer-events: none;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .po-field.po-area .po-field-label { top: 17px; }
        .po-field.po-area .po-field-icon { top: 11px; }

        .po-field:focus-within .po-field-label,
        .po-field.is-floated .po-field-label {
          top: 0;
          left: 24px;
          font-size: 0.64rem;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: var(--teal-mid);
        }

        .po-req { color: var(--danger); }

        .po-err {
          color: var(--danger) !important;
          font-size: 0.72rem;
          font-weight: 600;
          margin-top: 3px;
        }

        .po-submit {
          display: block;
          width: 42%;
          min-width: 190px;
          margin: 18px auto 4px;
          padding: 10px;
          font-size: 0.84rem;
          border: 1px solid var(--brand);
          border-radius: 6px;
          color: #ffffff;
          font-family: inherit;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          background: var(--brand);
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
          transition: all 0.15s ease;
        }

        .po-submit:hover { background: var(--brand-dark); border-color: var(--brand-dark); }
        .po-submit:active { transform: translateY(1px); }
        .po-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 992px) {
          .po-split { flex-direction: column; }
          .po-side { flex: none; min-height: 160px; padding: 20px; gap: 14px; }
          .po-side-hero h2 { font-size: 1.3rem; }
          .po-side-hero h1 { font-size: 2.2rem; margin-bottom: 6px; }
          .po-main { padding: 22px 16px; }
          .po-submit { width: 100%; }
        }

        /* ===== Filters bar ===== */
        .po-filter {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
          padding: 12px 18px 16px;
          margin-bottom: 18px;
        }

        .po-filter-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 10px;
          margin-bottom: 14px;
          border-bottom: 1px solid var(--line);
        }

        .po-filter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ink);
          font-size: 0.95rem;
          font-weight: 700;
        }

        .po-filter-title i {
          width: 26px; height: 26px; border-radius: 6px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--brand); font-size: 0.78rem;
          background: var(--brand-soft);
          border: 1px solid #f7d3c6;
        }

        .po-filter-count {
          background: var(--page);
          color: var(--ink-soft);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 3px 12px;
          font-size: 0.72rem;
          font-weight: 600;
        }

        .po-fbtn {
          flex: 1 1 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 38px;
          padding: 0 12px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.3px;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .po-fbtn:active { transform: translateY(1px); }

        .po-fbtn.export {
          color: #ffffff;
          background: var(--brand);
          border: 1px solid var(--brand);
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .po-fbtn.export:hover { background: var(--brand-dark); border-color: var(--brand-dark); }

        .po-fbtn.clear {
          background: #ffffff;
          color: var(--ink);
          border: 1px solid #cfd6de;
        }

        .po-fbtn.clear:hover { background: var(--page); border-color: var(--teal-mid); color: var(--teal-mid); }

        /* ---------- Scrollbars ---------- */
        .customer-dashboard-universe .table-responsive::-webkit-scrollbar { height: 8px; width: 8px; }
        .customer-dashboard-universe .table-responsive::-webkit-scrollbar-thumb { background: #c5ccd5; border-radius: 8px; }
        .customer-dashboard-universe .table-responsive::-webkit-scrollbar-track { background: #f1f3f6; }

        @media (max-width: 768px) {
          .customer-dashboard-universe { padding: 14px; }
          .customer-dashboard-universe .dash-hero-title { font-size: 18px; }
          .po-user-pill { position: static; transform: none; }
          .po-hero { flex-wrap: wrap; }
        }

        /* ---------- Small field icons (Order Requests form, CSS-only) ---------- */
.customer-dashboard-universe select.form-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px;
  padding-right: 30px !important;
  appearance: none; -webkit-appearance: none;
}

.customer-dashboard-universe select.form-select[name="orderType"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='2' width='6' height='6' rx='1'/%3E%3Crect x='2' y='16' width='6' height='6' rx='1'/%3E%3Crect x='16' y='16' width='6' height='6' rx='1'/%3E%3Cpath d='M12 8v4M5 16v-4h14v4'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
  appearance: none; -webkit-appearance: none;
}

.customer-dashboard-universe input.form-control[name="purchaseOrderNo"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpath d='M14 2v6h6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.customer-dashboard-universe input.form-control[type="date"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cpath d='M16 2v4M8 2v4M3 10h18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.customer-dashboard-universe textarea.form-control[name="remarks"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 3h15v13H1zM16 8h4l3 3v5h-7z'/%3E%3Ccircle cx='5.5' cy='18.5' r='2'/%3E%3Ccircle cx='18.5' cy='18.5' r='2'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px 11px;
  background-size: 15px;
  padding-left: 33px !important;
}

.customer-dashboard-universe textarea.form-control[name="remarks2"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px 11px;
  background-size: 15px;
  padding-left: 33px !important;
}

        .customer-dashboard-universe .po-field-icon { font-size: 0.78rem !important; }

        /* =====================================================================
           PLANNER PAGE LOOK: font, sizes, black text, light buttons,
           column header colour (appended override, no logic change)
           ===================================================================== */
        .customer-dashboard-universe {
          --ink: #000000;
          --ink-soft: #000000;
          --ink-mute: #000000;
          --field-line: #cfd6de;
          --teal-soft: #e3f1f4;
          font-size: 12.5px !important;
        }

        /* headings / helper text */
        .customer-dashboard-universe h4 { font-size: 16px; }
        .customer-dashboard-universe h5 { font-size: 14px; }
        .customer-dashboard-universe h6 { font-size: 13px; }
        .customer-dashboard-universe small,
        .customer-dashboard-universe .small { font-size: 11.5px; color: #000000 !important; }
        .customer-dashboard-universe .form-label { font-size: 11.5px; }
        .customer-dashboard-universe .text-primary,
        .customer-dashboard-universe .text-muted,
        .customer-dashboard-universe .text-dark { color: #000000 !important; }
        .customer-dashboard-universe .card-header { font-size: 14px; }
        .customer-dashboard-universe .dash-hero-title { font-size: 18px; }

        /* top mode tabs: smaller, black text, light selected fill */
        .customer-dashboard-universe .mode-pill-btn { font-size: 12px; padding: 5px 14px; color: #000000; }
        .customer-dashboard-universe .mode-pill-btn:hover { color: #000000; }
        .customer-dashboard-universe .mode-pill-btn.active {
          background: #fde3d8; border-color: #f5b9a1; color: #000000; box-shadow: none;
        }
        .customer-dashboard-universe .mode-pill-btn.warning-active {
          background: #d5e9ee; border-color: #a9cdd6; color: #000000; box-shadow: none;
        }

        /* buttons: size + light colours, black text */
        .customer-dashboard-universe .btn { font-size: 12px; min-height: 32px; color: #000000; }
        .customer-dashboard-universe .btn-sm { font-size: 11px; min-height: 26px; }
        .customer-dashboard-universe .btn-primary,
        .customer-dashboard-universe .btn-success {
          background: #fde3d8 !important; border: 1px solid #f5b9a1 !important; color: #000000 !important;
        }
        .customer-dashboard-universe .btn-primary:hover,
        .customer-dashboard-universe .btn-success:hover {
          background: #fbd0bf !important; border-color: #f0a48a !important; color: #000000 !important;
        }
        .customer-dashboard-universe .btn-info {
          background: #e8f3f6 !important; border: 1px solid #b9d6dd !important; color: #000000 !important;
        }
        .customer-dashboard-universe .btn-info:hover {
          background: #d5e9ee !important; color: #000000 !important;
        }
        .customer-dashboard-universe .btn-secondary { color: #000000 !important; }
        .customer-dashboard-universe .btn-warning { background: #fff3d6 !important; color: #000000 !important; }
        .customer-dashboard-universe .btn-danger { background: #fdecec !important; color: #000000 !important; }
        .customer-dashboard-universe .po-fbtn { font-size: 12px; min-height: 34px; }
        .customer-dashboard-universe .po-fbtn.export {
          background: #fde3d8; border-color: #f5b9a1; color: #000000; box-shadow: none;
        }
        .customer-dashboard-universe .po-fbtn.export:hover {
          background: #fbd0bf; border-color: #f0a48a;
        }
        .customer-dashboard-universe .po-fbtn.clear { color: #000000; }
        .customer-dashboard-universe .po-submit { font-size: 12.5px; }

        /* badges */
        .customer-dashboard-universe .badge.bg-primary { background: #d5e9ee !important; color: #000000 !important; }
        .customer-dashboard-universe .badge.bg-warning { color: #000000 !important; }
        .customer-dashboard-universe .badge.bg-info { color: #000000 !important; }
        .customer-dashboard-universe .badge { font-size: 11px; }
        .customer-dashboard-universe .cell-expandable { color: #000000; }

        /* tables: column heading colour (slightly darker teal), black text */
        .customer-dashboard-universe table { font-size: 12px; }
        .customer-dashboard-universe thead th {
          background: #a9d0d9 !important;
          color: #000000 !important;
          border: 1px solid #8fbcc7 !important;
          font-size: 10.5px;
          font-weight: 700;
          padding: 9px 10px;
        }
        .customer-dashboard-universe tbody td { font-size: 12px; color: #000000; padding: 7px 10px; }

        /* split entry form (same as Planner Create Work Order) */
        .customer-dashboard-universe .po-heading { font-size: 17px; }
        .customer-dashboard-universe .po-section { font-size: 13px; color: #000000; }
        .customer-dashboard-universe .po-side-brand { font-size: 11.5px; }
        .customer-dashboard-universe .po-side-hero h2 { font-size: 21px; }
        .customer-dashboard-universe .po-side-hero h1 { font-size: 38px; }
        .customer-dashboard-universe .po-side-hero p { font-size: 12px; }
        .customer-dashboard-universe .po-side-foot { font-size: 11px; }
        .customer-dashboard-universe .po-radio-row label { font-size: 12.5px; color: #000000; }

        /* floating-label fields */
        .customer-dashboard-universe .po-field { min-height: 36px; }
        .customer-dashboard-universe .po-field .po-input { font-size: 0.8rem; min-height: 34px; color: #000000; }
        .customer-dashboard-universe .po-field-icon { font-size: 0.8rem !important; }
        .customer-dashboard-universe .po-field-label { font-size: 0.8rem; color: #000000; }
        .customer-dashboard-universe .po-field:focus-within .po-field-label,
        .customer-dashboard-universe .po-field.is-floated .po-field-label { font-size: 0.62rem; color: #000000; }
        .customer-dashboard-universe .po-err { font-size: 0.7rem; }
        .customer-dashboard-universe .form-control,
        .customer-dashboard-universe .form-select,
        .customer-dashboard-universe textarea { font-size: 12.5px; color: #000000; }

        /* filter bar heading */
        .customer-dashboard-universe .po-filter-title { font-size: 13.5px; }
        .customer-dashboard-universe .po-filter-count { font-size: 11px; color: #000000; }

        /* =====================================================================
           page entrance animation (appended, css only)
           ===================================================================== */
        @keyframes pgfadeup {
          from { opacity: 0; transform: translatey(18px); }
          to   { opacity: 1; transform: translatey(0); }
        }
        @keyframes pgfadedown {
          from { opacity: 0; transform: translatey(-14px); }
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
        @keyframes pgrow {
          from { opacity: 0; transform: translatey(8px); }
          to   { opacity: 1; transform: translatey(0); }
        }

        /* page container */
        .customer-dashboard-universe {
          animation: pgfadeup 0.45s ease-out backwards;
        }

        /* top tabs */
        .customer-dashboard-universe .mode-toggle-bar {
          animation: pgfadedown 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
        }

        /* entry form (also plays each time it opens) */
        .customer-dashboard-universe .po-split {
          animation: pgpop 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
        }
        .customer-dashboard-universe .po-side {
          animation: pgslideright 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.35s backwards;
        }
        .customer-dashboard-universe .po-main .po-heading,
        .customer-dashboard-universe .po-main .po-radio-row,
        .customer-dashboard-universe .po-main .po-section,
        .customer-dashboard-universe .po-main .row {
          animation: pgfadeup 0.45s ease-out backwards;
        }
        .customer-dashboard-universe .po-main .po-heading   { animation-delay: 0.40s; }
        .customer-dashboard-universe .po-main .po-radio-row { animation-delay: 0.46s; }
        .customer-dashboard-universe .po-main .row          { animation-delay: 0.52s; }
        .customer-dashboard-universe .po-main .po-section   { animation-delay: 0.58s; }
        .customer-dashboard-universe .po-submit {
          animation: pgfadeup 0.45s ease-out 0.7s backwards;
        }

        /* filters + tables */
        .customer-dashboard-universe .po-filter {
          animation: pgfadeup 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s backwards;
        }
        .customer-dashboard-universe .card {
          animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.4s backwards;
        }
        .customer-dashboard-universe .card .card { animation: none; }

        /* table rows: quick stagger on the first rows */
        .customer-dashboard-universe tbody tr { animation: pgrow 0.35s ease-out backwards; }
        .customer-dashboard-universe tbody tr:nth-child(1)  { animation-delay: 0.55s; }
        .customer-dashboard-universe tbody tr:nth-child(2)  { animation-delay: 0.60s; }
        .customer-dashboard-universe tbody tr:nth-child(3)  { animation-delay: 0.65s; }
        .customer-dashboard-universe tbody tr:nth-child(4)  { animation-delay: 0.70s; }
        .customer-dashboard-universe tbody tr:nth-child(5)  { animation-delay: 0.75s; }
        .customer-dashboard-universe tbody tr:nth-child(6)  { animation-delay: 0.80s; }
        .customer-dashboard-universe tbody tr:nth-child(7)  { animation-delay: 0.85s; }
        .customer-dashboard-universe tbody tr:nth-child(8)  { animation-delay: 0.90s; }
        .customer-dashboard-universe tbody tr:nth-child(n+9) { animation-delay: 0.95s; }

        /* respect users who disable motion */
        @media (prefers-reduced-motion: reduce) {
          .customer-dashboard-universe,
          .customer-dashboard-universe * {
            animation: none !important;
          }
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
            <div className="po-split">
              {/* Left info panel */}
              <div className="po-side">
                <div className="po-side-brand">Order Request</div>

                <div className="po-side-hero">
                  <h2>Let's Process</h2>
                  <h1>Indent</h1>
                  <p>
                    Review the indent details and choose the order type to
                    create the purchase order.
                  </p>
                </div>

                <div className="po-side-foot">
                  Indent #{selectedIndent.indentNo}
                </div>
              </div>

              {/* Right form panel */}
              <div className="po-main">
                <div className="po-heading">Process Indent Form</div>

                <div className="po-section" style={{ marginTop: 0 }}>
                  Indent Information
                </div>

                <div className="row g-2">
                  {[
                    ["Indent No", selectedIndent.indentNo, "bi-hash", "col-md-4"],
                    [
                      "Product Code",
                      selectedIndent.items[0]?.productCode,
                      "bi-upc-scan",
                      "col-md-4"
                    ],
                    [
                      "Product Type",
                      selectedIndent.items[0]?.materialType || "-",
                      "bi-tag",
                      "col-md-4"
                    ],
                    [
                      "Description",
                      selectedIndent.items[0]?.description || "-",
                      "bi-card-text",
                      "col-12"
                    ],
                    [
                      "Customer",
                      selectedIndent.items[0]?.customerName || "-",
                      "bi-person",
                      "col-md-8"
                    ],
                    [
                      "Quantity",
                      selectedIndent.items[0]?.quantity,
                      "bi-123",
                      "col-md-4"
                    ],
                    [
                      "Location",
                      selectedIndent.location?.locationName || "-",
                      "bi-geo-alt",
                      "col-md-4"
                    ],
                    [
                      "Unit Rate",
                      selectedIndent.items[0]?.unitRate || "-",
                      "bi-currency-rupee",
                      "col-md-4"
                    ],
                    [
                      "Expected Date",
                      selectedIndent.items[0]?.deliveryDate
                        ? new Date(
                            selectedIndent.items[0].deliveryDate
                          ).toLocaleDateString("en-IN")
                        : "-",
                      "bi-calendar-check",
                      "col-md-4"
                    ],
                    [
                      "Customer PO No",
                      selectedIndent.items[0]?.customerPoNo || "-",
                      "bi-receipt",
                      "col-md-4"
                    ],
                    [
                      "Customer PO Date",
                      selectedIndent.items[0]?.customerPoDate
                        ? new Date(
                            selectedIndent.items[0].customerPoDate
                          ).toLocaleDateString("en-IN")
                        : "-",
                      "bi-calendar-event",
                      "col-md-4"
                    ],
                    [
                      "Item PDF",
                      selectedIndent.items[0]?.itemPdfPath ? "Attached" : "-",
                      "bi-paperclip",
                      "col-md-4"
                    ]
                  ].map(([label, value, icon, colClass], i) => (
                    <PoField
                      key={i}
                      className={colClass}
                      icon={icon}
                      label={label}
                      alwaysFloat
                    >
                      <input
                        className="po-input"
                        value={value ?? ""}
                        readOnly
                      />
                    </PoField>
                  ))}
                </div>

                <form onSubmit={handleProcessIndent}>
                  <div className="po-section">Order Information</div>

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
                        value={indentForm.orderType}
                        onChange={handleIndentFormChange}
                      >
                        <option value="">Select Order Type</option>
                        <option value="Inhouse">Inhouse</option>
                        <option value="Out Source">Out Source</option>
                        <option value="PMS">PMS</option>
                      </select>
                    </PoField>

                    {indentForm.orderType && (
                      <PoField
                        className="col-md-4"
                        icon="bi-receipt"
                        label="PO Number"
                        filled={has(indentForm.purchaseOrderNo)}
                        error={errors.purchaseOrderNo}
                      >
                        <input
                          type="text"
                          name="purchaseOrderNo"
                          className="po-input"
                          value={indentForm.purchaseOrderNo}
                          onChange={handleIndentFormChange}
                        />
                      </PoField>
                    )}

                    {indentForm.orderType && (
                      <PoField
                        className="col-md-4"
                        icon="bi-calendar-event"
                        label="PO Date"
                        alwaysFloat
                        error={errors.poDate}
                      >
                        <input
                          type="date"
                          name="poDate"
                          className="po-input"
                          value={indentForm.poDate}
                          onChange={handleIndentFormChange}
                        />
                      </PoField>
                    )}

                    {indentForm.orderType &&
                      indentForm.orderType !== "Inhouse" && (
                        <PoField
                          className="col-12"
                          icon="bi-truck"
                          label="Supplier Name"
                          area
                          filled={has(indentForm.remarks)}
                        >
                          <textarea
                            name="remarks"
                            className="po-input"
                            rows="2"
                            value={indentForm.remarks}
                            onChange={handleIndentFormChange}
                            required
                          />
                        </PoField>
                      )}

                    <PoField
                      className="col-12"
                      icon="bi-chat-left-text"
                      label="Additional Remarks"
                      area
                      filled={has(indentForm.remarks2)}
                    >
                      <textarea
                        name="remarks2"
                        className="po-input"
                        rows="2"
                        value={indentForm.remarks2 || ""}
                        onChange={handleIndentFormChange}
                      />
                    </PoField>
                  </div>

                  <div className="d-flex justify-content-center align-items-center gap-3 mt-3">
                    <button
                      type="submit"
                      className="po-submit"
                      style={{ width: "auto", minWidth: "190px", margin: 0, padding: "10px 28px" }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Processing..."
                        : indentForm.orderType === "Inhouse"
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

                  <button className="po-submit" type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Processing..."
                      : editingId
                      ? "Update Order"
                      : "Save Order"}
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