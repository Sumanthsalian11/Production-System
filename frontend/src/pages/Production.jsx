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

// Unique, non-empty material descriptions of a work order
const getMaterialOptions = (jobData) => [
  ...new Set(
    (jobData?.materials || [])
      .map((m) => m.materialDescription)
      .filter(Boolean)
  )
];

// If the WO has exactly one material description → that is the default
const getDefaultMaterial = (jobData) => {
  const opts = getMaterialOptions(jobData);
  return opts.length === 1 ? opts[0] : "";
};

// All material rows that belong to the given description
// (no description selected → all rows of the work order)
const getRelatedMaterials = (jobData, description) => {
  const all = jobData?.materials || [];
  if (!description) return all;
  const matched = all.filter((m) => m.materialDescription === description);
  return matched.length > 0 ? matched : all;
};

// Unique mills of a list of material rows
const getUniqueMills = (materialRows) => [
  ...new Set((materialRows || []).map((m) => m.mill).filter(Boolean))
];

// 🎨 presentation helper: puts one of the existing icons inside an input
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
  const [fetchedWo, setFetchedWo] = useState(null); // WO number that was actually fetched

  // ✅ MATERIAL DERIVED VALUES
  // The material description in use: what the operator picked, or the only one available
  const activeMaterialDescription =
    form.materialDescription || getDefaultMaterial(job);

  // Rows shown in the spec sheet + used for Mill options
  // (selected material → only its rows, otherwise every row of the WO)
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

    // ✅ SKIP ALL VALIDATION FOR REEL NO — handle separately
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

    // ✅ MATERIAL DESCRIPTION — skip numeric validation and sync the related Mill
    if (name === "materialDescription") {
      const related = getRelatedMaterials(job, value);
      const relatedMills = getUniqueMills(related);

      setForm((prev) => {
        let nextMill = prev.mill;

        // For Make Ready the operator picks from all mills, so don't override it
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

    // ✅ FETCH MILL ONLY FOR MAKE READY
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

    // ✅ Skip validation for productionDate
    if (name !== "productionDate") {
      // 🚫 Block minus & negative values
      if (value.includes("-") || (!isNaN(value) && Number(value) < 0)) {
        showAlert("Negative values are not allowed", "error");
        return;
      }

      if (
        name === "grossWeight" ||
        name === "millNetWeight" ||
        name === "actualNetWeight"
      ) {
        // 🚫 Max 3 digits before decimal & 2 after
        if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) {
          showAlert("Max 3 digits before decimal & 2 after decimal allowed", "error");
          return;
        }

        // 🚫 Actual Net should not exceed Gross
        if (name === "actualNetWeight") {
          const gross = Number(form.grossWeight || 0);
          const actual = Number(value || 0);

          if (gross && actual > gross) {
            showAlert("Actual Net Weight cannot be greater than Gross Weight", "error");
            return;
          }
        }
      }

      // ✅ DIGIT LIMIT RULES
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

    // 🚨 Matt Waste → max 2 digits + 2 decimal
    if (name === "mattWaste") {
      if (
        value.includes("+") ||
        value.includes("-") ||
        value.toLowerCase().includes("e")
      ) {
        showAlert("Invalid characters are not allowed", "error");
        return;
      }

      if (!/^\d{0,2}(\.\d{0,2})?$/.test(value)) {
        showAlert("Matt Waste: Max 2 digits and 2 decimal places allowed", "error");
        return;
      }
    }

    // 🚨 Core Weight → max 1 digit + 2 decimal
    if (name === "coreWeight") {
      if (
        value.includes("+") ||
        value.includes("-") ||
        value.toLowerCase().includes("e")
      ) {
        showAlert("Invalid characters are not allowed", "error");
        return;
      }

      if (!/^\d{0,1}(\.\d{0,2})?$/.test(value)) {
        showAlert("Core Weight: Max 1 digit and 2 decimal places allowed", "error");
        return;
      }
    }

    // 🚨 NEW rule ONLY for printWaste & realEndWaste
    if (name === "printWaste" || name === "realEndWaste") {
      if (
        value.includes("+") ||
        value.includes("-") ||
        value.toLowerCase().includes("e")
      ) {
        showAlert("Invalid characters are not allowed", "error");
        return;
      }

      if (!/^\d{0,2}(\.\d{0,2})?$/.test(value)) {
        showAlert("Maximum 2 digits and 2 decimal places allowed", "error");
        return;
      }
    }

    // 🚫 Balance cannot be greater than Actual Net Weight
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

  // FETCH WORK ORDER
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

      // ✅ auto-select mill + material description if only one material exists
      if (woData.materials && woData.materials.length === 1) {
        setForm((prev) => ({
          ...prev,
          mill: woData.materials[0].mill || "",
          materialDescription: woData.materials[0].materialDescription || ""
        }));
      } else {
        // multiple materials → operator must choose from the dropdown
        // (if all rows share the same description it is auto-selected)
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

  // CALCULATIONS
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

  // SAVE PRODUCTION
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

    // ✅ Material Description: required when the WO has more than one option
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

      // keep WO, mill and material selection for the next reel
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
          PROFESSIONAL TEAL / ORANGE ENTERPRISE THEME (scoped, injected in this single page)
          ====================================================================== */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');

        /* ---------- Theme tokens ---------- */
        .pd-root {
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

        /* ---------- Page ---------- */
        .pd-root {
          min-height: 100vh;
          padding: 24px 28px 40px;
          box-sizing: border-box;
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
          font-size: 14px;
          color: var(--ink);
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
          gap: 16px;
          margin-bottom: 18px;
          padding: 14px 22px;
          border-radius: 8px;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
        }
        .hero-left-branding { display: flex; align-items: center; gap: 14px; }
        .hero-emblem-3d {
          width: 40px; height: 40px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: var(--brand);
          background: var(--brand-soft);
          border: 1px solid #f7d3c6;
          box-shadow: none;
        }
        .hero-titles h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.2px; color: var(--ink); }
        .hero-titles p { margin: 2px 0 0; font-size: 12.5px; font-weight: 500; color: var(--ink-mute); }
        .hero-right-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .operator-pill-3d {
          display: flex; align-items: center; gap: 8px; padding: 5px 12px;
          border-radius: 30px; font-size: 13px; font-weight: 600; color: var(--ink);
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: none;
        }
        .operator-pulse-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--ok); box-shadow: 0 0 0 3px rgba(31, 157, 107, 0.18); animation: glowPulse 2s infinite;
        }
        @keyframes glowPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
        .calendar-control-3d {
          display: flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 6px;
          color: var(--ink);
          background: var(--surface);
          border: 1px solid var(--field-line);
          box-shadow: none;
        }
        .calendar-control-3d input {
          border: none; background: transparent; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--ink); outline: none;
        }

        /* ---------- Cards ---------- */
        .pd-glass {
          position: relative;
          border-radius: 8px;
          padding: 20px 22px;
          margin-bottom: 18px;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
          overflow: hidden;
        }
        .pd-glass::before { content: none; }
        .pd-glass > * { position: relative; }

        .pd-edit-chip {
          display: inline-block; margin-bottom: 14px;
          font-size: 12px; font-weight: 700; padding: 5px 14px; border-radius: 4px;
          color: #8a5a00; background: #fff3d6;
          border: 1px solid #f2d291;
        }

        /* ---------- Section headings ---------- */
        .radiant-card-3d { background: transparent; border: none; box-shadow: none; padding: 0; margin: 0; }
        .card-heading-row {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--line);
        }
        .heading-with-icon { display: flex; align-items: center; gap: 10px; }
        .heading-icon-badge,
        .heading-icon-badge.blue,
        .heading-icon-badge.purple,
        .heading-icon-badge.amber {
          width: 34px; height: 34px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: var(--brand) !important;
          background: var(--brand-soft) !important;
          border: 1px solid #f7d3c6;
          box-shadow: none;
        }
        .card-heading-row h2 { font-size: 16px; font-weight: 700; margin: 0; color: var(--ink); }
        .section-pill-tag {
          font-size: 11px; font-weight: 700; padding: 4px 11px; border-radius: 4px;
          text-transform: uppercase; letter-spacing: 0.5px;
          background: var(--teal-soft); color: var(--teal-mid); border: 1px solid #bdd9df;
        }
        .section-pill-tag.purple { color: var(--teal-mid); border-color: #bdd9df; background: var(--teal-soft); }
        .section-pill-tag.amber { color: #8a5a00; border-color: #f2d291; background: #fff3d6; }

        /* ---------- WO search ---------- */
        .wo-search-flex { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .wo-input-box { flex: 1; min-width: 250px; }
        .wo-date-box { flex: 0 0 210px; }

        /* ---------- Inputs ---------- */
        .field-3d-wrapper { display: flex; flex-direction: column; gap: 6px; }
        .label-3d {
          font-size: 11.5px; font-weight: 600; color: var(--ink-soft); letter-spacing: 0.3px; text-transform: uppercase;
          display: flex; justify-content: space-between; align-items: center;
        }
        .input-inset-3d, .select-inset-3d {
          width: 100%; padding: 10px 14px; border-radius: 6px;
          border: 1px solid var(--field-line); background: #ffffff;
          font-family: inherit; font-size: 14px; font-weight: 500; color: var(--ink); outline: none; box-sizing: border-box;
          box-shadow: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .select-inset-3d { cursor: pointer; }
        .input-inset-3d:focus, .select-inset-3d:focus {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }
        .input-inset-3d.readonly-locked {
          background: #f7f9fb;
          color: var(--ink-soft); border-color: var(--line); cursor: not-allowed;
          box-shadow: none;
        }
        .input-inset-3d::placeholder { color: var(--ink-mute); font-weight: 400; }

        /* ---------- Buttons (flat) ---------- */
        .push-btn-3d {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px 22px; border-radius: 6px; font-family: inherit; font-size: 14px; font-weight: 600;
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
          transform: none; background: var(--brand-dark); border-color: var(--brand-dark);
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .push-btn-primary:active:not(:disabled) { transform: translateY(1px); box-shadow: none; }
        .push-btn-hero-save {
          min-width: 240px; padding: 14px 32px; font-size: 15px; color: #ffffff; text-shadow: none;
          background: var(--brand); border-color: var(--brand);
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }
        .push-btn-hero-save:hover { transform: none; background: var(--brand-dark); border-color: var(--brand-dark); box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35); }
        .push-btn-hero-save:active { transform: translateY(1px); box-shadow: none; }
        .push-btn-edit-mode {
          background: var(--teal); border-color: var(--teal);
          box-shadow: 0 1px 2px rgba(11, 58, 69, 0.35);
        }
        .push-btn-edit-mode:hover { background: #072a33 !important; border-color: #072a33 !important; }

        /* ---------- Spec sheet ---------- */
        .locked-tag-3d {
          display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700;
          padding: 2px 7px; border-radius: 4px; background: #e4f6ee; color: #167a52; border: 1px solid #b7e4d0;
          text-transform: none; letter-spacing: 0;
        }

        /* ---------- Waste alert ---------- */
        .waste-alert-banner-3d {
          margin-top: 18px; padding: 16px; border-radius: 8px;
          background: #fff8e8;
          border: 1px solid #f2d291; box-shadow: none;
        }
        .alert-title-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; color: #9a6200; }
        .alert-title-wrap h4 { font-size: 15px; font-weight: 700; margin: 0; }
        .alert-counter { font-size: 11px; font-weight: 700; color: #8a5a00; text-align: right; margin-top: 4px; }

        /* ---------- Summary cards ---------- */
        .summary-dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-bottom: 8px; }
        .summary-card-3d {
          display: flex; align-items: center; gap: 16px; padding: 18px; border-radius: 8px;
          background: #ffffff; border: 1px solid var(--line); border-left: 4px solid var(--teal-mid);
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }
        .summary-card-3d.waste-fire { border-color: var(--line); border-left-color: var(--brand); background: #ffffff; }
        .summary-card-3d.waste-gauge { border-color: var(--line); border-left-color: var(--ok); background: #ffffff; }
        .summary-card-3d.waste-gauge.alert { border-color: var(--line); border-left-color: var(--danger); background: #ffffff; }
        .summary-icon-3d {
          width: 46px; height: 46px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff;
          box-shadow: none;
        }
        .summary-icon-3d.orange { background: var(--brand-soft); color: var(--brand); border: 1px solid #f7d3c6; }
        .summary-icon-3d.green { background: #e4f6ee; color: #167a52; border: 1px solid #b7e4d0; }
        .summary-icon-3d.red { background: #fdecec; color: #b42323; border: 1px solid #f3c1c1; }
        .summary-stat-group { flex: 1; }
        .stat-subhead { font-size: 11.5px; font-weight: 600; text-transform: uppercase; color: var(--ink-soft); letter-spacing: 0.4px; }
        .stat-number-flex { display: flex; align-items: baseline; gap: 6px; margin-top: 3px; }
        .stat-big-num { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; color: var(--ink); }
        .stat-unit { font-size: 13px; font-weight: 600; color: var(--ink-mute); }

        .save-button-centering { display: flex; flex-direction: column; align-items: center; gap: 12px; margin: 26px 0 6px; }
        .cancel-edit-link { background: transparent; border: none; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--danger); text-decoration: underline; cursor: pointer; }

        /* ---------- Table ---------- */
        .table-scroll-container-3d {
          width: 100%; overflow-x: auto; border-radius: 8px; border: 1px solid var(--line); background: #fff;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }
        .table-scroll-container-3d::-webkit-scrollbar { height: 8px; width: 8px; }
        .table-scroll-container-3d::-webkit-scrollbar-thumb { background: #c5ccd5; border-radius: 8px; }
        .table-scroll-container-3d::-webkit-scrollbar-track { background: #f1f3f6; }
        .colorful-3d-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; min-width: 1100px; background: #ffffff; }
        .colorful-3d-table thead th {
          background: #f7f9fb;
          color: var(--ink-soft); padding: 12px 8px; text-align: center; font-weight: 700; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid var(--line); white-space: nowrap;
          text-shadow: none;
        }
        .colorful-3d-table tbody td {
          padding: 10px 8px; text-align: center; border-bottom: 1px solid var(--line-soft); border-right: 1px solid #f6f8fa;
          font-weight: 500; color: var(--ink);
        }
        .colorful-3d-table tbody tr:nth-child(even) td { background: #fafbfc; }
        .colorful-3d-table tbody tr:hover td { background: var(--brand-soft); }
        .colorful-3d-table tbody td[style*="cursor: pointer"] { color: var(--teal-mid) !important; font-weight: 600; }
        .reel-tag-3d {
          display: inline-block; white-space: nowrap; padding: 3px 10px; border-radius: 4px; font-weight: 700; color: var(--teal-mid);
          background: var(--teal-soft); border: 1px solid #bdd9df;
        }
        .waste-cell-danger { color: #c0392b; font-weight: 700; }
        .balance-cell-emerald { color: #167a52; font-weight: 700; }
        .ratio-pill-3d { padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; }
        .ratio-pill-3d.safe { background: #e4f6ee; color: #167a52; border: 1px solid #b7e4d0; }
        .ratio-pill-3d.danger { background: #fdecec; color: #b42323; border: 1px solid #f3c1c1; }
        .prodtype-tag-3d { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .prodtype-tag-3d.makeready { background: #fff3d6; color: #8a5a00; }
        .prodtype-tag-3d.prod { background: var(--teal-soft); color: var(--teal-mid); }
        .btn-table-action-3d {
          display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: 6px;
          font-family: inherit; font-size: 11.5px; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: all 0.15s ease; color: #fff;
        }
        .btn-table-action-3d.edit {
          background: #ffffff; color: var(--teal-mid); border-color: var(--teal-mid);
          box-shadow: none;
        }
        .btn-table-action-3d.edit:hover { background: var(--teal-mid); color: #ffffff; }
        .btn-table-action-3d.delete {
          background: #fdecec; color: #b42323; border-color: #f3c1c1;
          box-shadow: none;
        }
        .btn-table-action-3d.delete:hover { background: #f9d4d4; }
        .btn-table-action-3d:hover { transform: none; }

        /* ---------- Responsive ---------- */
        @media (max-width: 768px) {
          .pd-root { padding: 14px; }
          .dash-hero-header { flex-direction: column; align-items: flex-start; }
          .hero-right-controls { width: 100%; justify-content: space-between; }
          .wo-search-flex { flex-direction: column; align-items: stretch; }
          .push-btn-3d { width: 100%; }
          .pd-glass { padding: 16px; }
        }

        /* ---------- Split form: teal (fetched WO) | white (entry) ---------- */
        .pd-split {
          display: grid; grid-template-columns: minmax(300px, 36%) 1fr;
          border-radius: 8px; overflow: hidden; margin-bottom: 18px; background: #ffffff;
          border: 1px solid var(--line);
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.07);
        }
        .pd-split-left {
          position: relative; overflow: hidden; padding: 26px 24px; color: #ffffff;
          background: linear-gradient(170deg, #0b3a45 0%, #0f5560 100%);
        }
        .pd-split-left::before {
          content: ''; position: absolute; width: 260px; height: 260px; border-radius: 50%;
          right: -110px; top: -90px; background: rgba(255, 255, 255, 0.06);
        }
        .pd-split-left::after {
          content: ''; position: absolute; width: 200px; height: 200px; border-radius: 50%;
          left: -90px; bottom: -80px; background: rgba(228, 87, 46, 0.18);
        }
        .pd-split-left > * { position: relative; z-index: 1; }
        .pd-left-brand { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #ffb59c; }
        .pd-left-hero { margin: 26px 0 12px; }
        .pd-left-kicker { font-size: 11.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #c9dde1; opacity: 1; }
        .pd-left-big { font-size: 44px; font-weight: 700; line-height: 1.05; letter-spacing: -1px; word-break: break-all; }
        .pd-left-sub { margin-top: 6px; font-size: 14px; font-weight: 500; color: #c9dde1; opacity: 1; }
        .pd-left-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
        .pd-lchip {
          font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 4px;
          background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.28); color: #fff;
        }
        .pd-lchip.ok { background: rgba(31, 157, 107, 0.35); border-color: rgba(120, 220, 175, 0.5); }
        .pd-lchip.warn { background: rgba(228, 87, 46, 0.35); border-color: rgba(255, 181, 156, 0.55); }
        .pd-left-list { display: flex; flex-direction: column; }
        .pd-lrow { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.14); }
        .pd-lrow:last-child { border-bottom: none; }
        .pd-licon {
          flex: 0 0 32px; width: 32px; height: 32px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center; color: #ffb59c;
          background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .pd-licon svg { width: 16px; height: 16px; }
        .pd-lbody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .pd-llabel { font-size: 10px; font-weight: 600; letter-spacing: 0.7px; text-transform: uppercase; color: #9fc0c7; }
        .pd-lvalue { font-size: 14px; font-weight: 600; color: #ffffff; word-break: break-word; }
        .pd-left-select {
          width: 100%; margin-top: 2px; padding: 8px 30px 8px 10px; border-radius: 6px; border: 1px solid transparent; outline: none;
          background-color: #ffffff; color: var(--ink); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; background-size: 14px;
        }
        .pd-left-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(228, 87, 46, 0.25); }

        .pd-split-right { background: #ffffff; padding: 26px 32px 28px; }
        .pd-right-title { margin: 0; text-align: left; font-size: 18px; font-weight: 700; letter-spacing: 0; text-transform: none; color: var(--ink); }
        .pd-right-rule { height: 1px; margin: 10px auto 6px; width: 100%; background: var(--line); }
        .pd-sub-head {
          margin: 20px 0 10px; font-size: 13px; font-weight: 700; color: var(--ink);
          padding-left: 8px; border-left: 3px solid var(--brand);
        }
        .pd-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
        .pd-edit-chip { margin: 6px 0 0; }

        .pd-split-right .label-3d { font-size: 11px; font-weight: 600; color: var(--ink-soft); }
        .pd-split-right .input-inset-3d,
        .pd-split-right .select-inset-3d {
          border-radius: 6px; border: 1px solid var(--field-line); box-shadow: none;
          padding: 10px 12px; font-size: 13.5px; font-weight: 500; background-color: #ffffff;
        }
        .pd-split-right .input-inset-3d:focus,
        .pd-split-right .select-inset-3d:focus { border-color: var(--teal-mid); box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15); }
        .pd-split-right .input-inset-3d.readonly-locked { background: #f7f9fb; }
        .pd-iconfield { position: relative; }
        .pd-iconfield .input-inset-3d, .pd-iconfield .select-inset-3d { padding-left: 38px; }
        .pd-ficon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--ink-mute); display: flex; pointer-events: none; }
        .pd-ficon svg { width: 16px; height: 16px; }

        /* ---------- Small field icons (CSS-only) ---------- */
        .select-inset-3d {
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; background-size: 14px;
          padding-right: 32px !important;
        }
        .wo-input-box .input-inset-3d {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M21 21l-4.3-4.3'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: 11px center; background-size: 15px;
          padding-left: 34px;
        }
        .wo-date-box .input-inset-3d {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cpath d='M16 2v4M8 2v4M3 10h18'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: 11px center; background-size: 15px;
          padding-left: 34px;
        }

        .pd-split-right .summary-dashboard-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .pd-split-right .summary-card-3d { padding: 14px; gap: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06); }
        .pd-split-right .summary-icon-3d { width: 42px; height: 42px; }
        .pd-split-right .stat-big-num { font-size: 24px; }
        .pd-split-right .save-button-centering { margin: 22px 0 0; }
        .pd-split-right .push-btn-hero-save {
          width: 100%; max-width: 340px; min-width: 0; padding: 12px 24px; font-size: 14.5px; letter-spacing: 0.3px;
        }

        @media (max-width: 900px) {
          .pd-split { grid-template-columns: 1fr; }
          .pd-form-grid, .pd-split-right .summary-dashboard-cards { grid-template-columns: 1fr; }
          .pd-split-right { padding: 22px 18px; }
          .pd-left-big { font-size: 36px; }
        }

        /* ---------- COMPACT MODE: whole form fits on the first screen ---------- */
        .pd-root { padding: 14px 18px 28px; }
        .dash-hero-header { padding: 9px 18px; margin-bottom: 10px; border-radius: 8px; gap: 10px; }
        .hero-emblem-3d { width: 36px; height: 36px; }
        .hero-titles h1 { font-size: 18px; }
        .hero-titles p { font-size: 11.5px; margin-top: 1px; }
        .operator-pill-3d { padding: 4px 12px; font-size: 12px; }
        .calendar-control-3d { padding: 4px 12px; }
        .pd-glass { padding: 14px 20px; margin-bottom: 10px; border-radius: 8px; }
        .card-heading-row { margin-bottom: 10px; padding-bottom: 10px; }
        .card-heading-row h2 { font-size: 15px; }
        .heading-icon-badge { width: 30px; height: 30px; }
        .pd-glass .label-3d { font-size: 11px; }
        .pd-glass .input-inset-3d { padding: 8px 12px; font-size: 13px; }
        .wo-input-box .input-inset-3d, .wo-date-box .input-inset-3d { padding-left: 34px; }
        .push-btn-3d { padding: 9px 18px; font-size: 13px; }
        .wo-search-flex { gap: 10px; }

        .pd-split { grid-template-columns: minmax(320px, 34%) 1fr; border-radius: 8px; margin-bottom: 12px; }
        .pd-split-left { padding: 16px 20px 14px; }
        .pd-left-brand { font-size: 11.5px; }
        .pd-left-hero { margin: 8px 0 6px; }
        .pd-left-kicker { font-size: 11px; }
        .pd-left-big { font-size: 32px; }
        .pd-left-sub { font-size: 13px; margin-top: 2px; }
        .pd-left-chips { gap: 5px; margin-bottom: 6px; }
        .pd-lchip { font-size: 10px; padding: 3px 8px; }
        .pd-left-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; }
        .pd-lrow { padding: 6px 0; gap: 9px; }
        .pd-lrow.wide { grid-column: span 2; }
        .pd-licon { flex: 0 0 26px; width: 26px; height: 26px; }
        .pd-licon svg { width: 13px; height: 13px; }
        .pd-llabel { font-size: 9px; }
        .pd-lvalue { font-size: 12.5px; }
        .pd-left-select { padding: 6px 28px 6px 8px; font-size: 12px; }

        .pd-split-right { padding: 14px 22px 16px; }
        .pd-right-title { font-size: 16px; }
        .pd-right-rule { margin: 6px auto 2px; }
        .pd-sub-head { margin: 10px 0 6px; font-size: 12px; }
        .pd-form-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px; }
        .field-3d-wrapper { gap: 3px; }
        .pd-split-right .label-3d { font-size: 10px; }
        .locked-tag-3d { font-size: 9px; padding: 1px 5px; }
        .pd-split-right .input-inset-3d,
        .pd-split-right .select-inset-3d { padding: 7px 10px; font-size: 12.5px; }
        .pd-iconfield .input-inset-3d, .pd-iconfield .select-inset-3d { padding-left: 32px; }
        .pd-iconfield .select-inset-3d { padding-right: 30px !important; }
        .pd-ficon { left: 9px; }
        .pd-ficon svg { width: 14px; height: 14px; }
        .pd-edit-chip { margin: 4px 0 0; padding: 3px 12px; font-size: 11px; }

        .waste-alert-banner-3d { margin-top: 8px; padding: 10px 14px; border-radius: 8px; }
        .alert-title-wrap { margin-bottom: 4px; }
        .alert-title-wrap h4 { font-size: 13px; }
        .waste-alert-banner-3d p { margin-bottom: 6px !important; }

        .pd-bottom-row { display: flex; align-items: center; gap: 14px; margin-top: 12px; flex-wrap: wrap; }
        .pd-bottom-row .summary-dashboard-cards { flex: 1 1 340px; margin: 0; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .pd-bottom-row .summary-card-3d { padding: 8px 12px; gap: 10px; border-radius: 8px; }
        .pd-bottom-row .summary-icon-3d { width: 34px; height: 34px; }
        .pd-bottom-row .summary-icon-3d svg { width: 16px; height: 16px; }
        .pd-bottom-row .stat-subhead { font-size: 10px; }
        .pd-bottom-row .stat-big-num { font-size: 19px; }
        .pd-bottom-row .stat-unit { font-size: 11px; }
        .pd-bottom-row .save-button-centering { margin: 0; gap: 4px; flex: 0 0 auto; }
        .pd-bottom-row .push-btn-hero-save { max-width: 230px; padding: 10px 18px; font-size: 13.5px; }

        @media (max-width: 1100px) {
          .pd-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .pd-split { grid-template-columns: 1fr; }
          .pd-split-right { padding: 16px 14px; }
        }
        @media (max-width: 600px) {
          .pd-form-grid, .pd-bottom-row .summary-dashboard-cards { grid-template-columns: 1fr; }
          .pd-bottom-row .push-btn-hero-save { max-width: none; }
        }
      `}</style>

      <div className="pd-shell">


        {/* 🔍 STEP 1: WORK ORDER RETRIEVAL */}
        <section className="pd-glass">
          <div className="card-heading-row">
            <div className="heading-with-icon">
              <div className="heading-icon-badge blue">
                <Icons.Search />
              </div>
              <h2>Work Order Retrieval</h2>
            </div>
            <span className="section-pill-tag blue">Step 1</span>
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

        {/* ======================================================================
            🗂️ SPLIT FORM — blue side = fetched Work Order, white side = entry
            ====================================================================== */}
        {job && (
          <>
            <div className="pd-split">

              {/* ───────────── LEFT (BLUE): FETCHED WORK ORDER ───────────── */}
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

                  {/* ⬇️ Material-linked rows: they follow the selected Material Description */}
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
                        // 2+ materials → dropdown right inside the blue panel
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
                        // 1 material → shown as plain text, selected automatically
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

              {/* ───────────── RIGHT (WHITE): ENTRY FIELDS ───────────── */}
              <section className="pd-split-right">
                <h2 className="pd-right-title">Reel Register Entry</h2>
                <div className="pd-right-rule"></div>

                {editingReelId && (
                  <div className="pd-edit-chip">✎ Editing reel {form.reelNo}</div>
                )}

                {/* ⚖️ REEL SPECIFICATIONS */}
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

                {/* ✂️ REEL WASTE DETAILS */}
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

                {/* ⚠️ HIGH WASTE ALERT & MANDATORY REMARKS */}
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

                {/* 📊 SUMMARY + 💾 SAVE (one compact row) */}
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

                {/* 💾 SAVE BUTTON */}
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

            {/* 📋 REEL REGISTER ENTRIES */}
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
                          {/* <th>Material</th> */}
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
                            <td colSpan="20" style={{ padding: "30px", color: "#64748b" }}>
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

                                  {/* <td
                                    style={{
                                      cursor: "pointer",
                                      color: "#0a6fb8",
                                      whiteSpace:
                                        expandedCell === `material-${r._id}`
                                          ? "normal"
                                          : "nowrap"
                                    }}
                                    onClick={() =>
                                      setExpandedCell(
                                        expandedCell === `material-${r._id}`
                                          ? null
                                          : `material-${r._id}`
                                      )
                                    }
                                  >
                                    {expandedCell === `material-${r._id}`
                                      ? r.materialDescription || "-"
                                      : truncateText(r.materialDescription, 12)}
                                  </td> */}

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
                                    <div style={{ fontWeight: 800 }}>{r.productionUser || "-"}</div>
                                    <small style={{ color: "#64748b", fontSize: "10px" }}>
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

                                  <td style={{ fontSize: "11px", color: "#64748b" }}>
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
                                            // older reels have no saved material → fall back to WO default
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