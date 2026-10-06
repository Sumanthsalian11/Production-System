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
          🎨 GLOSSY AQUA-GLASS STYLES (scoped, injected in this single page)
          ====================================================================== */}
      <style>{`
        /* ---------- Aqua glass backdrop ---------- */
        .pd-root {
          min-height: 100vh;
          padding: 24px 16px 40px;
          box-sizing: border-box;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #0b2f4f;
          background:
            radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.85) 0, rgba(255, 255, 255, 0) 30%),
            radial-gradient(circle at 88% 18%, rgba(160, 228, 255, 0.7) 0, rgba(160, 228, 255, 0) 32%),
            radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
            linear-gradient(165deg, #eaf8ff 0%, #c9ecfb 38%, #a6dcf5 72%, #d9f2fd 100%);
          background-attachment: fixed;
        }
        .pd-shell { max-width: 1250px; margin: 0 auto; }

        /* ---------- Glossy header strip ---------- */
        .dash-hero-header {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 18px;
          padding: 16px 22px;
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(222, 244, 254, 0.8) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow:
            0 14px 30px rgba(40, 120, 170, 0.18),
            inset 0 1px 0 #ffffff,
            inset 0 -10px 22px rgba(140, 210, 245, 0.2);
        }
        .hero-left-branding { display: flex; align-items: center; gap: 16px; }
        .hero-emblem-3d {
          width: 56px; height: 56px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #ffffff;
          background: radial-gradient(circle at 30% 25%, #b6ecff 0%, #34b6f0 40%, #0a6fb8 100%);
          box-shadow: 0 8px 18px rgba(2, 60, 110, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.8), inset 0 -4px 8px rgba(0, 60, 120, 0.35);
        }
        .hero-titles h1 {
          margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.4px;
          color: #0a4f8c;
        }
        .hero-titles p { margin: 3px 0 0; font-size: 13px; font-weight: 600; color: #4a7391; }
        .hero-right-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .operator-pill-3d {
          display: flex; align-items: center; gap: 8px; padding: 8px 14px;
          border-radius: 30px; font-size: 13px; font-weight: 700; color: #0b2f4f;
          background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 4px 12px rgba(2, 60, 110, 0.25), inset 0 1px 0 #fff;
        }
        .operator-pulse-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: #22c55e; box-shadow: 0 0 10px #22c55e; animation: glowPulse 2s infinite;
        }
        @keyframes glowPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
        .calendar-control-3d {
          display: flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 14px;
          color: #0b2f4f;
          background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 4px 12px rgba(2, 60, 110, 0.25), inset 0 1px 0 #fff;
        }
        .calendar-control-3d input {
          border: none; background: transparent; font-size: 13px; font-weight: 700; color: #0b2f4f; outline: none;
        }

        /* ---------- Shared glass panel ---------- */
        .pd-glass {
          position: relative;
          border-radius: 26px;
          padding: 22px;
          margin-bottom: 18px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(226, 246, 255, 0.86) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow:
            0 14px 32px rgba(40, 120, 170, 0.18),
            inset 0 1px 0 #ffffff,
            inset 0 -12px 26px rgba(140, 210, 245, 0.2);
          overflow: hidden;
        }
        .pd-glass::before {
          content: ''; position: absolute; left: 0; right: 0; top: 0; height: 46%;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 100%);
          pointer-events: none; border-radius: 26px 26px 0 0;
        }
        .pd-glass > * { position: relative; }

        /* ---------- Glossy tab bar ---------- */
        .pd-edit-chip {
          display: inline-block; margin-bottom: 14px;
          font-size: 12px; font-weight: 800; padding: 5px 14px; border-radius: 999px;
          color: #0a4f8c; background: linear-gradient(180deg, #fff7d6, #ffe9a3);
          border: 1px solid #fde68a;
        }

        /* ---------- Section headings ---------- */
        .radiant-card-3d { background: transparent; border: none; box-shadow: none; padding: 0; margin: 0; }
        .card-heading-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .heading-with-icon { display: flex; align-items: center; gap: 10px; }
        .heading-icon-badge {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #ffffff;
          box-shadow: 0 5px 12px rgba(2, 60, 110, 0.3), inset 0 2px 2px rgba(255, 255, 255, 0.7);
        }
        .heading-icon-badge.blue { background: radial-gradient(circle at 30% 25%, #b6ecff, #34b6f0 45%, #0a6fb8); }
        .heading-icon-badge.purple { background: radial-gradient(circle at 30% 25%, #d9ccff, #8b5cf6 50%, #5b21b6); }
        .heading-icon-badge.amber { background: radial-gradient(circle at 30% 25%, #ffe6a8, #f59e0b 50%, #b45309); }
        .card-heading-row h2 { font-size: 17px; font-weight: 800; margin: 0; color: #0b2f4f; }
        .section-pill-tag {
          font-size: 11px; font-weight: 800; padding: 4px 11px; border-radius: 20px;
          text-transform: uppercase; letter-spacing: 0.5px;
          background: linear-gradient(180deg, #ffffff, #d4f0fd); color: #0a4f8c; border: 1px solid #a6d6ee;
        }
        .section-pill-tag.purple { color: #5b21b6; border-color: #d8c8fb; background: linear-gradient(180deg, #fff, #efe7ff); }
        .section-pill-tag.amber { color: #92400e; border-color: #fde68a; background: linear-gradient(180deg, #fff, #fff1c9); }

        /* ---------- WO search ---------- */
        .wo-search-flex { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .wo-input-box { flex: 1; min-width: 250px; }

        /* ---------- Inputs ---------- */
        .field-3d-wrapper { display: flex; flex-direction: column; gap: 6px; }
        .label-3d {
          font-size: 12px; font-weight: 800; color: #0b2f4f; letter-spacing: 0.2px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .input-inset-3d, .select-inset-3d {
          width: 100%; padding: 11px 14px; border-radius: 14px;
          border: 1.5px solid #9ccbe6; background: #ffffff;
          font-size: 14px; font-weight: 700; color: #0b2f4f; outline: none; box-sizing: border-box;
          box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.12), 0 1px 0 rgba(255, 255, 255, 0.9);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .select-inset-3d { cursor: pointer; }
        .input-inset-3d:focus, .select-inset-3d:focus {
          border-color: #1b9be0;
          box-shadow: inset 0 1px 2px rgba(10, 80, 130, 0.08), 0 0 0 4px rgba(27, 155, 224, 0.22), 0 6px 14px rgba(27, 155, 224, 0.18);
        }
        .input-inset-3d.readonly-locked {
          background: linear-gradient(180deg, #f1f7fb 0%, #dbe9f2 100%);
          color: #476a85; border-color: #b8d3e4; cursor: not-allowed;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.08);
        }
        .input-inset-3d::placeholder { color: #7b9db5; font-weight: 600; }

        /* ---------- Glossy aqua buttons ---------- */
        .push-btn-3d {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 22px; border-radius: 14px; font-size: 14px; font-weight: 800;
          border: 1px solid rgba(255, 255, 255, 0.6); cursor: pointer; outline: none; user-select: none;
          transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .push-btn-3d:disabled { opacity: 0.5; cursor: not-allowed; }
        .push-btn-primary {
          color: #ffffff; text-shadow: 0 1px 2px rgba(0, 90, 150, 0.45);
          background: linear-gradient(180deg, #b4ecff 0%, #5cc4f2 48%, #2ea4e6 52%, #1b8fd6 100%);
          box-shadow: 0 4px 0 #1479b8, 0 10px 18px rgba(30, 130, 190, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.85);
        }
        .push-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 5px 0 #1479b8, 0 14px 22px rgba(30, 130, 190, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        .push-btn-primary:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 #1479b8, 0 4px 8px rgba(30, 130, 190, 0.22); }
        .push-btn-hero-save {
          min-width: 240px; padding: 16px 36px; font-size: 16px; color: #ffffff;
          text-shadow: 0 1px 2px rgba(0, 110, 70, 0.45);
          background: linear-gradient(180deg, #b9f5d6 0%, #5fddA6 48%, #2cc58a 52%, #14a870 100%);
          box-shadow: 0 5px 0 #0d8a5a, 0 14px 26px rgba(20, 168, 112, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.85);
        }
        .push-btn-hero-save:hover { transform: translateY(-2px); box-shadow: 0 7px 0 #0d8a5a, 0 18px 30px rgba(20, 168, 112, 0.4); }
        .push-btn-hero-save:active { transform: translateY(4px); box-shadow: 0 1px 0 #0d8a5a, 0 5px 10px rgba(20, 168, 112, 0.22); }
        .push-btn-edit-mode {
          background: linear-gradient(180deg, #b4ecff 0%, #5cc4f2 48%, #2ea4e6 52%, #1b8fd6 100%);
          box-shadow: 0 5px 0 #1479b8, 0 14px 26px rgba(30, 130, 190, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.85);
        }

        /* ---------- Spec sheet ---------- */
        .locked-tag-3d {
          display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800;
          padding: 2px 7px; border-radius: 6px; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;
        }

        /* ---------- Waste alert ---------- */
        .waste-alert-banner-3d {
          margin-top: 18px; padding: 18px; border-radius: 18px;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border: 1.5px solid #fde68a; box-shadow: 0 8px 18px rgba(217, 119, 6, 0.14), inset 0 1px 0 #fff;
        }
        .alert-title-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; color: #b45309; }
        .alert-title-wrap h4 { font-size: 15px; font-weight: 800; margin: 0; }
        .alert-counter { font-size: 11px; font-weight: 800; color: #92400e; text-align: right; margin-top: 4px; }

        /* ---------- Summary cards ---------- */
        .summary-dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-bottom: 8px; }
        .summary-card-3d {
          display: flex; align-items: center; gap: 18px; padding: 20px; border-radius: 22px;
          background: linear-gradient(180deg, #ffffff 0%, #eaf7fe 100%); border: 1px solid #cfe8f6;
          box-shadow: 0 12px 24px rgba(10, 100, 160, 0.14), inset 0 1px 0 #fff;
        }
        .summary-card-3d.waste-fire { border-color: #fed7aa; background: linear-gradient(135deg, #ffffff 0%, #fff4e6 100%); }
        .summary-card-3d.waste-gauge { border-color: #bbf7d0; background: linear-gradient(135deg, #ffffff 0%, #effcf4 100%); }
        .summary-card-3d.waste-gauge.alert { border-color: #fecaca; background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%); }
        .summary-icon-3d {
          width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.18), inset 0 2px 2px rgba(255, 255, 255, 0.7);
        }
        .summary-icon-3d.orange { background: radial-gradient(circle at 30% 25%, #ffd2a1, #f97316 50%, #c2410c); }
        .summary-icon-3d.green { background: radial-gradient(circle at 30% 25%, #b4f5d0, #10b981 50%, #047857); }
        .summary-icon-3d.red { background: radial-gradient(circle at 30% 25%, #ffc2c2, #ef4444 50%, #b91c1c); }
        .summary-stat-group { flex: 1; }
        .stat-subhead { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #4a7391; letter-spacing: 0.3px; }
        .stat-number-flex { display: flex; align-items: baseline; gap: 6px; margin-top: 3px; }
        .stat-big-num { font-size: 30px; font-weight: 900; letter-spacing: -0.5px; color: #0b2f4f; }
        .stat-unit { font-size: 14px; font-weight: 800; color: #4a7391; }

        .save-button-centering { display: flex; flex-direction: column; align-items: center; gap: 12px; margin: 26px 0 6px; }
        .cancel-edit-link { background: transparent; border: none; font-size: 13px; font-weight: 700; color: #dc2626; text-decoration: underline; cursor: pointer; }

        /* ---------- Table ---------- */
        .table-scroll-container-3d {
          width: 100%; overflow-x: auto; border-radius: 18px; border: 1px solid #a6d6ee; background: #fff;
          box-shadow: 0 8px 20px rgba(10, 100, 160, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        .colorful-3d-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; min-width: 1100px; background: #ffffff; }
        .colorful-3d-table thead th {
          background: linear-gradient(180deg, #8fd8f8 0%, #4fb8ee 55%, #34a5e3 100%);
          color: #ffffff; padding: 13px 8px; text-align: center; font-weight: 800; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #2b94d2; white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 80, 140, 0.5);
        }
        .colorful-3d-table tbody td {
          padding: 10px 8px; text-align: center; border-bottom: 1px solid #dcecf6; border-right: 1px solid #f1f8fc;
          font-weight: 600; color: #0b2f4f;
        }
        .colorful-3d-table tbody tr:nth-child(even) td { background: #f3faff; }
        .colorful-3d-table tbody tr:hover td { background: #d9f2fc; }
        .reel-tag-3d {
          display: inline-block; padding: 4px 10px; border-radius: 12px; font-weight: 800; color: #0a4f8c;
          background: linear-gradient(180deg, #ffffff 0%, #cfeefc 100%); border: 1px solid #a6d6ee;
        }
        .waste-cell-danger { color: #dc2626; font-weight: 800; }
        .balance-cell-emerald { color: #059669; font-weight: 800; }
        .ratio-pill-3d { padding: 3px 8px; border-radius: 10px; font-weight: 800; font-size: 11px; }
        .ratio-pill-3d.safe { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .ratio-pill-3d.danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .prodtype-tag-3d { padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 800; }
        .prodtype-tag-3d.makeready { background: #fef3c7; color: #b45309; }
        .prodtype-tag-3d.prod { background: #ede9fe; color: #6d28d9; }
        .btn-table-action-3d {
          display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 9px;
          font-size: 11px; font-weight: 800; border: none; cursor: pointer; transition: all 0.12s; color: #fff;
        }
        .btn-table-action-3d.edit {
          background: linear-gradient(180deg, #a8e6ff 0%, #4fb8ee 55%, #2a9be0 100%);
          box-shadow: 0 2px 0 #1479b8, 0 4px 6px rgba(30, 130, 190, 0.25);
        }
        .btn-table-action-3d.delete {
          background: linear-gradient(180deg, #ff9d9d 0%, #ef4444 50%, #b91c1c 100%);
          box-shadow: 0 2px 0 #991b1b, 0 4px 6px rgba(185, 28, 28, 0.25);
        }
        .btn-table-action-3d:hover { transform: translateY(-1px); }

        /* ---------- Responsive ---------- */
        @media (max-width: 768px) {
          .dash-hero-header { flex-direction: column; align-items: flex-start; }
          .hero-right-controls { width: 100%; justify-content: space-between; }
          .wo-search-flex { flex-direction: column; align-items: stretch; }
          .push-btn-3d { width: 100%; }
          .pd-glass { padding: 16px; }
        }

        /* ---------- Split form: blue (fetched WO) | white (entry) ---------- */
        .pd-split {
          display: grid; grid-template-columns: minmax(300px, 36%) 1fr;
          border-radius: 24px; overflow: hidden; margin-bottom: 18px; background: #ffffff;
          box-shadow: 0 18px 42px rgba(40, 120, 180, 0.28);
        }
        .pd-split-left {
          position: relative; overflow: hidden; padding: 28px 26px; color: #ffffff;
          background: linear-gradient(170deg, #35a2ea 0%, #4f9cf0 48%, #86cbf8 100%);
        }
        .pd-split-left::before {
          content: ''; position: absolute; width: 280px; height: 280px; border-radius: 50%;
          right: -110px; top: -90px; background: rgba(255, 255, 255, 0.13);
        }
        .pd-split-left::after {
          content: ''; position: absolute; width: 220px; height: 220px; border-radius: 50%;
          left: -90px; bottom: -80px; background: rgba(255, 255, 255, 0.1);
        }
        .pd-split-left > * { position: relative; z-index: 1; }
        .pd-left-brand { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; }
        .pd-left-hero { margin: 26px 0 12px; }
        .pd-left-kicker { font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; }
        .pd-left-big { font-size: 46px; font-weight: 900; line-height: 1.05; letter-spacing: -1px; word-break: break-all; }
        .pd-left-sub { margin-top: 6px; font-size: 14px; font-weight: 600; opacity: 0.95; }
        .pd-left-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
        .pd-lchip {
          font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 14px;
          background: rgba(255, 255, 255, 0.22); border: 1px solid rgba(255, 255, 255, 0.5); color: #fff;
        }
        .pd-lchip.ok { background: rgba(16, 185, 129, 0.35); }
        .pd-lchip.warn { background: rgba(251, 191, 36, 0.4); }
        .pd-left-list { display: flex; flex-direction: column; }
        .pd-lrow { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.22); }
        .pd-lrow:last-child { border-bottom: none; }
        .pd-licon {
          flex: 0 0 32px; width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #fff;
          background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35);
        }
        .pd-licon svg { width: 16px; height: 16px; }
        .pd-lbody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .pd-llabel { font-size: 10px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: rgba(255, 255, 255, 0.8); }
        .pd-lvalue { font-size: 14px; font-weight: 700; color: #ffffff; word-break: break-word; }
        .pd-left-select {
          width: 100%; margin-top: 2px; padding: 8px 10px; border-radius: 8px; border: none; outline: none;
          background: #ffffff; color: #0b2f4f; font-size: 13px; font-weight: 700; cursor: pointer;
        }

        .pd-split-right { background: #ffffff; padding: 28px 34px 30px; }
        .pd-right-title { margin: 0; text-align: center; font-size: 19px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: #2f4156; }
        .pd-right-rule { height: 2px; margin: 10px auto 6px; width: 100%; background: linear-gradient(90deg, transparent, #cfe6f5, transparent); }
        .pd-sub-head { margin: 20px 0 10px; font-size: 13px; font-weight: 800; color: #1b8fd6; }
        .pd-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
        .pd-edit-chip { margin: 6px 0 0; }

        .pd-split-right .label-3d { font-size: 11px; font-weight: 700; color: #5b6f82; }
        .pd-split-right .input-inset-3d,
        .pd-split-right .select-inset-3d {
          border-radius: 4px; border: 1px solid #cfd9e4; box-shadow: none;
          padding: 10px 12px; font-size: 13.5px; font-weight: 600; background: #ffffff;
        }
        .pd-split-right .input-inset-3d:focus,
        .pd-split-right .select-inset-3d:focus { border-color: #35a2ea; box-shadow: 0 0 0 3px rgba(53, 162, 234, 0.18); }
        .pd-split-right .input-inset-3d.readonly-locked { background: #f1f5f9; }
        .pd-iconfield { position: relative; }
        .pd-iconfield .input-inset-3d, .pd-iconfield .select-inset-3d { padding-left: 38px; }
        .pd-ficon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #6b7f93; display: flex; pointer-events: none; }
        .pd-ficon svg { width: 16px; height: 16px; }

        .pd-split-right .summary-dashboard-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .pd-split-right .summary-card-3d { padding: 14px; gap: 12px; border-radius: 14px; box-shadow: 0 4px 10px rgba(40, 120, 170, 0.1); }
        .pd-split-right .summary-icon-3d { width: 44px; height: 44px; }
        .pd-split-right .stat-big-num { font-size: 24px; }
        .pd-split-right .save-button-centering { margin: 22px 0 0; }
        .pd-split-right .push-btn-hero-save {
          width: 100%; max-width: 340px; min-width: 0; padding: 13px 24px; font-size: 15px; letter-spacing: 0.6px;
        }

        @media (max-width: 900px) {
          .pd-split { grid-template-columns: 1fr; }
          .pd-form-grid, .pd-split-right .summary-dashboard-cards { grid-template-columns: 1fr; }
          .pd-split-right { padding: 22px 18px; }
          .pd-left-big { font-size: 36px; }
        }

        /* ---------- COMPACT MODE: whole form fits on the first screen ---------- */
        .pd-root { padding: 12px 14px 28px; }
        .dash-hero-header { padding: 9px 18px; margin-bottom: 10px; border-radius: 20px; gap: 10px; }
        .hero-emblem-3d { width: 42px; height: 42px; }
        .hero-titles h1 { font-size: 21px; }
        .hero-titles p { font-size: 11.5px; margin-top: 1px; }
        .operator-pill-3d { padding: 5px 12px; font-size: 12px; }
        .calendar-control-3d { padding: 4px 12px; }
        .pd-glass { padding: 12px 18px; margin-bottom: 10px; border-radius: 20px; }
        .card-heading-row { margin-bottom: 8px; }
        .card-heading-row h2 { font-size: 15px; }
        .heading-icon-badge { width: 30px; height: 30px; }
        .pd-glass .label-3d { font-size: 11px; }
        .pd-glass .input-inset-3d { padding: 8px 12px; font-size: 13px; }
        .push-btn-3d { padding: 9px 18px; font-size: 13px; }
        .wo-search-flex { gap: 10px; }

        .pd-split { grid-template-columns: minmax(320px, 34%) 1fr; border-radius: 20px; margin-bottom: 12px; }
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
        .pd-left-select { padding: 6px 8px; font-size: 12px; }

        .pd-split-right { padding: 14px 22px 16px; }
        .pd-right-title { font-size: 15px; }
        .pd-right-rule { margin: 6px auto 2px; }
        .pd-sub-head { margin: 10px 0 6px; font-size: 12px; }
        .pd-form-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px; }
        .field-3d-wrapper { gap: 3px; }
        .pd-split-right .label-3d { font-size: 10px; }
        .locked-tag-3d { font-size: 9px; padding: 1px 5px; }
        .pd-split-right .input-inset-3d,
        .pd-split-right .select-inset-3d { padding: 7px 10px; font-size: 12.5px; }
        .pd-iconfield .input-inset-3d, .pd-iconfield .select-inset-3d { padding-left: 32px; }
        .pd-ficon { left: 9px; }
        .pd-ficon svg { width: 14px; height: 14px; }
        .pd-edit-chip { margin: 4px 0 0; padding: 3px 12px; font-size: 11px; }

        .waste-alert-banner-3d { margin-top: 8px; padding: 10px 14px; border-radius: 12px; }
        .alert-title-wrap { margin-bottom: 4px; }
        .alert-title-wrap h4 { font-size: 13px; }
        .waste-alert-banner-3d p { margin-bottom: 6px !important; }

        .pd-bottom-row { display: flex; align-items: center; gap: 14px; margin-top: 12px; flex-wrap: wrap; }
        .pd-bottom-row .summary-dashboard-cards { flex: 1 1 340px; margin: 0; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .pd-bottom-row .summary-card-3d { padding: 8px 12px; gap: 10px; border-radius: 12px; }
        .pd-bottom-row .summary-icon-3d { width: 34px; height: 34px; }
        .pd-bottom-row .summary-icon-3d svg { width: 16px; height: 16px; }
        .pd-bottom-row .stat-subhead { font-size: 10px; }
        .pd-bottom-row .stat-big-num { font-size: 19px; }
        .pd-bottom-row .stat-unit { font-size: 11px; }
        .pd-bottom-row .save-button-centering { margin: 0; gap: 4px; flex: 0 0 auto; }
        .pd-bottom-row .push-btn-hero-save { max-width: 230px; padding: 11px 18px; font-size: 13.5px; }

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
        {/* 🌟 GLOSSY HERO HEADER */}
        <header className="dash-hero-header">
          <div className="hero-left-branding">
            <div className="hero-emblem-3d">
              <Icons.Factory />
            </div>
            <div className="hero-titles">
              <h1>Reel Register Entry</h1>
              <p>Shop Floor Operations & Waste Tracking Dashboard</p>
            </div>
          </div>

          <div className="hero-right-controls">
            {loggedInUser && (
              <div className="operator-pill-3d">
                <span className="operator-pulse-dot"></span>
                <Icons.User />
                <span>{loggedInUser}</span>
              </div>
            )}

            <div className="calendar-control-3d">
              <Icons.Calendar />
              <input
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
              />
            </div>
          </div>
        </header>

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