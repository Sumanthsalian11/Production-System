import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import Swal from "sweetalert2";
import JsBarcode from "jsbarcode";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";

// ============================================================================
// 🎨 CRISP 3D SVG ICONS (Embedded directly - zero external icon dependencies)
// ============================================================================
const Icons = {
  Layers: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Tag: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  Cart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  Search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Filter: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Excel: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <path d="M8 13l3 4m0-4l-3 4" /><path d="M14 13l3 4m0-4l-3 4" />
    </svg>
  ),
  PDF: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Barcode: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="5" x2="3" y2="19" /><line x1="6" y1="5" x2="6" y2="19" />
      <line x1="9" y1="5" x2="9" y2="19" /><line x1="13" y1="5" x2="13" y2="19" />
      <line x1="17" y1="5" x2="17" y2="19" /><line x1="21" y1="5" x2="21" y2="19" />
    </svg>
  ),
  Box: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Clipboard: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  Reset: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  List: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Inbox: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  Done: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
};

// Outlined floating-label field with a leading icon (same as Customer Dashboard)
const has = (v) => v !== "" && v !== null && v !== undefined;

function PoField({
  icon,
  label,
  required,
  filled,
  alwaysFloat,
  caret,
  area,
  className = "",
  style,
  labelClass = "",
  children
}) {
  return (
    <div className={className} style={style}>
      <div
        className={`po-field ${filled || alwaysFloat ? "is-floated" : ""} ${
          area ? "po-area" : ""
        }`}
      >
        {icon && <i className={`bi ${icon} po-field-icon`}></i>}
        {children}
        <label className={`po-field-label ${labelClass}`}>
          {label}
          {required && <span className="po-req"> *</span>}
        </label>
        {caret && <i className="bi bi-chevron-down po-caret"></i>}
      </div>
    </div>
  );
}

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

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true); // first load only
  const [expandedCell, setExpandedCell] = useState(null);

  // ===== Locations master (for Outer Label auto-fill) =====
  const [locationsMaster, setLocationsMaster] = useState([]);
  const [outerLabelLocationId, setOuterLabelLocationId] = useState("");

  // ===== Outer Label Entry (separate lightweight screen) =====
  const [plannerViewMode, setPlannerViewMode] = useState("main"); // "main" | "outerLabelEntry"
  const [outerLabelWoInput, setOuterLabelWoInput] = useState("");
  const [outerLabelWo, setOuterLabelWo] = useState(null);
  const [outerLabelLoading, setOuterLabelLoading] = useState(false);
  const [outerLabelForm, setOuterLabelForm] = useState({ boxQty: "", dispatchLocation: "", unitType: "" });

  // Filter states
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterWoNo, setFilterWoNo] = useState("");
  const [filterProductCode, setFilterProductCode] = useState("");
  const [filterMachine, setFilterMachine] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const showAlert = (title, text, icon = "warning") => {
    Swal.fire({
      title: title,
      text: text,
      confirmButtonColor: "#0284c7",
      confirmButtonText: "OK",
      width: "380px"
    });
  };

  const [workRows, setWorkRows] = useState([
    {
      activityId: "",
      machineId: "",
      inches: "",
      slitNumber: "",
      UPS: "",
      isBooklet: false,
      isPerfecting: false,
      pages: "",
      component: "",
      materialCode: "",
      materialDescription: "",
      materialGroupDescription: "",
      mill: "",
      gsm: "",
      paperSize: "",
      paperQty: "",
      isDraft: true
    }
  ]);

  const [priorities, setPriorities] = useState([]);
  const formRef = useRef(null);

  // ⭐ Activity 2 (additional activities, multi-select checkboxes)
  const [activity2, setActivity2] = useState([]);
  const [showActivity2Dropdown, setShowActivity2Dropdown] = useState(false);

  // ⭐ Modal state for Activity/Machine/Paper Code entries
  const [showRowModal, setShowRowModal] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [isNewRow, setIsNewRow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);

  const [workOrderForm, setWorkOrderForm] = useState({
    workorder2: "",
    priority: "",
    machines: [],
    productCode: "",
    inches: "",
    slitNumber: "",
    colorFront: "",
    colorBack: "",
    materialCode: "",
    materialDescription: "",
    materialGroupDescription: "",
    mill: "",
    gsm: "",
    paperQty: "",
    orderQty: "",
    wasteQty: "",
    totalQty: "",
    jobSize: "",
    paperSize: "",
    UPS: "",
    dispatchLocation: "",
    boxQty: "",
    impFront: "",
    impBack: "",
    totalImp: "",
    inkDetails: "",
    remarks: ""
  });

  const cust = () => {
    navigate("/customer-dashboard");
  };

  const [userLocations, setUserLocations] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setLoggedInUser(decoded.name || "");
        setUserLocations(decoded.locations || []);
      } catch (err) {
        console.error("Token decoding failed:", err);
      }
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
      const filtered = (res.data || []).filter(wo => wo.status === "PLANNED");
      setWorkOrders(filtered);
    } catch (err) {
      console.error("Error fetching work orders:", err);
    }
  };

  // Fetch data
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setLoggedInUser(decoded.name || "");
      } catch (err) {
        console.error("Token decoding failed:", err);
      }
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [orderRes, printingRes, workRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/customer-orders`, {
            params: {
              status: "ORDER_RECEIVED",
              orderType: "Inhouse"
            },
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          }),
          axios.get(`${BASE_URL}/api/printing-instructions`),
          axios.get(`${BASE_URL}/api/workorders`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          })
        ]);

        const filteredPrinting = printingRes.data.filter(
          p => p.status === "ORDER_RECEIVED"
        );

        const workOrdersData = workRes.data || [];

        const convertedOrderIds = workOrdersData
          .map(w => String(w.customerOrderId))
          .filter(Boolean);

        const filteredOrders = (orderRes.data || []).filter(
          o => !convertedOrderIds.includes(String(o._id))
        );

        setOrders(filteredOrders);
        setPrintingOrders(filteredPrinting || []);
        setWorkOrders(workOrdersData.filter(wo => wo.status === "PLANNED"));
      } catch (err) {
        console.error("FETCH ERROR:", err);
        setOrders([]);
      }
      setLoading(false);
      setPageLoading(false);
    };

    fetchData();
    fetchMachines();
    fetchMaterials();
    fetchActivities();
    fetchPriorities();
    fetchLocationsMaster();
  }, [statusFilter]);

  const fetchMachines = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/machines`);
      setMachines(res.data || []);
    } catch (err) {
      console.error("Error fetching machines:", err);
    }
  };

  const handleFetchWoForLabel = async () => {
    if (!outerLabelWoInput.trim()) {
      showAlert("Enter a WO Number first");
      return;
    }

    setOuterLabelLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/workorders`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      const found = (res.data || []).find(
        wo => String(wo.efiWoNumber) === outerLabelWoInput.trim()
      );

      if (!found) {
        showAlert("Work Order Not Found", `No Work Order found with number ${outerLabelWoInput}`, "error");
        setOuterLabelWo(null);
        return;
      }

      setOuterLabelWo(found);
      setOuterLabelForm({
        boxQty: found.boxQty || "",
        dispatchLocation: found.dispatchLocation || "",
        unitType: ""
      });
    } catch (err) {
      console.error("Error fetching WO for label:", err);
      showAlert("Error fetching Work Order", "", "error");
    } finally {
      setOuterLabelLoading(false);
    }
  };

  const handleOuterLabelFormChange = (e) => {
    const { name, value } = e.target;
    setOuterLabelForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveOuterLabelInfo = async (andDownload = false) => {
    if (!outerLabelWo) {
      showAlert("Fetch a Work Order first");
      return;
    }
    if (!outerLabelForm.boxQty) {
      showAlert("Quantity in Box is required");
      return;
    }
    if (!outerLabelForm.dispatchLocation.trim()) {
      showAlert("Dispatch Location is required");
      return;
    }
    if (!outerLabelForm.unitType) {
      showAlert("Please select a Unit (Each or Sheet)");
      return;
    }
    if (!outerLabelLocationId) {
      showAlert("Please select a Location");
      return;
    }

    const rawBoxQty = Number(outerLabelForm.boxQty) || 0;
    const finalBoxQty =
      outerLabelForm.unitType === "sheet"
        ? rawBoxQty * 3
        : rawBoxQty;

    const payload = {
      ...outerLabelWo,
      customer: outerLabelWo.customer?.name || outerLabelWo.customer,
      location: outerLabelWo.location?.locationName || outerLabelWo.location,
      boxQty: finalBoxQty,
      dispatchLocation: outerLabelForm.dispatchLocation,
      boxQtyEntered: rawBoxQty,
      boxUnitType: outerLabelForm.unitType
    };

    try {
      await axios.patch(
        `${BASE_URL}/api/workorders/${outerLabelWo._id}/outer-label`,
        {
          boxQty: finalBoxQty,
          dispatchLocation: outerLabelForm.dispatchLocation,
          boxQtyEntered: rawBoxQty,
          boxUnitType: outerLabelForm.unitType
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      const updatedWo = { ...outerLabelWo, ...payload };

      showAlert("Saved ✅", `Quantity in Box and Dispatch Location updated for WO ${updatedWo.efiWoNumber}`, "success");

      if (andDownload) {
        downloadOuterLabel([updatedWo]);
      }

      const [
        ,,,,,,
        orderRes,
        workRes2,
        printingRes
      ] = await Promise.all([
        fetchWorkOrders(),
        fetchMachines(),
        fetchMaterials(),
        fetchActivities(),
        fetchPriorities(),
        fetchLocationsMaster(),
        axios.get(`${BASE_URL}/api/customer-orders`, {
          params: { status: "ORDER_RECEIVED", orderType: "Inhouse" },
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }),
        axios.get(`${BASE_URL}/api/workorders`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }),
        axios.get(`${BASE_URL}/api/printing-instructions`)
      ]);

      const convertedOrderIds = (workRes2.data || [])
        .map(w => String(w.customerOrderId))
        .filter(Boolean);
      const filteredOrders = (orderRes.data || []).filter(
        o => !convertedOrderIds.includes(String(o._id))
      );
      setOrders(filteredOrders);

      const filteredPrinting = printingRes.data.filter(p => p.status === "ORDER_RECEIVED");
      setPrintingOrders(filteredPrinting || []);

      setOuterLabelWoInput("");
      setOuterLabelWo(null);
      setOuterLabelForm({ boxQty: "", dispatchLocation: "", unitType: "" });
      setOuterLabelLocationId("");
    } catch (err) {
      console.error("Error saving outer label info:", err);
      showAlert("Error saving Work Order", "", "error");
    }
  };

  const fetchLocationsMaster = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/locations`);
      setLocationsMaster(res.data || []);
    } catch (err) {
      console.error("Error fetching locations:", err);
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

  const handleSendToPrepress = async (id) => {
    try {
      await axios.patch(
        `${BASE_URL}/api/workorders/${id}/send-to-prepress`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      setWorkOrders(prev =>
        prev.map(wo => (wo._id === id ? { ...wo, sentToPrepress: true } : wo))
      );

      showAlert("Sent to Prepress ✅", "", "success");
    } catch (err) {
      console.error("Error sending to prepress:", err);
      showAlert("Error sending to Prepress", "", "error");
    }
  };

  const handleOuterLabelLocationChange = (e) => {
    const locId = e.target.value;
    setOuterLabelLocationId(locId);

    const loc = locationsMaster.find(l => l._id === locId);

    setOuterLabelForm(prev => ({
      ...prev,
      dispatchLocation: loc?.address || prev.dispatchLocation
    }));
  };

  const handleDeleteWorkOrder = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this Work Order?");
    if (!confirm) return;

    try {
      await axios.delete(`${BASE_URL}/api/workorders/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      showAlert("Deleted Successfully ✅", "", "success");

      const workRes = await axios.get(`${BASE_URL}/api/workorders`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      setWorkOrders(workRes.data || []);
    } catch (err) {
      console.error(err);
      showAlert("Error deleting Work Order", "", "error");
    }
  };

  const handleEditWorkOrder = (wo) => {
    setSelectedOrder({
      _id: wo._id,
      poDate: wo.poDate,
      customer: wo.customer?.name || wo.customer,
      productName: wo.productName || wo.description || "-",
      location: wo.location?._id || wo.location,
      qtyInLvs: wo.qtyInLvs,
      orderQty: wo.orderQty,
      productType: wo.productType || "",
      slNo: wo.slNo,
      efiWoNumber: wo.efiWoNumber,
      expectedDeliveryDate: wo.expectedDeliveryDate,
      isPrinting: !!wo.printingId,
      printingId: wo.printingId || null,
      customerOrderId: wo.customerOrderId || null,
      workorder2: wo.workorder2 || "",
      productCode: wo.productCode || "",
      itemPdfPath: wo.itemPdfPath || "",
      status: "PLANNED"
    });

    setWorkOrderForm({
      priority: wo.priority,
      colorFront: wo.colorFront,
      colorBack: wo.colorBack,
      inches: wo.inches || "",
      slitNumber: wo.slitNumber || "",
      materialCode: wo.materialCode,
      materialDescription: wo.materialDescription,
      materialGroupDescription: wo.materialGroupDescription,
      mill: wo.mill,
      gsm: wo.gsm,
      productCode: wo.productCode,
      paperSize: wo.paperSize,
      paperQty: wo.materials?.map(m => m.paperQty).join(", "),
      orderQty: wo.orderQty,
      wasteQty: wo.wasteQty,
      totalQty: wo.totalQty,
      jobSize: wo.jobSize,
      dispatchLocation: wo.dispatchLocation || "",
      boxQty: wo.boxQty || "",
      UPS: wo.UPS,
      impFront: wo.impFront,
      impBack: wo.impBack,
      totalImp: wo.totalImp,
      inkDetails: wo.inkDetails,
      remarks: wo.remarks
    });

    const machinesArr = wo.machines || [];
    const materialsArr = wo.materials || [];
    const hasRowIndex = materialsArr.some(m => m.rowIndex !== undefined && m.rowIndex !== null);
    const rowCount = Math.max(machinesArr.length, hasRowIndex ? 1 : materialsArr.length, 1);

    setWorkRows(
      Array.from({ length: rowCount }, (_, i) => {
        const pair = machinesArr[i] || {};
        const mats = hasRowIndex
          ? materialsArr.filter(m => m.rowIndex === i)
          : [materialsArr[i] || {}];
        const mat = mats[0] || {};
        const extras = mats.slice(1).map(m => ({
          materialCode: m.materialCode || "",
          materialDescription: m.materialDescription || "",
          materialGroupDescription: m.materialGroupDescription || "",
          mill: m.mill || "",
          gsm: m.gsm || "",
          paperSize: m.paperSize || "",
          paperQty: m.paperQty || ""
        }));
        return {
          activityId: pair.activityId?._id || pair.activityId || "",
          machineId: pair.machineId?._id || pair.machineId || "",
          inches: pair.inches || "",
          slitNumber: pair.slitNumber || "",
          UPS: pair.UPS || "",
          isBooklet: pair.isBooklet || false,
          isPerfecting: pair.isPerfecting || false,
          pages: pair.pages || "",
          component: pair.component || "",
          materialCode: mat.materialCode || "",
          materialDescription: mat.materialDescription || "",
          materialGroupDescription: mat.materialGroupDescription || "",
          mill: mat.mill || "",
          gsm: mat.gsm || "",
          paperSize: mat.paperSize || "",
          paperQty: mat.paperQty || "",
          extraMaterials: extras
        };
      })
    );

    setActivity2((wo.activity2 || []).map(a => a?._id || a));
  };

  // ===== Functions =====
  const handleActivityChange = (index, value) => {
    const rows = [...workRows];
    rows[index].activityId = value;
    rows[index].machineId = "";
    rows[index].inches = "";
    rows[index].slitNumber = "";
    setWorkRows(rows);
  };

  const handlePairInchesChange = (index, value) => {
    const rows = [...workRows];
    rows[index].inches = value;
    setWorkRows(rows);
  };

  const handlePairSlitChange = (index, value) => {
    const rows = [...workRows];
    rows[index].slitNumber = value;
    setWorkRows(rows);
  };

  const isOffsetActivity = (activityId) => {
    const act = activities.find(a => a._id === activityId);
    return act?.activityName?.toLowerCase().includes("offset");
  };

  const isSheetfedActivity = (activityId) => {
    const act = activities.find(a => a._id === activityId);
    const normalized = act?.activityName?.toLowerCase().replace(/\s+/g, "") || "";
    return normalized.includes("sheetfed");
  };

  const parseSlitSum = (value) => {
    return String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .reduce((sum, v) => sum + (Number(v) || 0), 0);
  };

  const computeRowImpression = (row) => {
    const colorFront = Number(workOrderForm.colorFront) || 0;
    const colorBack = Number(workOrderForm.colorBack) || 0;

    const qty = Number(workOrderForm.orderQty) || 0;
    const waste = Number(workOrderForm.wasteQty) || 0;
    const ups = Number(row.UPS) || 0;
    const totalQty = Math.round(qty + qty * (waste / 100));

    const pagesVal = Number(row.pages) || 0;
    const impQtyBase =
      row.isBooklet && pagesVal > 0 ? totalQty * pagesVal : totalQty;

    if (ups <= 0) return { impFront: 0, impBack: 0, totalImp: 0 };

    const imp = Math.round(impQtyBase / ups);
    const impFront = colorFront > 0 ? imp : 0;
    const impBack = colorBack > 0 ? imp : 0;

    const useOffsetRule = isOffsetActivity(row.activityId) || row.isPerfecting;

    const totalImp = useOffsetRule
      ? (impFront > 0 && impBack > 0
          ? Math.round((impFront + impBack) / 2)
          : impFront + impBack)
      : impFront + impBack;

    return { impFront, impBack, totalImp };
  };

  const rowImpressions = useMemo(
    () => workRows.map(row => computeRowImpression(row)),
    [
      workRows,
      workOrderForm.colorFront,
      workOrderForm.colorBack,
      workOrderForm.orderQty,
      workOrderForm.wasteQty
    ]
  );

  const handleRowUpsChange = (index, value) => {
    if (!/^[0-9]{0,2}$/.test(value)) {
      showAlert("UPS must be up to 2 digits only");
      return;
    }
    const rows = [...workRows];
    rows[index].UPS = value;
    setWorkRows(rows);
  };

  const handleRowBookletToggle = (index, checked) => {
    setWorkRows(prev => {
      const rows = [...prev];
      rows[index] = {
        ...rows[index],
        isBooklet: checked,
        pages: checked ? rows[index].pages : "",
        component: checked ? rows[index].component : ""
      };
      return rows;
    });
  };

  const handleRowPerfectingToggle = (index, checked) => {
    setWorkRows(prev => {
      const rows = [...prev];
      rows[index] = { ...rows[index], isPerfecting: checked };
      return rows;
    });
  };

  const handleRowPagesChange = (index, value) => {
    if (!/^\d*$/.test(value)) {
      showAlert("Pages must be a whole number");
      return;
    }
    const rows = [...workRows];
    rows[index].pages = value;
    setWorkRows(rows);
  };

  const handleRowComponentChange = (index, value) => {
    const rows = [...workRows];
    rows[index].component = value;
    setWorkRows(rows);
  };

  useEffect(() => {
    const totals = workRows.reduce(
      (acc, row) => {
        const r = computeRowImpression(row);
        acc.impFront += r.impFront;
        acc.impBack += r.impBack;
        acc.totalImp += r.totalImp;
        return acc;
      },
      { impFront: 0, impBack: 0, totalImp: 0 }
    );

    const qty = Number(workOrderForm.orderQty) || 0;
    const waste = Number(workOrderForm.wasteQty) || 0;
    const totalQty = Math.round(qty + qty * (waste / 100));

    setWorkOrderForm(prev => ({
      ...prev,
      totalQty,
      impFront: totals.impFront,
      impBack: totals.impBack,
      totalImp: totals.totalImp
    }));
  }, [
    workRows,
    workOrderForm.colorFront,
    workOrderForm.colorBack,
    workOrderForm.orderQty,
    workOrderForm.wasteQty
  ]);

  const handleMachineChangeForPair = (index, value) => {
    const rows = [...workRows];
    rows[index].machineId = value;
    const machine = machines.find(m => m._id === value);
    rows[index].UPS = machine?.ups ? String(machine.ups) : rows[index].UPS;
    setWorkRows(rows);
  };

  const handleMaterialChange = (index, field, value) => {
    const rows = [...workRows];
    rows[index][field] = value;

    if (field === "materialCode") {
      const material = materials.find(
        m => String(m.code).trim() === String(value).trim()
      );

      rows[index].materialDescription = material?.description || "";
      rows[index].materialGroupDescription = material?.group || "";
      rows[index].mill = material?.mill || "";
      rows[index].gsm = material?.gsm || "";
      rows[index].paperSize = material?.paperSize || "";
    }

    setWorkRows(rows);
  };

  const emptyMaterial = {
    materialCode: "", materialDescription: "", materialGroupDescription: "",
    mill: "", gsm: "", paperSize: "", paperQty: ""
  };

  const addExtraMaterial = (index) => {
    setWorkRows(prev => {
      const rows = [...prev];
      rows[index] = {
        ...rows[index],
        extraMaterials: [...(rows[index].extraMaterials || []), { ...emptyMaterial }]
      };
      return rows;
    });
  };

  const removeExtraMaterial = (index, mIdx) => {
    setWorkRows(prev => {
      const rows = [...prev];
      rows[index] = {
        ...rows[index],
        extraMaterials: (rows[index].extraMaterials || []).filter((_, i) => i !== mIdx)
      };
      return rows;
    });
  };

  const handleExtraMaterialChange = (index, mIdx, field, value) => {
    setWorkRows(prev => {
      const rows = [...prev];
      const extras = [...(rows[index].extraMaterials || [])];
      const m = { ...extras[mIdx], [field]: value };
      if (field === "materialCode") {
        const material = materials.find(x => String(x.code).trim() === String(value).trim());
        m.materialDescription = material?.description || "";
        m.materialGroupDescription = material?.group || "";
        m.mill = material?.mill || "";
        m.gsm = material?.gsm || "";
        m.paperSize = material?.paperSize || "";
      }
      extras[mIdx] = m;
      rows[index] = { ...rows[index], extraMaterials: extras };
      return rows;
    });
  };

  const addWorkRow = () => {
    setWorkRows(prev => [
      ...prev,
      {
        activityId: "",
        machineId: "",
        inches: "",
        slitNumber: "",
        UPS: "",
        isBooklet: false,
        isPerfecting: false,
        pages: "",
        component: "",
        materialCode: "",
        materialDescription: "",
        materialGroupDescription: "",
        mill: "",
        gsm: "",
        paperSize: "",
        paperQty: ""
      }
    ]);
  };

  const removeWorkRow = (index) => {
    setWorkRows(prev => prev.filter((_, i) => i !== index));
  };

  const openNewRowModal = () => {
    const newIndex = workRows.length;
    addWorkRow();
    setWorkRows(prev => {
      const rows = [...prev];
      if (rows[newIndex]) rows[newIndex] = { ...rows[newIndex], isDraft: true };
      return rows;
    });
    setEditingRowIndex(newIndex);
    setIsNewRow(true);
    setShowRowModal(true);
  };

  const openEditRowModal = (index) => {
    setEditingRowIndex(index);
    setIsNewRow(false);
    setShowRowModal(true);
  };

  const handleSaveRowModal = () => {
    if (editingRowIndex !== null) {
      setWorkRows(prev => {
        const rows = [...prev];
        if (rows[editingRowIndex]) {
          const { isDraft, ...confirmedRow } = rows[editingRowIndex];
          rows[editingRowIndex] = confirmedRow;
        }
        return rows;
      });
    }
    setShowRowModal(false);
    setEditingRowIndex(null);
    setIsNewRow(false);
  };

  const handleCancelRowModal = () => {
    if (isNewRow && editingRowIndex !== null) {
      const row = workRows[editingRowIndex];
      const isEmpty = !row?.activityId && !row?.machineId && !row?.materialCode;
      if (isEmpty) removeWorkRow(editingRowIndex);
    }
    setShowRowModal(false);
    setEditingRowIndex(null);
    setIsNewRow(false);
  };

  const handleRemoveRowFromTable = (index) => {
    removeWorkRow(index);
    if (editingRowIndex === index) {
      setShowRowModal(false);
      setEditingRowIndex(null);
    }
  };

  const handleActivity2Toggle = (activityId) => {
    setActivity2(prev =>
      prev.includes(activityId)
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  };

  const hasActivityType = (keyword) => {
    const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, "");
    return workRows.some(row => {
      const act = activities.find(a => a._id === row.activityId);
      const normalized = act?.activityName?.toLowerCase().replace(/\s+/g, "") || "";
      return normalized.includes(normalizedKeyword);
    });
  };

  const filteredMachinesForPair = (activityId) => {
    if (!activityId) return [];
    const activity = activities.find(a => a._id === activityId);
    if (!activity?.machines) return [];
    return machines.filter(m => activity.machines.map(String).includes(String(m._id)));
  };

  const handleSelectOrder = (order) => {
    setHiddenOrders(prev => [...prev, order._id]);

    setSelectedOrder({
      ...order,
      qtyInLvs: order.quantity,
      customer: order.customerName,
      productName: order.description,
      productType: order.materialType || "",
      expectedDeliveryDate: order.expectedDeliveryDate || order.deliveryDate,
      isPrinting: order.isPrinting || false,
      customerOrderId: order.isPrinting ? null : order._id,
      colorFront: order.colorFront,
      colorBack: order.colorBack,
      wasteQty: order.wasteQty,
      jobSize: order.jobSize,
      inkDetails: order.inkDetails,
      itemPdfPath: order.itemPdfPath || ""
    });

    setWorkRows([
      {
        activityId: "",
        machineId: "",
        inches: "",
        slitNumber: "",
        UPS: "",
        isBooklet: false,
        isPerfecting: false,
        pages: "",
        component: "",
        materialCode: "",
        materialDescription: "",
        materialGroupDescription: "",
        mill: "",
        gsm: "",
        paperSize: "",
        paperQty: "",
        isDraft: true
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
      dispatchLocation: "",
      boxQty: "",
      remarks: ""
    });
    setActivity2([]);
  };

  const containsSpecialChars = (value) => {
    const regex = /[^a-zA-Z0-9\s.]/;
    return regex.test(value);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    const textFields = ["jobSize", "inkDetails"];
    if (textFields.includes(name)) {
      if (containsSpecialChars(value)) {
        showAlert("Special characters are not allowed");
        return;
      }
    }

    if (name === "colorFront" || name === "colorBack") {
      if (!/^[0-9]?$/.test(value)) {
        showAlert("Only 1 digit allowed");
        return;
      }
    }

    if (name === "boxQty") {
      if (!/^\d*$/.test(value)) {
        showAlert("Quantity in Box must be a whole number");
        return;
      }
    }

    if (name === "wasteQty") {
      if (!/^\d{0,2}(\.\d{0,2})?$/.test(value)) {
        showAlert("Waste % allows only 2 digits");
        return;
      }
    }

    setWorkOrderForm(prev => {
      let updated = { ...prev, [name]: value };

      if (name === "orderQty" || name === "wasteQty" || name === "colorFront" || name === "colorBack") {
        const qty = Number(name === "orderQty" ? value : prev.orderQty) || 0;
        const waste = Number(name === "wasteQty" ? value : prev.wasteQty) || 0;
        const totalQty = Math.round(qty + (qty * (waste / 100)));
        updated.totalQty = totalQty;
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
    if (submitLock.current) return;

    if (!selectedOrder.productType || selectedOrder.productType.trim() === "") {
      showAlert("Product Type is required");
      return;
    }

    const requiredFields = [
      { key: "priority", label: "Priority" },
      { key: "colorFront", label: "Color Front" },
      { key: "colorBack", label: "Color Back" },
      { key: "orderQty", label: "Order Quantity" },
      { key: "wasteQty", label: "Waste %" },
      { key: "jobSize", label: "Job Size" },
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

    if (Number(workOrderForm.boxQty) > Number(workOrderForm.orderQty)) {
      showAlert("Quantity in Box cannot be greater than Order Qty");
      return;
    }

    const confirmedRows = workRows.filter(row => !row.isDraft);

    if (!confirmedRows.length) {
      showAlert("At least one Activity/Machine row is required");
      return;
    }

    const skipMaterialCheck = selectedOrder?.isPrinting && selectedOrder?.workorder2;

    for (let i = 0; i < confirmedRows.length; i++) {
      const row = confirmedRows[i];

      if (!row.activityId) {
        showAlert(`Activity is required`);
        return;
      }

      if (!row.machineId) {
        showAlert(`Machine is required `);
        return;
      }

      if (!row.UPS || Number(row.UPS) <= 0) {
        showAlert("UPS is required for this Activity/Machine row");
        return;
      }

      if (isOffsetActivity(row.activityId) && !row.inches) {
        showAlert("Inches is required for Offset activity");
        return;
      }

      if (isSheetfedActivity(row.activityId) && !row.slitNumber) {
        showAlert("Slit Number is required for Sheetfed activity");
        return;
      }

      if (row.isBooklet && !row.pages) {
        showAlert("Pages is required when Booklet is checked for this row");
        return;
      }

      if (!skipMaterialCheck) {
        if (!row.materialCode || row.materialCode.trim() === "") {
          showAlert("Material Code is required");
          return;
        }
        if (!row.paperQty || Number(row.paperQty) <= 0) {
          showAlert("Paper Quantity is required for all materials");
          return;
        }
        for (const em of (row.extraMaterials || [])) {
          if (!em.materialCode || em.materialCode.trim() === "") {
            showAlert("Material Code is required for every added Paper material");
            return;
          }
          if (!em.paperQty || Number(em.paperQty) <= 0) {
            showAlert("Paper Quantity is required for every added Paper material");
            return;
          }
        }
      }
    }

    submitLock.current = true;
    setIsSubmitting(true);
    try {
      const payload = {
        customerOrderId: selectedOrder.isPrinting ? null : selectedOrder.customerOrderId,
        printingId: selectedOrder.isPrinting ? (selectedOrder.printingId || selectedOrder._id) : null,
        slNo: selectedOrder.slNo || 0,
        efiWoNumber: selectedOrder.efiWoNumber || 0,
        workorder2: selectedOrder.workorder2,
        productCode: selectedOrder.productCode,
        purchaseOrderNo: selectedOrder.purchaseOrderNo,
        poDate: selectedOrder.poDate,
        itemPdfPath: selectedOrder.itemPdfPath || "",
        priority: workOrderForm.priority,
        productType: selectedOrder.productType || "",
        customer: selectedOrder.customer || selectedOrder.customerName,
        productName: selectedOrder.productName || selectedOrder.description || "-",
        location: selectedOrder.location?.locationName || selectedOrder.location,
        qtyInLvs: Number(selectedOrder.qtyInLvs),
        colorFront: Number(workOrderForm.colorFront) || 0,
        colorBack: Number(workOrderForm.colorBack) || 0,
        dispatchLocation: workOrderForm.dispatchLocation,
        boxQty: Number(workOrderForm.boxQty) || 0,
        activity2: activity2,
        materials: confirmedRows.flatMap((row, rowIndex) =>
          [row, ...(row.extraMaterials || [])]
            .filter(m => m.materialCode && m.materialCode.trim() !== "")
            .map(m => ({
              materialCode: m.materialCode,
              materialDescription: m.materialDescription,
              materialGroupDescription: m.materialGroupDescription,
              mill: m.mill,
              gsm: m.gsm,
              paperSize: m.paperSize,
              paperQty: Number(m.paperQty) || 0,
              rowIndex,
            }))
        ),

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

        machines: confirmedRows.map((row) => {
          const i = workRows.indexOf(row);
          return {
            activityId: row.activityId || null,
            machineId: row.machineId || null,
            inches: isOffsetActivity(row.activityId) ? row.inches : "",
            slitNumber: isSheetfedActivity(row.activityId) ? row.slitNumber : "",
            UPS: Number(row.UPS) || 0,
            isBooklet: row.isBooklet || false,
            isPerfecting: row.isPerfecting || false,
            pages: Number(row.pages) || 0,
            component: row.component || "",
            impFront: rowImpressions[i]?.impFront || 0,
            impBack: rowImpressions[i]?.impBack || 0,
            totalImp: rowImpressions[i]?.totalImp || 0
          };
        })
      };

      console.log("Work Rows State:", workRows);
      console.log("Final Payload Materials:", payload.materials);
      console.log("Full Payload:", payload);

      if (selectedOrder._id && selectedOrder.status === "PLANNED") {
        await axios.put(
          `${BASE_URL}/api/workorders/${selectedOrder._id}`,
          payload,
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

        showAlert("Success", "Work Order Updated Successfully ✅", "success");
      } else {
        await axios.post(
          `${BASE_URL}/api/workorders/create`,
          payload,
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

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

      if (selectedOrder?._id) {
        setHiddenOrders(prev => [...prev, selectedOrder._id]);
      }

      setSelectedOrder(null);

      const orderRes = await axios.get(`${BASE_URL}/api/customer-orders`, {
        params: {
          status: "ORDER_RECEIVED",
          orderType: "Inhouse"
        },
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      const workRes2 = await axios.get(`${BASE_URL}/api/workorders`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      const convertedOrderIds = (workRes2.data || [])
        .map(w => String(w.customerOrderId))
        .filter(Boolean);

      const filteredOrders = (orderRes.data || []).filter(
        o => !convertedOrderIds.includes(String(o._id))
      );

      setOrders(filteredOrders);
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
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const productTypeOptions = useMemo(() => [
    ...new Set(orders.map(o => o.materialType).filter(Boolean))
  ], [orders]);

  const printingTypeOptions = useMemo(() => [
    ...new Set(
      printingOrders
        .map(o => o.products?.[0]?.materialType || o.materialType)
        .filter(Boolean)
    )
  ], [printingOrders]);

  const customerOptions = useMemo(() => [
    ...new Set(
      workOrders
        .map(wo => wo.customer?.name || wo.customer)
        .filter(Boolean)
    )
  ], [workOrders]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders
      .filter(wo => {
        const customerName = wo.customer?.name || wo.customer || "";
        const matchCustomer = filterCustomer === "" || customerName === filterCustomer;
        const matchWo = filterWoNo === "" || String(wo.efiWoNumber).includes(filterWoNo);
        const matchProductCode =
          filterProductCode === "" ||
          String(wo.productCode || "").toLowerCase().includes(filterProductCode.toLowerCase());

        const matchMachine =
          filterMachine === "" ||
          wo.machines?.some(
            m => String(m.machineId?._id || m.machineId) === String(filterMachine)
          );

        const matchLocation =
          filterUserLocation === "" ||
          wo.userLocations?.includes(filterUserLocation);

        const woDateString = new Date(wo.createdAt).toISOString().split("T")[0];
        const matchFrom = dateFrom === "" || woDateString >= dateFrom;
        const matchTo = dateTo === "" || woDateString <= dateTo;

        return matchCustomer && matchWo && matchProductCode && matchMachine && matchLocation && matchFrom && matchTo;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [workOrders, filterCustomer, filterWoNo, filterProductCode, filterMachine, filterUserLocation, dateFrom, dateTo]);

  const displayedWorkOrders = useMemo(() => {
    return filterWoNo || filterProductCode || filterMachine || dateFrom || dateTo || filterCustomer
      ? filteredWorkOrders
      : filteredWorkOrders.slice(0, 50);
  }, [filteredWorkOrders, filterWoNo, filterProductCode, filterMachine, dateFrom, dateTo, filterCustomer]);

  const downloadExcel = () => {
    if (!filteredWorkOrders.length) return showAlert("No data to download!");

    const data = filteredWorkOrders.map(wo => ({
      "SL No": wo.slNo,
      "WO NO": wo.efiWoNumber,
      "Product Code": wo.productCode,
      "PO number": wo.purchaseOrderNo,
      "Priority": wo.priority,
      "Customer": wo.customer?.name || wo.customer,
      "Product Type": wo.productType || "-",
      "Job Description": wo.description || wo.productName || "-",
      "WO Date": new Date(wo.createdAt).toLocaleDateString("en-IN"),
      "Qty In LVS": wo.qtyInLvs || 0,
      "Location": wo.location?.locationName || wo.location,
      "Activity": wo.machines?.map(pair => {
        const act = activities.find(
          a => String(a._id) === String(pair.activityId?._id || pair.activityId)
        );
        return act?.activityName || "-";
      }).join(", "),
      "Machines": wo.machines?.map(pair => {
        const mac = machines.find(
          m => String(m._id) === String(pair.machineId?._id || pair.machineId)
        );
        return mac?.machineName || "-";
      }).join(", "),
      "Color Front": wo.colorFront,
      "Color Back": wo.colorBack,
      "Inches": wo.machines?.map(m => m.inches).filter(Boolean).join(", ") || "-",
      "Slit Number": wo.machines?.map(m => m.slitNumber).filter(Boolean).join(", ") || "-",
      "Booklet": wo.machines?.map(m => (m.isBooklet ? "Yes" : "No")).join(", ") || "-",
      "Pages": wo.machines?.map(m => m.pages).filter(Boolean).join(", ") || "-",
      "Component": wo.machines?.map(m => m.component).filter(Boolean).join(", ") || "-",
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
      "UPS": `${wo.UPS && wo.UPS !== 0 ? wo.UPS : ""}  ${wo.machines?.map(m => m.UPS).filter(v => v !== undefined && v !== null && v !== "" && v !== 0).join(", ") || ""}`,
      "IMP Front": `${wo.impFront && wo.impFront !== 0 ? wo.impFront : ""}  ${wo.machines?.map(m => m.impFront).filter(v => v !== undefined && v !== null && v !== "" && v !== 0).join(", ") || ""}`,
      "IMP Back": `${wo.impBack && wo.impBack !== 0 ? wo.impBack : ""}  ${wo.machines?.map(m => m.impBack).filter(v => v !== undefined && v !== null && v !== "" && v !== 0).join(", ") || ""}`,
      "Total IMP": `${wo.totalImp && wo.totalImp !== 0 ? wo.totalImp : ""}  ${wo.machines?.map(m => m.totalImp).filter(v => v !== undefined && v !== null && v !== "" && v !== 0).join(", ") || ""}`,
      "Ink Details": wo.inkDetails,
      "Dispatch Location": wo.dispatchLocation || "-",
      "Quantity in Box": wo.boxQty || "-",
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

  const outerLabelPreview = useMemo(() => {
    const orderQty = Number(outerLabelWo?.orderQty) || 0;
    const rawBoxQty = Number(outerLabelForm.boxQty) || 0;

    if (!orderQty || !rawBoxQty || !outerLabelForm.unitType) {
      return null;
    }

    const isSheet = outerLabelForm.unitType === "sheet";
    const finalBoxQty = isSheet ? rawBoxQty * 3 : rawBoxQty;
    const totalLabels = Math.ceil(orderQty / finalBoxQty);

    const boxQtyFormula = isSheet
      ? `${rawBoxQty} (entered) × 3 (Sheet) = ${finalBoxQty}`
      : `${rawBoxQty} (entered, Each — no change)`;

    const labelsFormula = `${orderQty} (Order Qty) ÷ ${finalBoxQty} (Qty per Box) = ${totalLabels} label(s)`;

    return { finalBoxQty, totalLabels, boxQtyFormula, labelsFormula };
  }, [outerLabelWo, outerLabelForm.boxQty, outerLabelForm.unitType]);

  const generateBarcodeDataUrl = (value) => {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,
      height: 35,
      margin: 0
    });
    return canvas.toDataURL("image/png");
  };

  const downloadOuterLabel = (explicitData) => {
    const isFilterApplied = filterWoNo || filterProductCode || filterMachine || dateFrom || dateTo || filterUserLocation || filterCustomer;
    const dataToDownload = Array.isArray(explicitData)
      ? explicitData
      : (isFilterApplied ? filteredWorkOrders : displayedWorkOrders);

    if (!dataToDownload.length) return showAlert("No data to download!");

    const MAX_BOXES_PER_WO = 3000;

    const validWorkOrders = dataToDownload.filter(
      wo => Number(wo.boxQty) > 0 && Number(wo.orderQty) > 0
    );

    if (!validWorkOrders.length) {
      return showAlert("None of the selected Work Orders have Quantity in Box set");
    }

    const oversized = validWorkOrders.filter(
      wo => Math.ceil(Number(wo.orderQty) / Number(wo.boxQty)) > MAX_BOXES_PER_WO
    );

    if (oversized.length) {
      return showAlert(
        "Quantity in Box too low for Order Qty",
        `WO ${oversized.map(wo => wo.efiWoNumber ?? "-").join(", ")} would generate an unreasonable number of labels. Please check Quantity in Box.`,
        "error"
      );
    }

    const missingDispatch = validWorkOrders.some(wo => !wo.dispatchLocation);
    if (missingDispatch) {
      showAlert("Some Work Orders are missing Dispatch Location — showing '-' for those");
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const pageH = 297;

    const marginX = 10;
    const marginTop = 8;
    const marginBottom = 8;
    const gap = 5;
    const labelsPerPage = 3;
    const labelW = pageW - marginX * 2;
    const labelH = (pageH - marginTop - marginBottom - gap * (labelsPerPage - 1)) / labelsPerPage;

    let labelIndexOnPage = 0;

    validWorkOrders.forEach((wo) => {
      const orderQty = Number(wo.orderQty) || 0;
      const boxQty = Number(wo.boxQty) || 0;
      const totalBoxes = Math.ceil(orderQty / boxQty);

      for (let box = 1; box <= totalBoxes; box++) {
        if (labelIndexOnPage === labelsPerPage) {
          doc.addPage();
          labelIndexOnPage = 0;
        }

        const qtyInThisBox =
          box < totalBoxes ? boxQty : orderQty - boxQty * (totalBoxes - 1);

        const top = marginTop + labelIndexOnPage * (labelH + gap);
        const left = marginX;
        const right = marginX + labelW;
        const pad = 6;
        const rightColX = right - pad;
        const leftColX = left + pad;

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.rect(left, top, labelW, labelH);

        let y = top + 9;

        const itemName = wo.productName || wo.description || "-";
        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.text(itemName, pageW / 2, y, { align: "center" });

        y += 8;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`BOX NO : ${box} / ${totalBoxes}`, pageW / 2, y, { align: "center" });

        doc.setFontSize(9);
        doc.text("PACKING SLIP", rightColX, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("(OUTER)", rightColX, y + 4, { align: "right" });

        y += 9;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("To,", leftColX, y);
        y += 5;

        doc.setFontSize(9.5);

        const dispatchLines = doc.splitTextToSize(
          wo.dispatchLocation || "-",
          labelW - 35
        );

        doc.text(dispatchLines, leftColX + 1, y, {
          lineHeightFactor: 1.25
        });

        doc.setFontSize(20);
        doc.text(String(box), rightColX, top + 40, { align: "right" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.text(`Work Order NO : ${wo.efiWoNumber ?? "-"}`, rightColX, top + 55, { align: "right" });

        y = top + labelH * 0.60;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(`CUSTOMER : ${wo.customer?.name || wo.customer || "-"}`, leftColX, y);
        y += 5;
        const itemLabel = wo.productCode
          ? `${wo.productName || wo.description || "-"} (${wo.productCode})`
          : (wo.productName || wo.description || "-");
        doc.text(`ITEM :  ${itemLabel}`, leftColX, y);
        y += 5;

        const enteredQtyLabel =
          wo.boxQtyEntered != null
            ? `${wo.boxQtyEntered}`
            : "-";

        doc.text(`LEAVES QTY : ${enteredQtyLabel}`, leftColX, y);
        y += 5;
        doc.text(`SHEET QUANTITY : ${qtyInThisBox}`, leftColX, y);
        y += 6;

        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(9);
        doc.text("HANDLE WITH CARE", leftColX + 3, top + labelH - 8);

        const dispatchFirstLetter = (wo.dispatchLocation || "-").trim().charAt(0).toUpperCase();
        doc.setFont("times", "bold");
        doc.setFontSize(26);
        doc.text(dispatchFirstLetter, pageW / 2, top + labelH - 8, { align: "center" });

        const barcodeValue = `${wo.efiWoNumber ?? "NA"}-${box}`;

        try {
          const barcodeDataUrl = generateBarcodeDataUrl(barcodeValue);
          const bcW = 42;
          const bcH = 11;
          const bcX = rightColX - bcW;
          const bcY = top + labelH - 21;
          doc.addImage(barcodeDataUrl, "PNG", bcX, bcY, bcW, bcH);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.text(barcodeValue, bcX + bcW / 2, bcY + bcH + 3.5, { align: "center" });
        } catch (e) {
          console.error("Barcode generation failed:", e);
        }

        labelIndexOnPage += 1;
      }
    });

    const firstWo = validWorkOrders[0];
    const label =
      validWorkOrders.length === 1
        ? firstWo?.efiWoNumber ?? "NA"
        : "ALL";

    doc.save(`OuterLabel_WO${label}.pdf`);
  };

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

  const downloadFormattedPDF = async () => {
    try {
      const isFilterApplied = filterWoNo || filterProductCode || filterMachine || dateFrom || dateTo || filterUserLocation;
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

        autoTable(doc, {
          ...plainStyle,
          startY: y,
          body: [
            ["PO NO", wo.purchaseOrderNo ?? "-", "Priority", wo.priority ?? "-"],
            [
              "WO NO",
              { content: wo.efiWoNumber ?? "-", styles: { fontStyle: "bold" } },
              "Customer",
              wo.customer?.name ?? wo.customer ?? "-"
            ],
            [
              "WO Date",
              wo.createdAt ? new Date(wo.createdAt).toLocaleDateString("en-IN") : "-",
              "Job Description",
              { content: wo.productName ?? "-", styles: { fontStyle: "bold" } }
            ],
            [
              "Product Code",
              { content: wo.productCode ?? "-", styles: { fontStyle: "bold" }, colSpan: 3 }
            ]
          ],
          didParseCell: function (data) {
            if (data.section === "body" && (data.column.index === 0 || data.column.index === 2)) {
              data.cell.styles.fontStyle = "bold";
            }
          }
        });

        y = doc.lastAutoTable.finalY + 8;

        doc.setFont("helvetica", "bold");
        doc.text("ACTIVITY, MACHINE & PAPER DETAILS", 14, y);
        y += 4;

        const machinesArr = wo.machines || [];
        const materialsArr = wo.materials || [];
        const combinedRowCount = Math.max(machinesArr.length, materialsArr.length, 1);

        const combinedBody = Array.from({ length: combinedRowCount }, (_, i) => {
          const pair = machinesArr[i] || {};
          const mat = materialsArr[i] || {};

          const act = activities.find(
            a => String(a._id) === String(pair.activityId?._id || pair.activityId)
          );
          const mac = machines.find(
            m => String(m._id) === String(pair.machineId?._id || pair.machineId)
          );
          return [
            act?.activityName ?? "-",
            mac?.machineName ?? "-",
            pair.inches || pair.slitNumber || "-",
            pair.isBooklet ? `${pair.pages || 0}` : "-",
            pair.isBooklet ? (pair.component || "-") : "-",
            mat.materialCode ?? "-",
            mat.materialDescription ?? "-",
            mat.gsm ?? "-",
            mat.paperQty ?? "-",
            pair.impFront ?? 0,
            pair.impBack ?? 0,
            pair.totalImp ?? 0
          ];
        });

        autoTable(doc, {
          ...plainStyle,
          startY: y,
          head: [["Activity", "Machine", "Inches/Slit", "Pages", "Component", "Paper Code", "Description", "GSM", "Paper Qty(KG/Sheets)", "Imp Front", "Imp Back", "Total Imp"]],
          body: combinedBody.length ? combinedBody : [["-", "-", "-", "-", "-", "-", "-", "No Materials", "-", "-", "-", "-", "-"]],
          styles: { ...plainStyle.styles, fontSize: 6.5 },
          didParseCell: function (data) {
            if (data.section !== "body") return;

            // Paper Code (5) and GSM (7) -> bigger and bold
            if (data.column.index === 5 || data.column.index === 7) {
              data.cell.styles.fontSize = 8.5;
              data.cell.styles.fontStyle = "bold";
            }

            // Paper Qty (8) -> biggest
            if (data.column.index === 8) {
              data.cell.styles.fontSize = 10.5;
              data.cell.styles.fontStyle = "bold";
            }
          }
        });

        y = doc.lastAutoTable.finalY + 8;

        doc.text("QUANTITY DETAILS", 14, y);
        y += 4;

        autoTable(doc, {
          ...plainStyle,
          startY: y,
          head: [["Order Qty", "Waste %", "Total Qty", "Job Size", "UPS", "Color F/B"]],
          body: [[
            { content: wo.orderQty ?? "-", styles: { fontStyle: "bold" } },
            wo.wasteQty ?? "-",
            { content: wo.totalQty ?? "-", styles: { fontStyle: "bold" } },
            wo.jobSize ?? "-",
            `${wo.UPS && wo.UPS !== 0 ? wo.UPS : ""} ${wo.machines?.map(m => m.UPS).filter(v => v !== undefined && v !== null && v !== "" && v !== 0).join(", ") || ""}`,
            `${wo.colorFront ?? 0} / ${wo.colorBack ?? 0}`
          ]]
        });

        y = doc.lastAutoTable.finalY + 8;

        doc.text("INK DETAILS", 14, y);
        y += 4;

        autoTable(doc, {
          ...plainStyle,
          startY: y,
          body: [[wo.inkDetails ?? "-"]]
        });

        y = doc.lastAutoTable.finalY + 8;

        doc.text("REMARKS", 14, y);
        y += 4;

        autoTable(doc, {
          ...plainStyle,
          startY: y,
          body: [[wo.remarks ?? "-"]]
        });

        y = doc.lastAutoTable.finalY + 8;

        const activity2List = wo.activity2 || [];

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("ACTIVITIES", 14, y);
        y += 4;

        const plannerNameDate = `${wo.planningUser ?? "-"} \nDate: ${
          wo.createdAt ? new Date(wo.createdAt).toLocaleDateString("en-IN") : "-"
        }`;

        const activity2Body = [
          [1, "Planner", plannerNameDate, ""],
          ...activity2List.map((act, idx) => [
            idx + 2,
            act?.activityName || act?.name || "-",
            "",
            ""
          ])
        ];

        autoTable(doc, {
          ...plainStyle,
          startY: y,
          head: [["S.No", "Activity", "Name & Date", "Signature"]],
          body: activity2Body,
          columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: 90 },
            2: { cellWidth: 55 },
            3: { cellWidth: "auto" }
          },
          styles: { ...plainStyle.styles, minCellHeight: 8 }
        });

        y = doc.lastAutoTable.finalY + 8;

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

  const downloadDocketLabel = () => {
    const isFilterApplied = filterWoNo || filterProductCode || filterMachine || dateFrom || dateTo || filterUserLocation || filterCustomer;
    const dataToDownload = isFilterApplied ? filteredWorkOrders : displayedWorkOrders;

    if (!dataToDownload.length) return showAlert("No data to download!");

    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;

    dataToDownload.forEach((wo, index) => {
      if (index !== 0) doc.addPage();

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.rect(8, 8, pageW - 16, 281);

      doc.setLineWidth(0.2);
      doc.rect(9.5, 9.5, pageW - 19, 278);

      let y = 20;

      doc.setFont("times", "bold");
      doc.setFontSize(15);
      const companyName = "Manipal Payment and Identity Solutions Limited,";
      const textWidth = doc.getTextWidth(companyName);
      const centerX = pageW / 2;
      doc.text(companyName, centerX, y, { align: "center" });
      doc.setLineWidth(0.4);
      doc.line(centerX - textWidth / 2, y + 1.2, centerX + textWidth / 2, y + 1.2);

      y += 8;
      doc.setFontSize(9);
      doc.text(`Document ID: MPi_SP_QS_PLAN_T124_V1.00`, 14, y);
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

      doc.setFont("times", "bold");
      doc.setFontSize(13);
      doc.text("DOCKET LABEL PRINTING", centerX, y, { align: "center" });

      y += 12;

      const machineName = String(
        wo.machines?.map(pair => {
          const mac = machines.find(m => String(m._id) === String(pair.machineId?._id || pair.machineId));
          return mac?.machineName || "-";
        }).join(", ") || "-"
      );

      const fields = [
        ["CUSTOMER", String(wo.customer?.name || wo.customer || "-")],
        ["ITEM", String(wo.productName || wo.description || "-")],
        ["LOCATION", String(wo.location || "-")],
        ["WORK ORDER", String(wo.efiWoNumber ?? "-")],
        ["WO DATE", wo.createdAt ? new Date(wo.createdAt).toLocaleDateString("en-IN") : "-"],
        ["MACHINE NAME", machineName]
      ];

      doc.setFontSize(12);
      fields.forEach(([label, value]) => {
        doc.setFont("times", "bold");
        doc.text(`${label}: - `, 18, y);
        const labelW = doc.getTextWidth(`${label}: - `);
        doc.setFont("times", "normal");
        doc.text(value, 18 + labelW, y);
        y += 11;
      });

      y += 8;

      const tableX = 13;
      const tableW = pageW - 26;
      const col = tableW / 4;
      const headerH = 10;
      const rowH = 42;

      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setLineWidth(0.5);

      const headers = ["PLANNING", "PREPRESS", "CTP", "PRODUCTION"];
      headers.forEach((h, i) => {
        doc.rect(tableX + i * col, y, col, headerH);
        doc.text(h, tableX + i * col + col / 2, y + 7, { align: "center" });
      });
      y += headerH;

      headers.forEach((_, i) => {
        doc.setLineWidth(0.5);
        doc.rect(tableX + i * col, y, col, rowH);
      });

      doc.setFont("times", "normal");
      doc.setFontSize(10);

      const pad = 4;

      doc.text("CHECKED BY:", tableX + pad, y + 12);
      doc.text("DATE:", tableX + pad, y + 32);

      const pp = tableX + col;
      doc.text("NO.OF +VES:", pp + pad, y + 10);
      doc.text("CHECKED BY:", pp + pad, y + 22);
      doc.text("DATE:", pp + pad, y + 34);

      const ctp = tableX + col * 2;
      doc.text("NO.OF PLATES:", ctp + pad, y + 10);
      doc.text("CHECKED BY:", ctp + pad, y + 22);
      doc.text("DATE:", ctp + pad, y + 34);

      const prod = tableX + col * 3;
      const boxW = 16;
      const boxH = 5;

      doc.text("PRINTED:", prod + pad, y + 9);
      const printedLabelW = doc.getTextWidth("PRINTED:");
      doc.setLineWidth(0.4);
      doc.rect(prod + pad + printedLabelW + 1, y + 4.5, boxW, boxH);

      doc.text("SPECIMEN:", prod + pad, y + 19);
      const specimenLabelW = doc.getTextWidth("SPECIMEN:");
      doc.rect(prod + pad + specimenLabelW + 1, y + 14.5, boxW, boxH);

      doc.text("CHECKED BY:", prod + pad, y + 30);
      doc.text("DATE:", prod + pad, y + 39);
    });

    const firstWo = dataToDownload[0];
    doc.save(`MPI_DocketLabel_${String(firstWo?.efiWoNumber || "ALL")}.pdf`);
  };

  const downloadBindingSigningSheet = () => {
    const isFilterApplied = filterWoNo || filterProductCode || filterMachine || dateFrom || dateTo || filterUserLocation || filterCustomer;
    const dataToDownload = isFilterApplied ? filteredWorkOrders : displayedWorkOrders;

    if (!dataToDownload.length) return showAlert("No data to download!");

    const MAX_BOXES_PER_WO = 3000;

    const validWorkOrders = dataToDownload.filter(
      wo => Number(wo.boxQty) > 0 && Number(wo.orderQty) > 0
    );

    if (!validWorkOrders.length) {
      return showAlert("None of the selected Work Orders have Quantity in Box set");
    }

    const oversized = validWorkOrders.filter(
      wo => Math.ceil(Number(wo.orderQty) / Number(wo.boxQty)) > MAX_BOXES_PER_WO
    );

    if (oversized.length) {
      return showAlert(
        "Quantity in Box too low for Order Qty",
        `WO ${oversized.map(wo => wo.efiWoNumber ?? "-").join(", ")} would generate an unreasonable number of rows. Please check Quantity in Box.`,
        "error"
      );
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const centerX = pageW / 2;

    validWorkOrders.forEach((wo, index) => {
      if (index !== 0) doc.addPage();

      const orderQty = Number(wo.orderQty) || 0;
      const boxQty = Number(wo.boxQty) || 0;
      const totalBoxes = Math.ceil(orderQty / boxQty);

      let y = 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("MANIPAL PAYMENT AND IDENTITY SOLUTIONS", centerX, y, { align: "center" });

      y += 7;
      doc.setFontSize(12);
      doc.text("BINDING IN PROCESS RECORD", centerX, y, { align: "center" });

      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("MPi_SP_QS_PLAN_T086_V1.00", pageW - 14, y, { align: "right" });

      y += 12;

      doc.setFontSize(11);
      const labelX = 14;
      const colonGap = 45;

      const productLabel = wo.productCode
        ? `${wo.productName || wo.description || "-"} (${wo.productCode})`
        : (wo.productName || wo.description || "-");

      const fields = [
        ["Name", "MANIPAL PAYMENT AND IDENTITY SOLUTIONS LTD"],
        ["Job No", wo.purchaseOrderNo ?? "-"],
        ["Work Order Number", wo.efiWoNumber ?? "-"],
        ["Product", productLabel],
      ];

      fields.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, labelX, y);
        doc.text(":", labelX + colonGap, y);

        doc.setFont("helvetica", "normal");
        doc.text(String(value), labelX + colonGap + 4, y);
        y += 7;
      });

      y += 6;

      const rows = [];
      for (let box = 1; box <= totalBoxes; box++) {
        const qtyInThisBox = box < totalBoxes ? boxQty : orderQty - boxQty * (totalBoxes - 1);
        rows.push(["", "", "", qtyInThisBox, box, "", ""]);
      }

      autoTable(doc, {
        startY: y,
        head: [["PREFIX", "START", "END", "QTY", "BOX NO", "DATE", "SIGNATURE"]],
        body: rows,
        theme: "grid",
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 10,
          halign: "center",
          valign: "middle",
          lineColor: [0, 0, 0],
          lineWidth: 0.3,
          textColor: [0, 0, 0],
          cellPadding: 3,
          minCellHeight: 9
        },
        headStyles: {
          fillColor: false,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineWidth: 0.3
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 22 },
          2: { cellWidth: 22 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20 },
          5: { cellWidth: 30 },
          6: { cellWidth: "auto" }
        }
      });
    });

    const firstWo = validWorkOrders[0];
    const label = validWorkOrders.length === 1 ? firstWo?.efiWoNumber ?? "NA" : "ALL";
    doc.save(`BindingSigningSheet_WO${label}.pdf`);
  };

  // ============================================================================
  // 🧭 QUICK-NAV TABS (All Orders | Received Orders | Planned | Outer Label Entry)
  // ============================================================================
  const activeTab =
    plannerViewMode === "outerLabelEntry" ? "OUTER_LABEL" : (statusFilter || "ALL");

  const receivedCount =
    orders.filter(o => o.userLocations?.some(loc => userLocations.includes(loc))).length +
    printingOrders
      .filter(o => !hiddenOrders.includes(o._id))
      .filter(o => o.userLocations?.some(loc => userLocations.includes(loc))).length;

  const plannedCount = workOrders.length;

  const handleTabChange = (tab) => {
    if (tab === "OUTER_LABEL") {
      setPlannerViewMode("outerLabelEntry");
      setOuterLabelWo(null);
      setOuterLabelWoInput("");
      setOuterLabelForm({ boxQty: "", dispatchLocation: "", unitType: "" });
      setOuterLabelLocationId("");
      return;
    }

    // restore a half-opened order back into the list before leaving the form
    if (selectedOrder?._id) {
      setHiddenOrders(prev => prev.filter(id => id !== selectedOrder._id));
    }

    setPlannerViewMode("main");
    setStatusFilter(tab === "ALL" ? "" : tab);
    setSelectedOrder(null);
  };

  return (
    <div className="planner-dashboard-root">
      {/* ========================================================================= */}
      {/* SCOPED ENTERPRISE TEAL / ORANGE THEME (No separate CSS file required) */}
      {/* ========================================================================= */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');

        /* ---------- Theme tokens ---------- */
        .planner-dashboard-root {
          --brand: #e4572e;
          --brand-dark: #c9461f;
          --brand-soft: #fdeee8;
          --teal: #0b3a45;
          --teal-mid: #0f5560;
          --teal-soft: #e3f1f4;
          --ink: #1f2937;
          --ink-soft: #5b6676;
          --ink-mute: #8a94a3;
          --line: #e3e7ec;
          --line-soft: #eef1f4;
          --field-line: #cfd6de;
          --surface: #ffffff;
          --page: #f4f6f8;
          --ok: #1f9d6b;
          --warn: #d98a00;
          --danger: #d64545;
        }

        .planner-dashboard-root {
          background: var(--page);
          position: relative;
          min-height: 100vh;
          padding: 24px 28px 40px;
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
          font-size: 14px;
          color: var(--ink);
        }

        .planner-container-3d {
          max-width: 100%;
          margin: 0 auto;
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 0;
          box-shadow: none;
        }

        /* ---------- Bootstrap overrides (scoped to this page) ---------- */
        .planner-dashboard-root h1,
        .planner-dashboard-root h4,
        .planner-dashboard-root h5,
        .planner-dashboard-root h6 {
          color: var(--ink) !important;
          font-weight: 700;
          letter-spacing: -0.1px;
        }
        .planner-dashboard-root [style*="rgb(6, 76, 115)"] { color: var(--ink) !important; }
        .planner-dashboard-root [style*="rgb(2, 132, 199)"] { color: var(--teal-mid) !important; }
        .planner-dashboard-root .border[style*="rgb(184, 217, 235)"] { border-color: var(--line) !important; }
        .planner-dashboard-root .text-primary { color: var(--teal-mid) !important; }
        .planner-dashboard-root .text-muted { color: var(--ink-mute) !important; }
        .planner-dashboard-root .text-success { color: var(--ok) !important; }
        .planner-dashboard-root .bg-white.border { border-color: var(--line) !important; border-radius: 8px !important; }
        .planner-dashboard-root .shadow-sm { box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06) !important; }
        .planner-dashboard-root .form-label,
        .planner-dashboard-root small {
          color: var(--ink-soft);
          font-weight: 600;
        }
        .planner-dashboard-root .form-label {
          font-size: 11.5px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .planner-dashboard-root .form-control,
        .planner-dashboard-root .form-select {
          border: 1px solid var(--field-line);
          border-radius: 6px;
          font-size: 13.5px;
          color: var(--ink);
          box-shadow: none;
        }
        .planner-dashboard-root .form-control:focus,
        .planner-dashboard-root .form-select:focus {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }
        .planner-dashboard-root .form-check-input:checked {
          background-color: var(--brand);
          border-color: var(--brand);
        }
        .planner-dashboard-root .table-responsive::-webkit-scrollbar,
        .planner-dashboard-root .scrollable-table-container::-webkit-scrollbar,
        .planner-dashboard-root .wo-table-wrap::-webkit-scrollbar { height: 8px; width: 8px; }
        .planner-dashboard-root .table-responsive::-webkit-scrollbar-thumb,
        .planner-dashboard-root .scrollable-table-container::-webkit-scrollbar-thumb,
        .planner-dashboard-root .wo-table-wrap::-webkit-scrollbar-thumb { background: #c5ccd5; border-radius: 8px; }
        .planner-dashboard-root .table-responsive::-webkit-scrollbar-track,
        .planner-dashboard-root .scrollable-table-container::-webkit-scrollbar-track,
        .planner-dashboard-root .wo-table-wrap::-webkit-scrollbar-track { background: #f1f3f6; }

        /* ---------- Cards ---------- */
        .card-glass-3d {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
          overflow: hidden;
          transition: box-shadow 0.2s ease;
        }

        /* ---------- Buttons (flat, enterprise) ---------- */
        .btn-3d {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-weight: 600;
          border-radius: 6px;
          padding: 7px 16px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          font-size: 13px;
          border: 1px solid transparent;
          line-height: 1.3;
          white-space: nowrap;
        }
        .btn-3d:active { transform: translateY(1px) !important; }
        .btn-3d:disabled { opacity: 0.55; cursor: not-allowed; }

        .btn-3d-primary { background: var(--brand); border-color: var(--brand); color: #ffffff; box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35); }
        .btn-3d-primary:hover { background: var(--brand-dark); border-color: var(--brand-dark); color: #fff; }

        .btn-3d-success { background: var(--ok); border-color: var(--ok); color: #ffffff; box-shadow: 0 1px 2px rgba(31, 157, 107, 0.35); }
        .btn-3d-success:hover { background: #178158; border-color: #178158; color: #fff; }

        .btn-3d-warning { background: #fff7e6; border-color: #f2d291; color: #9a6200; }
        .btn-3d-warning:hover { background: #ffecc2; color: #7d4f00; }

        .btn-3d-danger { background: #fdecec; border-color: #f3c1c1; color: #b42323; }
        .btn-3d-danger:hover { background: #f9d4d4; color: #8f1a1a; }

        .btn-3d-info { background: #ffffff; border-color: var(--teal-mid); color: var(--teal-mid); }
        .btn-3d-info:hover { background: var(--teal-mid); color: #fff; }

        .btn-3d-dark { background: var(--teal); border-color: var(--teal); color: #ffffff; box-shadow: 0 1px 2px rgba(11, 58, 69, 0.35); }
        .btn-3d-dark:hover { background: #072a33; border-color: #072a33; color: #fff; }

        .btn-3d-secondary { background: #ffffff; border-color: var(--field-line); color: var(--ink); }
        .btn-3d-secondary:hover { background: var(--page); color: var(--ink); }

        /* ---------- Mode toggle / quick-nav (segmented tabs) ---------- */
        .mode-toggle-group,
        .quick-nav-group {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 4px;
          display: inline-flex;
          flex-wrap: wrap;
          gap: 4px;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
        }
        .mode-toggle-btn,
        .quick-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid transparent;
          background: transparent;
          color: #000000;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .quick-nav-btn svg { width: 12px; height: 12px; }
        .mode-toggle-btn.inactive { background: transparent; color: #000000; }
        .mode-toggle-btn.inactive:hover,
        .quick-nav-btn:hover { background: var(--page); color: #000000; }
        .quick-nav-cta { padding: 4px 10px; font-size: 11px; }
        .quick-nav-cta svg { width: 12px; height: 12px; }

        .mode-toggle-btn.active-planner,
        .quick-nav-btn.active-received {
          background: var(--brand);
          border-color: var(--brand);
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .quick-nav-btn.active-all {
          background: var(--teal);
          border-color: var(--teal);
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(11, 58, 69, 0.35);
        }
        .quick-nav-btn.active-planned {
          background: var(--ok);
          border-color: var(--ok);
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(31, 157, 107, 0.35);
        }
        .mode-toggle-btn.active-outer,
        .quick-nav-btn.active-outer {
          background: var(--danger);
          border-color: var(--danger);
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(214, 69, 69, 0.35);
        }

        .quick-nav {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .quick-nav-count {
          min-width: 18px;
          padding: 0 5px;
          border-radius: 9999px;
          font-size: 9.5px;
          font-weight: 700;
          text-align: center;
          background: var(--page);
          color: #000000;
          border: 1px solid var(--line);
        }
        .quick-nav-btn[class*="active-"] .quick-nav-count {
          background: rgba(255, 255, 255, 0.22);
          border-color: transparent;
          color: #ffffff;
        }

        /* ---------- Inputs ---------- */
        .input-3d {
          background: #ffffff;
          border: 1px solid var(--field-line);
          border-radius: 6px;
          padding: 6px 12px;
          font-family: inherit;
          font-size: 13px;
          color: var(--ink);
          box-shadow: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .input-3d:focus {
          outline: none;
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }

        /* ---------- Data tables ---------- */
        .scrollable-table-container {
          border-radius: 8px;
          overflow-x: auto;
          overflow-y: auto;
          border: 1px solid var(--line);
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
          background: #ffffff;
          max-height: 520px;
        }
        .table-modern,
        .planned-workorders-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 0;
          white-space: nowrap;
        }
        .table-modern thead th,
        .planned-workorders-table thead th {
          background: #f7f9fb !important;
          color: var(--ink-soft) !important;
          font-weight: 700;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 12px 12px;
          border: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          z-index: 5;
          text-align: center;
          white-space: nowrap;
        }
        .table-modern tbody td,
        .planned-workorders-table tbody td {
          padding: 9px 12px;
          border: 1px solid var(--line-soft);
          color: var(--ink);
          font-weight: 500;
          vertical-align: middle;
          transition: background 0.15s ease;
        }
        .table-modern tbody tr:nth-child(even) td,
        .planned-workorders-table tbody tr:nth-child(even) td { background: #fafbfc; }
        .table-modern tbody tr:hover td,
        .planned-workorders-table tbody tr:hover td {
          background-color: var(--brand-soft) !important;
        }

        .truncate {
          max-width: 170px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
        }
        .expanded {
          white-space: normal;
          max-width: 300px;
          word-break: break-word;
          cursor: pointer;
          background: var(--teal-soft);
        }

        /* ---------- Badges ---------- */
        .badge-3d {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.2px;
          box-shadow: none;
        }
        .badge-3d-success { background: #e4f6ee; color: #167a52; border: 1px solid #b7e4d0; }
        .badge-3d-primary { background: var(--teal-soft); color: var(--teal-mid); border: 1px solid #bdd9df; }
        .badge-3d-warning { background: #fff3d6; color: #8a5a00; border: 1px solid #f2d291; }

        /* ---------- Toolbar ---------- */
        .premium-toolbar {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 14px 18px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }
        .premium-select,
        .premium-date {
          background: #ffffff;
          border: 1px solid var(--field-line);
          border-radius: 6px;
          padding: 6px 10px;
          font-family: inherit;
          font-size: 13px;
          color: var(--ink);
          box-shadow: none;
        }
        .premium-select:focus,
        .premium-date:focus {
          outline: none;
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }
        .clear-btn {
          background: #ffffff;
          color: var(--ink);
          border: 1px solid var(--field-line);
          border-radius: 6px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: none;
        }
        .clear-btn:hover { background: var(--page); border-color: var(--teal-mid); color: var(--teal-mid); transform: none; }

        /* ===== Work Order Form — clean white panels ===== */
        .wo-glass {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.07);
          padding: 18px;
          color: var(--ink);
        }
        .wo-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 2px 4px 14px;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--line);
        }
        .wo-head-left { display: flex; align-items: center; gap: 12px; }
        .wo-icon {
          width: 36px; height: 36px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: var(--brand-soft);
          color: var(--brand);
          border: 1px solid #f7d3c6;
          box-shadow: none;
        }
        .wo-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); letter-spacing: -0.1px; }
        .wo-sub { font-size: 12px; color: var(--ink-mute); }
        .wo-pill {
          font-size: 11.5px; font-weight: 600;
          padding: 3px 12px;
          border-radius: 999px;
          background: var(--page);
          border: 1px solid var(--line);
          box-shadow: none;
        }
        .wo-pill-blue { color: var(--teal-mid); background: var(--teal-soft); border-color: #bdd9df; }
        .wo-pill-amber { color: #8a5a00; background: #fff3d6; border-color: #f2d291; }
        .wo-close {
          width: 30px; height: 30px;
          border-radius: 6px;
          border: 1px solid var(--line);
          background: #ffffff;
          color: var(--ink-soft);
          font-size: 12px;
          cursor: pointer;
          box-shadow: none;
        }
        .wo-close:hover { background: var(--brand-soft); color: var(--brand); border-color: #f7d3c6; }

        .wo-panel {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 12px;
          box-shadow: none;
        }
        .wo-panel-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; margin-bottom: 10px;
        }
        .wo-panel-title {
          font-size: 13px; font-weight: 700; color: var(--ink);
          padding-left: 8px; border-left: 3px solid var(--brand);
        }
        .wo-panel-note { font-size: 11.5px; color: var(--ink-mute); }

        .wo-info-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px 10px;
        }
        .wo-info {
          background: #fafbfc;
          border: 1px solid var(--line-soft);
          border-radius: 6px;
          padding: 7px 11px;
          min-width: 0;
        }
        .wo-info.wide { grid-column: span 2; }
        .wo-info > span {
          display: block; font-size: 10.5px; color: var(--ink-mute);
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
        }
        .wo-info > b {
          display: block;
          font-size: 13px; font-weight: 600; color: var(--ink);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .wo-accent { color: var(--teal-mid) !important; }
        .wo-good { color: var(--ok) !important; }
        .wo-muted { color: var(--ink-mute); }

        .wo-fields {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 10px 12px;
          align-items: end;
        }
        .fs-2 { grid-column: span 2; }
        .fs-3 { grid-column: span 3; }
        .fs-4 { grid-column: span 4; }
        .wo-field { min-width: 0; }
        .wo-field > label {
          display: block;
          font-size: 11px; font-weight: 600; color: var(--ink-soft);
          text-transform: uppercase; letter-spacing: 0.3px;
          margin: 0 0 4px 1px;
        }
        .wo-field > label i { color: var(--danger); font-style: normal; }

        .wo-input {
          width: 100%;
          height: 36px;
          padding: 0 11px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
          background: #ffffff;
          border: 1px solid var(--field-line);
          border-radius: 6px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .wo-input:focus {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }
        .wo-input:disabled { opacity: 0.6; cursor: not-allowed; background: #f7f9fb; }
        .wo-select-btn {
          display: flex; align-items: center; justify-content: space-between;
          gap: 6px; text-align: left; cursor: pointer;
        }
        .wo-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wo-ro {
          height: 36px;
          display: flex; align-items: center;
          padding: 0 11px;
          font-size: 13px; font-weight: 600; color: var(--ink-soft);
          background: #f7f9fb;
          border: 1px solid var(--line-soft);
          border-radius: 6px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .wo-check {
          display: flex; align-items: center; gap: 8px;
          height: 38px; margin: 0;
          padding: 0 10px;
          font-size: 0.82rem; font-weight: 600; color: var(--ink);
          border: 1px solid var(--field-line);
          border-radius: 6px;
          background: #ffffff;
          cursor: pointer;
        }
        .wo-check input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--brand); }

        .wo-dd {
          position: absolute; top: 40px; left: 0; right: 0; z-index: 100;
          max-height: 220px; overflow-y: auto;
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 10px 24px rgba(16, 24, 40, 0.14);
          padding: 4px;
        }
        .wo-dd-empty { padding: 8px; font-size: 12.5px; color: var(--ink-mute); }
        .wo-dd-item {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; margin: 0;
          padding: 7px 9px; border-radius: 6px;
          font-size: 13px; cursor: pointer;
        }
        .wo-dd-item:hover { background: var(--page); }
        .wo-dd-item.sel { background: var(--brand-soft); }
        .wo-badge-num {
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--brand); color: #fff;
          font-size: 10.5px; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center;
        }

        .wo-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          height: 34px; padding: 0 16px;
          font-family: inherit;
          font-size: 13px; font-weight: 600;
          border-radius: 6px; border: 1px solid transparent;
          cursor: pointer; white-space: nowrap;
          transition: all 0.15s ease;
        }
        .wo-btn:active { transform: translateY(1px); }
        .wo-btn-xs { height: 26px; padding: 0 10px; font-size: 11.5px; border-radius: 6px; }
        .wo-btn-primary {
          background: var(--brand);
          border-color: var(--brand);
          color: #fff;
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .wo-btn-primary:hover { background: var(--brand-dark); border-color: var(--brand-dark); box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35); }
        .wo-btn-soft {
          background: #ffffff; color: var(--teal-mid);
          border-color: var(--teal-mid);
        }
        .wo-btn-soft:hover { background: var(--teal-mid); color: #fff; }
        .wo-btn-ghost {
          background: #ffffff; color: var(--ink);
          border-color: var(--field-line);
        }
        .wo-btn-ghost:hover { background: var(--page); }
        .wo-btn-danger {
          background: #fdecec; color: #b42323;
          border-color: #f3c1c1;
        }
        .wo-btn-danger:hover { background: #f9d4d4; }
        .wo-foot { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

        .wo-table-wrap {
          border-radius: 8px; overflow: auto; max-height: 260px;
          background: #ffffff;
          border: 1px solid var(--line);
        }
        .wo-table { width: 100%; border-collapse: collapse; font-size: 12.5px; white-space: nowrap; }
        .wo-table th {
          position: sticky; top: 0; z-index: 2;
          background: #f7f9fb;
          color: var(--ink-soft); font-weight: 700; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.3px;
          padding: 9px 10px; text-align: center;
          border-bottom: 1px solid var(--line);
        }
        .wo-table td {
          padding: 7px 10px; text-align: center; color: var(--ink);
          border-bottom: 1px solid var(--line-soft);
          vertical-align: middle;
        }
        .wo-table tbody tr:hover td { background: var(--brand-soft); }
        .wo-chip {
          display: inline-block;
          font-size: 11px; font-weight: 600;
          padding: 2px 8px; border-radius: 4px;
          background: var(--teal-soft); color: var(--teal-mid);
        }
        .wo-chip-green { background: #e4f6ee; color: #167a52; }
        .wo-empty {
          text-align: center; padding: 16px 10px;
          border: 1.5px dashed var(--field-line);
          border-radius: 8px; color: var(--ink-mute); font-size: 12.5px;
          background: #fafbfc;
        }

        .wo-overlay {
          position: fixed; inset: 0; z-index: 1050;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          background: rgba(11, 58, 69, 0.45);
          backdrop-filter: blur(3px);
        }
        .wo-modal {
          width: 100%; max-width: 720px; max-height: 92vh; overflow-y: auto;
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 24px 60px rgba(16, 24, 40, 0.28);
          padding: 18px;
          color: var(--ink);
        }
        /* Activity & paper modal: all text black */
        .wo-modal,
        .wo-modal .wo-title,
        .wo-modal .wo-panel-title,
        .wo-modal .wo-panel-note,
        .wo-modal .wo-field > label,
        .wo-modal .wo-input,
        .wo-modal .wo-ro,
        .wo-modal .wo-check,
        .wo-modal .wo-info > span,
        .wo-modal .wo-info > b,
        .wo-modal .wo-accent,
        .wo-modal .wo-good,
        .wo-modal .po-field-label,
        .wo-modal .po-input {
          color: #000 !important;
        }
        /* Paper qty: bold + red (must stay AFTER the black rule) */
        .wo-modal .po-field-label.wo-paper-qty,
        .wo-modal .po-input.wo-paper-qty {
          color: #dc2626 !important;
          -webkit-text-fill-color: #dc2626 !important;
          font-weight: 800 !important;
        }

        .wo-modal-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px 12px;
        }
        .wo-modal-grid > .s2 { grid-column: span 2; }
        .wo-modal-grid > .s4 { grid-column: span 4; }

        @media (max-width: 900px) {
          .wo-info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .wo-fields > .wo-field { grid-column: span 6; }
        }
        @media (max-width: 768px) {
          .planner-dashboard-root { padding: 14px; }
        }
        @media (max-width: 560px) {
          .wo-fields > .wo-field { grid-column: span 12; }
          .wo-modal-grid > .s2,
          .wo-modal-grid > .s4 { grid-column: span 6; }
        }

        /* ===== Outlined floating-label fields (same as Customer Dashboard) ===== */
        .planner-dashboard-root .po-field {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 38px;
          background: #ffffff;
          border: 1px solid var(--field-line);
          border-radius: 6px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .planner-dashboard-root .po-field:focus-within {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }
        .planner-dashboard-root .po-field-icon {
          position: absolute;
          left: 10px;
          color: var(--ink-mute);
          font-size: 0.78rem;
          pointer-events: none;
        }
        .planner-dashboard-root .po-field .po-input {
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
        .planner-dashboard-root .po-field .po-input[readonly] { color: var(--ink-soft); background: #f7f9fb !important; }
        .planner-dashboard-root .po-field select.po-input {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          padding-right: 28px;
        }
        .planner-dashboard-root .po-field select.po-input:disabled { cursor: not-allowed; opacity: 0.7; }
        .planner-dashboard-root .po-field textarea.po-input { resize: vertical; padding-top: 10px; }
        .planner-dashboard-root .po-field button.po-input {
          display: flex;
          align-items: center;
          text-align: left;
          cursor: pointer;
          padding-right: 28px;
        }
        .planner-dashboard-root .po-caret {
          position: absolute;
          right: 10px;
          font-size: 0.7rem;
          color: var(--ink-mute);
          pointer-events: none;
        }
        .planner-dashboard-root .po-field-label {
          position: absolute;
          left: 32px;
          top: 50%;
          transform: translateY(-50%);
          padding: 0 4px;
          margin: 0;
          background: #ffffff;
          color: var(--ink-mute);
          font-size: 0.78rem;
          font-weight: 500;
          pointer-events: none;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .planner-dashboard-root .po-field.po-area { align-items: flex-start; }
        .planner-dashboard-root .po-field.po-area .po-field-label { top: 17px; }
        .planner-dashboard-root .po-field.po-area .po-field-icon { top: 11px; }
        .planner-dashboard-root .po-field:focus-within .po-field-label,
        .planner-dashboard-root .po-field.is-floated .po-field-label {
          top: 0;
          left: 24px;
          font-size: 0.64rem;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: var(--teal-mid);
        }
        .planner-dashboard-root .po-req { color: var(--danger); }

        /* Planned work orders filter grid */
        .pl-filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 12px 10px;
          align-items: center;
          padding-top: 6px;
        }
        .pl-filter-grid .clear-btn {
          height: 38px;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        /* =====================================================================
           COMPACT TYPE + PURE BLACK TEXT (entire page)
           ===================================================================== */
        .planner-dashboard-root {
          --ink: #000000;
          --ink-soft: #000000;
          --ink-mute: #000000;
          font-size: 12px;
        }

        /* headings / helper text */
        .planner-dashboard-root h1,
        .planner-dashboard-root h4 { font-size: 15px; }
        .planner-dashboard-root h5 { font-size: 13px; }
        .planner-dashboard-root h6 { font-size: 12px; }
        .planner-dashboard-root small,
        .planner-dashboard-root .small { font-size: 10.5px; color: #000000 !important; }
        .planner-dashboard-root .fs-5 { font-size: 1rem !important; }
        .planner-dashboard-root .text-primary,
        .planner-dashboard-root .text-success,
        .planner-dashboard-root .text-danger,
        .planner-dashboard-root .text-muted,
        .planner-dashboard-root .text-dark { color: #000000 !important; }
        .planner-dashboard-root .wo-accent,
        .planner-dashboard-root .wo-good,
        .planner-dashboard-root .wo-muted { color: #000000 !important; }

        /* buttons */
        .planner-dashboard-root .btn-3d { font-size: 11px; padding: 5px 12px; gap: 6px; }
        .planner-dashboard-root .btn-3d svg { width: 13px; height: 13px; }
        .planner-dashboard-root .clear-btn { font-size: 11px; }
        .planner-dashboard-root .wo-btn { font-size: 11px; height: 30px; padding: 0 13px; }
        .planner-dashboard-root .wo-btn-xs { font-size: 10px; height: 24px; padding: 0 9px; }
        .btn-3d-warning,
        .btn-3d-danger,
        .wo-btn-danger,
        .btn-3d-warning:hover,
        .btn-3d-danger:hover { color: #000000; }
        .btn-3d-info:not(:hover),
        .wo-btn-soft:not(:hover) { color: #000000; }

        /* badges / chips / pills */
        .planner-dashboard-root .badge-3d { font-size: 10px; padding: 3px 8px; color: #000000; }
        .planner-dashboard-root .wo-chip,
        .planner-dashboard-root .wo-chip-green,
        .planner-dashboard-root .wo-pill,
        .planner-dashboard-root .wo-pill-blue,
        .planner-dashboard-root .wo-pill-amber { color: #000000; font-size: 10px; }

        /* data tables */
        .planner-dashboard-root .table-modern,
        .planner-dashboard-root .planned-workorders-table { font-size: 11px; }
        .planner-dashboard-root .table-modern thead th,
        .planner-dashboard-root .planned-workorders-table thead th { font-size: 9.5px; padding: 9px 10px; }
        .planner-dashboard-root .table-modern tbody td,
        .planner-dashboard-root .planned-workorders-table tbody td { padding: 7px 10px; color: #000000; }
        .planner-dashboard-root .wo-table { font-size: 11px; }
        .planner-dashboard-root .wo-table th { font-size: 9.5px; padding: 8px 9px; }
        .planner-dashboard-root .wo-table td { padding: 6px 9px; }

        /* work order form + modal */
        .planner-dashboard-root .wo-title { font-size: 14px; }
        .planner-dashboard-root .wo-sub { font-size: 11px; }
        .planner-dashboard-root .wo-panel-title { font-size: 12px; }
        .planner-dashboard-root .wo-panel-note { font-size: 10.5px; }
        .planner-dashboard-root .wo-info > span { font-size: 9px; }
        .planner-dashboard-root .wo-info > b { font-size: 11.5px; }
        .planner-dashboard-root .wo-field > label { font-size: 10px; }
        .planner-dashboard-root .wo-input,
        .planner-dashboard-root .wo-ro { font-size: 11.5px; }
        .planner-dashboard-root .wo-check { font-size: 0.74rem; height: 34px; }
        .planner-dashboard-root .wo-dd-item { font-size: 11.5px; }
        .planner-dashboard-root .wo-empty { font-size: 11.5px; }

        /* outlined floating-label fields */
        .planner-dashboard-root .po-field { min-height: 34px; }
        .planner-dashboard-root .po-field .po-input { font-size: 0.72rem; min-height: 32px; }
        .planner-dashboard-root .po-field-icon { font-size: 0.72rem; }
        .planner-dashboard-root .po-field-label { font-size: 0.72rem; }
        .planner-dashboard-root .po-field.po-area .po-field-label { top: 15px; }
        .planner-dashboard-root .po-field:focus-within .po-field-label,
        .planner-dashboard-root .po-field.is-floated .po-field-label {
          font-size: 0.58rem;
          color: #000000;
        }
        .planner-dashboard-root .po-err { font-size: 0.66rem; }

        /* =====================================================================
           TEXT A LITTLE BIGGER + LIGHT BUTTON COLOURS
           ===================================================================== */
        .planner-dashboard-root { font-size: 12.5px; }

        .planner-dashboard-root h1,
        .planner-dashboard-root h4 { font-size: 16px; }
        .planner-dashboard-root h5 { font-size: 14px; }
        .planner-dashboard-root h6 { font-size: 13px; }
        .planner-dashboard-root small,
        .planner-dashboard-root .small { font-size: 11.5px; }
        .planner-dashboard-root .fs-5 { font-size: 1.1rem !important; }

        /* tabs + top button */
        .planner-dashboard-root .quick-nav-btn { font-size: 12px; padding: 5px 12px; }
        .planner-dashboard-root .quick-nav-btn svg { width: 13px; height: 13px; }
        .planner-dashboard-root .quick-nav-cta { font-size: 12px; padding: 5px 12px; }
        .planner-dashboard-root .quick-nav-cta svg { width: 13px; height: 13px; }
        .planner-dashboard-root .quick-nav-count { font-size: 10.5px; min-width: 20px; }

        /* buttons: size */
        .planner-dashboard-root .btn-3d { font-size: 12px; padding: 6px 13px; }
        .planner-dashboard-root .btn-3d svg { width: 14px; height: 14px; }
        .planner-dashboard-root .clear-btn { font-size: 12px; }
        .planner-dashboard-root .wo-btn { font-size: 12px; height: 32px; }
        .planner-dashboard-root .wo-btn-xs { font-size: 11px; height: 26px; }

        /* buttons: light colours, black text */
        .planner-dashboard-root .btn-3d-primary,
        .planner-dashboard-root .wo-btn-primary {
          background: #fde3d8; border-color: #f5b9a1; color: #000000; box-shadow: none;
        }
        .planner-dashboard-root .btn-3d-primary:hover,
        .planner-dashboard-root .wo-btn-primary:hover {
          background: #fbd0bf; border-color: #f0a48a; color: #000000; box-shadow: none;
        }
        .planner-dashboard-root .btn-3d-success {
          background: #d9f2e6; border-color: #a9dcc3; color: #000000; box-shadow: none;
        }
        .planner-dashboard-root .btn-3d-success:hover {
          background: #c5ebd6; border-color: #8fceb0; color: #000000;
        }
        .planner-dashboard-root .btn-3d-dark {
          background: #d5e9ee; border-color: #a9cdd6; color: #000000; box-shadow: none;
        }
        .planner-dashboard-root .btn-3d-dark:hover {
          background: #c3dde4; border-color: #93bfca; color: #000000;
        }
        .planner-dashboard-root .btn-3d-info,
        .planner-dashboard-root .wo-btn-soft {
          background: #e8f3f6; border-color: #b9d6dd; color: #000000;
        }
        .planner-dashboard-root .btn-3d-info:hover,
        .planner-dashboard-root .wo-btn-soft:hover {
          background: #d5e9ee; border-color: #a9cdd6; color: #000000;
        }
        .planner-dashboard-root .btn-3d-secondary,
        .planner-dashboard-root .wo-btn-ghost { color: #000000; }

        /* selected tab: light fill, black text */
        .planner-dashboard-root .quick-nav-btn.active-all {
          background: #d5e9ee; border-color: #a9cdd6; color: #000000; box-shadow: none;
        }
        .planner-dashboard-root .quick-nav-btn.active-received {
          background: #fde3d8; border-color: #f5b9a1; color: #000000; box-shadow: none;
        }
        .planner-dashboard-root .quick-nav-btn.active-planned {
          background: #d9f2e6; border-color: #a9dcc3; color: #000000; box-shadow: none;
        }
        .planner-dashboard-root .quick-nav-btn.active-outer {
          background: #fbdcdc; border-color: #f0b4b4; color: #000000; box-shadow: none;
        }
        .planner-dashboard-root .quick-nav-btn[class*="active-"] .quick-nav-count {
          background: rgba(0, 0, 0, 0.08); color: #000000;
        }

        /* badges */
        .planner-dashboard-root .badge-3d { font-size: 11px; }
        .planner-dashboard-root .wo-chip,
        .planner-dashboard-root .wo-chip-green,
        .planner-dashboard-root .wo-pill,
        .planner-dashboard-root .wo-pill-blue,
        .planner-dashboard-root .wo-pill-amber { font-size: 11px; }

        /* data tables */
        .planner-dashboard-root .table-modern,
        .planner-dashboard-root .planned-workorders-table { font-size: 12px; }
        .planner-dashboard-root .table-modern thead th,
        .planner-dashboard-root .planned-workorders-table thead th { font-size: 10.5px; }
        .planner-dashboard-root .wo-table { font-size: 12px; }
        .planner-dashboard-root .wo-table th { font-size: 10.5px; }

        /* work order form + modal */
        .planner-dashboard-root .wo-title { font-size: 15px; }
        .planner-dashboard-root .wo-sub { font-size: 11.5px; }
        .planner-dashboard-root .wo-panel-title { font-size: 13px; }
        .planner-dashboard-root .wo-panel-note { font-size: 11.5px; }
        .planner-dashboard-root .wo-info > span { font-size: 10px; }
        .planner-dashboard-root .wo-info > b { font-size: 12.5px; }
        .planner-dashboard-root .wo-field > label { font-size: 10.5px; }
        .planner-dashboard-root .wo-input,
        .planner-dashboard-root .wo-ro { font-size: 12.5px; }
        .planner-dashboard-root .wo-check { font-size: 0.8rem; height: 36px; }
        .planner-dashboard-root .wo-dd-item { font-size: 12.5px; }
        .planner-dashboard-root .wo-empty { font-size: 12.5px; }

        /* floating-label fields */
        .planner-dashboard-root .po-field { min-height: 36px; }
        .planner-dashboard-root .po-field .po-input { font-size: 0.8rem; min-height: 34px; }
        .planner-dashboard-root .po-field-icon { font-size: 0.8rem; }
        .planner-dashboard-root .po-field-label { font-size: 0.8rem; }
        .planner-dashboard-root .po-field:focus-within .po-field-label,
        .planner-dashboard-root .po-field.is-floated .po-field-label { font-size: 0.62rem; }
        .planner-dashboard-root .po-err { font-size: 0.7rem; }

        /* =====================================================================
           TABLE COLUMN HEADER COLOUR (light)
           ===================================================================== */
        .planner-dashboard-root .table-modern thead th,
        .planner-dashboard-root .planned-workorders-table thead th {
          background: #d5e9ee !important;
          color: #000000 !important;
          border: 1px solid #b9d6dd !important;
        }
        .planner-dashboard-root .wo-table th {
          background: #d5e9ee;
          color: #000000;
          border-bottom: 1px solid #b9d6dd;
        }
      
        /* ===== CREATE WORK ORDER — split layout like Purchase Order Entry ===== */
        .planner-dashboard-root .wo-split.po-split {
          display: flex;
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 8px;
          overflow: hidden;
          padding: 0;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.07);
          max-width: 1180px;
          margin-left: auto; margin-right: auto;
        }
        .planner-dashboard-root .wo-split .po-side {
          flex: 0 0 24%;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 24px;
          color: #ffffff;
          background: linear-gradient(170deg, #0b3a45 0%, #0f5560 100%);
        }
        .planner-dashboard-root .wo-split .po-side::before {
          content: ''; position: absolute; width: 260px; height: 260px; border-radius: 50%;
          right: -110px; top: -90px; background: rgba(255, 255, 255, 0.06);
        }
        .planner-dashboard-root .wo-split .po-side::after {
          content: ''; position: absolute; width: 200px; height: 200px; border-radius: 50%;
          left: -90px; bottom: -80px; background: rgba(228, 87, 46, 0.18);
        }
        .planner-dashboard-root .wo-split .po-side > * { position: relative; z-index: 1; }
        .planner-dashboard-root .wo-split .po-side-brand {
          font-weight: 700; font-size: 11.5px; letter-spacing: 1px;
          text-transform: uppercase; color: #ffb59c;
        }
        .planner-dashboard-root .wo-split .po-side-hero h2 {
          margin: 0; padding: 0; color: #ffffff !important;
          font-size: 21px; font-weight: 600; line-height: 1.15;
        }
        .planner-dashboard-root .wo-split .po-side-hero h1 {
          margin: 0 0 12px; color: #ffffff;
          font-size: 38px; font-weight: 700; line-height: 1; letter-spacing: -0.5px;
        }
        .planner-dashboard-root .wo-split .po-side-hero p {
          margin: 0; max-width: 210px; font-size: 12px; line-height: 1.55; color: #c9dde1;
        }
        .planner-dashboard-root .wo-split .po-side-foot {
          color: #ffb59c; font-size: 11px; font-weight: 700;
          letter-spacing: 0.8px; text-transform: uppercase;
        }
        .planner-dashboard-root .wo-split .po-main {
          flex: 1; min-width: 0; padding: 22px 28px 20px; background: #ffffff;
        }
        .planner-dashboard-root .wo-split .po-heading {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          text-align: left; color: var(--ink);
          font-size: 17px; font-weight: 700;
          padding-bottom: 10px; margin-bottom: 14px;
          border-bottom: 1px solid var(--line);
        }
        .planner-dashboard-root .wo-split .wo-panel {
          background: transparent; border: 0; border-radius: 0;
          padding: 0; margin: 0 0 6px; box-shadow: none;
        }
        .planner-dashboard-root .wo-split .wo-panel-head { margin: 14px 0 8px; }
        .planner-dashboard-root .wo-split .wo-panel-title {
          font-size: 13px; font-weight: 700; color: var(--ink);
          padding-left: 8px; border-left: 3px solid var(--brand);
        }
        .planner-dashboard-root .wo-split .wo-info { background: #f7f9fb; }
        .planner-dashboard-root .wo-split .wo-table-wrap {
          border: 1px solid var(--line); border-radius: 6px; overflow-x: auto;
        }
        .planner-dashboard-root .wo-split .wo-foot {
          justify-content: center; align-items: center; gap: 10px;
          margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line);
        }
        .planner-dashboard-root .wo-split .wo-foot .wo-btn {
          min-width: 150px; padding: 10px 18px; font-size: 13px;
          font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
          border-radius: 6px; justify-content: center;
        }
        .planner-dashboard-root .wo-split .wo-foot .wo-btn-ghost {
          background: #ffffff; color: var(--ink); border: 1px solid var(--field-line);
        }
        .planner-dashboard-root .wo-split .wo-foot .wo-btn-ghost:hover {
          background: var(--page); border-color: var(--teal-mid); color: var(--teal-mid);
        }
        .planner-dashboard-root .wo-split .wo-foot .wo-btn-primary {
          background: var(--brand); border: 1px solid var(--brand); color: #ffffff;
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .planner-dashboard-root .wo-split .wo-foot .wo-btn-primary:hover {
          background: var(--brand-dark); border-color: var(--brand-dark);
        }
        @media (max-width: 992px) {
          .planner-dashboard-root .wo-split.po-split { flex-direction: column; }
          .planner-dashboard-root .wo-split .po-side { flex: none; min-height: 160px; padding: 20px; gap: 14px; }
          .planner-dashboard-root .wo-split .po-side-hero h1 { font-size: 30px; margin-bottom: 6px; }
          .planner-dashboard-root .wo-split .po-main { padding: 20px 14px; }
          .planner-dashboard-root .wo-split .wo-foot .wo-btn { flex: 1; min-width: 0; }
        }
      
        /* ===== PLANNED REGISTRY: section headings + slightly darker column headers ===== */
        .planner-dashboard-root .pl-section-title {
          display: flex; align-items: center; gap: 7px;
          margin: 2px 0 10px; padding-left: 8px;
          border-left: 3px solid var(--brand);
          font-size: 13px; font-weight: 700; color: #000000;
          letter-spacing: 0.2px;
        }
        .planner-dashboard-root .pl-section-title i { color: var(--brand); font-size: 14px; }
        .planner-dashboard-root .pl-filter-grid { padding-top: 0; }

        .planner-dashboard-root .table-modern thead th,
        .planner-dashboard-root .planned-workorders-table thead th {
          background: #a9d0d9 !important;
          color: #000000 !important;
          font-weight: 700 !important;
          border: 1px solid #8fbcc7 !important;
        }
        .planner-dashboard-root .wo-table th {
          background: #a9d0d9;
          color: #000000;
          font-weight: 700;
          border-bottom: 1px solid #8fbcc7;
        }

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
        @keyframes pgfade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* page container */
        .planner-dashboard-root {
          animation: pgfadeup 0.45s ease-out backwards;
        }

        /* top tabs */
        .planner-dashboard-root .quick-nav {
          animation: pgfadedown 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
        }

        /* cards (received, printing, planned, outer label) */
        .planner-dashboard-root .card-glass-3d {
          animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.25s backwards;
        }
        .planner-dashboard-root .premium-toolbar {
          animation: pgfadeup 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.4s backwards;
        }
        .planner-dashboard-root .scrollable-table-container {
          animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.5s backwards;
        }

        /* work order form (plays every time it opens) */
        .planner-dashboard-root .wo-split {
          animation: pgpop 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s backwards;
        }
        .planner-dashboard-root .wo-split .po-side {
          animation: pgslideright 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
        }
        .planner-dashboard-root .wo-split .po-heading,
        .planner-dashboard-root .wo-split .wo-panel,
        .planner-dashboard-root .wo-split .wo-foot {
          animation: pgfadeup 0.45s ease-out backwards;
        }
        .planner-dashboard-root .wo-split .po-heading         { animation-delay: 0.25s; }
        .planner-dashboard-root .wo-split .wo-panel:nth-of-type(1) { animation-delay: 0.32s; }
        .planner-dashboard-root .wo-split .wo-panel:nth-of-type(2) { animation-delay: 0.40s; }
        .planner-dashboard-root .wo-split .wo-panel:nth-of-type(3) { animation-delay: 0.48s; }
        .planner-dashboard-root .wo-split .wo-foot            { animation-delay: 0.56s; }

        /* activity / paper modal */
        .planner-dashboard-root .wo-overlay { animation: pgfade 0.25s ease-out backwards; }
        .planner-dashboard-root .wo-modal   { animation: pgpop 0.35s cubic-bezier(0.22, 1, 0.36, 1) backwards; }

        /* table rows: quick stagger on the first rows */
        .planner-dashboard-root .table-modern tbody tr,
        .planner-dashboard-root .planned-workorders-table tbody tr {
          animation: pgrow 0.35s ease-out backwards;
        }
        .planner-dashboard-root .table-modern tbody tr:nth-child(1),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(1)  { animation-delay: 0.55s; }
        .planner-dashboard-root .table-modern tbody tr:nth-child(2),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(2)  { animation-delay: 0.60s; }
        .planner-dashboard-root .table-modern tbody tr:nth-child(3),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(3)  { animation-delay: 0.65s; }
        .planner-dashboard-root .table-modern tbody tr:nth-child(4),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(4)  { animation-delay: 0.70s; }
        .planner-dashboard-root .table-modern tbody tr:nth-child(5),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(5)  { animation-delay: 0.75s; }
        .planner-dashboard-root .table-modern tbody tr:nth-child(6),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(6)  { animation-delay: 0.80s; }
        .planner-dashboard-root .table-modern tbody tr:nth-child(7),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(7)  { animation-delay: 0.85s; }
        .planner-dashboard-root .table-modern tbody tr:nth-child(8),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(8)  { animation-delay: 0.90s; }
        .planner-dashboard-root .table-modern tbody tr:nth-child(n+9),
        .planner-dashboard-root .planned-workorders-table tbody tr:nth-child(n+9) { animation-delay: 0.95s; }

        /* ===== PAGE LOADER ===== */
        @keyframes plSpin { to { transform: rotate(360deg); } }
        @keyframes plLoaderIn { from { opacity: 0; } to { opacity: 1; } }
        .planner-dashboard-root .pl-loader-overlay {
          position: absolute; inset: 0; z-index: 200;
          display: flex; justify-content: center; align-items: flex-start;
          background: rgba(244, 246, 248, 0.8);
          backdrop-filter: blur(2px);
          animation: plLoaderIn 0.25s ease-out 0.4s backwards;
        }
        .planner-dashboard-root .pl-loader-box {
          position: sticky; top: 35vh; height: fit-content;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 26px 38px; border-radius: 8px;
          background: #ffffff; border: 1px solid #e3e7ec;
          box-shadow: 0 16px 36px rgba(16, 24, 40, 0.18);
        }
        .planner-dashboard-root .pl-spinner {
          width: 46px; height: 46px; border-radius: 50%;
          border: 5px solid #fdeee8;
          border-top-color: #e4572e;
          animation: plSpin 0.8s linear infinite;
        }
        .planner-dashboard-root .pl-loader-text { font-size: 13px; font-weight: 700; color: #000; }

        /* respect users who disable motion */
        @media (prefers-reduced-motion: reduce) {
          .planner-dashboard-root,
          .planner-dashboard-root * {
            animation: none !important;
          }
        }
      `}</style>

      {pageLoading && (
        <div className="pl-loader-overlay">
          <div className="pl-loader-box">
            <div className="pl-spinner" />
            <span className="pl-loader-text">Loading planner data…</span>
          </div>
        </div>
      )}

      <div className="planner-container-3d">
        {/* QUICK-NAV TABS */}
        <div className="quick-nav">
          <div className="quick-nav-group shadow-sm">
            <button
              type="button"
              className={`quick-nav-btn ${activeTab === "ALL" ? "active-all" : ""}`}
              onClick={() => handleTabChange("ALL")}
            >
              <Icons.List /> All Orders
            </button>

            <button
              type="button"
              className={`quick-nav-btn ${activeTab === "ORDER_RECEIVED" ? "active-received" : ""}`}
              onClick={() => handleTabChange("ORDER_RECEIVED")}
            >
              <Icons.Inbox /> Received Orders
              <span className="quick-nav-count">{receivedCount}</span>
            </button>

            <button
              type="button"
              className={`quick-nav-btn ${activeTab === "PLANNED" ? "active-planned" : ""}`}
              onClick={() => handleTabChange("PLANNED")}
            >
              <Icons.Done /> Planned Work Orders
              <span className="quick-nav-count">{plannedCount}</span>
            </button>

            <button
              type="button"
              className={`quick-nav-btn ${activeTab === "OUTER_LABEL" ? "active-outer" : ""}`}
              onClick={() => handleTabChange("OUTER_LABEL")}
            >
              <Icons.Tag /> Outer Label Entry
            </button>
          </div>

          <button type="button" onClick={cust} className="btn-3d btn-3d-primary quick-nav-cta">
            <Icons.Cart /> Purchase Order Entry
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. OUTER LABEL ENTRY VIEW                                                 */}
        {/* ========================================================================= */}
        {plannerViewMode === "outerLabelEntry" && (
          <div className="card-glass-3d p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4 pb-3 border-bottom border-info-subtle">
              <div style={{ width: "90px" }} />
              <div className="text-center flex-grow-1">
                <h4 className="fw-bold mb-1" style={{ color: "#064c73" }}>
                  Outer Label Entry
                </h4>
                <small className="text-muted">
                  Fetch work order and configure outer carton dispatch labels
                </small>
              </div>
              <span className="badge-3d badge-3d-primary">
                Label Setup
              </span>
            </div>

            {/* WO Search Box */}
            <div className="bg-white p-3 rounded-3 border mb-4 shadow-sm" style={{ borderColor: "#b8d9eb" }}>
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <PoField
                  style={{ width: "300px", maxWidth: "100%" }}
                  icon="bi-hash"
                  label="Work Order Number"
                  filled={has(outerLabelWoInput)}
                >
                  <input
                    type="text"
                    className="po-input"
                    value={outerLabelWoInput}
                    onChange={(e) => setOuterLabelWoInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetchWoForLabel()}
                  />
                </PoField>
                <button
                  className="btn-3d btn-3d-primary"
                  style={{ height: "38px", padding: "0 22px" }}
                  onClick={handleFetchWoForLabel}
                  disabled={outerLabelLoading}
                >
                  <Icons.Search /> {outerLabelLoading ? "Loading..." : "Call WO"}
                </button>
              </div>
            </div>

            {outerLabelWo && (
              <>
                {/* 4 KPI Summary Tiles */}
                <div className="row g-3 mb-4 align-items-stretch">
                  <div className="col-md-3">
                    <div className="bg-white p-3 rounded-3 border shadow-sm h-100" style={{ borderLeft: "5px solid #0284c7", borderColor: "#b8d9eb" }}>
                      <small className="fw-bold text-muted d-block">WO NUMBER</small>
                      <div className="fs-5 fw-bold text-dark mt-1">{outerLabelWo.efiWoNumber}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="bg-white p-3 rounded-3 border shadow-sm h-100" style={{ borderLeft: "5px solid #10b981", borderColor: "#b8d9eb" }}>
                      <small className="fw-bold text-muted d-block">CUSTOMER</small>
                      <div className="fs-5 fw-bold text-dark mt-1 text-truncate">
                        {outerLabelWo.customer?.name || outerLabelWo.customer || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white p-3 rounded-3 border shadow-sm h-100" style={{ borderLeft: "5px solid #f59e0b", borderColor: "#b8d9eb" }}>
                      <small className="fw-bold text-muted d-block">PRODUCT</small>
                      <div className="fs-5 fw-bold text-dark mt-1 text-truncate">
                        {outerLabelWo.productName || outerLabelWo.description || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="bg-white p-3 rounded-3 border shadow-sm h-100" style={{ borderLeft: "5px solid #8b5cf6", borderColor: "#b8d9eb" }}>
                      <small className="fw-bold text-muted d-block">ORDER QTY</small>
                      <div className="fs-5 fw-bold text-dark mt-1">{outerLabelWo.orderQty || "-"}</div>
                    </div>
                  </div>
                </div>

                {/* Form Controls */}
                <div className="bg-white p-4 rounded-3 border shadow-sm" style={{ borderColor: "#b8d9eb" }}>
                  <h6 className="fw-bold mb-3" style={{ color: "#064c73" }}>
                    Packaging &amp; Dispatch Details
                  </h6>

                  <div className="row g-3 align-items-start">
                    <PoField
                      className="col-md-3"
                      icon="bi-box-seam"
                      label="Packaging Unit"
                      alwaysFloat
                      caret
                    >
                      <select
                        name="unitType"
                        className="po-input"
                        value={outerLabelForm.unitType}
                        onChange={handleOuterLabelFormChange}
                      >
                        <option value="">Select Unit</option>
                        <option value="each">Each</option>
                        <option value="sheet">Sheets</option>
                      </select>
                    </PoField>

                    <PoField
                      className="col-md-4"
                      icon="bi-123"
                      label="Quantity in Box"
                      filled={has(outerLabelForm.boxQty)}
                    >
                      <input
                        type="number"
                        name="boxQty"
                        className="po-input"
                        value={outerLabelForm.boxQty}
                        onChange={handleOuterLabelFormChange}
                        min="0"
                      />
                    </PoField>

                    <PoField
                      className="col-md-5"
                      icon="bi-geo-alt"
                      label="Delivery Destination"
                      alwaysFloat
                      caret
                    >
                      <select
                        className="po-input"
                        value={outerLabelLocationId}
                        onChange={handleOuterLabelLocationChange}
                      >
                        <option value="">Select Delivery Location</option>
                        {locationsMaster.map(loc => (
                          <option key={loc._id} value={loc._id}>
                            {loc.locationName}
                          </option>
                        ))}
                      </select>
                    </PoField>

                    <PoField
                      className="col-12"
                      icon="bi-truck"
                      label="Dispatch Location & Address"
                      area
                      filled={has(outerLabelForm.dispatchLocation)}
                    >
                      <textarea
                        name="dispatchLocation"
                        className="po-input"
                        style={{ resize: "none", height: "80px" }}
                        rows={2}
                        value={outerLabelForm.dispatchLocation}
                        onChange={handleOuterLabelFormChange}
                      />
                    </PoField>
                  </div>

                  {/* Read-Only Preview */}
                  {outerLabelPreview && (
                    <div className="row g-3 mt-2">
                      <div className="col-md-6">
                        <div className="p-3 rounded-3" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                          <small className="fw-bold" style={{ color: "#0284c7" }}>Final Quantity per Box</small>
                          <h5 className="mb-1 mt-1 fw-bold text-dark">{outerLabelPreview.finalBoxQty}</h5>
                          <small className="text-muted">{outerLabelPreview.boxQtyFormula}</small>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="p-3 rounded-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                          <small className="fw-bold" style={{ color: "#15803d" }}>Labels to be Generated</small>
                          <h5 className="mb-1 mt-1 fw-bold text-dark">{outerLabelPreview.totalLabels}</h5>
                          <small className="text-muted">{outerLabelPreview.labelsFormula}</small>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="d-flex justify-content-center gap-3 flex-wrap mt-4 pt-3 border-top">
                    <button
                      className="btn-3d btn-3d-success px-4"
                      style={{ minWidth: "160px" }}
                      onClick={() => handleSaveOuterLabelInfo(false)}
                    >
                      Save
                    </button>
                    <button
                      className="btn-3d btn-3d-info px-4"
                      style={{ minWidth: "220px" }}
                      onClick={() => handleSaveOuterLabelInfo(true)}
                    >
                      <Icons.PDF /> Save &amp; Download Label
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. MAIN PLANNER VIEW                                                      */}
        {/* ========================================================================= */}
        {plannerViewMode === "main" && (
          <>
            {/* 3A. PURCHASE ORDER RECEIVED TABLE */}
            {(statusFilter === "ORDER_RECEIVED" || statusFilter === "") && orders.length > 0 && (
              <div className="card-glass-3d p-3 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <h5 className="fw-bold m-0" style={{ color: "#064c73" }}>
                    Purchase Orders Received
                  </h5>

                  {/* Filter by Product Type */}
                  <div className="d-flex align-items-center gap-2">
                    <PoField
                      style={{ width: "220px" }}
                      icon="bi-tag"
                      label="Product Type"
                      alwaysFloat
                      caret
                    >
                      <select
                        className="po-input"
                        value={productTypeFilter}
                        onChange={(e) => setProductTypeFilter(e.target.value)}
                      >
                        <option value="">All Types</option>
                        {productTypeOptions.map((type, i) => (
                          <option key={i} value={type}>{type}</option>
                        ))}
                      </select>
                    </PoField>
                    {productTypeFilter && (
                      <button
                        className="btn-3d btn-3d-secondary btn-sm"
                        style={{ height: "38px", padding: "0 12px", fontSize: "12px" }}
                        onClick={() => setProductTypeFilter("")}
                      >
                        <Icons.Reset /> Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="scrollable-table-container">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th>PO No</th>
                        <th>Customer Name</th>
                        <th>Job Description</th>
                        <th>Order Quantity</th>
                        <th>Location</th>
                        <th>Product Type</th>
                        <th>View PDF</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders
                        .filter(order =>
                          order.userLocations?.some(loc => userLocations.includes(loc))
                        )
                        .filter(order =>
                          productTypeFilter
                            ? order.materialType === productTypeFilter
                            : true
                        )
                        .map(order => (
                          <tr key={order._id}>
                            <td className="fw-bold">{order.purchaseOrderNo || "-"}</td>
                            <td>{order.customer?.name || order.customerName}</td>
                            <td>{order.description || order.productName || "-"}</td>
                            <td className="fw-bold text-primary">{order.quantity}</td>
                            <td>{order.location?.locationName || order.location || "N/A"}</td>
                            <td>
                              <span className="badge-3d badge-3d-primary">{order.materialType || "-"}</span>
                            </td>
                            <td>
                              {order.itemPdfPath ? (
                                <a
                                  href={`${BASE_URL}${order.itemPdfPath}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-3d btn-3d-info btn-sm"
                                  style={{ padding: "3px 10px", fontSize: "11.5px" }}
                                >
                                  View
                                </a>
                              ) : "-"}
                            </td>
                            <td>
                              <span className="badge-3d badge-3d-warning">{order.status}</span>
                            </td>
                            <td>
                              <button
                                className="btn-3d btn-3d-success btn-sm"
                                style={{ padding: "4px 12px", fontSize: "11.5px" }}
                                onClick={() => handleSelectOrder(order)}
                              >
                                Convert to WO
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3B. PRINTING ORDERS RECEIVED TABLE */}
            {(statusFilter === "ORDER_RECEIVED" || statusFilter === "") && printingOrders.length > 0 && (
              <div className="card-glass-3d p-3 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <h5 className="fw-bold m-0" style={{ color: "#064c73" }}>
                    Printing Orders Received
                  </h5>

                  <div className="d-flex align-items-center gap-2">
                    <PoField
                      style={{ width: "220px" }}
                      icon="bi-tag"
                      label="Product Type"
                      alwaysFloat
                      caret
                    >
                      <select
                        className="po-input"
                        value={printingTypeFilter}
                        onChange={(e) => setPrintingTypeFilter(e.target.value)}
                      >
                        <option value="">All Types</option>
                        {printingTypeOptions.map((type, i) => (
                          <option key={i} value={type}>{type}</option>
                        ))}
                      </select>
                    </PoField>
                    {printingTypeFilter && (
                      <button
                        className="btn-3d btn-3d-secondary btn-sm"
                        style={{ height: "38px", padding: "0 12px", fontSize: "12px" }}
                        onClick={() => setPrintingTypeFilter("")}
                      >
                        <Icons.Reset /> Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="scrollable-table-container">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th>PO No</th>
                        <th>Customer</th>
                        <th>Job Description</th>
                        <th>Order Quantity</th>
                        <th>Location</th>
                        <th>Work Order</th>
                        <th>Product Type</th>
                        <th>Product Code</th>
                        <th>View PDF</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printingOrders
                        .filter(order => !hiddenOrders.includes(order._id))
                        .filter(order =>
                          order.userLocations?.some(loc => userLocations.includes(loc))
                        )
                        .filter(order =>
                          printingTypeFilter
                            ? (order.products?.[0]?.materialType || order.materialType) === printingTypeFilter
                            : true
                        )
                        .map(order => (
                          <tr key={order._id}>
                            <td className="fw-bold">{order.purchaseOrderNo || "-"}</td>
                            <td>{order.products?.length ? order.products[0].customerName : order.customerName || "-"}</td>
                            <td>{order.products?.length ? order.products[0].description : order.description || "-"}</td>
                            <td className="fw-bold text-primary">{order.quantity || "-"}</td>
                            <td>{order.location || "-"}</td>
                            <td className="fw-bold">{order.workorder2 || "-"}</td>
                            <td>
                              <span className="badge-3d badge-3d-primary">
                                {order.products?.length ? order.products[0].materialType : order.materialType || "-"}
                              </span>
                            </td>
                            <td>{order.products?.length ? order.products[0].productCode : order.productCode || "-"}</td>
                            <td>
                              {order.itemPdfPath ? (
                                <a
                                  href={`${BASE_URL}${order.itemPdfPath}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-3d btn-3d-info btn-sm"
                                  style={{ padding: "3px 10px", fontSize: "11.5px" }}
                                >
                                  View
                                </a>
                              ) : "-"}
                            </td>
                            <td>
                              <span className="badge-3d badge-3d-warning">{order.status}</span>
                            </td>
                            <td>
                              <button
                                className="btn-3d btn-3d-success btn-sm"
                                style={{ padding: "4px 12px", fontSize: "11.5px" }}
                                onClick={() =>
                                  handleSelectOrder({
                                    ...order,
                                    isPrinting: true,
                                    customerName: order.products?.[0]?.customerName || order.customerName,
                                    description: order.products?.[0]?.description || order.description,
                                    materialType: order.products?.[0]?.materialType || order.materialType,
                                    productCode: order.products?.[0]?.productCode || order.productCode,
                                    productType: order.products?.[0]?.materialType || order.materialType,
                                    colorFront: order.products?.[0]?.colorFront || order.colorFront,
                                    colorBack: order.products?.[0]?.colorBack || order.colorBack,
                                    wasteQty: order.products?.[0]?.wasteQty || order.wasteQty,
                                    jobSize: order.products?.[0]?.jobSize || order.jobSize,
                                    inkDetails: order.products?.[0]?.inkDetails || order.inkDetails,
                                  })
                                }
                              >
                                Convert to WO
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 4. WORK ORDER FORM (Plan / Edit)                                          */}
            {/* ========================================================================= */}
            {selectedOrder && (
              <div ref={formRef} className="wo-glass po-split wo-split my-3">
                {/* Left info panel */}
                <div className="po-side">
                  <div className="po-side-brand">Work Order</div>

                  <div className="po-side-hero">
                    <h2>Let's Plan</h2>
                    <h1>{selectedOrder.status === "PLANNED" ? "Update" : "Started"}</h1>
                    <p>
                      Review the order details, set waste and priority, then add
                      activity, machine and paper entries to build the work order.
                    </p>
                  </div>

                  <div className="po-side-foot">
                    {selectedOrder.status === "PLANNED" ? "Updating Work Order" : "New Work Order"}
                  </div>
                </div>

                {/* Right form panel */}
                <div className="po-main">
                <div className="po-heading wo-heading-row">
                  <span>
                    {selectedOrder.status === "PLANNED" ? "Edit Work Order" : "Create Work Order"}
                  </span>
                  <span className={`wo-pill ${selectedOrder.status === "PLANNED" ? "wo-pill-amber" : "wo-pill-blue"}`}>
                    {selectedOrder.status === "PLANNED" ? "Planned" : "New"}
                  </span>
                </div>

                <form onSubmit={handleSubmitWorkOrder}>
                  {/* Order details (read-only summary) */}
                  <div className="wo-panel">
                    <div className="wo-panel-head">
                      <span className="wo-panel-title">Order details</span>
                    </div>
                    <div className="wo-info-grid">
                      <div className="wo-info">
                        <span>Customer</span>
                        <b title={selectedOrder.customer || selectedOrder.customerName}>
                          {selectedOrder.customer || selectedOrder.customerName || "-"}
                        </b>
                      </div>
                      <div className="wo-info">
                        <span>Location</span>
                        <b>{selectedOrder.location?.locationName || selectedOrder.location || "-"}</b>
                      </div>
                      <div className="wo-info">
                        <span>Expected delivery</span>
                        <b>
                          {selectedOrder?.expectedDeliveryDate
                            ? selectedOrder.expectedDeliveryDate.split("T")[0]
                            : "-"}
                        </b>
                      </div>
                      <div className="wo-info">
                        <span>Product type</span>
                        <b>{selectedOrder.productType || "-"}</b>
                      </div>

                      <div className="wo-info wide">
                        <span>Job description</span>
                        <b title={selectedOrder.productName || selectedOrder.description}>
                          {selectedOrder.productName || selectedOrder.description || "-"}
                        </b>
                      </div>
                      <div className="wo-info">
                        <span>Order qty</span>
                        <b className="wo-accent">{workOrderForm.orderQty ?? "-"}</b>
                      </div>
                      <div className="wo-info">
                        <span>Total qty</span>
                        <b className="wo-good">{workOrderForm.totalQty ?? "-"}</b>
                      </div>

                      <div className="wo-info">
                        <span>Job size</span>
                        <b>{workOrderForm.jobSize || "-"}</b>
                      </div>
                      <div className="wo-info">
                        <span>Color front / back</span>
                        <b>{workOrderForm.colorFront || "-"} / {workOrderForm.colorBack || "-"}</b>
                      </div>
                      <div className="wo-info wide">
                        <span>Ink details</span>
                        <b title={workOrderForm.inkDetails}>{workOrderForm.inkDetails || "None"}</b>
                      </div>
                    </div>
                  </div>

                  {/* Inputs: waste, priority, remarks, activities sign-off */}
                  <div className="wo-panel">
                    <div className="wo-panel-head">
                      <span className="wo-panel-title">Planning inputs</span>
                    </div>
                    <div className="wo-fields">
                      <PoField
                        className="wo-field fs-2"
                        icon="bi-percent"
                        label="Waste %"
                        required
                        filled={has(workOrderForm.wasteQty)}
                      >
                        <input
                          type="text"
                          name="wasteQty"
                          value={workOrderForm.wasteQty}
                          onChange={handleFormChange}
                          className="po-input"
                          required
                        />
                      </PoField>

                      <PoField
                        className="wo-field fs-3"
                        icon="bi-flag"
                        label="Priority"
                        required
                        alwaysFloat
                        caret
                      >
                        <select
                          name="priority"
                          value={workOrderForm.priority}
                          onChange={handleFormChange}
                          className="po-input"
                          required
                        >
                          <option value="">Select priority</option>
                          {priorities.map((p) => (
                            <option key={p._id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </PoField>

                      <PoField
                        className="wo-field fs-3"
                        icon="bi-chat-left-text"
                        label="Remarks"
                        filled={has(workOrderForm.remarks)}
                      >
                        <input
                          type="text"
                          name="remarks"
                          value={workOrderForm.remarks}
                          onChange={handleFormChange}
                          className="po-input"
                        />
                      </PoField>

                      <PoField
                        className="wo-field fs-4"
                        icon="bi-list-check"
                        label="Activities Sign-off Order"
                        alwaysFloat
                        caret
                      >
                        <button
                          type="button"
                          className="po-input"
                          onClick={() => setShowActivity2Dropdown(prev => !prev)}
                        >
                          <span className="wo-ellipsis">
                            {activity2.length > 0
                              ? activity2
                                  .map((id, idx) => {
                                    const act = activities.find(a => a._id === id);
                                    return `${idx + 1}. ${act?.activityName || "-"}`;
                                  })
                                  .join(", ")
                              : "Select activities"}
                          </span>
                        </button>

                        {showActivity2Dropdown && (
                          <div className="wo-dd">
                            {activities.length === 0 ? (
                              <div className="wo-dd-empty">No activities found</div>
                            ) : (
                              activities.map((a) => {
                                const selectedIndex = activity2.indexOf(a._id);
                                const isSelected = selectedIndex !== -1;
                                return (
                                  <label
                                    key={a._id}
                                    className={`wo-dd-item ${isSelected ? "sel" : ""}`}
                                  >
                                    <span className="d-flex align-items-center gap-2">
                                      {isSelected && (
                                        <span className="wo-badge-num">{selectedIndex + 1}</span>
                                      )}
                                      <span>{a.activityName}</span>
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleActivity2Toggle(a._id)}
                                      style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#e4572e" }}
                                    />
                                  </label>
                                );
                              })
                            )}
                          </div>
                        )}
                      </PoField>
                    </div>
                  </div>

                  {/* Allocations */}
                  <div className="wo-panel">
                    <div className="wo-panel-head">
                      <div>
                        <span className="wo-panel-title">Activity, machine &amp; paper</span>
                        <span className="wo-panel-note"> &nbsp;Routing, slit/inches, UPS, booklet and paper</span>
                      </div>
                      <button type="button" className="wo-btn wo-btn-soft" onClick={openNewRowModal}>
                        <Icons.Plus /> Add entry
                      </button>
                    </div>

                    {workRows.filter(row => !row.isDraft).length === 0 ? (
                      <div className="wo-empty">
                        <div style={{ fontWeight: 600, color: "#1b2a3c", marginBottom: 2 }}>No entries yet</div>
                        <div style={{ marginBottom: 8 }}>Add an activity, assign a machine and set paper details.</div>
                        <button type="button" className="wo-btn wo-btn-primary" onClick={openNewRowModal}>
                          <Icons.Plus /> Add first entry
                        </button>
                      </div>
                    ) : (
                      <div className="wo-table-wrap">
                        <table className="wo-table">
                          <thead>
                            <tr>
                              <th>Activity</th>
                              <th>Machine</th>
                              <th>Inches / Slit</th>
                              <th>UPS</th>
                              <th>Pages</th>
                              <th>Component</th>
                              <th>Perfecting</th>
                              {!(selectedOrder?.isPrinting && selectedOrder?.workorder2) && (
                                <>
                                  <th>Paper code</th>
                                  <th>Description</th>
                                  <th>GSM</th>
                                  <th>Paper qty</th>
                                </>
                              )}
                              <th>Imp front</th>
                              <th>Imp back</th>
                              <th>Total imp</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {workRows.map((row, index) => {
                              if (row.isDraft) return null;
                              const act = activities.find(a => a._id === row.activityId);
                              const mac = machines.find(m => m._id === row.machineId);
                              const imp = rowImpressions[index] || { impFront: 0, impBack: 0, totalImp: 0 };
                              return (
                                <tr key={index}>
                                  <td style={{ fontWeight: 600 }}>{act?.activityName || "-"}</td>
                                  <td>{mac?.machineName || "-"}</td>
                                  <td>{row.inches || row.slitNumber || "-"}</td>
                                  <td className="wo-accent">{row.UPS || "-"}</td>
                                  <td>
                                    {row.isBooklet ? (
                                      <span className="wo-chip">{row.pages || 0} pgs</span>
                                    ) : (
                                      <span className="wo-muted">No</span>
                                    )}
                                  </td>
                                  <td>{row.component || "-"}</td>
                                  <td>
                                    {row.isPerfecting ? (
                                      <span className="wo-chip wo-chip-green">Yes</span>
                                    ) : (
                                      <span className="wo-muted">No</span>
                                    )}
                                  </td>
                                  {!(selectedOrder?.isPrinting && selectedOrder?.workorder2) && (
                                    <>
                                      <td className="wo-accent" style={{ fontWeight: 600 }}>{[row.materialCode, ...(row.extraMaterials || []).map(m => m.materialCode)].filter(Boolean).join(", ") || "-"}</td>
                                      <td className="truncate" title={row.materialDescription}>
                                        {row.materialDescription || "-"}
                                      </td>
                                      <td>{row.gsm || "-"}</td>
                                      <td style={{ fontWeight: 600 }}>{[row.paperQty, ...(row.extraMaterials || []).map(m => m.paperQty)].filter(Boolean).join(", ") || "-"}</td>
                                    </>
                                  )}
                                  <td className="wo-good">{imp.impFront}</td>
                                  <td className="wo-good">{imp.impBack}</td>
                                  <td className="wo-accent" style={{ fontWeight: 700 }}>{imp.totalImp}</td>
                                  <td>
                                    <div className="d-inline-flex gap-1">
                                      <button
                                        type="button"
                                        className="wo-btn wo-btn-xs wo-btn-soft"
                                        onClick={() => openEditRowModal(index)}
                                      >
                                        Edit
                                      </button>
                                      {workRows.length > 1 && (
                                        <button
                                          type="button"
                                          className="wo-btn wo-btn-xs wo-btn-danger"
                                          onClick={() => handleRemoveRowFromTable(index)}
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="wo-foot">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedOrder?._id) {
                          setHiddenOrders(prev => prev.filter(id => id !== selectedOrder._id));
                        }
                        setSelectedOrder(null);
                        setWorkRows([
                          {
                            activityId: "",
                            machineId: "",
                            inches: "",
                            slitNumber: "",
                            UPS: "",
                            isBooklet: false,
                            isPerfecting: false,
                            pages: "",
                            component: "",
                            materialCode: "",
                            materialDescription: "",
                            materialGroupDescription: "",
                            mill: "",
                            gsm: "",
                            paperSize: "",
                            paperQty: "",
                            isDraft: true
                          }
                        ]);
                      }}
                      className="wo-btn wo-btn-ghost"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="wo-btn wo-btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : selectedOrder.status === "PLANNED" ? "Update work order" : "Save work order"}
                    </button>
                  </div>
                </form>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 5. MODAL: ACTIVITY / MACHINE / PAPER                                      */}
            {/* ========================================================================= */}
            {selectedOrder && showRowModal && editingRowIndex !== null && workRows[editingRowIndex] && (() => {
              const r = workRows[editingRowIndex];
              const isOffset = isOffsetActivity(r.activityId);
              const isSheetfed = isSheetfedActivity(r.activityId);
              const needsPaper = !(selectedOrder?.isPrinting && selectedOrder?.workorder2);
              const imp = rowImpressions[editingRowIndex] || { impFront: 0, impBack: 0, totalImp: 0 };

              return (
                <div className="wo-overlay" onClick={handleCancelRowModal}>
                  <div className="wo-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="wo-head">
                      <div className="wo-head-left">
                        <div className="wo-icon"><Icons.Layers /></div>
                        <div>
                          <h5 className="wo-title">Activity &amp; paper</h5>
                        </div>
                      </div>
                      <button type="button" className="wo-close" onClick={handleCancelRowModal} aria-label="Close">
                        ✕
                      </button>
                    </div>

                    {/* Step 1 */}
                    <div className="wo-panel">
                      <div className="wo-panel-head">
                        <span className="wo-panel-title">Activity &amp; machine</span>
                      </div>
                      <div className="wo-modal-grid">
                        <PoField
                          className="wo-field s2"
                          icon="bi-diagram-3"
                          label="Activity"
                          required
                          alwaysFloat
                          caret
                        >
                          <select
                            className="po-input"
                            value={r.activityId}
                            onChange={(e) => handleActivityChange(editingRowIndex, e.target.value)}
                            required
                          >
                            <option value="">Select activity</option>
                            {activities.map((a) => (
                              <option key={a._id} value={a._id}>{a.activityName}</option>
                            ))}
                          </select>
                        </PoField>

                        <PoField
                          className="wo-field s2"
                          icon="bi-cpu"
                          label="Machine"
                          required
                          alwaysFloat
                          caret
                        >
                          <select
                            className="po-input"
                            value={r.machineId}
                            onChange={(e) => handleMachineChangeForPair(editingRowIndex, e.target.value)}
                            disabled={!r.activityId}
                            required
                          >
                            <option value="">Select machine</option>
                            {filteredMachinesForPair(r.activityId).map((m) => (
                              <option key={m._id} value={m._id}>{m.machineName}</option>
                            ))}
                          </select>
                        </PoField>

                        <PoField
                          className="wo-field s2"
                          icon="bi-grid-3x3-gap"
                          label="UPS"
                          required
                          filled={has(r.UPS)}
                        >
                          <input
                            type="text"
                            className="po-input"
                            style={{ fontWeight: 700 }}
                            value={r.UPS}
                            onChange={(e) => handleRowUpsChange(editingRowIndex, e.target.value)}
                            required
                          />
                        </PoField>

                        {isOffset && (
                          <PoField
                            className="wo-field s2"
                            icon="bi-rulers"
                            label="Inches"
                            required
                            filled={has(r.inches)}
                          >
                            <input
                              type="text"
                              className="po-input"
                              value={r.inches}
                              onChange={(e) => handlePairInchesChange(editingRowIndex, e.target.value)}
                              required
                            />
                          </PoField>
                        )}

                        {isSheetfed && (
                          <>
                            <PoField
                              className="wo-field s2"
                              icon="bi-scissors"
                              label="Slit Number"
                              required
                              filled={has(r.slitNumber)}
                            >
                              <input
                                type="text"
                                className="po-input"
                                value={r.slitNumber}
                                onChange={(e) => handlePairSlitChange(editingRowIndex, e.target.value)}
                                required
                              />
                            </PoField>
                            <div className="wo-field s2">
                              <label className="wo-check" htmlFor={`rowPerfecting-${editingRowIndex}`}>
                                <input
                                  type="checkbox"
                                  id={`rowPerfecting-${editingRowIndex}`}
                                  checked={r.isPerfecting}
                                  onChange={(e) => handleRowPerfectingToggle(editingRowIndex, e.target.checked)}
                                />
                                Perfecting
                              </label>
                            </div>
                          </>
                        )}

                        <div className="wo-field s2">
                          <label className="wo-check" htmlFor={`rowBooklet-${editingRowIndex}`}>
                            <input
                              type="checkbox"
                              id={`rowBooklet-${editingRowIndex}`}
                              checked={r.isBooklet}
                              onChange={(e) => handleRowBookletToggle(editingRowIndex, e.target.checked)}
                            />
                            Booklet
                          </label>
                        </div>

                        {r.isBooklet && (
                          <>
                            <PoField
                              className="wo-field s2"
                              icon="bi-file-earmark-text"
                              label="Pages"
                              required
                              filled={has(r.pages)}
                            >
                              <input
                                type="text"
                                className="po-input"
                                value={r.pages}
                                onChange={(e) => handleRowPagesChange(editingRowIndex, e.target.value)}
                                required
                              />
                            </PoField>
                            <PoField
                              className="wo-field s2"
                              icon="bi-puzzle"
                              label="Component"
                              filled={has(r.component)}
                            >
                              <input
                                type="text"
                                className="po-input"
                                value={r.component}
                                onChange={(e) => handleRowComponentChange(editingRowIndex, e.target.value)}
                              />
                            </PoField>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Step 2 */}
                    {needsPaper && (
                      <div className="wo-panel">
                        <div className="wo-panel-head">
                          <span className="wo-panel-title">Paper material</span>
                          <button type="button" className="wo-btn wo-btn-xs wo-btn-soft" onClick={() => addExtraMaterial(editingRowIndex)}>
                            <Icons.Plus /> Paper material
                          </button>
                        </div>
                        <div className="wo-modal-grid">
                          <PoField
                            className="wo-field s2"
                            icon="bi-upc-scan"
                            label="Paper Code"
                            required
                            filled={has(r.materialCode)}
                          >
                            <input
                              type="text"
                              className="po-input"
                              style={{ fontWeight: 700 }}
                              value={r.materialCode}
                              onChange={(e) => handleMaterialChange(editingRowIndex, "materialCode", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "-" || e.key === "e" || e.key === "+") {
                                  e.preventDefault();
                                  showAlert("Special characters are not allowed");
                                }
                              }}
                              required
                            />
                          </PoField>

                          <PoField
                            className="wo-field s4"
                            icon="bi-card-text"
                            label="Description"
                            alwaysFloat
                          >
                            <input
                              className="po-input"
                              value={r.materialDescription || "-"}
                              title={r.materialDescription}
                              readOnly
                            />
                          </PoField>

                          <PoField
                            className="wo-field s2"
                            icon="bi-collection"
                            label="Group Desc"
                            alwaysFloat
                          >
                            <input
                              className="po-input"
                              value={r.materialGroupDescription || "-"}
                              title={r.materialGroupDescription}
                              readOnly
                            />
                          </PoField>

                          <PoField
                            className="wo-field s2"
                            icon="bi-building"
                            label="Mill Name"
                            alwaysFloat
                          >
                            <input className="po-input" value={r.mill || "-"} readOnly />
                          </PoField>

                          <PoField
                            className="wo-field s2"
                            icon="bi-aspect-ratio"
                            label="Paper Size"
                            alwaysFloat
                          >
                            <input className="po-input" value={r.paperSize || "-"} readOnly />
                          </PoField>

                          <PoField
                            className="wo-field s2"
                            icon="bi-speedometer2"
                            label="GSM"
                            alwaysFloat
                          >
                            <input className="po-input" value={r.gsm || "-"} readOnly />
                          </PoField>

                          <PoField
                            className="wo-field s2"
                            icon="bi-stack"
                            label="Paper Qty"
                            labelClass="wo-paper-qty"
                            required
                            filled={has(r.paperQty)}
                          >
                            <input
                              type="number"
                              className="po-input wo-paper-qty"
                              style={{ fontWeight: 700 }}
                              value={r.paperQty}
                              onChange={(e) => handleMaterialChange(editingRowIndex, "paperQty", e.target.value)}
                              min="0"
                              onKeyDown={(e) => {
                                if (e.key === "-" || e.key === "e" || e.key === "+") {
                                  e.preventDefault();
                                  showAlert("Special characters are not allowed");
                                }
                              }}
                              required
                            />
                          </PoField>
                        </div>

                        {(r.extraMaterials || []).map((em, mIdx) => (
                          <div key={mIdx} style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--field-line)" }}>
                            <div className="wo-panel-head">
                              <span className="wo-panel-note" style={{ fontWeight: 700 }}>Paper material #{mIdx + 2}</span>
                              <button type="button" className="wo-btn wo-btn-xs wo-btn-danger" onClick={() => removeExtraMaterial(editingRowIndex, mIdx)}>
                                Remove
                              </button>
                            </div>
                            <div className="wo-modal-grid">
                              <PoField className="wo-field s2" icon="bi-upc-scan" label="Paper Code" required filled={has(em.materialCode)}>
                                <input
                                  type="text"
                                  className="po-input"
                                  style={{ fontWeight: 700 }}
                                  value={em.materialCode}
                                  onChange={(e) => handleExtraMaterialChange(editingRowIndex, mIdx, "materialCode", e.target.value)}
                                />
                              </PoField>
                              <PoField className="wo-field s4" icon="bi-card-text" label="Description" alwaysFloat>
                                <input className="po-input" value={em.materialDescription || "-"} readOnly />
                              </PoField>
                              <PoField className="wo-field s2" icon="bi-collection" label="Group Desc" alwaysFloat>
                                <input className="po-input" value={em.materialGroupDescription || "-"} readOnly />
                              </PoField>
                              <PoField className="wo-field s2" icon="bi-building" label="Mill Name" alwaysFloat>
                                <input className="po-input" value={em.mill || "-"} readOnly />
                              </PoField>
                              <PoField className="wo-field s2" icon="bi-aspect-ratio" label="Paper Size" alwaysFloat>
                                <input className="po-input" value={em.paperSize || "-"} readOnly />
                              </PoField>
                              <PoField className="wo-field s2" icon="bi-speedometer2" label="GSM" alwaysFloat>
                                <input className="po-input" value={em.gsm || "-"} readOnly />
                              </PoField>
                              <PoField className="wo-field s2" icon="bi-stack" label="Paper Qty" labelClass="wo-paper-qty" required filled={has(em.paperQty)}>
                                <input
                                  type="number"
                                  className="po-input wo-paper-qty"
                                  style={{ fontWeight: 700 }}
                                  value={em.paperQty}
                                  min="0"
                                  onChange={(e) => handleExtraMaterialChange(editingRowIndex, mIdx, "paperQty", e.target.value)}
                                />
                              </PoField>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Step 3 */}
                    <div className="wo-panel">
                      <div className="wo-panel-head">
                        <span className="wo-panel-title">Impressions</span>
                        <span className="wo-panel-note">Auto-calculated</span>
                      </div>
                      <div className="wo-modal-grid">
                        <div className="wo-info s2">
                          <span>Imp front</span>
                          <b className="wo-good">{imp.impFront || 0}</b>
                        </div>
                        <div className="wo-info s2">
                          <span>Imp back</span>
                          <b className="wo-good">{imp.impBack || 0}</b>
                        </div>
                        <div className="wo-info s2">
                          <span>Total imp</span>
                          <b className="wo-accent">{imp.totalImp || 0}</b>
                        </div>
                      </div>
                    </div>

                    <div className="wo-foot">
                      <button type="button" className="wo-btn wo-btn-ghost" onClick={handleCancelRowModal}>
                        Cancel
                      </button>
                      <button type="button" className="wo-btn wo-btn-primary" onClick={handleSaveRowModal}>
                        Apply &amp; save entry
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* 6. PLANNED WORK ORDERS SECTION (Main Registry)                            */}
            {/* ========================================================================= */}
            {(statusFilter === "PLANNED" || statusFilter === "") && workOrders.length > 0 && (
              <div className="card-glass-3d p-3 mt-4">
                <div className="text-center mb-3">
                  <h4 className="fw-bold m-0" style={{ color: "#064c73" }}>
                    Planned Work Orders
                  </h4>
                  <small className="text-muted">Master production registry &amp; document dispatch hub</small>
                </div>

                {/* Action & Filter Toolbar */}
                <div className="premium-toolbar">
                  {/* Top Action Buttons */}
                  <div className="pl-section-title"><i className="bi bi-download" /> Downloads &amp; Documents</div>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                    <button className="btn-3d btn-3d-success" onClick={downloadExcel}>
                      <Icons.Excel /> Download Excel
                    </button>
                    <button className="btn-3d btn-3d-secondary" onClick={downloadFormattedPDF}>
                      <Icons.PDF /> Work Order PDF
                    </button>
                    <button className="btn-3d btn-3d-warning" onClick={downloadDocketLabel}>
                      <Icons.Barcode /> SPDP Label
                    </button>
                    <button className="btn-3d btn-3d-info" onClick={downloadOuterLabel}>
                      <Icons.Box /> Outer Label
                    </button>
                    <button className="btn-3d btn-3d-dark" onClick={downloadBindingSigningSheet}>
                      <Icons.Clipboard /> Binding Signing Sheet
                    </button>
                  </div>

                  {/* Bottom Filters */}
                  <div className="pl-section-title"><i className="bi bi-funnel" /> Filter Work Orders</div>
                  <div className="pl-filter-grid">
                    <PoField icon="bi-search" label="WO Number" filled={has(filterWoNo)}>
                      <input
                        type="text"
                        className="po-input"
                        value={filterWoNo}
                        onChange={(e) => setFilterWoNo(e.target.value)}
                      />
                    </PoField>

                    <PoField icon="bi-upc-scan" label="Product Code" filled={has(filterProductCode)}>
                      <input
                        type="text"
                        className="po-input"
                        value={filterProductCode}
                        onChange={(e) => setFilterProductCode(e.target.value)}
                      />
                    </PoField>

                    <PoField icon="bi-cpu" label="Machine" alwaysFloat caret>
                      <select
                        className="po-input"
                        value={filterMachine}
                        onChange={(e) => setFilterMachine(e.target.value)}
                      >
                        <option value="">All Machines</option>
                        {machines.map(m => (
                          <option key={m._id} value={m._id}>{m.machineName}</option>
                        ))}
                      </select>
                    </PoField>

                    <PoField icon="bi-person" label="Customer" alwaysFloat caret>
                      <select
                        className="po-input"
                        value={filterCustomer}
                        onChange={(e) => setFilterCustomer(e.target.value)}
                      >
                        <option value="">All Customers</option>
                        {customerOptions.map((c, index) => (
                          <option key={index} value={c}>{c}</option>
                        ))}
                      </select>
                    </PoField>

                    <PoField icon="bi-geo-alt" label="User Location" alwaysFloat caret>
                      <select
                        className="po-input"
                        value={filterUserLocation}
                        onChange={(e) => setFilterUserLocation(e.target.value)}
                      >
                        <option value="">User Locations</option>
                        {[...new Set(workOrders.flatMap(wo => wo.userLocations || []))].map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </PoField>

                    <PoField icon="bi-calendar-event" label="From Date" alwaysFloat>
                      <input
                        type="date"
                        className="po-input"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </PoField>

                    <PoField icon="bi-calendar-check" label="To Date" alwaysFloat>
                      <input
                        type="date"
                        className="po-input"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </PoField>

                    <button
                      className="clear-btn"
                      onClick={() => {
                        setFilterCustomer("");
                        setFilterWoNo("");
                        setFilterProductCode("");
                        setFilterMachine("");
                        setFilterUserLocation("");
                        setDateFrom("");
                        setDateTo("");
                      }}
                    >
                      <Icons.Reset /> Clear Filters
                    </button>
                  </div>
                </div>

                {/* Main Data Table */}
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
                        <th>Product Type</th>
                        <th>Job Description</th>
                        <th>WO Date</th>
                        <th>Location</th>
                        <th>Activity</th>
                        <th>Machines</th>
                        <th>Color Front</th>
                        <th>Color Back</th>
                        <th>Inches</th>
                        <th>Slit Number</th>
                        <th>Booklet</th>
                        <th>Paper Code</th>
                        <th>Description</th>
                        <th>Group Description</th>
                        <th>Mill Name</th>
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
                        <th>Dispatch Location</th>
                        <th>Quantity in Box</th>
                        <th>View PDF</th>
                        <th>Prepress</th>
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
                          <td className="fw-bold text-primary">{wo.efiWoNumber}</td>
                          <td className="font-monospace fw-bold">{wo.productCode}</td>
                          <td>{wo.purchaseOrderNo || "--"}</td>
                          <td>
                            <span className="badge-3d badge-3d-warning">{wo.priority}</span>
                          </td>
                          <td className="fw-semibold">{wo.customer?.name || wo.customer}</td>
                          <td>
                            <span className="badge-3d badge-3d-primary">{wo.productType || "-"}</span>
                          </td>
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
                                a => String(a._id) === String(pair.activityId?._id || pair.activityId)
                              );
                              return activity?.activityName || "-";
                            }).join(", ")}
                          </td>
                          <td>
                            {wo.machines?.map(pair => {
                              const machine = machines.find(
                                m => String(m._id) === String(pair.machineId?._id || pair.machineId)
                              );
                              return machine?.machineName || "-";
                            }).join(", ")}
                          </td>
                          <td className="text-center">{wo.colorFront}</td>
                          <td className="text-center">{wo.colorBack}</td>
                          <td className="text-center">{wo.machines?.map(m => m.inches).filter(Boolean).join(", ") || "-"}</td>
                          <td className="text-center">{wo.machines?.map(m => m.slitNumber).filter(Boolean).join(", ") || "-"}</td>
                          <td className="text-center">
                            {wo.machines?.length
                              ? wo.machines
                                  .map(m =>
                                    m.isBooklet
                                      ? `Yes (${m.pages || 0} pg${m.component ? `, ${m.component}` : ""})`
                                      : "No"
                                  )
                                  .join(", ")
                              : "-"}
                          </td>
                          <td className="font-monospace fw-bold text-primary">
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
                          <td>{wo.materials?.map(m => m.mill).join(", ")}</td>
                          <td className="text-center">{wo.materials?.map(m => m.gsm).join(", ")}</td>
                          <td className="text-center">{wo.materials?.map(m => m.paperSize).join(", ")}</td>
                          <td className="text-center fw-bold">{wo.materials?.map(m => m.paperQty).join(", ")}</td>
                          <td className="fw-bold">{wo.orderQty}</td>
                          <td className="text-danger fw-bold">{wo.wasteQty}%</td>
                          <td className="text-success fw-bold">{wo.totalQty}</td>
                          <td>{wo.jobSize}</td>
                          <td className="text-center fw-bold text-primary">
                            {wo.UPS || ""} {wo.machines?.map(m => m.UPS).filter(Boolean).join(", ") || ""}
                          </td>
                          <td className="text-center fw-bold text-success">
                            {wo.impFront || ""} {wo.machines?.map(m => m.impFront).join(", ") || ""}
                          </td>
                          <td className="text-center fw-bold text-success">
                            {wo.impBack || ""} {wo.machines?.map(m => m.impBack).join(", ") || ""}
                          </td>
                          <td className="text-center fw-bold text-primary bg-info-subtle">
                            {wo.totalImp || ""} {wo.machines?.map(m => m.totalImp).join(", ") || ""}
                          </td>
                          <td
                            className={expandedCell === wo._id + "ink" ? "expanded" : "truncate"}
                            onClick={() =>
                              setExpandedCell(
                                expandedCell === wo._id + "ink" ? null : wo._id + "ink"
                              )
                            }
                          >
                            {wo.inkDetails || "-"}
                          </td>
                          <td
                            className={expandedCell === wo._id + "remarks" ? "expanded" : "truncate"}
                            onClick={() =>
                              setExpandedCell(
                                expandedCell === wo._id + "remarks" ? null : wo._id + "remarks"
                              )
                            }
                          >
                            {wo.remarks || "-"}
                          </td>
                          <td
                            className={expandedCell === wo._id + "dispatch" ? "expanded" : "truncate"}
                            onClick={() =>
                              setExpandedCell(
                                expandedCell === wo._id + "dispatch" ? null : wo._id + "dispatch"
                              )
                            }
                          >
                            {wo.dispatchLocation || "-"}
                          </td>
                          <td className="text-center fw-bold">{wo.boxQty || "-"}</td>
                          <td className="text-center">
                            {wo.itemPdfPath ? (
                              <a
                                href={`${BASE_URL}${wo.itemPdfPath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-3d btn-3d-info btn-sm"
                                style={{ padding: "3px 10px", fontSize: "11px" }}
                              >
                                View
                              </a>
                            ) : "-"}
                          </td>
                          <td className="text-center">
                            {wo.sentToPrepress ? (
                              <span className="badge-3d badge-3d-success">Sent</span>
                            ) : loggedInUser &&
                              wo.planningUser &&
                              wo.planningUser.trim() === loggedInUser.trim() ? (
                              <button
                                className="btn-3d btn-3d-primary btn-sm"
                                style={{ padding: "3px 10px", fontSize: "11px" }}
                                onClick={() => handleSendToPrepress(wo._id)}
                              >
                                Send
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="small">
                            {wo.planningUser
                              ? `${wo.planningUser} - ${new Date(wo.createdAt).toLocaleDateString("en-IN")}`
                              : "-"}
                          </td>
                          <td>
                            {wo.userLocations && wo.userLocations.length > 0
                              ? wo.userLocations.join(", ")
                              : "-"}
                          </td>
                          <td className="text-center">
                            {loggedInUser &&
                            wo.planningUser &&
                            wo.planningUser.trim() === loggedInUser.trim() ? (
                              <button
                                className="btn-3d btn-3d-warning btn-sm"
                                style={{ padding: "3px 10px", fontSize: "11px" }}
                                onClick={() => handleEditWorkOrder(wo)}
                              >
                                Edit
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="text-center">
                            {loggedInUser &&
                            wo.planningUser &&
                            wo.planningUser.trim() === loggedInUser.trim() ? (
                              <button
                                className="btn-3d btn-3d-danger btn-sm"
                                style={{ padding: "3px 10px", fontSize: "11px" }}
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
          </>
        )}
      </div>
    </div>
  );
}

export default PlannerDashboard;