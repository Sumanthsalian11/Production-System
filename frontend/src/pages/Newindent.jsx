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
        /* ============ Page shell (sky blue + white) ============ */
        .indent-app-container {
          max-width: 100%;
          min-height: 100vh;
          padding: 12px 24px 28px;
          font-size: 14px;
          color: #08283d;
          border: 1px solid rgba(12, 90, 130, 0.38);
          border-radius: 0px;
          background:
            radial-gradient(circle at top left, rgba(34, 153, 204, 0.34), transparent 32%),
            linear-gradient(135deg, #d6f1fb 0%, #edfaff 48%, #c7e9f7 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        /* ============ Page header ============ */
        .indent-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px 6px;
          margin-bottom: 10px;
          border-bottom: 2px solid rgba(6, 76, 115, 0.22);
        }

        .indent-title {
          margin: 0;
          color: #06324d;
          font-size: 21px;
          font-weight: 800;
          line-height: 1.15;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .user-pill {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-60%);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 12px;
          border: 1px solid rgba(14, 94, 135, 0.45);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.72);
          box-shadow: 0 2px 6px rgba(10, 78, 115, 0.14);
          color: #06324d;
          font-size: 0.78rem;
          font-weight: 700;
        }

        /* ============ Light glass entry panel ============ */
        .indent-app-container .gl-stage {
          position: relative;
          overflow: hidden;
          margin-bottom: 14px;
          padding: 14px;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.85);
          background: linear-gradient(160deg, #e3f2fd 0%, #c6e0f5 55%, #acd3ee 100%);
          box-shadow: 0 12px 28px rgba(14, 86, 122, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .indent-app-container .gl-stage::before,
        .indent-app-container .gl-stage::after {
          content: "";
          position: absolute;
          pointer-events: none;
          border-radius: 50% 50% 48% 48% / 60% 60% 40% 40%;
          filter: blur(8px);
        }

        .indent-app-container .gl-stage::before {
          width: 190px;
          height: 240px;
          left: -50px;
          top: -80px;
          transform: rotate(-18deg);
          background: radial-gradient(circle at 35% 30%, #a9d0ee, #7fb4e0);
          opacity: 0.7;
        }

        .indent-app-container .gl-stage::after {
          width: 210px;
          height: 260px;
          right: -50px;
          bottom: -90px;
          transform: rotate(16deg);
          background: radial-gradient(circle at 60% 30%, #f4faff, #c3dff4);
          opacity: 0.85;
        }

        .indent-app-container .gl-card {
          position: relative;
          z-index: 1;
          padding: 14px 16px 16px;
          color: #0b2a45;
          border-radius: 20px;
          border: 1.5px solid rgba(255, 255, 255, 0.95);
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42));
          backdrop-filter: blur(16px) saturate(130%);
          -webkit-backdrop-filter: blur(16px) saturate(130%);
          box-shadow: 0 10px 26px rgba(14, 86, 122, 0.16), inset 0 1px 0 rgba(255, 255, 255, 1);
        }

        .indent-app-container .gl-head {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 2px dotted rgba(14, 94, 135, 0.35);
        }

        .indent-app-container .gl-title {
          margin: 0;
          color: #0b3a5e;
          font-size: 1.3rem;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.2px;
        }

        .indent-app-container .gl-pill {
          display: inline-block;
          padding: 2px 14px;
          border-radius: 999px;
          border: 1px solid rgba(8, 119, 173, 0.35);
          background: rgba(8, 119, 173, 0.12);
          color: #075f90;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .indent-app-container .gl-inner {
          margin-top: 10px;
          padding: 10px 12px 12px;
          border-radius: 14px;
          border: 1px solid rgba(14, 94, 135, 0.18);
          background: rgba(255, 255, 255, 0.5);
          box-shadow: inset 0 1px 4px rgba(14, 86, 122, 0.08);
        }

        .indent-app-container .gl-inner.first {
          margin-top: 0;
        }

        .indent-app-container .gl-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: #062b42;
          font-size: 13px;
          font-weight: 700;
        }

        .indent-app-container .gl-group i {
          color: #119bd2;
          font-size: 1.05rem;
          background: #ffffff;
          border-radius: 50%;
          line-height: 1;
        }

        /* ============ Labels / inputs ============ */
        .custom-label {
          display: block !important;
          margin-bottom: 3px !important;
          overflow: hidden;
          color: #1d4f86 !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          letter-spacing: 0.2px;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .required-star {
          margin-left: 0.2rem;
          color: #ef4444;
          font-weight: 700;
        }

        .indent-app-container .custom-input,
        .indent-app-container select.custom-input,
        .indent-app-container textarea.custom-input {
          display: block;
          width: 100%;
          min-height: 32px;
          padding: 4px 10px !important;
          border: 1px solid rgba(14, 94, 135, 0.35) !important;
          border-radius: 8px !important;
          background-color: rgba(255, 255, 255, 0.92) !important;
          color: #0b2a45 !important;
          font-size: 0.8rem !important;
          font-weight: 600 !important;
          line-height: 1.5 !important;
          box-shadow: inset 0 1px 2px rgba(8, 55, 83, 0.06);
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
          color-scheme: light;
        }

        .indent-app-container select.custom-input {
          padding-right: 26px !important;
        }

        .indent-app-container .custom-input:focus,
        .indent-app-container select.custom-input:focus,
        .indent-app-container textarea.custom-input:focus {
          border-color: #087fb5 !important;
          background-color: #ffffff !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(8, 127, 181, 0.22) !important;
        }

        .indent-app-container .custom-input-readonly {
          border: 1px solid rgba(14, 94, 135, 0.25) !important;
          background-color: rgba(228, 241, 250, 0.95) !important;
          color: #0b2a45 !important;
          cursor: not-allowed !important;
        }

        .indent-app-container .custom-input::placeholder {
          color: rgba(11, 42, 69, 0.5) !important;
          opacity: 1 !important;
        }

        .indent-app-container .custom-textarea {
          min-height: 58px;
          resize: vertical;
        }

        .indent-app-container input[type="file"].custom-input {
          padding: 3px 8px !important;
        }

        .indent-app-container small,
        .indent-app-container .text-muted {
          font-size: 0.72rem;
        }

        .indent-error-text {
          display: block;
          margin-top: 0.2rem;
          color: #dc2626;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .indent-app-container .btn-submit-indent {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 200px;
          justify-content: center;
          padding: 8px 28px;
          border: 0;
          border-radius: 8px;
          background: linear-gradient(135deg, #0877ad, #16a4dc);
          color: #ffffff;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.4px;
          box-shadow: 0 6px 14px rgba(10, 78, 115, 0.28);
          transition: transform 0.12s ease, filter 0.12s ease;
          cursor: pointer;
        }

        .indent-app-container .btn-submit-indent:hover {
          color: #ffffff;
          filter: brightness(1.06);
          transform: translateY(-1px);
        }

        /* ============ Section cards (filters / table) ============ */
        .bar-card {
          margin-top: 14px;
          overflow: hidden;
          border: 1px solid rgba(20, 111, 156, 0.42);
          border-radius: 12px;
          background: rgba(221, 243, 252, 0.94);
          box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22);
        }

        .bar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 18px;
          background: linear-gradient(135deg, #075f90, #119bd2);
          color: #ffffff;
        }

        .bar-head h5 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .bar-body {
          padding: 12px 18px 14px;
        }

        .bar-count {
          padding: 3px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .indent-app-container .btn-export {
          min-height: 32px;
          border: 0;
          border-radius: 8px;
          background: linear-gradient(135deg, #087f68, #18aa91);
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 700;
          box-shadow: 0 5px 12px rgba(10, 78, 115, 0.24);
        }

        .indent-app-container .btn-export:hover {
          color: #ffffff;
          filter: brightness(1.06);
        }

        .indent-app-container .btn-clear-filters {
          min-height: 32px;
          border: 0;
          border-radius: 8px;
          background: linear-gradient(135deg, #405f76, #6f91a6);
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 700;
          box-shadow: 0 5px 12px rgba(10, 78, 115, 0.24);
          cursor: pointer;
        }

        .indent-app-container .btn-clear-filters:hover {
          color: #ffffff;
          filter: brightness(1.06);
        }

        /* Action Buttons */
        .btn-action-edit {
          background-color: #fef3c7 !important;
          color: #d97706 !important;
          border: 1px solid #fde68a !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          padding: 0.25rem 0.6rem !important;
          border-radius: 4px !important;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-edit:hover {
          background-color: #1eb4f4 !important;
          color: #000000 !important;
        }

        .btn-action-delete {
          background-color: #fee2e2 !important;
          color: #dc2626 !important;
          border: 1px solid #fecaca !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          padding: 0.25rem 0.6rem !important;
          border-radius: 4px !important;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-delete:hover {
          background-color: #fb0505 !important;
          color: #fdfdfd !important;
        }

        /* ============ Table ============ */
        .custom-table-container {
          width: 100%;
          max-height: 400px;
          overflow-y: auto;
          overflow-x: auto;
          background: #d5edf8;
        }

        .custom-table-container table {
          margin-bottom: 0;
          color: #09283d;
          background: #ffffff;
        }

        .custom-table-container thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          padding: 0.6rem 0.8rem;
          background: #064c73 !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.28) !important;
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
          vertical-align: middle;
        }

        .custom-table-container tbody td {
          padding: 0.5rem 0.8rem;
          border-color: rgba(20, 93, 130, 0.28) !important;
          font-size: 0.82rem;
          vertical-align: middle;
        }

        .custom-table-container tbody tr:hover td {
          background: #d9f2fc !important;
        }

        .custom-badge {
          display: inline-block;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: 600;
        }

        .badge-pending {
          background-color: #fef3c7;
          color: #d97706;
          border: 1px solid #fde68a;
        }

        .badge-approved {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .badge-rejected {
          background-color: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .badge-secondary {
          background-color: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .custom-table-container::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-table-container::-webkit-scrollbar-track {
          background: #e8f4fb;
        }
        .custom-table-container::-webkit-scrollbar-thumb {
          background: #8fb8d1;
          border-radius: 4px;
        }
        .custom-table-container::-webkit-scrollbar-thumb:hover {
          background: #5f95b5;
        }

        @media (max-width: 768px) {
          .indent-app-container {
            padding: 10px;
            border-radius: 14px;
          }

          .indent-header {
            flex-direction: column;
            gap: 6px;
          }

          .user-pill {
            position: static;
            transform: none;
          }

          .indent-app-container .gl-stage {
            padding: 10px;
            border-radius: 18px;
          }

          .indent-app-container .gl-card {
            padding: 12px;
            border-radius: 16px;
          }
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