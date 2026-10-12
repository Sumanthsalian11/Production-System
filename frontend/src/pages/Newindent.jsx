import { useState, useEffect, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import axios from "axios";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

function NewIndent() {
  const [locations, setLocations] = useState([]);
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
    itemPdfPath: ""
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name || decoded.username);
    }
    fetchLocations();
    fetchIndents();
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
        colorFront: res.data.colorFront || "",
        colorBack: res.data.colorBack || "",
        wasteQty: res.data.wasteQty || "",
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

  const validateForm = () => {
    let newErrors = {};
    if (!form.productCode) newErrors.productCode = "Required";
    if (!form.quantity) newErrors.quantity = "Required";
    if (!form.location) newErrors.location = "Required";
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
      typeOfBilling: ""
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
      deliveryDate: ind.deliveryDate ? ind.deliveryDate.substring(0, 10) : "",

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
      itemPdfPath: item.itemPdfPath || ""
    });

    setCustomerCopyFile(null);
    setArtworkFile(null);
    setExistingCustomerCopy(item.customerCopy?.filePath ? item.customerCopy : null);
    setExistingArtwork(item.artwork?.filePath ? item.artwork : null);
    setEditingId(ind._id);

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
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');

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

`}</style>

      <div className="indent-app-container">

        {/* HEADER SECTION */}

        {/* ===== ENTRY FORM (glass panel) ===== */}
        <div className="gl-stage" ref={stageRef}>
          <div className="gl-card">
            <div className="gl-head">
              <h3 className="gl-title" style={{ textAlign: "center", width: "100%" }}>Indent Details</h3>
              <span className="gl-pill" style={{ textAlign: "center", width: "100%" }}>
                {editingId ? "Editing indent" : "New indent"}
              </span>
            </div>

            <form onSubmit={handleSubmit}>

              {/* SECTION 1: PRODUCT INFO */}
              <div className="gl-inner first">
                <div className="gl-group">
                  <i className="bi bi-check-circle-fill"></i>
                  <span>Product Details</span>
                </div>

                <div className="row g-2">
                  <div className="col-6 col-md-3 col-xl-2">
                    <label className="custom-label">
                      Product Code<span className="required-star">*</span>
                    </label>
                    <input
                      ref={productCodeRef}
                      type="text"
                      name="productCode"
                      className="form-control custom-input"
                      value={form.productCode}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "Enter" && quantityRef.current.focus()}
                      placeholder="Enter code"
                    />
                    {errors.productCode && <small className="indent-error-text">{errors.productCode}</small>}
                  </div>

                  <div className="col-6 col-md-3 col-xl-2">
                    <label className="custom-label">Product Type</label>
                    <input
                      className="form-control custom-input custom-input-readonly"
                      value={form.materialType}
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>

                  <div className="col-12 col-md-6 col-xl-3">
                    <label className="custom-label">Customer</label>
                    <input
                      className="form-control custom-input custom-input-readonly"
                      value={form.customerName}
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>

                  <div className="col-12 col-md-6 col-xl-5">
                    <label className="custom-label">Description</label>
                    <input
                      className="form-control custom-input custom-input-readonly"
                      value={form.description}
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  <div className="col-6 col-md-3 col-xl-2">
                    <label className="custom-label">Color Front</label>
                    <input
                      className="form-control custom-input custom-input-readonly"
                      value={form.colorFront}
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  <div className="col-6 col-md-3 col-xl-2">
                    <label className="custom-label">Color Back</label>
                    <input
                      className="form-control custom-input custom-input-readonly"
                      value={form.colorBack}
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                  <div className="col-12 col-md-6 col-xl-3">
                    <label className="custom-label">Job Size</label>
                    <input
                      className="form-control custom-input custom-input-readonly"
                      value={form.jobSize}
                      readOnly
                      placeholder="Auto-filled"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: ORDER INFO */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-check-circle-fill"></i>
                  <span>Order Specifications</span>
                </div>

                <div className="row g-2">
                  <div className="col-6 col-md-3">
                    <label className="custom-label">
                      Order Quantity<span className="required-star">*</span>
                    </label>
                    <input
                      ref={quantityRef}
                      type="number"
                      name="quantity"
                      className="form-control custom-input"
                      value={form.quantity}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "Enter" && locationRef.current.focus()}
                      placeholder="Enter quantity"
                    />
                    {errors.quantity && <small className="indent-error-text">{errors.quantity}</small>}
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="custom-label">
                      Location<span className="required-star">*</span>
                    </label>
                    <select
                      ref={locationRef}
                      name="location"
                      className="form-select custom-input"
                      value={form.location}
                      onChange={handleChange}
                    >
                      <option value="">Select Location</option>
                      {locations.map(loc => (
                        <option key={loc._id} value={loc._id}>{loc.locationName}</option>
                      ))}
                    </select>
                    {errors.location && <small className="indent-error-text">{errors.location}</small>}
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="custom-label">Unit Rate</label>
                    <input
                      type="number"
                      name="unitRate"
                      className="form-control custom-input"
                      value={form.unitRate}
                      onChange={handleChange}
                      placeholder="Enter rate"
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="custom-label">Delivery Date</label>
                    <input
                      type="date"
                      name="deliveryDate"
                      className="form-control custom-input"
                      value={form.deliveryDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: SALES ORDER / BILLING DETAILS (NEW) */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-check-circle-fill"></i>
                  <span>Sales Order / Billing Details</span>
                </div>

                <div className="row g-2">
                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">Lamination</label>
                    <input
                      type="text"
                      name="lamination"
                      className="form-control custom-input"
                      value={form.lamination}
                      onChange={handleChange}
                      placeholder="Enter lamination"
                    />
                  </div>

                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">Finish</label>
                    <input
                      type="text"
                      name="finish"
                      className="form-control custom-input"
                      value={form.finish}
                      onChange={handleChange}
                      placeholder="Enter finish"
                    />
                  </div>
                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">Job No</label>
                    <input
                      type="text"
                      name="jobNo"
                      className="form-control custom-input"
                      value={form.jobNo}
                      onChange={handleChange}
                      placeholder="Enter job no"
                    />
                  </div>

                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">SO No</label>
                    <input
                      type="text"
                      name="soNo"
                      className="form-control custom-input"
                      value={form.soNo}
                      onChange={handleChange}
                      placeholder="Enter SO no"
                    />
                  </div>

                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">SO Date</label>
                    <input
                      type="date"
                      name="soDate"
                      className="form-control custom-input"
                      value={form.soDate}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">Sample Type</label>
                    <select
                      name="sampleType"
                      className="form-select custom-input"
                      value={form.sampleType}
                      onChange={handleChange}
                    >
                      <option value="">Select Type</option>
                      <option value="Offset">Offset</option>
                      <option value="Digital">Digital</option>
                    </select>
                  </div>

                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">Costing Confirmation</label>
                    <input
                      type="text"
                      name="costingConfirmation"
                      className="form-control custom-input"
                      value={form.costingConfirmation}
                      onChange={handleChange}
                      placeholder="Enter confirmation"
                    />
                  </div>

                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">Type of Billing</label>
                    <select
                      name="typeOfBilling"
                      className="form-select custom-input"
                      value={form.typeOfBilling}
                      onChange={handleChange}
                    >
                      <option value="">Select Billing</option>
                      <option value="Billing">Readiness Billing</option>
                      <option value="Kit Billing">Kit Billing</option>
                    </select>
                  </div>

                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">Customer PO No</label>
                    <input
                      type="text"
                      name="customerPoNo"
                      className="form-control custom-input"
                      value={form.customerPoNo}
                      onChange={handleChange}
                      placeholder="Enter customer PO no"
                    />
                  </div>

                  <div className="col-6 col-md-4 col-xl-2">
                    <label className="custom-label">Customer PO Date</label>
                    <input
                      type="date"
                      name="customerPoDate"
                      className="form-control custom-input"
                      value={form.customerPoDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: ADDITIONAL INFO */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-check-circle-fill"></i>
                  <span>Additional Information</span>
                </div>

                <div className="row g-2">
                  <div className="col-md-6 col-xl-4">
                    <label className="custom-label">PO Copy (Upload)</label>
                    <input
                      type="file"
                      name="customerCopy"
                      className="form-control custom-input"
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                    {customerCopyFile && (
                      <small className="text-muted d-block mt-1">Selected: {customerCopyFile.name}</small>
                    )}
                    {!customerCopyFile && existingCustomerCopy?.filePath && (
                      <small className="d-block mt-1">
                        Current: <a href={`${BASE_URL}${existingCustomerCopy.filePath}`} target="_blank" rel="noreferrer">{existingCustomerCopy.fileName}</a>
                      </small>
                    )}
                  </div>

                  <div className="col-md-6 col-xl-4">
                    <label className="custom-label">Artwork (Upload)</label>
                    <input
                      type="file"
                      name="artwork"
                      className="form-control custom-input"
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png,.ai,.psd,.doc,.docx"
                    />
                    {artworkFile && (
                      <small className="text-muted d-block mt-1">Selected: {artworkFile.name}</small>
                    )}
                    {!artworkFile && existingArtwork?.filePath && (
                      <small className="d-block mt-1">
                        Current: <a href={`${BASE_URL}${existingArtwork.filePath}`} target="_blank" rel="noreferrer">{existingArtwork.fileName}</a>
                      </small>
                    )}
                  </div>

                  <div className="col-12 col-xl-4">
                    <label className="custom-label">Remarks</label>
                    <textarea
                      name="remark"
                      className="form-control custom-input custom-textarea"
                      rows="2"
                      value={form.remark}
                      onChange={handleChange}
                      placeholder="Add indent notes or details..."
                    />
                  </div>
                </div>
              </div>

              <div className="text-center mt-3">
                <button type="submit" className="btn btn-submit-indent">
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
              <div className="col-6 col-lg-2">
                <label className="custom-label">Indent No</label>
                <input
                  type="text"
                  placeholder="Search Indent No"
                  className="form-control custom-input"
                  value={indentNoFilter}
                  onChange={(e) => setIndentNoFilter(e.target.value)}
                />
              </div>

              <div className="col-6 col-lg-2">
                <label className="custom-label">Product Code</label>
                <input
                  type="text"
                  placeholder="Search Code"
                  className="form-control custom-input"
                  value={productCodeFilter}
                  onChange={(e) => setProductCodeFilter(e.target.value)}
                />
              </div>

              <div className="col-12 col-lg-3">
                <label className="custom-label">Customer Name</label>
                <input
                  type="text"
                  placeholder="Search Customer"
                  className="form-control custom-input"
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                />
              </div>

              <div className="col-6 col-lg-2">
                <label className="custom-label">Location</label>
                <select
                  className="form-select custom-input"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc._id} value={loc._id}>{loc.locationName}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-lg-3">
                <label className="custom-label">From Date</label>
                <input
                  type="date"
                  className="form-control custom-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div className="col-6 col-lg-3">
                <label className="custom-label">To Date</label>
                <input
                  type="date"
                  className="form-control custom-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
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
                    <td colSpan={25} className="text-center text-muted py-4">
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
                      <td>{ind.items[0]?.finish || "-"}</td>
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
                      <td>
                        <div
                          style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={ind.items[0]?.remark}
                        >
                          {ind.items[0]?.remark || "-"}
                        </div>
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