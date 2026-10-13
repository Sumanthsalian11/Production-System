import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import BASE_URL from "../config/api";

// ============================================================================
// 🎨 CRISP VECTOR 3D ICONS (Embedded directly - zero external icon dependencies)
// ============================================================================
const Icons = {
  Factory: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
      <path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Scale: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
    </svg>
  ),
  Reel: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5"/><path d="M12 16v5"/><path d="M3 12h5"/><path d="M16 12h5"/>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Save: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  ),
  Flame: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  ),
  Alert: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Gauge: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>
    </svg>
  ),
  Lock: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
};

// ============================================================================
// 📦 MATERIAL HELPERS (pure functions – no state)
// ============================================================================
const getMaterialOptions = (jobData) => [
  ...new Set(
    (jobData?.materials || [])
      .map((m) => m.materialDescription)
      .filter(Boolean)
  )
];

const getDefaultMaterial = (jobData) => {
  const opts = getMaterialOptions(jobData);
  return opts.length === 1 ? opts[0] : "";
};

const getRelatedMaterials = (jobData, description) => {
  const all = jobData?.materials || [];
  if (!description) return all;
  const matched = all.filter((m) => m.materialDescription === description);
  return matched.length > 0 ? matched : all;
};

const getUniqueMills = (materialRows) => [
  ...new Set((materialRows || []).map((m) => m.mill).filter(Boolean))
];

const IconField = ({ icon: Icon, children }) => (
  <div className="pd-iconfield">
    <span className="pd-ficon"><Icon /></span>
    {children}
  </div>
);

