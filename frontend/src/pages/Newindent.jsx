import { useState, useEffect, useRef, useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import axios from "axios";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

// Outlined floating-label field with a leading icon (Planner styling)
function PoField({ icon, label, required, filled, alwaysFloat, caret, area, className = "", after, children }) {
  return (
    <div className={className}>
      <div className={`po-field ${filled || alwaysFloat ? "is-floated" : ""} ${area ? "po-area" : ""}`}>
        {icon && <i className={`bi ${icon} po-field-icon`}></i>}
        {children}
        <label className="po-field-label">
          {label}
          {required && <span className="po-req"> *</span>}
        </label>
        {caret && <i className="bi bi-chevron-down po-caret"></i>}
      </div>
      {after}
    </div>
  );
}
const has = (v) => v !== "" && v !== null && v !== undefined;
const norm = (v) => String(v ?? "").trim();

// form key -> field name in the Materials master
const PAPER_FIELDS = {
  millName: "mill",
  paperGroup: "group",
  paperSize: "paperSize",
  gsm: "gsm",
};

function NewIndent() {
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [errors, setErrors] = useState({});
  const [indents, setIndents] = useState([]);
  const [filteredIndents, setFilteredIndents] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const token = localStorage.getItem("token");
  const [expandedCell, setExpandedCell] = useState(null);
  const productCodeRef = useRef();
  const stageRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  // entry form is hidden until "Create New Indent" is clicked (or an indent is edited)
  const [showForm, setShowForm] = useState(false);
  const quantityRef = useRef();
  const locationRef = useRef();

  const [form, setForm] = useState({
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
    unitRate: "",
    remark: "",
    deliveryDate: "",

    // ===== NEW FIELDS =====
    lamination: "",
    finish: "",
    jobNo: "",
    soNo: "",
    soDate: "",
    sampleType: "",
    costingConfirmation: "",
    customerPoNo: "",
    customerPoDate: "",
    typeOfBilling: "",
    itemPdfPath: "",
    millName: "",
    paperGroup: "",
    paperSize: "",
    gsm: ""
  });

  // ===== UPLOADED FILES =====
  const [customerCopyFile, setCustomerCopyFile] = useState(null);
  const [artworkFile, setArtworkFile] = useState(null);
  const [existingCustomerCopy, setExistingCustomerCopy] = useState(null);
  const [existingArtwork, setExistingArtwork] = useState(null);

  // ===== FILTER STATES =====
  const [indentNoFilter, setIndentNoFilter] = useState("");
  const [productCodeFilter, setProductCodeFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  // ===== PRODUCT SEARCH MODE: "code" (normal) or "customer" (customer + description dropdowns) =====
  const [searchMode, setSearchMode] = useState("code");
  const [itemList, setItemList] = useState([]);
  const [custSearch, setCustSearch] = useState("");
  const [descSearch, setDescSearch] = useState("");

  const itemCodeOf = (it) => String(it.productCode || it.itemCode || it.code || "");
  const descLabelOf = (it) => `${itemCodeOf(it)} - ${norm(it.description)}`;

  useEffect(() => {
    axios
      .get(`${BASE_URL}/api/master/items`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setItemList(Array.isArray(res.data) ? res.data : (res.data?.data || [])))
      .catch(() => setItemList([]));
  }, []);

  const customerNames = useMemo(
    () =>
      [...new Set(itemList.map((it) => norm(it.customerName)).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [itemList]
  );

  // only the products of the chosen customer
  const customerItems = useMemo(
    () => itemList.filter((it) => custSearch && norm(it.customerName) === norm(custSearch)),
    [itemList, custSearch]
  );

  // sends the chosen code through the existing handleChange (so all current logic runs)
  const pickItemCode = (code) => {
    if (!code) return;
    handleChange({ target: { name: "productCode", value: code } });
  };

  const onDescPick = (val) => {
    setDescSearch(val);
    const it = customerItems.find((x) => descLabelOf(x) === val);
    if (it) pickItemCode(itemCodeOf(it));
  };

  // clear the search boxes when the form is reset / code cleared
  useEffect(() => {
    if (!form.productCode) {
      setCustSearch("");
      setDescSearch("");
    }
  }, [form.productCode]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name || decoded.username);
    }
    fetchLocations();
    fetchIndents();
    fetchMaterials();
  }, []);

  const fetchIndents = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/newindent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIndents(res.data);
    } catch {
      setIndents([]);
    }
  };
  const truncateText = (text, length = 30) => {
    if (!text) return "-";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/locations`);
      setLocations(res.data);
    } catch {
      setLocations([]);
    }
  };

  const fetchProductDetails = async (code) => {
    if (!code) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/master/items/${code}`);
      setForm(prev => ({
        ...prev,
        materialType: res.data.materialType || "",
        description: res.data.description || "",
        customerName: res.data.customerName || "",
        colorFront: res.data.colorFront ?? "",
        colorBack: res.data.colorBack ?? "",
        wasteQty: res.data.wasteQty ?? "",
        jobSize: res.data.jobSize || "",
        inkDetails: res.data.inkDetails || "",
        itemPdfPath: res.data.pdfPath || ""
      }));
    } catch {
      setForm(prev => ({
        ...prev,
        materialType: "",
        description: "",
        customerName: "",
        colorFront: "",
        colorBack: "",
        wasteQty: "",
        jobSize: "",
        inkDetails: "",
        itemPdfPath: ""
      }));
    }
  };

  const onlyAlphaNumeric = (value) => value.replace(/[^a-zA-Z0-9]/g, "");

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const file = files?.[0] || null;
    if (name === "customerCopy") setCustomerCopyFile(file);
    if (name === "artwork") setArtworkFile(file);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "productCode") {
      newValue = onlyAlphaNumeric(value);

      if (!newValue) {
        setForm(prev => ({
          ...prev,
          productCode: "",
          materialType: "",
          description: "",
          customerName: "",
          colorFront: "",
          colorBack: "",
          wasteQty: "",
          jobSize: "",
          inkDetails: "",
          itemPdfPath: ""
        }));
        return;
      }

      fetchProductDetails(newValue);
    }

    if (name === "quantity" && value < 0) return;

    setErrors(prev => ({ ...prev, [name]: "" }));
    setForm(prev => ({ ...prev, [name]: newValue }));
  };

  const fetchMaterials = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/materials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMaterials(res.data);
    } catch {
      setMaterials([]);
    }
  };

  // each dropdown shows only values that match the OTHER selected dropdowns
  const paperOptions = useMemo(() => {
    const out = {};
    Object.keys(PAPER_FIELDS).forEach((fk) => {
      const set = new Set();
      materials.forEach((m) => {
        const match = Object.entries(PAPER_FIELDS).every(
          ([k, mk]) => k === fk || !form[k] || norm(m[mk]) === form[k]
        );
        const val = norm(m[PAPER_FIELDS[fk]]);
        if (match && val) set.add(val);
      });
      if (form[fk]) set.add(form[fk]); // keep saved value visible when editing
      out[fk] = [...set].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    });
    return out;
  }, [materials, form.millName, form.paperGroup, form.paperSize, form.gsm]);

  const handlePaperChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (!value) return next;

      // clear any other selection that no longer fits with the new choice
      let pool = materials.filter((m) => norm(m[PAPER_FIELDS[name]]) === value);
      Object.keys(PAPER_FIELDS).forEach((k) => {
        if (k === name || !next[k]) return;
        const mk = PAPER_FIELDS[k];
        const narrowed = pool.filter((m) => norm(m[mk]) === next[k]);
        if (narrowed.length) pool = narrowed;
        else next[k] = "";
      });
      return next;
    });
  };

  const validateForm = () => {
    let newErrors = {};
    if (!form.productCode) newErrors.productCode = "Required";
    if (!form.quantity) newErrors.quantity = "Required";
    if (!form.location) newErrors.location = "Required";
if (!form.deliveryDate) newErrors.deliveryDate = "Required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value ?? "");
      });
      if (customerCopyFile) formData.append("customerCopy", customerCopyFile);
      if (artworkFile) formData.append("artwork", artworkFile);

      const res = editingId
        ? await axios.put(
            `${BASE_URL}/api/newindent/${editingId}`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data"
              }
            }
          )
        : await axios.post(
            `${BASE_URL}/api/newindent`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data"
              }
            }
          );

      if (res.status === 201 || res.status === 200) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: editingId ? "Indent Updated Successfully" : "Indent Created Successfully",
          width: "350px",
          confirmButtonColor: "#3085d6"
        });

        resetForm();
        fetchIndents();
      }
    } catch (err) {
      console.error("Save Error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || "Server error while saving indent",
        confirmButtonColor: "#d33"
      });
    }
  };

  const resetForm = () => {
    setForm({
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
      unitRate: "",
      remark: "",
      deliveryDate: "",

      // ===== NEW FIELDS =====
      lamination: "",
      finish: "",
      jobNo: "",
      soNo: "",
      soDate: "",
      sampleType: "",
      costingConfirmation: "",
      customerPoNo: "",
      customerPoDate: "",
      typeOfBilling: "",
      millName: "",
      paperGroup: "",
      paperSize: "",
      gsm: ""
    });
    setCustomerCopyFile(null);
    setArtworkFile(null);
    setExistingCustomerCopy(null);
    setExistingArtwork(null);
    setErrors({});
    setEditingId(null);
  };

  // ===== EDIT ACTION =====
  const handleEdit = (ind) => {
    const item = ind.items?.[0] || {};
    setForm({
      productCode: item.productCode || "",
      materialType: item.materialType || "",
      description: item.description || "",
      customerName: item.customerName || "",
      colorFront: item.colorFront || "",
      colorBack: item.colorBack || "",
      wasteQty: item.wasteQty || "",
      jobSize: item.jobSize || "",
      inkDetails: item.inkDetails || "",
      quantity: item.quantity || "",
      location: ind.location?._id || "",
      unitRate: item.unitRate || "",
      remark: item.remark || "",
      deliveryDate: (item.deliveryDate || ind.deliveryDate)
  ? String(item.deliveryDate || ind.deliveryDate).substring(0, 10)
  : "",

      // ===== NEW FIELDS =====
      lamination: item.lamination || "",
      finish: item.finish || "",
      jobNo: item.jobNo || "",
      soNo: item.soNo || "",
      soDate: item.soDate ? item.soDate.substring(0, 10) : "",
      sampleType: item.sampleType || "",
      costingConfirmation: item.costingConfirmation || "",
      customerPoNo: item.customerPoNo || "",
      customerPoDate: item.customerPoDate ? item.customerPoDate.substring(0, 10) : "",
      typeOfBilling: item.typeOfBilling || "",
      itemPdfPath: item.itemPdfPath || "",
      millName: item.millName || "",
      paperGroup: item.paperGroup || "",
      paperSize: item.paperSize || "",
      gsm: item.gsm || ""
    });

    setCustomerCopyFile(null);
    setArtworkFile(null);
    setExistingCustomerCopy(item.customerCopy?.filePath ? item.customerCopy : null);
    setExistingArtwork(item.artwork?.filePath ? item.artwork : null);
    setEditingId(ind._id);
    setShowForm(true);

    // bring the whole form panel into view, then auto-focus first input field
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    productCodeRef.current?.focus({ preventScroll: true });
  };

  // ===== DELETE ACTION =====
  const handleDelete = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`${BASE_URL}/api/newindent/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          Swal.fire({
            icon: "success",
            title: "Deleted!",
            text: "Indent has been successfully deleted.",
            confirmButtonColor: "#3085d6"
          });
          fetchIndents();
        } catch (err) {
          console.error("Delete Error:", err);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: err.response?.data?.message || "Server error while deleting indent",
            confirmButtonColor: "#d33"
          });
        }
      }
    });
  };

  // ===== APPLY FILTERS =====
  useEffect(() => {
    let result = [...indents];

    if (indentNoFilter) {
      result = result.filter(ind =>
        ind.indentNo?.toLowerCase().includes(indentNoFilter.toLowerCase())
      );
    }

    if (productCodeFilter) {
      result = result.filter(ind =>
        ind.items?.[0]?.productCode?.toLowerCase().includes(productCodeFilter.toLowerCase())
      );
    }
    if (fromDate) {
      result = result.filter((ind) => {
        const created = new Date(ind.createdAt);
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);

        return created >= from;
      });
    }

    if (toDate) {
      result = result.filter((ind) => {
        const created = new Date(ind.createdAt);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);

        return created <= to;
      });
    }
    if (customerFilter) {
      result = result.filter(ind =>
        ind.items?.[0]?.customerName?.toLowerCase().includes(customerFilter.toLowerCase())
      );
    }

    if (locationFilter) {
      result = result.filter(ind => ind.location?._id === locationFilter);
    }

    setFilteredIndents(result);
  }, [indents, indentNoFilter, productCodeFilter, customerFilter, locationFilter, fromDate, toDate]);

  const clearFilters = () => {
    setIndentNoFilter("");
    setProductCodeFilter("");
    setCustomerFilter("");
    setLocationFilter("");

    setFromDate("");
    setToDate("");

    fetchIndents();
  };
  const exportToExcel = () => {
    const data = filteredIndents.map((ind) => ({
      "Indent No": ind.indentNo,
      "Product Code": ind.items?.[0]?.productCode,
      Description: ind.items?.[0]?.description,
      Customer: ind.items?.[0]?.customerName,
      Type: ind.items?.[0]?.materialType,
      Quantity: ind.items?.[0]?.quantity,
      "Unit Rate": ind.items?.[0]?.unitRate,
      Location: ind.location?.locationName,
      Status: ind.status,
      Remark: ind.items?.[0]?.remark,

      // ===== NEW FIELDS =====
      Lamination: ind.items?.[0]?.lamination,
      Finish: ind.items?.[0]?.finish,
      Group: ind.items?.[0]?.paperGroup,
      Size: ind.items?.[0]?.paperSize,
      GSM: ind.items?.[0]?.gsm,
      "Job No": ind.items?.[0]?.jobNo,
      "SO No": ind.items?.[0]?.soNo,
      "SO Date": ind.items?.[0]?.soDate
        ? new Date(ind.items[0].soDate).toLocaleDateString("en-IN")
        : "",
      "Sample Type": ind.items?.[0]?.sampleType,
      "Costing Confirmation": ind.items?.[0]?.costingConfirmation,
      "Customer PO No": ind.items?.[0]?.customerPoNo,
      "Customer PO Date": ind.items?.[0]?.customerPoDate
        ? new Date(ind.items[0].customerPoDate).toLocaleDateString("en-IN")
        : "",
      "Type of Billing": ind.items?.[0]?.typeOfBilling,
      "Customer Copy": ind.items?.[0]?.customerCopy?.fileName || "",
      "Artwork": ind.items?.[0]?.artwork?.fileName || "",

      "Saved By": ind.user,
      "Saved At": new Date(ind.createdAt).toLocaleString("en-IN")
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Indents");

    XLSX.writeFile(wb, "Indent_Report.xlsx");
  };
  // ---- Double-click protection for Save Indent ----
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSafeSubmit = async (e) => {
    e.preventDefault();
    if (isSavingRef.current) return; // ignore the 2nd click instantly
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await handleSubmit(e);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <>
      <style>{`
        /* font loaded locally */

        /* ============ Theme tokens ============ */
        .indent-app-container {
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
          --page: #f4f6f8;
          --ok: #1f9d6b;
          --danger: #d64545;
        }

        /* ============ Page shell ============ */
        .indent-app-container {
          max-width: 100%;
          min-height: 100vh;
          padding: 20px 28px 36px;
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
          font-size: 14px;
          color: var(--ink);
          border: none;
          border-radius: 0px;
          background: var(--page);
          box-shadow: none;
        }

        /* ============ Page header ============ */
        .indent-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px 8px;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--line);
        }

        .indent-title {
          margin: 0;
          color: var(--ink);
          font-size: 20px;
          font-weight: 700;
          line-height: 1.15;
          text-shadow: none;
        }

        .user-pill {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-60%);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: #ffffff;
          box-shadow: none;
          color: var(--ink);
          font-size: 0.78rem;
          font-weight: 600;
        }

        /* ============ Entry panel ============ */
        .indent-app-container .gl-stage {
          position: relative;
          overflow: visible;
          margin-bottom: 16px;
          padding: 0;
          border-radius: 0;
          border: none;
          background: transparent;
          box-shadow: none;
        }

        .indent-app-container .gl-stage::before,
        .indent-app-container .gl-stage::after {
          content: none;
        }

        .indent-app-container .gl-card {
          position: relative;
          z-index: 1;
          padding: 18px 22px 20px;
          color: var(--ink);
          border-radius: 8px;
          border: 1px solid var(--line);
          background: #ffffff;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.07);
        }

        .indent-app-container .gl-head {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--line);
        }

        .indent-app-container .gl-title {
          margin: 0;
          color: var(--ink);
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.1px;
        }

        .indent-app-container .gl-pill {
          display: inline-block;
          padding: 3px 14px;
          border-radius: 4px;
          border: 1px solid #bdd9df;
          background: var(--teal-soft);
          color: var(--teal-mid);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .indent-app-container .gl-inner {
          margin-top: 12px;
          padding: 12px 14px 14px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: #ffffff;
          box-shadow: none;
        }

        .indent-app-container .gl-inner.first {
          margin-top: 0;
        }

        .indent-app-container .gl-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: var(--ink);
          font-size: 13px;
          font-weight: 700;
          padding-left: 8px;
          border-left: 3px solid var(--brand);
        }

        .indent-app-container .gl-group i {
          color: var(--brand);
          font-size: 0.95rem;
          background: transparent;
          border-radius: 50%;
          line-height: 1;
        }

        /* ============ Labels / inputs ============ */
        .custom-label {
          display: block !important;
          margin-bottom: 4px !important;
          overflow: hidden;
          color: var(--ink-soft) !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .required-star {
          margin-left: 0.2rem;
          color: var(--danger);
          font-weight: 700;
        }

        .indent-app-container .custom-input,
        .indent-app-container select.custom-input,
        .indent-app-container textarea.custom-input {
          display: block;
          width: 100%;
          min-height: 36px;
          padding: 5px 10px !important;
          border: 1px solid var(--field-line) !important;
          border-radius: 6px !important;
          background-color: #ffffff !important;
          color: var(--ink) !important;
          font-family: inherit;
          font-size: 0.82rem !important;
          font-weight: 500 !important;
          line-height: 1.5 !important;
          box-shadow: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
          color-scheme: light;
        }

        .indent-app-container select.custom-input {
          padding-right: 26px !important;
        }

        .indent-app-container .custom-input:focus,
        .indent-app-container select.custom-input:focus,
        .indent-app-container textarea.custom-input:focus {
          border-color: var(--teal-mid) !important;
          background-color: #ffffff !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15) !important;
        }

        .indent-app-container .custom-input-readonly {
          border: 1px solid var(--line) !important;
          background-color: #f7f9fb !important;
          color: var(--ink-soft) !important;
          cursor: not-allowed !important;
        }

        .indent-app-container .custom-input::placeholder {
          color: var(--ink-mute) !important;
          font-weight: 400 !important;
          opacity: 1 !important;
        }

        .indent-app-container .custom-textarea {
          min-height: 58px;
          resize: vertical;
        }

        .indent-app-container input[type="file"].custom-input {
          padding: 4px 8px !important;
        }

        .indent-app-container small,
        .indent-app-container .text-muted {
          font-size: 0.72rem;
        }
        .indent-app-container .text-muted { color: var(--ink-mute) !important; }
        .indent-app-container .text-primary { color: var(--teal-mid) !important; }
        .indent-app-container a { color: var(--teal-mid); font-weight: 600; }
        .indent-app-container a:hover { color: var(--brand); }

        .indent-error-text {
          display: block;
          margin-top: 0.2rem;
          color: var(--danger);
          font-size: 0.72rem;
          font-weight: 600;
        }

        .indent-app-container .btn-submit-indent {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 200px;
          justify-content: center;
          padding: 9px 28px;
          border: 1px solid var(--brand);
          border-radius: 6px;
          background: var(--brand);
          color: #ffffff;
          font-size: 0.88rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .indent-app-container .btn-submit-indent:hover {
          color: #ffffff;
          background: var(--brand-dark);
          border-color: var(--brand-dark);
          filter: none;
          transform: none;
        }

        /* ============ Section cards (filters / table) ============ */
        .bar-card {
          margin-top: 16px;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }

        .bar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 20px;
          background: #ffffff;
          border-bottom: 1px solid var(--line);
          color: var(--ink);
        }

        .bar-head h5 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: var(--ink);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0;
        }

        .bar-head h5 svg { color: var(--brand); }

        .bar-body {
          padding: 14px 20px 16px;
        }

        .bar-count {
          padding: 3px 12px;
          border-radius: 999px;
          background: var(--page);
          border: 1px solid var(--line);
          color: var(--ink-soft);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .indent-app-container .btn-export {
          min-height: 36px;
          border: 1px solid var(--brand);
          border-radius: 6px;
          background: var(--brand);
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }

        .indent-app-container .btn-export:hover {
          color: #ffffff;
          background: var(--brand-dark);
          border-color: var(--brand-dark);
          filter: none;
        }

        .indent-app-container .btn-clear-filters {
          min-height: 36px;
          border: 1px solid var(--field-line);
          border-radius: 6px;
          background: #ffffff;
          color: var(--ink);
          font-size: 0.82rem;
          font-weight: 600;
          box-shadow: none;
          cursor: pointer;
        }

        .indent-app-container .btn-clear-filters:hover {
          color: var(--teal-mid);
          background: var(--page);
          border-color: var(--teal-mid);
          filter: none;
        }

        /* Action Buttons */
        .btn-action-edit {
          background-color: #ffffff !important;
          color: var(--teal-mid) !important;
          border: 1px solid var(--teal-mid) !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          padding: 0.25rem 0.7rem !important;
          border-radius: 6px !important;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-edit:hover {
          background-color: var(--teal-mid) !important;
          color: #ffffff !important;
        }

        .btn-action-delete {
          background-color: #fdecec !important;
          color: #b42323 !important;
          border: 1px solid #f3c1c1 !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          padding: 0.25rem 0.7rem !important;
          border-radius: 6px !important;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-delete:hover {
          background-color: var(--danger) !important;
          color: #ffffff !important;
          border-color: var(--danger) !important;
        }

        /* ============ Table ============ */
        .custom-table-container {
          width: 100%;
          max-height: 400px;
          overflow-y: auto;
          overflow-x: auto;
          background: #ffffff;
        }

        .custom-table-container table {
          margin-bottom: 0;
          color: var(--ink);
          background: #ffffff;
        }

        .custom-table-container thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          padding: 0.7rem 0.8rem;
          background: #f7f9fb !important;
          color: var(--ink-soft) !important;
          border-color: var(--line) !important;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          white-space: nowrap;
          vertical-align: middle;
        }

        .custom-table-container tbody td {
          padding: 0.55rem 0.8rem;
          border-color: var(--line-soft) !important;
          font-size: 0.82rem;
          font-weight: 500;
          vertical-align: middle;
          background-color: #ffffff;
          color: var(--ink);
        }

        .custom-table-container tbody tr:nth-child(even) td { background-color: #fafbfc; }

        .custom-table-container tbody tr:hover td {
          background: var(--brand-soft) !important;
        }

        .custom-badge {
          display: inline-block;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: 600;
        }

        .badge-pending {
          background-color: #fff3d6;
          color: #8a5a00;
          border: 1px solid #f2d291;
        }

        .badge-approved {
          background-color: #e4f6ee;
          color: #167a52;
          border: 1px solid #b7e4d0;
        }

        .badge-rejected {
          background-color: #fdecec;
          color: #b42323;
          border: 1px solid #f3c1c1;
        }

        .badge-secondary {
          background-color: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .custom-table-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-table-container::-webkit-scrollbar-track {
          background: #f1f3f6;
        }
        .custom-table-container::-webkit-scrollbar-thumb {
          background: #c5ccd5;
          border-radius: 8px;
        }
        .custom-table-container::-webkit-scrollbar-thumb:hover {
          background: #a9b4c0;
        }

        @media (max-width: 768px) {
          .indent-app-container {
            padding: 12px;
            border-radius: 0;
          }

          .indent-header {
            flex-direction: column;
            gap: 6px;
          }

          .user-pill {
            position: static;
            transform: none;
          }

          .indent-app-container .gl-card {
            padding: 14px;
            border-radius: 8px;
          }
        }

        /* ---------- Small field icons (CSS-only, no markup changes) ---------- */
.indent-app-container select.custom-input {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px;
  padding-right: 30px !important;
}

.indent-app-container input.custom-input[name="productCode"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h16M4 15h16M10 3L8 21M16 3l-2 18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="quantity"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z'/%3E%3Cpath d='M3.3 7L12 12l8.7-5M12 22V12'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container select.custom-input[name="location"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
}

.indent-app-container input.custom-input[name="unitRate"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-10'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="lamination"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2l10 5-10 5L2 7z'/%3E%3Cpath d='M2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="finish"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="jobNo"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h16M4 15h16M10 3L8 21M16 3l-2 18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="soNo"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpath d='M14 2v6h6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container select.custom-input[name="sampleType"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z'/%3E%3Ccircle cx='7' cy='7' r='1.5'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
}

.indent-app-container input.custom-input[name="costingConfirmation"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container select.custom-input[name="typeOfBilling"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 2v20l3-2 2 2 3-2 3 2 2-2 3 2V2l-3 2-2-2-3 2-3-2-2 2z'/%3E%3Cpath d='M8 8h8M8 12h8'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
}

.indent-app-container input.custom-input[name="customerPoNo"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpath d='M14 2v6h6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container textarea.custom-input[name="remark"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px 11px;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[type="date"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cpath d='M16 2v4M8 2v4M3 10h18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[placeholder*="Indent No"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M21 21l-4.3-4.3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[placeholder*="Search Code"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h16M4 15h16M10 3L8 21M16 3l-2 18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[placeholder*="Customer"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container .bar-body select.custom-input {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
}


        /* =====================================================================
           PLANNER PAGE LOOK (appended override, presentation only)
           ===================================================================== */
        .indent-app-container{--ink:#000;--ink-soft:#000;--ink-mute:#000;font-size:12.5px;padding:24px 28px 40px}
        .indent-app-container .text-muted,.indent-app-container .text-primary,.indent-app-container small{color:#000!important}
        .indent-app-container a{color:#0f5560}
        .indent-app-container .gl-title{font-size:16px}
        .indent-app-container .gl-pill{font-size:10.5px;color:#000;background:#e3f1f4;border-color:#b9d6dd}
        .indent-error-text{color:#d64545!important}

        /* split entry form */
        .indent-app-container .gl-card.indent-split{display:flex;padding:0;overflow:hidden;max-width:1180px;margin-left:auto;margin-right:auto}
        .indent-app-container .indent-split .po-main{padding:22px 28px 22px}
        .indent-app-container .indent-split .gl-inner{border:0;padding:0;margin-top:14px;background:transparent}
        .indent-app-container .indent-split .gl-inner.first{margin-top:0}
        .indent-app-container .indent-split .gl-group{font-size:13px;margin-bottom:10px}
        .indent-app-container .indent-split .gl-group i{font-size:.9rem}
        .indent-app-container .indent-split .btn-submit-indent{font-size:12.5px;padding:9px 36px;min-width:190px}
        .indent-app-container .indent-split .po-heading .gl-pill{font-size:10.5px}
        .po-field.po-area .po-field-label{top:17px}
        .po-field.po-area.is-floated .po-field-label,.po-field.po-area:focus-within .po-field-label{top:0}
        .po-field.po-area .po-field-icon{top:15px;transform:none}

        /* filter / table cards */
        .bar-head h5{font-size:14px;padding-left:8px;border-left:3px solid #e4572e}
        .bar-head h5 svg{color:#e4572e}
        .bar-count{font-size:11px;color:#000}
        .indent-app-container .btn-export{background:#d9f2e6;border-color:#a9dcc3;color:#000;box-shadow:none;font-size:12px;min-height:34px}
        .indent-app-container .btn-export:hover{background:#c5ebd6;border-color:#8fceb0;color:#000}
        .indent-app-container .btn-clear-filters{font-size:12px;min-height:34px;color:#000}
        .btn-action-edit{background-color:#e8f3f6!important;color:#000!important;border:1px solid #b9d6dd!important}
        .btn-action-edit:hover{background-color:#d5e9ee!important;color:#000!important}
        .btn-action-delete{background-color:#fbdcdc!important;color:#000!important;border:1px solid #f0b4b4!important}
        .btn-action-delete:hover{background-color:#f7c7c7!important;color:#000!important;border-color:#f0b4b4!important}

        /* table */
        .custom-table-container thead th{background:#a9d0d9!important;color:#000!important;border:1px solid #8fbcc7!important;font-size:10.5px}
        .custom-table-container tbody td{font-size:12px;color:#000}
        .custom-badge{font-size:11px;color:#000!important}
        .badge-pending{background-color:#fff3d6}
        .badge-approved{background-color:#d9f2e6;border-color:#a9dcc3}
        .badge-rejected{background-color:#fbdcdc;border-color:#f0b4b4}

  /* ---- outlined floating-label fields (Planner look) ---- */
  .indent-app-container .po-field{position:relative;display:flex;align-items:center;min-height:36px;background:#fff;border:1px solid #cfd6de;border-radius:6px;transition:border-color .15s ease,box-shadow .15s ease}
  .indent-app-container .po-field:focus-within{border-color:#0f5560;box-shadow:0 0 0 3px rgba(15,85,96,.15)}
  .indent-app-container .po-field.po-invalid{border-color:#d64545}
  .indent-app-container .po-field-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#000;font-size:.8rem;pointer-events:none;z-index:1}
  .indent-app-container .po-field .po-input{width:100%;min-height:34px;padding:6px 8px 6px 32px;border:none!important;outline:none;background:transparent!important;box-shadow:none!important;border-radius:6px;font-family:inherit;font-size:.8rem;font-weight:500;color:#000}
  .indent-app-container .po-field .po-input[readonly]{background:#f7f9fb!important}
  .indent-app-container .po-field textarea.po-input{min-height:34px;padding-top:10px;resize:vertical}
  .indent-app-container .po-field select.po-input{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:28px}
  .indent-app-container .po-field .po-input:disabled{background:#f1f3f5!important;cursor:not-allowed}
  .indent-app-container .po-field .po-input::placeholder{color:#6b7685;opacity:1}
  .indent-app-container .po-caret{position:absolute;right:10px;font-size:.7rem;color:#000;pointer-events:none}
  .indent-app-container .po-field-label{position:absolute;left:32px;top:50%;transform:translateY(-50%);max-width:calc(100% - 34px);overflow:hidden;text-overflow:ellipsis;padding:0 4px;background:#fff;color:#000;font-size:.8rem;font-weight:500;white-space:nowrap;pointer-events:none;transition:all .15s ease}
  .indent-app-container .po-field:focus-within .po-field-label,.indent-app-container .po-field.is-floated .po-field-label{top:0;left:24px;font-size:.62rem;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
  .indent-app-container .po-req{color:#d64545}

  /* ---- split form card (teal info panel + white form) ---- */
  .indent-app-container .indent-split.po-split{display:flex;background:#fff;border:1px solid #e3e7ec;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.07)}
  .indent-app-container .indent-split .po-side{flex:0 0 28%;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:24px;color:#fff;background:linear-gradient(170deg,#0b3a45 0%,#0f5560 100%)}
  .indent-app-container .indent-split .po-side::before{content:'';position:absolute;width:260px;height:260px;border-radius:50%;right:-110px;top:-90px;background:rgba(255,255,255,.06)}
  .indent-app-container .indent-split .po-side::after{content:'';position:absolute;width:200px;height:200px;border-radius:50%;left:-90px;bottom:-80px;background:rgba(228,87,46,.18)}
  .indent-app-container .indent-split .po-side>*{position:relative;z-index:1}
  .indent-app-container .indent-split .po-side-brand{font-weight:700;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;color:#ffb59c}
  .indent-app-container .indent-split .po-side-hero h2{margin:0;padding:0;color:#fff!important;font-size:21px;font-weight:600;line-height:1.15}
  .indent-app-container .indent-split .po-side-hero h1{margin:0 0 12px;color:#fff!important;font-size:36px;font-weight:700;line-height:1;letter-spacing:-.5px}
  .indent-app-container .indent-split .po-side-hero p{margin:0;max-width:210px;font-size:12px;line-height:1.55;color:#c9dde1}
  .indent-app-container .indent-split .po-side-foot{color:#ffb59c;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
  .indent-app-container .indent-split .po-main{flex:1;min-width:0;padding:22px 28px;background:#fff}
  .indent-app-container .indent-split .po-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#000;font-size:17px;font-weight:700;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #e3e7ec}
  .indent-app-container .indent-split .po-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}
  .indent-app-container .indent-split .po-grid .po-full{grid-column:1/-1}
  .indent-app-container .indent-split .po-actions{display:flex;justify-content:center;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e3e7ec}
  .indent-app-container .indent-split .po-actions .btn{min-width:150px;height:38px;padding:0 18px;font-size:12.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
  .indent-app-container .indent-split .po-actions .btn-po-save{background:#e4572e!important;border:1px solid #e4572e!important;color:#fff!important;box-shadow:0 1px 2px rgba(228,87,46,.35)}
  .indent-app-container .indent-split .po-actions .btn-po-save:hover:not(:disabled){background:#c9461f!important;border-color:#c9461f!important}
  .indent-app-container .indent-split .po-actions .btn-po-save:disabled{background:#e2e4ea!important;border-color:#e2e4ea!important;color:#9DA2B0!important;box-shadow:none}
  @media(max-width:992px){.indent-app-container .indent-split.po-split{flex-direction:column}.indent-app-container .indent-split .po-side{flex:none;min-height:150px;padding:20px;gap:14px}.indent-app-container .indent-split .po-side-hero h1{font-size:28px;margin-bottom:6px}.indent-app-container .indent-split .po-main{padding:18px 14px}.indent-app-container .indent-split .po-grid{grid-template-columns:1fr}}

        /* "Create New Indent" toggle button (same tab style as the Planner / Customer pages) */
        .indent-app-container .mode-toggle-bar{display:flex;justify-content:center;gap:4px;width:fit-content;margin:0 auto 18px;padding:4px;border-radius:8px;background:#fff;border:1px solid #e3e7ec;box-shadow:0 1px 2px rgba(16,24,40,.05)}
        .indent-app-container .mode-pill-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid transparent;background:transparent;color:#000;border-radius:6px;padding:6px 18px;font-weight:600;font-size:12px;cursor:pointer;transition:all .15s ease}
        .indent-app-container .mode-pill-btn:hover{background:#f4f6f8}
        .indent-app-container .mode-pill-btn.active{background:#fde3d8;border-color:#f5b9a1;color:#000}
        .indent-app-container .mode-pill-btn i{color:#e4572e}
        .indent-app-container .gl-stage:empty{display:none}

/* show the full label on hover/focus */
.indent-app-container .po-field:hover .po-field-label,
.indent-app-container .po-field:focus-within .po-field-label,
.indent-app-container .po-field.is-floated .po-field-label {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  z-index: 3;
}
.indent-app-container .po-field .po-input {
  text-overflow: ellipsis;
  min-width: 0;
}
.indent-app-container .po-field input[type="date"].po-input {
  padding-right: 6px;
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
        @keyframes pgfade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pgrow {
          from { opacity: 0; transform: translatey(8px); }
          to   { opacity: 1; transform: translatey(0); }
        }

        /* page container (fade only) */
        .indent-app-container { animation: pgfade 0.45s ease-out backwards; }

        /* top button drops in */
        .indent-app-container .mode-toggle-bar {
          animation: pgfadedown 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
        }

        /* entry form (plays every time it opens) */
        .indent-app-container .indent-split {
          animation: pgpop 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s backwards;
        }
        .indent-app-container .indent-split .po-side {
          animation: pgslideright 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
        }
        .indent-app-container .indent-split .po-heading,
        .indent-app-container .indent-split .gl-inner,
        .indent-app-container .indent-split .text-center {
          animation: pgfadeup 0.45s ease-out backwards;
        }
        .indent-app-container .indent-split .po-heading { animation-delay: 0.25s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(1) { animation-delay: 0.32s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(2) { animation-delay: 0.40s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(3) { animation-delay: 0.48s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(4) { animation-delay: 0.56s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(5) { animation-delay: 0.64s; }
        .indent-app-container .indent-split form > .text-center { animation-delay: 0.72s; }

        /* filter card + table card */
        .indent-app-container .bar-card {
          animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.25s backwards;
        }
        .indent-app-container .bar-card + .bar-card { animation-delay: 0.38s; }

        /* table rows: quick stagger on the first rows */
        .indent-app-container .custom-table-container tbody tr { animation: pgrow 0.35s ease-out backwards; }
        .indent-app-container .custom-table-container tbody tr:nth-child(1)  { animation-delay: 0.55s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(2)  { animation-delay: 0.60s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(3)  { animation-delay: 0.65s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(4)  { animation-delay: 0.70s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(5)  { animation-delay: 0.75s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(6)  { animation-delay: 0.80s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(7)  { animation-delay: 0.85s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(8)  { animation-delay: 0.90s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(n+9) { animation-delay: 0.95s; }

        /* respect users who disable motion */
        @media (prefers-reduced-motion: reduce) {
          .indent-app-container,
          .indent-app-container * {
            animation: none !important;
          }
        }
`}</style>

      <div className="indent-app-container">

        {/* HEADER SECTION */}

        {/* ===== ENTRY FORM (glass panel) ===== */}
        <div className="mode-toggle-bar">
          <button
            type="button"
            className={`mode-pill-btn ${showForm ? "active" : ""}`}
            onClick={() => setShowForm((prev) => !prev)}
          >
            <i className="bi bi-plus-circle"></i> Create New Indent
          </button>
        </div>

        <div className="gl-stage" ref={stageRef}>
          {showForm && (
          <div className="gl-card indent-split po-split">
            {/* Left info panel */}
            <div className="po-side">
              <div className="po-side-brand">Indent</div>

              <div className="po-side-hero">
                <h2>Let's Raise</h2>
                <h1>{editingId ? "Update" : "Indent"}</h1>
                <p>
                  Enter the product code to auto-fill the product details, then
                  add the order, billing and file details.
                </p>
              </div>

              <div className="po-side-foot">
                {editingId ? "Updating Indent" : "New Indent"}
              </div>
            </div>

            {/* Right form panel */}
            <div className="po-main">
            <div className="po-heading">
              <span>Indent Details</span>
              <span className="gl-pill">{editingId ? "Editing indent" : "New indent"}</span>
            </div>

            <form onSubmit={handleSafeSubmit} onWheel={(e) => { if (e.target.type === "number") e.target.blur(); }}>

              {/* SECTION 1: PRODUCT INFO */}
              <div className="gl-inner first">
                <div className="gl-group">
                  <i className="bi bi-box-seam"></i>
                  <span>Product Details</span>
                </div>

                <div className="row g-2">
                  <div className="col-12 d-flex justify-content-center">
                  <div
                    className="d-flex gap-4 align-items-center"
                    style={{
                      border: "1px solid #070809",
                      borderRadius: "8px",
                      background: "#dde6f0b5",
                      padding: "6px 16px"
                    }}
                  >
                    <div className="form-check form-check-inline m-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="productSearchMode"
                        id="psm-code"
                        checked={searchMode === "code"}
                        onChange={() => setSearchMode("code")}
                      />
                      <label className="form-check-label fw-bold" htmlFor="psm-code">
                        Product Code
                      </label>
                    </div>
                    <div className="form-check form-check-inline m-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="productSearchMode"
                        id="psm-customer"
                        checked={searchMode === "customer"}
                        onChange={() => setSearchMode("customer")}
                      />
                      <label className="form-check-label fw-bold" htmlFor="psm-customer">
                        Customer / Description
                      </label>
                    </div>
                  </div>

                  </div>

                  {searchMode === "customer" && (
                    <>
                      <PoField className="col-12 col-md-4" icon="bi-person" label="Select Customer" alwaysFloat>
                        <input
                          className="po-input"
                          list="indent-customer-list"
                          value={custSearch}
                          placeholder="Type to search customer"
                          onChange={(e) => {
                            setCustSearch(e.target.value);
                            setDescSearch("");
                          }}
                        />
                        <datalist id="indent-customer-list">
                          {customerNames.map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </PoField>

                      <PoField className="col-12 col-md-8" icon="bi-card-text" label="Search Description" alwaysFloat>
                        <input
                          className="po-input"
                          list="indent-desc-list"
                          value={descSearch}
                          disabled={!customerItems.length}
                          placeholder={customerItems.length ? "Type to search description or code, then pick from the list" : "Select a customer first"}
                          onChange={(e) => onDescPick(e.target.value)}
                        />
                        <datalist id="indent-desc-list">
                          {customerItems.map((it, i) => (
                            <option key={`${itemCodeOf(it)}-${i}`} value={descLabelOf(it)} />
                          ))}
                        </datalist>
                      </PoField>
                    </>
                  )}
                  <PoField className="col-6 col-md-4"
                    icon="bi-upc-scan"
                    label="Product Code"
                    required
                    filled={has(form.productCode)}
                    after={
                    <>
    {errors.productCode && <small className="indent-error-text">{errors.productCode}</small>}
                    </>
                  }
                  >
                    <input
                      ref={productCodeRef}
                      readOnly={searchMode !== "code"}
                      type="text"
                      name="productCode"
                      className="po-input"
                      value={form.productCode}
 title={form.productCode}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "Enter" && quantityRef.current.focus()}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-tag" label="Product Type" filled={has(form.materialType)}>
                    <input
                      className="po-input"
                      value={form.materialType}
 title={form.materialType}
                      readOnly
                      />
                  </PoField>

                  <PoField className="col-12 col-md-4" icon="bi-person" label="Customer" filled={has(form.customerName)}>
                    <input
                      className="po-input"
                      value={form.customerName}
 title={form.customerName}
                      readOnly
                      />
                  </PoField>

                  <PoField className="col-12" icon="bi-card-text" label="Description" filled={has(form.description)}>
                    <input
                      className="po-input"
                      value={form.description}
 title={form.description}
                      readOnly
                      />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-palette" label="Color Front" filled={has(form.colorFront)}>
                    <input
                      className="po-input"
                      value={form.colorFront}
 title={form.colorFront}
                      readOnly
                      />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-palette2" label="Color Back" filled={has(form.colorBack)}>
                    <input
                      className="po-input"
                      value={form.colorBack}
 title={form.colorBack}
                      readOnly
                      />
                  </PoField>
                  <PoField className="col-12 col-md-4" icon="bi-aspect-ratio" label="Job Size" filled={has(form.jobSize)}>
                    <input
                      className="po-input"
                      value={form.jobSize}
 title={form.jobSize}
                      readOnly
                      />
                  </PoField>
                </div>
              </div>

              {/* SECTION 2: ORDER INFO */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-list-check"></i>
                  <span>Order Specifications</span>
                </div>

                <div className="row g-2">
                  <PoField className="col-6 col-md-3"
                    icon="bi-123"
                    label="Order Quantity"
                    required
                    filled={has(form.quantity)}
                    after={
                    <>
    {errors.quantity && <small className="indent-error-text">{errors.quantity}</small>}
                    </>
                  }
                  >
                    <input
                      ref={quantityRef}
                      type="number"
                      name="quantity"
                      className="po-input"
                      value={form.quantity}
 title={form.quantity}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "Enter" && locationRef.current.focus()}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-3"
                    icon="bi-geo-alt"
                    label="Location"
                    required
                    alwaysFloat
                    caret
                    after={
                    <>
    {errors.location && <small className="indent-error-text">{errors.location}</small>}
                    </>
                  }
                  >
                    <select
                      ref={locationRef}
                      name="location"
                      className="po-input"
                      value={form.location}
 title={locations.find(l => l._id === form.location)?.locationName || ""}
                      onChange={handleChange}
                      >
                      <option value="">Select Location</option>
                      {locations.map(loc => (
                      <option key={loc._id} value={loc._id}>{loc.locationName}</option>
                      ))}
                      </select>
                  </PoField>

                  <PoField className="col-6 col-md-3" icon="bi-currency-rupee" label="Unit Rate" filled={has(form.unitRate)}>
                    <input
                      type="number"
                      name="unitRate"
                      className="po-input"
                      value={form.unitRate}
 title={form.unitRate}
                      onChange={handleChange}
                      />
                  </PoField>

                  <PoField
  className="col-6 col-md-3"
  icon="bi-calendar-event"
  label="Delivery Date"
  required
  alwaysFloat
  after={
    <>
      {errors.deliveryDate && <small className="indent-error-text">{errors.deliveryDate}</small>}
    </>
  }
>
                    <input
                      type="date"
                      name="deliveryDate"
                      className="po-input"
                      value={form.deliveryDate}
 title={form.deliveryDate}
                      onChange={handleChange}
                      />
                  </PoField>
                </div>
              </div>

              {/* PAPER DETAILS */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-file-earmark-richtext"></i>
                  <span>Paper Details</span>
                </div>

                <div className="row g-2">
                  {/* <PoField className="col-6 col-md-3" icon="bi-building" label="Mill Name" alwaysFloat caret>
                    <select name="millName" className="po-input" value={form.millName}
                            title={form.millName} onChange={handlePaperChange}>
                      <option value="">Select Mill</option>
                      {paperOptions.millName.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </PoField> */}

                  <PoField className="col-6 col-md-3" icon="bi-collection" label="Group" alwaysFloat caret>
                    <select name="paperGroup" className="po-input" value={form.paperGroup}
                            title={form.paperGroup} onChange={handlePaperChange}>
                      <option value="">Select Group</option>
                      {paperOptions.paperGroup.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </PoField>

                  <PoField className="col-6 col-md-3" icon="bi-aspect-ratio" label="Size" alwaysFloat caret>
                    <select name="paperSize" className="po-input" value={form.paperSize}
                            title={form.paperSize} onChange={handlePaperChange}>
                      <option value="">Select Size</option>
                      {paperOptions.paperSize.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </PoField>

                  <PoField className="col-6 col-md-3" icon="bi-speedometer2" label="GSM" alwaysFloat caret>
                    <select name="gsm" className="po-input" value={form.gsm}
                            title={form.gsm} onChange={handlePaperChange}>
                      <option value="">Select GSM</option>
                      {paperOptions.gsm.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </PoField>
                </div>
              </div>

              {/* SECTION 3: SALES ORDER / BILLING DETAILS (NEW) */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-receipt-cutoff"></i>
                  <span>Sales Order / Billing Details</span>
                </div>

                <div className="row g-2">
                  <PoField className="col-6 col-md-4" icon="bi-layers" label="Lamination" filled={has(form.lamination)}>
                    <input
                      type="text"
                      name="lamination"
                      className="po-input"
                      value={form.lamination}
 title={form.lamination}
                      onChange={handleChange}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-stars" label="Finish" filled={has(form.finish)}>
                    <input
                      type="text"
                      name="finish"
                      className="po-input"
                      value={form.finish}
 title={form.finish}
                      onChange={handleChange}
                      />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-hash" label="Job No" filled={has(form.jobNo)}>
                    <input
                      type="text"
                      name="jobNo"
                      className="po-input"
                      value={form.jobNo}
 title={form.jobNo}
                      onChange={handleChange}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-file-earmark-text" label="SO No" filled={has(form.soNo)}>
                    <input
                      type="text"
                      name="soNo"
                      className="po-input"
                      value={form.soNo}
 title={form.soNo}
                      onChange={handleChange}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-calendar-date" label="SO Date" alwaysFloat>
                    <input
                      type="date"
                      name="soDate"
                      className="po-input"
                      value={form.soDate}
 title={form.soDate}
                      onChange={handleChange}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-tag" label="Sample Type" alwaysFloat caret>
                    <select
                      name="sampleType"
                      className="po-input"
                      value={form.sampleType}
 title={form.sampleType}
                      onChange={handleChange}
                      >
                      <option value="">Select Type</option>
                      <option value="Offset">Offset</option>
                      <option value="Digital">Digital</option>
                      </select>
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-check2-circle" label="Costing Confirmation" filled={has(form.costingConfirmation)}>
                    <input
                      type="text"
                      name="costingConfirmation"
                      className="po-input"
                      value={form.costingConfirmation}
 title={form.costingConfirmation}
                      onChange={handleChange}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-receipt" label="Type of Billing" alwaysFloat caret>
                    <select
                      name="typeOfBilling"
                      className="po-input"
                      value={form.typeOfBilling}
 title={form.typeOfBilling === "Billing" ? "Readiness Billing" : form.typeOfBilling}
                      onChange={handleChange}
                      >
                      <option value="">Select Billing</option>
                      <option value="Billing">Readiness Billing</option>
                      <option value="Kit Billing">Kit Billing</option>
                      </select>
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-receipt" label="Customer PO No" filled={has(form.customerPoNo)}>
                    <input
                      type="text"
                      name="customerPoNo"
                      className="po-input"
                      value={form.customerPoNo}
 title={form.customerPoNo}
                      onChange={handleChange}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-calendar-check" label="Customer PO Date" alwaysFloat>
                    <input
                      type="date"
                      name="customerPoDate"
                      className="po-input"
                      value={form.customerPoDate}
 title={form.customerPoDate}
                      onChange={handleChange}
                      />
                  </PoField>
                </div>
              </div>

              {/* SECTION 4: ADDITIONAL INFO */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-info-circle"></i>
                  <span>Additional Information</span>
                </div>

                <div className="row g-2">
                  <PoField className="col-md-6"
                    icon="bi-paperclip"
                    label="PO Copy (Upload)"
                    alwaysFloat
                    after={
                    <>
    {customerCopyFile && (
    <small className="text-muted d-block mt-1">Selected: {customerCopyFile.name}</small>
    )}
    {!customerCopyFile && existingCustomerCopy?.filePath && (
    <small className="d-block mt-1">
    Current: <a href={`${BASE_URL}${existingCustomerCopy.filePath}`} target="_blank" rel="noreferrer">{existingCustomerCopy.fileName}</a>
    </small>
    )}
                    </>
                  }
                  >
                    <input
                      type="file"
                      name="customerCopy"
                      className="po-input"
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                  </PoField>

                  <PoField className="col-md-6"
                    icon="bi-image"
                    label="Artwork (Upload)"
                    alwaysFloat
                    after={
                    <>
    {artworkFile && (
    <small className="text-muted d-block mt-1">Selected: {artworkFile.name}</small>
    )}
    {!artworkFile && existingArtwork?.filePath && (
    <small className="d-block mt-1">
    Current: <a href={`${BASE_URL}${existingArtwork.filePath}`} target="_blank" rel="noreferrer">{existingArtwork.fileName}</a>
    </small>
    )}
                    </>
                  }
                  >
                    <input
                      type="file"
                      name="artwork"
                      className="po-input"
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png,.ai,.psd,.doc,.docx"
                      />
                  </PoField>

                  <PoField className="col-12" icon="bi-chat-left-text" label="Remarks" filled={has(form.remark)} area>
                    <textarea
                      name="remark"
                      className="po-input"
                      value={form.remark}
 title={form.remark}
                      onChange={handleChange}
                      />
                  </PoField>
                </div>
              </div>

              <div className="text-center mt-3">
                <button type="submit" className="btn btn-submit-indent" disabled={isSaving}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Save Indent
                </button>
              </div>
            </form>
            </div>
          </div>
          )}
        </div>

        {/* ===== FILTERS ===== */}
        <div className="bar-card">
          <div className="bar-head">
            <h5>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filter Indents
            </h5>
            <span className="bar-count">
              {filteredIndents.length} / {indents.length} indents
            </span>
          </div>

          <div className="bar-body">
            <div className="row g-2 align-items-end">
              <PoField className="col-6 col-lg-2" icon="bi-search" label="Indent No" filled={has(indentNoFilter)}>
                <input
                  type="text"
                  className="po-input"
                  value={indentNoFilter}
 title={indentNoFilter}
                  onChange={(e) => setIndentNoFilter(e.target.value)}
                  />
              </PoField>

              <PoField className="col-6 col-lg-2" icon="bi-upc-scan" label="Product Code" filled={has(productCodeFilter)}>
                <input
                  type="text"
                  className="po-input"
                  value={productCodeFilter}
 title={productCodeFilter}
                  onChange={(e) => setProductCodeFilter(e.target.value)}
                  />
              </PoField>

              <PoField className="col-12 col-lg-3" icon="bi-person" label="Customer Name" filled={has(customerFilter)}>
                <input
                  type="text"
                  className="po-input"
                  value={customerFilter}
 title={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  />
              </PoField>

              <PoField className="col-6 col-lg-2" icon="bi-geo-alt" label="Location" alwaysFloat caret>
                <select
                  className="po-input"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                  <option key={loc._id} value={loc._id}>{loc.locationName}</option>
                  ))}
                  </select>
              </PoField>
              <PoField className="col-6 col-lg-3" icon="bi-calendar-event" label="From Date" alwaysFloat>
                <input
                  type="date"
                  className="po-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  />
              </PoField>

              <PoField className="col-6 col-lg-3" icon="bi-calendar-check" label="To Date" alwaysFloat>
                <input
                  type="date"
                  className="po-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  />
              </PoField>
              <div className="col-6 col-lg-3">
                <button
                  type="button"
                  className="btn btn-export w-100"
                  onClick={exportToExcel}
                >
                  Export Excel
                </button>
              </div>

              <div className="col-6 col-lg-3">
                <button className="btn btn-clear-filters w-100 d-flex align-items-center justify-content-center gap-2" onClick={clearFilters}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <polyline points="16 3 16 8 21 8"></polyline>
                    <line x1="21" y1="12" x2="21" y2="21"></line>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <polyline points="8 21 8 16 3 16"></polyline>
                  </svg>
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== TABLE CONTAINER ===== */}
        <div className="bar-card">
          <div className="bar-head">
            <h5>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              Saved Indents
            </h5>
            <span className="bar-count">
              Showing {Math.min(filteredIndents.length, 50)} of {filteredIndents.length} entries
            </span>
          </div>

          <div className="custom-table-container">
            <table className="table border-black table-bordered table-hover align-middle text-center bg-white">
              <thead className="table-dark sticky-top">
                <tr>
                  <th>Indent No</th>
                  <th>Product Code</th>
                  <th>Description</th>
                  <th>Customer</th>
                  <th>Delivery date</th>
                  <th>Product Type</th>
                  <th>Qty</th>
                  <th>Unit Rate</th>
                  <th> Requested Location</th>
                  <th>Lamination</th>
                  <th>Finish</th>
                  <th>Group</th>
                  <th>Size</th>
                  <th>GSM</th>
                  <th>Job No</th>
                  <th>SO No</th>
                  <th>SO Date</th>
                  <th>Sample Type</th>
                  <th>Costing Confirmation</th>
                  <th>Customer PO No</th>
                  <th>Customer PO Date</th>
                  <th>Type of Billing</th>
                  <th>Customer Copy</th>
                  <th>Artwork</th>
                  <th>Item PDF</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Requested By</th>
                  <th>Requested At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIndents.length === 0 ? (
                  <tr>
                    <td colSpan={31} className="text-center text-muted py-4">
                      <div className="d-flex flex-column align-items-center gap-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>No indents found matching the filters</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Limit the displayed rows in view to the top 50 records as requested
                  filteredIndents.slice(0, 50).map((ind) => (
                    <tr key={ind._id}>
                      <td className="fw-bold text-primary">{ind.indentNo}</td>
                      <td className="fw-semibold">{ind.items[0]?.productCode}</td>
                      <td
                        style={{
                          maxWidth: "280px",
                          cursor: "pointer",
                          whiteSpace:
                            expandedCell === `desc-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `desc-${ind._id}`
                              ? null
                              : `desc-${ind._id}`
                          )
                        }
                      >
                        {expandedCell === `desc-${ind._id}`
                          ? ind.items[0]?.description || "-"
                          : truncateText(ind.items[0]?.description)}
                      </td>
                      <td
                        style={{
                          maxWidth: "140px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `cust-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `cust-${ind._id}` ? null : `cust-${ind._id}`)
                        }
                      >
                        {expandedCell === `cust-${ind._id}`
                          ? ind.items[0]?.customerName || "-"
                          : truncateText(ind.items[0]?.customerName)}
                      </td>
                      <td>
                        {ind.items[0]?.deliveryDate
                          ? new Date(ind.items[0].deliveryDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td>{ind.items[0]?.materialType || "-"}</td>
                      <td className="fw-semibold">{ind.items[0]?.quantity}</td>
                      <td>{ind.items[0]?.unitRate || "-"}</td>
                      <td>
                        <span className="text-muted fw-semibold">{ind.location?.locationName || "-"}</span>
                      </td>
                      <td>{ind.items[0]?.lamination || "-"}</td>
                      <td
                        style={{
                          maxWidth: "140px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `fin-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `fin-${ind._id}` ? null : `fin-${ind._id}`)
                        }
                      >
                        {expandedCell === `fin-${ind._id}`
                          ? ind.items[0]?.finish || "-"
                          : truncateText(ind.items[0]?.finish, 20)}
                      </td>
                      <td>{ind.items[0]?.paperGroup || "-"}</td>
                      <td>{ind.items[0]?.paperSize || "-"}</td>
                      <td>{ind.items[0]?.gsm || "-"}</td>
                      <td>{ind.items[0]?.jobNo || "-"}</td>
                      <td>{ind.items[0]?.soNo || "-"}</td>
                      <td>
                        {ind.items[0]?.soDate
                          ? new Date(ind.items[0].soDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td>{ind.items[0]?.sampleType || "-"}</td>
                      <td
                        style={{
                          maxWidth: "160px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `cost-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `cost-${ind._id}` ? null : `cost-${ind._id}`)
                        }
                      >
                        {expandedCell === `cost-${ind._id}`
                          ? ind.items[0]?.costingConfirmation || "-"
                          : truncateText(ind.items[0]?.costingConfirmation)}
                      </td>
                      <td>{ind.items[0]?.customerPoNo || "-"}</td>
                      <td>
                        {ind.items[0]?.customerPoDate
                          ? new Date(ind.items[0].customerPoDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td>{ind.items[0]?.typeOfBilling || "-"}</td>
                      <td>
                        {ind.items[0]?.customerCopy?.filePath ? (
                          <a href={`${BASE_URL}${ind.items[0].customerCopy.filePath}`} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : "-"}
                      </td>
                      <td>
                        {ind.items[0]?.artwork?.filePath ? (
                          <a href={`${BASE_URL}${ind.items[0].artwork.filePath}`} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : "-"}
                      </td>
                      <td>
                        {ind.items[0]?.itemPdfPath ? (
                          <a href={`${BASE_URL}${ind.items[0].itemPdfPath}`} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : "-"}
                      </td>
                      <td>
                        <span className={`custom-badge ${
                          ind.status === "PENDING_PO" ? "badge-pending" :
                          ind.status === "APPROVED" ? "badge-approved" :
                          ind.status === "REJECTED" ? "badge-rejected" : "badge-secondary"
                        }`}>
                          {ind.status}
                        </span>
                      </td>
                      <td
                        style={{
                          maxWidth: "180px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `rem-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `rem-${ind._id}` ? null : `rem-${ind._id}`)
                        }
                      >
                        {expandedCell === `rem-${ind._id}`
                          ? ind.items[0]?.remark || "-"
                          : truncateText(ind.items[0]?.remark)}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1 justify-content-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          <span className="small">{ind.user || "System"}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-muted small">
                          {ind.createdAt ? new Date(ind.createdAt).toLocaleString("en-IN") : ""}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => handleEdit(ind)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => handleDelete(ind._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default NewIndent;