function Productiondashboard() {
  const emptyForm = {
    efiWoNumber: "",
    reelWoNumber: "",
    productionDate: "",
    reelNo: "",
    grossWeight: "",
    millNetWeight: "",
    actualNetWeight: "",
    actualGsm: "",
    productionOutput: "",
    mattWaste: "",
    printWaste: "",
    realEndWaste: "",
    coreWeight: "",
    balance: "",
    mill: "",
    productionType: "",
    materialDescription: ""
  };

  const showAlert = (message, icon = "warning") => {
    let bgColor = "#ffc0cb";
    if (icon === "success") bgColor = "#ffffff";
    if (icon === "error") bgColor = "#e5e8e8";
    if (icon === "info") bgColor = "#17a2b8";

    Swal.fire({
      toast: true,
      position: "top",
      icon: icon,
      title: message,
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      background: bgColor,
      color: "#000000",
    });
  };

  const navigate = useNavigate();
  const [productionDate, setProductionDate] = useState("");
  const [expandedCell, setExpandedCell] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [remarksRequired, setRemarksRequired] = useState(false);
  const [mills, setMills] = useState([]);
  const [job, setJob] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [reels, setReels] = useState([]);
  const [editingReelId, setEditingReelId] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [autoFetchedNet, setAutoFetchedNet] = useState(false);
  const [fetchedWo, setFetchedWo] = useState(null);

  const activeMaterialDescription =
    form.materialDescription || getDefaultMaterial(job);

  const displayMaterials = getRelatedMaterials(job, activeMaterialDescription);
  const materialOptions = getMaterialOptions(job);
  const hasMultipleMaterials = materialOptions.length > 1;
  const materialSelected = hasMultipleMaterials && !!form.materialDescription;

  const getAuthConfig = () => {
    const token = localStorage.getItem("token");
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setLoggedInUser(decoded.name || "");
      } catch (err) {
        console.error("Token decoding error:", err);
      }
    }
  }, []);

  const validateDigits = (value, limit) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length > limit) {
      showAlert(`Only ${limit} digits allowed`, "error");
      return false;
    }
    return true;
  };

  const truncateText = (text, length = 8) => {
    if (!text) return "-";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const deleteReel = async (id) => {
    if (!window.confirm("Delete this reel?")) return;

    try {
      await axios.delete(`${BASE_URL}/api/production/${id}`, getAuthConfig());
      showAlert("Reel Deleted Successfully 🗑️", "success");
      fetchReels(form.efiWoNumber);
    } catch (err) {
      showAlert("Error deleting reel", "error");
    }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;

    if (name === "reelNo") {
      setAutoFetchedNet(false);
      setForm((prev) => ({
        ...prev,
        reelNo: value,
        actualNetWeight: ""
      }));

      if (!value) return;

      try {
        const res = await axios.get(
          `${BASE_URL}/api/production/reel/${value}`,
          getAuthConfig()
        );

        setForm((prev) => {
          if (prev.reelNo !== value) return prev;
          return {
            ...prev,
            actualNetWeight: res.data?.balance ?? ""
          };
        });

        if (res.data?.balance >= 0) {
          setAutoFetchedNet(true);
        } else {
          setAutoFetchedNet(false);
        }
      } catch {
        console.log("No previous reel found");
      }
      return;
    }

    if (name === "materialDescription") {
      const related = getRelatedMaterials(job, value);
      const relatedMills = getUniqueMills(related);

      setForm((prev) => {
        let nextMill = prev.mill;
        if (prev.productionType !== "Make Ready") {
          if (relatedMills.length === 1) {
            nextMill = relatedMills[0];
          } else if (!relatedMills.includes(prev.mill)) {
            nextMill = "";
          }
        }
        return {
          ...prev,
          materialDescription: value,
          mill: nextMill
        };
      });
      return;
    }

    if (value === "Make Ready") {
      try {
        const res = await axios.get(
          `${BASE_URL}/api/master/materials/mills`,
          getAuthConfig()
        );
        setMills(res.data);
      } catch (err) {
        console.error("Mill fetch error:", err);
      }
    }

    if (name === "actualNetWeight") {
      setAutoFetchedNet(false);
    }

    if (name !== "productionDate") {
      if (value.includes("-") || (!isNaN(value) && Number(value) < 0)) {
        showAlert("Negative values are not allowed", "error");
        return;
      }

      if (
        name === "grossWeight" ||
        name === "millNetWeight" ||
        name === "actualNetWeight"
      ) {
        if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) {
          showAlert("Max 3 digits before decimal & 2 after decimal allowed", "error");
          return;
        }

        if (name === "actualNetWeight") {
          const gross = Number(form.grossWeight || 0);
          const actual = Number(value || 0);
          if (gross && actual > gross) {
            showAlert("Actual Net Weight cannot be greater than Gross Weight", "error");
            return;
          }
        }
      }

      const digitLimits = {
        grossWeight: 5,
        millNetWeight: 5,
        actualGsm: 5,
        mattWaste: 5,
        printWaste: 5,
        realEndWaste: 5,
        coreWeight: 5,
        balance: 5
      };

      if (digitLimits[name]) {
        if (!validateDigits(value, digitLimits[name])) return;
      }
    }

    if (name === "mattWaste") {
      if (value.includes("+") || value.includes("-") || value.toLowerCase().includes("e")) {
        showAlert("Invalid characters are not allowed", "error");
        return;
      }
      if (!/^\d{0,2}(\.\d{0,2})?$/.test(value)) {
        showAlert("Matt Waste: Max 2 digits and 2 decimal places allowed", "error");
        return;
      }
    }

    if (name === "coreWeight") {
      if (value.includes("+") || value.includes("-") || value.toLowerCase().includes("e")) {
        showAlert("Invalid characters are not allowed", "error");
        return;
      }
      if (!/^\d{0,1}(\.\d{0,2})?$/.test(value)) {
        showAlert("Core Weight: Max 1 digit and 2 decimal places allowed", "error");
        return;
      }
    }

    if (name === "printWaste" || name === "realEndWaste") {
      if (value.includes("+") || value.includes("-") || value.toLowerCase().includes("e")) {
        showAlert("Invalid characters are not allowed", "error");
        return;
      }
      if (!/^\d{0,2}(\.\d{0,2})?$/.test(value)) {
        showAlert("Maximum 2 digits and 2 decimal places allowed", "error");
        return;
      }
    }

    if (name === "balance") {
      const actualNet = Number(form.actualNetWeight || 0);
      const balanceValue = Number(value || 0);

      if (balanceValue > actualNet) {
        showAlert("Balance cannot be greater than Actual Net Weight", "error");
        return;
      }
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const fetchWO = async () => {
    if (!form.efiWoNumber) return showAlert("Enter WO Number", "error");

    try {
      const res = await axios.get(
        `${BASE_URL}/api/production/workorder/${form.efiWoNumber}`,
        getAuthConfig()
      );
      const woData = res.data;

      setJob(woData);
      setFetchedWo(Number(form.efiWoNumber));
      fetchReels(form.efiWoNumber);

      if (woData.materials && woData.materials.length === 1) {
        setForm((prev) => ({
          ...prev,
          mill: woData.materials[0].mill || "",
          materialDescription: woData.materials[0].materialDescription || ""
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          materialDescription: getDefaultMaterial(woData)
        }));
      }
    } catch {
      showAlert("Work Order not found", "error");
    }
  };

  const fetchReels = async (wo) => {
    if (!wo) return;

    try {
      const res = await axios.get(
        `${BASE_URL}/api/production/workorder/${wo}/reels`,
        getAuthConfig()
      );
      setReels(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching reels:", err);
      setReels([]);
    }
  };

  const totalWaste =
    Number(form.mattWaste || 0) +
    Number(form.printWaste || 0) +
    Number(form.realEndWaste || 0) +
    Number(form.coreWeight || 0);

  const TotalWaste = Number(totalWaste.toFixed(2));

  const netAfterBalance =
    Number(form.actualNetWeight || 0) - Number(form.balance || 0);

  const wastePercent =
    netAfterBalance > 0
      ? ((totalWaste / netAfterBalance) * 100).toFixed(2)
      : 0;

  useEffect(() => {
    if (Number(wastePercent) > 15) {
      setRemarksRequired(true);
    } else {
      setRemarksRequired(false);
      setRemarks("");
    }
  }, [wastePercent]);

  const save = async () => {
    if (!job) return showAlert("Fetch Work Order first", "error");

    if (Number(form.efiWoNumber) !== fetchedWo) {
      showAlert("Work Order changed. Please click Fetch Work Order again", "error");
      return;
    }

    if (Number(form.reelWoNumber) !== Number(form.efiWoNumber)) {
      showAlert("WO Number does not match fetched Work Order", "error");
      return;
    }

    const requiredFields = [
      "reelNo",
      "actualNetWeight",
      "actualGsm",
      "productionOutput",
      "balance",
      "mattWaste",
      "printWaste",
      "realEndWaste",
      "coreWeight",
      "mill",
      "productionType"
    ];

    if (!productionDate) {
      showAlert("Production Date is required", "error");
      return;
    }

    const materialDescription =
      form.materialDescription || getDefaultMaterial(job);

    if (getMaterialOptions(job).length > 1 && !materialDescription) {
      showAlert("Please select Material Description", "error");
      return;
    }

    for (let field of requiredFields) {
      if (form[field] === "" || form[field] === null) {
        showAlert(`${field.replace(/([A-Z])/g, " $1")} is required`, "error");
        return;
      }
    }

    if (remarksRequired) {
      if (!remarks || remarks.length < 10) {
        showAlert("Remarks must be at least 10 characters long", "error");
        return;
      }
      if (/[-+,.&*^%$#@_<>/e{}[\]\\|]/.test(remarks)) {
        showAlert("Special characters not allowed", "error");
        return;
      }
    }

    if (Number(form.actualNetWeight) === 0) {
      showAlert("Actual Net Weight cannot be 0", "error");
      return;
    }

    try {
      if (
        Number(form.grossWeight) > 0 &&
        Number(form.actualNetWeight) > Number(form.grossWeight)
      ) {
        showAlert("Actual Net Weight cannot be greater than Gross Weight", "error");
        return;
      }

      if (Number(form.balance) > Number(form.actualNetWeight)) {
        showAlert("Balance cannot be greater than Actual Net Weight", "error");
        return;
      }

      if (editingReelId) {
        await axios.put(
          `${BASE_URL}/api/production/${editingReelId}`,
          {
            ...form,
            materialDescription,
            productionDate,
            productionUser: loggedInUser,
            remarks: remarksRequired ? remarks : ""
          },
          getAuthConfig()
        );

        showAlert("Reel Updated Successfully ✅", "success");
        setEditingReelId(null);
      } else {
        await axios.post(
          `${BASE_URL}/api/production`,
          {
            efiWoNumber: Number(form.efiWoNumber),
            productionDate: productionDate,
            reelNo: form.reelNo,
            grossWeight: Number(form.grossWeight) || 0,
            millNetWeight: Number(form.millNetWeight) || 0,
            actualNetWeight: form.actualNetWeight
              ? Number(form.actualNetWeight)
              : undefined,
            actualGsm: Number(form.actualGsm) || 0,
            productionOutput: Number(form.productionOutput) || 0,
            mattWaste: Number(form.mattWaste) || 0,
            printWaste: Number(form.printWaste) || 0,
            realEndWaste: Number(form.realEndWaste) || 0,
            coreWeight: Number(form.coreWeight) || 0,
            balance: Number(form.balance) || 0,
            mill: form.mill,
            productionType: form.productionType,
            materialDescription,
            productionUser: loggedInUser,
            remarks: remarksRequired ? remarks : ""
          },
          getAuthConfig()
        );

        showAlert("Reel Saved Successfully ✅", "success");
      }

      setForm((prev) => ({
        ...emptyForm,
        efiWoNumber: prev.efiWoNumber,
        mill: prev.mill,
        materialDescription: prev.materialDescription
      }));

      fetchReels(form.efiWoNumber);
    } catch (err) {
      console.error("SAVE ERROR:", err.response?.data || err.message);
      showAlert(err.response?.data?.message || "Error saving", "error");
    }
  };

  return (
    <div className="pd-root">
      {/* ======================================================================
          CRISP PURE-BLACK FONT & LIGHT TABLE HEADER THEME
          ====================================================================== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap');

        /* ---------- Theme tokens with Pure Black Text & Crisp Light Header ---------- */
        .pd-root {
          --brand: #e4572e;
          --brand-dark: #c9461f;
          --brand-soft: #fdeee8;
          --teal: #0b3a45;
          --teal-mid: #0f5560;
          --teal-soft: #e3f1f4;
          --ink: #000000;
          --ink-soft: #111827;
          --ink-mute: #374151;
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
        .pd-shell { max-width: 1250px; margin: 0 auto; }

        /* ---------- Header strip ---------- */
        .dash-hero-header {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 10px;
          padding: 9px 18px;
          border-radius: 8px;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
        }
        .hero-left-branding { display: flex; align-items: center; gap: 14px; }
        .hero-emblem-3d {
          width: 36px; height: 36px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: var(--brand);
          background: var(--brand-soft);
          border: 1px solid #f7d3c6;
          box-shadow: none;
        }
        .hero-titles h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.2px; color: #000000; }
        .hero-titles p { margin: 1px 0 0; font-size: 11.5px; font-weight: 600; color: #1f2937; }
        .hero-right-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .operator-pill-3d {
          display: flex; align-items: center; gap: 8px; padding: 4px 12px;
          border-radius: 30px; font-size: 12px; font-weight: 700; color: #000000;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: none;
        }
        .operator-pulse-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--ok); box-shadow: 0 0 0 3px rgba(31, 157, 107, 0.18);
        }

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

        /* ---------- WO search ---------- */
        .wo-search-flex { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
        .wo-input-box { flex: 1; min-width: 250px; }
        .wo-date-box { flex: 0 0 210px; }

        /* ---------- Inputs & Labels in Pure Black ---------- */
        .field-3d-wrapper { display: flex; flex-direction: column; gap: 4px; }
        .label-3d {
          font-size: 11px; font-weight: 700; color: #000000; letter-spacing: 0.3px; text-transform: uppercase;
          display: flex; justify-content: space-between; align-items: center;
        }
        .input-inset-3d, .select-inset-3d {
          width: 100%; padding: 8px 12px; border-radius: 6px;
          border: 1px solid var(--field-line); background: #ffffff;
          font-family: inherit; font-size: 13.5px; font-weight: 600; color: #000000; outline: none; box-sizing: border-box;
          box-shadow: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .select-inset-3d { cursor: pointer; }
        .input-inset-3d:focus, .select-inset-3d:focus {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.18);
        }
        .input-inset-3d.readonly-locked {
          background: #f3f4f6;
          color: #1f2937; border-color: var(--line); cursor: not-allowed;
          font-weight: 700;
        }
        .input-inset-3d::placeholder { color: #6b7280; font-weight: 400; }

        /* ---------- Buttons (untouched) ---------- */
        .push-btn-3d {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 9px 18px; border-radius: 6px; font-family: inherit; font-size: 13px; font-weight: 600;
          border: 1px solid transparent; cursor: pointer; outline: none; user-select: none;
          transition: all 0.15s ease;
        }
        .push-btn-3d:disabled { opacity: 0.5; cursor: not-allowed; }
        .push-btn-primary {
          color: #ffffff; text-shadow: none;
          background: var(--brand); border-color: var(--brand);
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .push-btn-primary:hover:not(:disabled) {
          background: var(--brand-dark); border-color: var(--brand-dark);
        }
        .push-btn-hero-save {
          max-width: 230px; padding: 10px 18px; font-size: 13.5px; color: #ffffff;
          background: var(--brand); border-color: var(--brand);
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .push-btn-hero-save:hover { background: var(--brand-dark); border-color: var(--brand-dark); }
        .push-btn-edit-mode {
          background: var(--teal); border-color: var(--teal);
        }
        .push-btn-edit-mode:hover { background: #072a33 !important; border-color: #072a33 !important; }

        .locked-tag-3d {
          font-size: 9px; padding: 1px 5px; border-radius: 4px;
          background: #e4f6ee; color: #167a52; border: 1px solid #b7e4d0;
          font-weight: 700;
        }

        /* ---------- Waste alert ---------- */
        .waste-alert-banner-3d {
          margin-top: 8px; padding: 10px 14px; border-radius: 8px;
          background: #fff8e8; border: 1px solid #f2d291;
        }
        .alert-title-wrap { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; color: #9a6200; }
        .alert-title-wrap h4 { font-size: 13px; font-weight: 700; margin: 0; }
        .alert-counter { font-size: 11px; font-weight: 700; color: #8a5a00; text-align: right; margin-top: 4px; }

        /* ---------- Summary cards ---------- */
        .pd-bottom-row { display: flex; align-items: center; gap: 14px; margin-top: 12px; flex-wrap: wrap; }
        .pd-bottom-row .summary-dashboard-cards { flex: 1 1 340px; margin: 0; gap: 10px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .summary-card-3d {
          display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px;
          background: #ffffff; border: 1px solid var(--line); border-left: 4px solid var(--teal-mid);
        }
        .summary-card-3d.waste-fire { border-left-color: var(--brand); }
        .summary-card-3d.waste-gauge { border-left-color: var(--ok); }
        .summary-card-3d.waste-gauge.alert { border-left-color: var(--danger); }
        .summary-icon-3d {
          width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
        }
        .summary-icon-3d.orange { background: var(--brand-soft); color: var(--brand); border: 1px solid #f7d3c6; }
        .summary-icon-3d.green { background: #e4f6ee; color: #167a52; border: 1px solid #b7e4d0; }
        .summary-icon-3d.red { background: #fdecec; color: #b42323; border: 1px solid #f3c1c1; }
        .stat-subhead { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #000000; letter-spacing: 0.3px; }
        .stat-number-flex { display: flex; align-items: baseline; gap: 6px; margin-top: 2px; }
        .stat-big-num { font-size: 20px; font-weight: 800; color: #000000; }
        .stat-unit { font-size: 11px; font-weight: 700; color: #111827; }

        .save-button-centering { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 0; flex: 0 0 auto; }
        .cancel-edit-link { background: transparent; border: none; font-size: 12px; font-weight: 700; color: var(--danger); text-decoration: underline; cursor: pointer; }

        /* ---------- Table With Light Header & Black Text ---------- */
        .table-scroll-container-3d {
          width: 100%; overflow-x: auto; border-radius: 8px; border: 1px solid var(--line); background: #fff;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }
        .colorful-3d-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; min-width: 1100px; background: #ffffff; }
        
        /* ── LIGHT HEADER WITH BOLD BLACK TEXT ── */
        .colorful-3d-table thead th {
          background: #dbe5ed !important;
          color: #000000 !important;
          padding: 11px 8px; text-align: center; font-weight: 700; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.4px;
          border-bottom: 1px solid #b2c4d4 !important;
          border-right: 1px solid #b2c4d4 !important;
          white-space: nowrap;
        }
        .colorful-3d-table tbody td {
          padding: 8px 8px; text-align: center;
          border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;
          font-weight: 600; color: #000000 !important;
        }
        .colorful-3d-table tbody tr:nth-child(even) td { background: #fafbfc; }
        .colorful-3d-table tbody tr:hover td { background: var(--brand-soft); }

        .reel-tag-3d {
          display: inline-block; white-space: nowrap; padding: 3px 9px; border-radius: 4px; font-weight: 700; color: #000000;
          background: var(--teal-soft); border: 1px solid #bdd9df;
        }
        .waste-cell-danger { color: #dc2626 !important; font-weight: 800; }
        .balance-cell-emerald { color: #059669 !important; font-weight: 800; }
        .ratio-pill-3d { padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 11px; }
        .ratio-pill-3d.safe { background: #e4f6ee; color: #167a52; border: 1px solid #b7e4d0; }
        .ratio-pill-3d.danger { background: #fdecec; color: #b42323; border: 1px solid #f3c1c1; }
        .prodtype-tag-3d { padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .prodtype-tag-3d.makeready { background: #fff3d6; color: #8a5a00; }
        .prodtype-tag-3d.prod { background: var(--teal-soft); color: var(--teal-mid); }
        .btn-table-action-3d {
          display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 5px;
          font-family: inherit; font-size: 11.5px; font-weight: 700; border: 1px solid transparent; cursor: pointer; transition: all 0.15s ease;
        }
        .btn-table-action-3d.edit {
          background: #ffffff; color: var(--teal-mid); border-color: var(--teal-mid);
        }
        .btn-table-action-3d.edit:hover { background: var(--teal-mid); color: #ffffff; }
        .btn-table-action-3d.delete {
          background: #fdecec; color: #b42323; border-color: #f3c1c1;
        }
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
        .pd-left-big { font-size: 32px; font-weight: 700; line-height: 1.05; letter-spacing: -1px; }
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
        .pd-left-select {
          width: 100%; margin-top: 2px; padding: 6px 28px 6px 8px; border-radius: 6px; border: 1px solid transparent; outline: none;
          background-color: #ffffff; color: #000000; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
        }

        .pd-split-right { background: #ffffff; padding: 14px 22px 16px; }
        .pd-right-title { margin: 0; font-size: 16px; font-weight: 800; color: #000000; }
        .pd-right-rule { height: 1px; margin: 6px auto 2px; width: 100%; background: var(--line); }
        .pd-sub-head {
          margin: 10px 0 6px; font-size: 12px; font-weight: 800; color: #000000;
          padding-left: 8px; border-left: 3px solid var(--brand);
        }
        .pd-form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px; }

        .pd-iconfield { position: relative; }
        .pd-iconfield .input-inset-3d, .pd-iconfield .select-inset-3d { padding-left: 32px; }
        .pd-iconfield .select-inset-3d { padding-right: 28px !important; }
        .pd-ficon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: #4b5563; display: flex; pointer-events: none; }
        .pd-ficon svg { width: 14px; height: 14px; }

        @media (max-width: 1100px) {
          .pd-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .pd-split { grid-template-columns: 1fr; }
          .pd-split-right { padding: 16px 14px; }
        }
        @media (max-width: 600px) {
          .pd-form-grid, .pd-bottom-row .summary-dashboard-cards { grid-template-columns: 1fr; }
        }

        /* =====================================================================
           page entrance animation (appended, css only)
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

        /* page container (fade only) */
        .pd-root { animation: pgfade 0.45s ease-out backwards; }

        /* work order retrieval card */
        .pd-root .pd-glass {
          animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.12s backwards;
        }

        /* split form (plays when the work order is fetched) */
        .pd-root .pd-split {
          animation: pgpop 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s backwards;
        }
        .pd-root .pd-split-left {
          animation: pgslideright 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
        }
        .pd-root .pd-split-right .pd-right-title,
        .pd-root .pd-split-right .pd-sub-head,
        .pd-root .pd-split-right .pd-form-grid,
        .pd-root .pd-split-right .pd-bottom-row {
          animation: pgfadeup 0.45s ease-out backwards;
        }
        .pd-root .pd-split-right .pd-right-title { animation-delay: 0.25s; }
        .pd-root .pd-split-right .pd-sub-head    { animation-delay: 0.30s; }
        .pd-root .pd-split-right .pd-form-grid   { animation-delay: 0.36s; }
        .pd-root .pd-split-right .pd-bottom-row  { animation-delay: 0.50s; }

        /* reel register entries card (after the form) */
        .pd-root .pd-split ~ .pd-glass {
          animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.35s backwards;
        }

        /* table rows: quick stagger on the first rows */
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

        /* respect users who disable motion */
        @media (prefers-reduced-motion: reduce) {
          .pd-root,
          .pd-root * {
            animation: none !important;
          }
        }
      `}</style>

      <div className="pd-shell">
        {/* STEP 1: WORK ORDER RETRIEVAL */}
        <section className="pd-glass">
          <div className="card-heading-row">
            <div className="heading-with-icon">
              <div className="heading-icon-badge">
                <Icons.Search />
              </div>
              <h2>Work Order Retrieval</h2>
            </div>
            <span className="section-pill-tag">Step 1</span>
          </div>

          <div className="wo-search-flex">
            <div className="wo-input-box">
              <div className="field-3d-wrapper">
                <label className="label-3d">Work Order Number (WO)</label>
                <input
                  name="efiWoNumber"
                  placeholder="Enter WO Number (e.g. 104523)"
                  value={form.efiWoNumber}
                  onChange={handleChange}
                  className="input-inset-3d"
                />
              </div>
            </div>

            <div className="wo-date-box">
              <div className="field-3d-wrapper">
                <label className="label-3d">Production Date</label>
                <input
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                  className="input-inset-3d"
                />
              </div>
            </div>

            <button
              type="button"
              className="push-btn-3d push-btn-primary"
              onClick={fetchWO}
            >
              <Icons.Search /> Fetch Work Order
            </button>
          </div>
        </section>

        {/* SPLIT FORM */}
        {job && (
          <>
            <div className="pd-split">
              {/* LEFT (BLUE): FETCHED WORK ORDER */}
              <aside className="pd-split-left">
                <div className="pd-left-brand">
                  <Icons.Factory /> <span>Work Order</span>
                </div>

                <div className="pd-left-hero">
                  <div className="pd-left-kicker">Active WO</div>
                  <div className="pd-left-big">#{job.efiWoNumber || form.efiWoNumber}</div>
                  <div className="pd-left-sub">{job.customerName}</div>
                </div>

                <div className="pd-left-chips">
                  {hasMultipleMaterials && !materialSelected && (
                    <span className="pd-lchip warn">
                      Multiple materials – select a Material Description below
                    </span>
                  )}
                  {materialSelected && (
                    <span className="pd-lchip">Showing selected material only</span>
                  )}
                  <span className="pd-lchip ok">Verified Record</span>
                </div>

                <div className="pd-left-list">
                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.Calendar /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">WO Date</span>
                      <span className="pd-lvalue">
                        {new Date(job.date).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.User /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">Customer Name</span>
                      <span className="pd-lvalue">{job.customerName}</span>
                    </div>
                  </div>

                  <div className="pd-lrow wide">
                    <span className="pd-licon"><Icons.Factory /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">Job Description</span>
                      <span className="pd-lvalue">{job.jobDescription}</span>
                    </div>
                  </div>

                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.Scale /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">Job Size</span>
                      <span className="pd-lvalue">{job.jobSize || "-"}</span>
                    </div>
                  </div>

                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.Gauge /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">UPS</span>
                      <span className="pd-lvalue">
                        {job.ups && `${job.ups}`}
                        {job.machineUps && (
                          <>{job.ups ? ` | ${job.machineUps}` : job.machineUps}</>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.Reel /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">Paper Code</span>
                      <span className="pd-lvalue">
                        {displayMaterials.length > 0
                          ? displayMaterials.map((m, i) => (
                              <div key={i}>{m.materialCode || "-"}</div>
                            ))
                          : "-"}
                      </span>
                    </div>
                  </div>

                  <div className="pd-lrow wide">
                    <span className="pd-licon"><Icons.Search /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">Material Description</span>
                      {hasMultipleMaterials ? (
                        <select
                          name="materialDescription"
                          value={form.materialDescription || ""}
                          onChange={handleChange}
                          className="pd-left-select"
                        >
                          <option value="">Select Material</option>
                          {materialOptions.map((desc, i) => (
                            <option key={i} value={desc}>
                              {desc}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="pd-lvalue">
                          {displayMaterials.length > 0
                            ? displayMaterials.map((m, i) => (
                                <div key={i}>{m.materialDescription || "-"}</div>
                              ))
                            : "-"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.Scale /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">Material Group</span>
                      <span className="pd-lvalue">
                        {displayMaterials.length > 0
                          ? displayMaterials.map((m, i) => (
                              <div key={i}>{m.materialGroupDescription || "-"}</div>
                            ))
                          : "-"}
                      </span>
                    </div>
                  </div>

                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.Factory /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">Mill Name</span>
                      <span className="pd-lvalue">
                        {getUniqueMills(displayMaterials).length > 0
                          ? getUniqueMills(displayMaterials).map((mill, i) => (
                              <div key={i}>{mill}</div>
                            ))
                          : "-"}
                      </span>
                    </div>
                  </div>

                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.Gauge /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">GSM</span>
                      <span className="pd-lvalue">
                        {displayMaterials.length > 0
                          ? displayMaterials.map((m, i) => (
                              <div key={i}>{m.gsm ?? "-"}</div>
                            ))
                          : "-"}
                      </span>
                    </div>
                  </div>

                  <div className="pd-lrow">
                    <span className="pd-licon"><Icons.Reel /></span>
                    <div className="pd-lbody">
                      <span className="pd-llabel">Paper Size</span>
                      <span className="pd-lvalue">
                        {displayMaterials.length > 0
                          ? displayMaterials.map((m, i) => (
                              <div key={i}>{m.paperSize || "-"}</div>
                            ))
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </aside>

              {/* RIGHT (WHITE): ENTRY FIELDS */}
              <section className="pd-split-right">
                <h2 className="pd-right-title">Reel Register Entry</h2>
                <div className="pd-right-rule"></div>

                {editingReelId && (
                  <div className="pd-edit-chip">✎ Editing reel {form.reelNo}</div>
                )}

                <div className="pd-sub-head">Reel Specifications &amp; Weights</div>

                <div className="pd-form-grid">
                  <div className="field-3d-wrapper">
                    <label className="label-3d">WO Number (Reel)</label>
                    <IconField icon={Icons.Factory}>
                      <input
                        type="number"
                        name="reelWoNumber"
                        value={form.reelWoNumber}
                        onChange={handleChange}
                        placeholder="Matches active WO"
                        className="input-inset-3d"
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Invalid characters are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Reel No</label>
                    <IconField icon={Icons.Reel}>
                      <input
                        name="reelNo"
                        value={form.reelNo}
                        onChange={handleChange}
                        placeholder=" enter Reel No"
                        className="input-inset-3d"
                        onKeyDown={(e) => {
                          if (
                            !/^[a-zA-Z0-9\-\/\\]$/.test(e.key) &&
                            e.key !== "Backspace" &&
                            e.key !== "Delete" &&
                            e.key !== "ArrowLeft" &&
                            e.key !== "ArrowRight" &&
                            e.key !== "Tab"
                          ) {
                            e.preventDefault();
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <div className="label-3d">
                      <span>Gross Weight (KG)</span>
                      {autoFetchedNet && (
                        <span className="locked-tag-3d">
                          <Icons.Lock /> Locked
                        </span>
                      )}
                    </div>
                    <IconField icon={Icons.Scale}>
                      <input
                        type="number"
                        step="0.01"
                        name="grossWeight"
                        value={form.grossWeight}
                        onChange={handleChange}
                        readOnly={autoFetchedNet}
                        placeholder="0.00"
                        className={`input-inset-3d ${
                          autoFetchedNet ? "readonly-locked" : ""
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <div className="label-3d">
                      <span>Mill Net Weight (KG)</span>
                      {autoFetchedNet && (
                        <span className="locked-tag-3d">
                          <Icons.Lock /> Locked
                        </span>
                      )}
                    </div>
                    <IconField icon={Icons.Scale}>
                      <input
                        type="number"
                        step="0.01"
                        name="millNetWeight"
                        value={form.millNetWeight}
                        onChange={handleChange}
                        readOnly={autoFetchedNet}
                        placeholder="0.00"
                        className={`input-inset-3d ${
                          autoFetchedNet ? "readonly-locked" : ""
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <div className="label-3d">
                      <span>Actual Net Weight (KG)</span>
                      {autoFetchedNet && (
                        <span className="locked-tag-3d">
                          <Icons.Lock /> Synced
                        </span>
                      )}
                    </div>
                    <IconField icon={Icons.Scale}>
                      <input
                        type="number"
                        name="actualNetWeight"
                        value={form.actualNetWeight}
                        onChange={handleChange}
                        readOnly={autoFetchedNet}
                        placeholder="0.00"
                        className={`input-inset-3d ${
                          autoFetchedNet ? "readonly-locked" : ""
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Actual GSM</label>
                    <IconField icon={Icons.Gauge}>
                      <input
                        type="number"
                        name="actualGsm"
                        value={form.actualGsm}
                        onChange={handleChange}
                        placeholder="e.g. 120"
                        className="input-inset-3d"
                        onInput={(e) => {
                          if (e.target.value.length > 3) {
                            showAlert("Only 5 digits allowed", "error");
                            e.target.value = e.target.value.slice(0, 3);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Production Output</label>
                    <IconField icon={Icons.Factory}>
                      <input
                        type="number"
                        min="0"
                        name="productionOutput"
                        value={form.productionOutput}
                        onChange={handleChange}
                        placeholder="Units / output"
                        className="input-inset-3d"
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Reel Balance (KG)</label>
                    <IconField icon={Icons.Scale}>
                      <input
                        type="number"
                        name="balance"
                        value={form.balance}
                        onChange={(e) => {
                          const value = e.target.value;
                          const actualNet = Number(form.actualNetWeight || 0);
                          const balanceValue = Number(value || 0);

                          if (balanceValue > actualNet) {
                            showAlert(
                              "Balance cannot be greater than Actual Net Weight",
                              "error"
                            );
                            return;
                          }
                          handleChange(e);
                        }}
                        placeholder="0.00"
                        className="input-inset-3d"
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Mill Name</label>
                    <IconField icon={Icons.Factory}>
                      <select
                        name="mill"
                        value={form.mill || ""}
                        onChange={handleChange}
                        className="select-inset-3d"
                      >
                        <option value="">Select Mill</option>
                        {(form.productionType === "Make Ready"
                          ? mills
                          : getUniqueMills(displayMaterials)
                        )?.map((m, i) => (
                          <option key={i} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Production Type</label>
                    <IconField icon={Icons.Gauge}>
                      <select
                        name="productionType"
                        value={form.productionType}
                        onChange={handleChange}
                        className="select-inset-3d"
                      >
                        <option value="">Select Type</option>
                        <option value="Make Ready">Make Ready</option>
                        <option value="Production">Production</option>
                      </select>
                    </IconField>
                  </div>
                </div>

                <div className="pd-sub-head">Reel Waste Details (KG)</div>

                <div className="pd-form-grid">
                  <div className="field-3d-wrapper">
                    <label className="label-3d">Reel Matt Waste</label>
                    <IconField icon={Icons.Flame}>
                      <input
                        type="number"
                        min="0"
                        name="mattWaste"
                        value={form.mattWaste}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="input-inset-3d"
                        onInput={(e) => {
                          if (e.target.value.length > 5) {
                            showAlert("Only 2 digits allowed", "error");
                            e.target.value = e.target.value.slice(0, 5);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Reel Print Waste</label>
                    <IconField icon={Icons.Flame}>
                      <input
                        type="number"
                        min="0"
                        name="printWaste"
                        value={form.printWaste}
                        placeholder="0.00"
                        className="input-inset-3d"
                        onInput={(e) => {
                          if (e.target.value.length > 5) {
                            showAlert("Only 5 digits allowed", "error");
                            e.target.value = e.target.value.slice(0, 5);
                          }
                        }}
                        onChange={handleChange}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Reel End Waste</label>
                    <IconField icon={Icons.Flame}>
                      <input
                        type="number"
                        min="0"
                        name="realEndWaste"
                        value={form.realEndWaste}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="input-inset-3d"
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>

                  <div className="field-3d-wrapper">
                    <label className="label-3d">Reel Core Waste</label>
                    <IconField icon={Icons.Flame}>
                      <input
                        type="number"
                        min="0"
                        name="coreWeight"
                        value={form.coreWeight}
                        placeholder="0.00"
                        className="input-inset-3d"
                        onInput={(e) => {
                          if (e.target.value.length > 5) {
                            showAlert("Only 5 digits allowed", "error");
                            e.target.value = e.target.value.slice(0, 5);
                          }
                        }}
                        onChange={handleChange}
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "+" || e.key === "e") {
                            e.preventDefault();
                            showAlert("Negative values are not allowed", "error");
                          }
                        }}
                      />
                    </IconField>
                  </div>
                </div>

                {remarksRequired && (
                  <div className="waste-alert-banner-3d">
                    <div className="alert-title-wrap">
                      <Icons.Alert />
                      <h4>Excessive Waste Recorded ({wastePercent}%)</h4>
                    </div>
                    <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#92400e" }}>
                      Waste exceeds the allowed 15% threshold. Please supply a clear reason (minimum 10 alphanumeric characters).
                    </p>
                    <input
                      type="text"
                      placeholder="Enter reason for elevated wastage..."
                      value={remarks}
                      className="input-inset-3d"
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(
                          /[^a-zA-Z0-9 ]/g,
                          ""
                        );
                        setRemarks(cleanValue);
                      }}
                      onKeyDown={(e) => {
                        if (
                          !/^[a-zA-Z0-9 ]$/.test(e.key) &&
                          e.key !== "Backspace" &&
                          e.key !== "Delete" &&
                          e.key !== "ArrowLeft" &&
                          e.key !== "ArrowRight" &&
                          e.key !== "Tab"
                        ) {
                          e.preventDefault();
                          showAlert("Special characters are not allowed", "error");
                        }
                      }}
                    />
                    <div className="alert-counter">
                      {remarks.length} / 10 min chars
                    </div>
                  </div>
                )}

                <div className="pd-bottom-row">
                  <div className="summary-dashboard-cards">
                    <div className="summary-card-3d waste-fire">
                      <div className="summary-icon-3d orange">
                        <Icons.Flame />
                      </div>
                      <div className="summary-stat-group">
                        <div className="stat-subhead">Total Waste Accumulated</div>
                        <div className="stat-number-flex">
                          <span className="stat-big-num">{TotalWaste}</span>
                          <span className="stat-unit">KG</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`summary-card-3d waste-gauge ${
                        Number(wastePercent) > 15 ? "alert" : ""
                      }`}
                    >
                      <div
                        className={`summary-icon-3d ${
                          Number(wastePercent) > 15 ? "red" : "green"
                        }`}
                      >
                        <Icons.Gauge />
                      </div>
                      <div className="summary-stat-group">
                        <div className="stat-subhead">Waste Percentage</div>
                        <div className="stat-number-flex">
                          <span
                            className="stat-big-num"
                            style={{
                              color:
                                Number(wastePercent) > 15 ? "#dc2626" : "#059669"
                            }}
                          >
                            {wastePercent}%
                          </span>
                          <span
                            className={`ratio-pill-3d ${
                              Number(wastePercent) > 15 ? "danger" : "safe"
                            }`}
                            style={{ marginLeft: "auto" }}
                          >
                            {Number(wastePercent) > 15 ? "High" : "Optimal"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="save-button-centering">
                    <button
                      type="button"
                      className={`push-btn-3d push-btn-hero-save ${
                        editingReelId ? "push-btn-edit-mode" : ""
                      }`}
                      onClick={save}
                    >
                      {editingReelId ? <Icons.Edit /> : <Icons.Save />}
                      <span>{editingReelId ? "Update Reel Record" : "Save Reel Record"}</span>
                    </button>

                    {editingReelId && (
                      <button
                        type="button"
                        className="cancel-edit-link"
                        onClick={() => {
                          setEditingReelId(null);
                          setForm({
                            ...emptyForm,
                            efiWoNumber: form.efiWoNumber,
                            mill: form.mill,
                            materialDescription: form.materialDescription
                          });
                        }}
                      >
                        Cancel Editing
                      </button>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* REEL REGISTER ENTRIES */}
            <section className="pd-glass">
              <div className="card-heading-row">
                <div className="heading-with-icon">
                  <div className="heading-icon-badge" style={{ background: "radial-gradient(circle at 30% 25%, #b4f5d0, #10b981 50%, #047857)" }}>
                    <Icons.Reel />
                  </div>
                  <h2>Reel Register Entries ({reels.length})</h2>
                </div>
              </div>

              <div className="table-scroll-container-3d">
                <table className="colorful-3d-table">
                  <thead>
                    <tr>
                      <th>Reel No</th>
                      <th>Gross Wt</th>
                      <th>Mill Net</th>
                      <th>Actual Net</th>
                      <th>GSM</th>
                      <th>Output</th>
                      <th>Matt Wst</th>
                      <th>Print Wst</th>
                      <th>End Wst</th>
                      <th>Core Wst</th>
                      <th>Total Waste</th>
                      <th>Waste %</th>
                      <th>Balance</th>
                      <th>Mill</th>
                      <th>Type</th>
                      <th>Entered By</th>
                      <th>Remarks</th>
                      <th>Location</th>
                      <th>Action</th>
                      <th>Delete</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reels.length === 0 ? (
                      <tr>
                        <td colSpan="20" style={{ padding: "30px", color: "#000000" }}>
                          No reel records found for this Work Order
                        </td>
                      </tr>
                    ) : (
                      [...reels]
                        .sort(
                          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                        )
                        .map((r) => {
                          const itemTotalWaste =
                            r.mattWaste +
                            r.printWaste +
                            r.realEndWaste +
                            r.coreWeight;

                          const itemNetAfterBal =
                            Number(r.actualNetWeight || 0) -
                            Number(r.balance || 0);

                          const itemWastePct =
                            itemNetAfterBal > 0
                              ? ((itemTotalWaste / itemNetAfterBal) * 100).toFixed(2)
                              : 0;

                          const isOwner =
                            loggedInUser &&
                            r.productionUser?.trim() === loggedInUser.trim();

                          return (
                            <tr key={r._id}>
                              <td>
                                <span className="reel-tag-3d">{r.reelNo}</span>
                              </td>
                              <td>{r.grossWeight}</td>
                              <td>{r.millNetWeight}</td>
                              <td style={{ fontWeight: 800 }}>{r.actualNetWeight}</td>
                              <td>{r.actualGsm}</td>
                              <td>{r.productionOutput}</td>
                              <td>{r.mattWaste}</td>
                              <td>{r.printWaste}</td>
                              <td>{r.realEndWaste}</td>
                              <td>{r.coreWeight}</td>

                              <td className="waste-cell-danger">
                                {Number(itemTotalWaste || 0).toFixed(2)}
                              </td>

                              <td>
                                <span
                                  className={`ratio-pill-3d ${
                                    Number(itemWastePct) > 15 ? "danger" : "safe"
                                  }`}
                                >
                                  {Number(itemWastePct || 0).toFixed(2)}%
                                </span>
                              </td>

                              <td className="balance-cell-emerald">{r.balance}</td>

                              <td>{r.mill || "-"}</td>

                              <td>
                                <span
                                  className={`prodtype-tag-3d ${
                                    r.productionType === "Make Ready"
                                      ? "makeready"
                                      : "prod"
                                  }`}
                                >
                                  {r.productionType}
                                </span>
                              </td>

                              <td>
                                <div style={{ fontWeight: 800, color: "#000000" }}>{r.productionUser || "-"}</div>
                                <small style={{ color: "#1f2937", fontSize: "10px", fontWeight: 600 }}>
                                  {new Date(r.createdAt).toLocaleDateString("en-IN")}{" "}
                                  {new Date(r.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </small>
                              </td>

                              <td
                                style={{
                                  cursor: "pointer",
                                  color: "#0a6fb8",
                                  whiteSpace:
                                    expandedCell === `remarks-${r._id}`
                                      ? "normal"
                                      : "nowrap"
                                }}
                                onClick={() =>
                                  setExpandedCell(
                                    expandedCell === `remarks-${r._id}`
                                      ? null
                                      : `remarks-${r._id}`
                                  )
                                }
                              >
                                {expandedCell === `remarks-${r._id}`
                                  ? r.remarks || "-"
                                  : truncateText(r.remarks)}
                              </td>

                              <td style={{ fontSize: "11px", color: "#000000", fontWeight: 600 }}>
                                {r.userLocations?.filter(Boolean).length > 0
                                  ? r.userLocations.filter(Boolean).join(", ")
                                  : "-"}
                              </td>

                              <td>
                                {isOwner ? (
                                  <button
                                    type="button"
                                    className="btn-table-action-3d edit"
                                    onClick={() => {
                                      setEditingReelId(r._id);
                                      setForm({
                                        efiWoNumber: r.efiWoNumber,
                                        reelWoNumber: r.efiWoNumber,
                                        reelNo: r.reelNo,
                                        grossWeight: r.grossWeight,
                                        millNetWeight: r.millNetWeight,
                                        actualNetWeight: r.actualNetWeight,
                                        actualGsm: r.actualGsm,
                                        productionOutput: r.productionOutput,
                                        mattWaste: r.mattWaste,
                                        printWaste: r.printWaste,
                                        realEndWaste: r.realEndWaste,
                                        coreWeight: r.coreWeight,
                                        balance: r.balance,
                                        mill: r.mill,
                                        productionType: r.productionType,
                                        materialDescription:
                                          r.materialDescription ||
                                          getDefaultMaterial(job)
                                      });

                                      setProductionDate(
                                        new Date(r.productionDate)
                                          .toISOString()
                                          .slice(0, 10)
                                      );

                                      setRemarks(r.remarks || "");
                                      setAutoFetchedNet(false);

                                      window.scrollTo({
                                        top: 300,
                                        behavior: "smooth"
                                      });
                                    }}
                                  >
                                    <Icons.Edit /> Edit
                                  </button>
                                ) : (
                                  "-"
                                )}
                              </td>

                              <td>
                                {isOwner ? (
                                  <button
                                    type="button"
                                    className="btn-table-action-3d delete"
                                    onClick={() => deleteReel(r._id)}
                                  >
                                    <Icons.Trash /> Del
                                  </button>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default Productiondashboard;