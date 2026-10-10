import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BASE_URL from "../config/api";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

// 🎨 presentation only: round blue emblem icon used in the header strip
const FactoryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" />
  </svg>
);

function NewInspectionForm() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const authConfig = { headers: { Authorization: `Bearer ${token}` } };

  const [allMaterialSpecs, setAllMaterialSpecs] = useState({});
  const [locations, setLocations] = useState([]);
  const [selectedMat, setSelectedMat] = useState("");
  const [samplingNumber, setSamplingNumber] = useState(2);
  const [fetchMode, setFetchMode] = useState("material"); // "material" | "item"
  const [allItemsList, setAllItemsList] = useState([]);

  const [rrNo, setRrNo] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [testedDate, setTestedDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [poNo, setPoNo] = useState("");
  const [girNo, setGirNo] = useState("");
  const [itemDescDetails, setItemDescDetails] = useState("");
  const [invoiceDetails, setInvoiceDetails] = useState("");
  const [receivedQty, setReceivedQty] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [locationSelect, setLocationSelect] = useState("");

  const [acceptanceRadio, setAcceptanceRadio] = useState("LA (Lot Accept)");
  const [defectRadio, setDefectRadio] = useState("Minor Defect");
  const [comments, setComments] = useState("");
  const [qcDoneBy, setQcDoneBy] = useState("");
  const [checkedBy, setCheckedBy] = useState("");

  const [itemData, setItemData] = useState(null); // holds gsm/width/length for auto-remark calc
  const [rows, setRows] = useState([]); // { readings: [] }

  useEffect(() => {
    loadMaterialSpecs();
    loadLocations();
    loadItemsList();
  }, []);

  const loadMaterialSpecs = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/rm-iqc`, authConfig);
      const map = {};
      (res.data || []).forEach((group) => {
        if (!group.description) return;
        map[group.description] = (group.parameters || []).map((p, idx) => ({
          sNo: idx + 1,
          parameter: p.qualityParameter,
          specification: p.specification,
          tolLimit: p.tolerance,
          uom: p.uom,
          inputType: "Multiple",
        }));
      });
      setAllMaterialSpecs(map);
    } catch (err) {
      console.error("Error loading RM-IQC specs:", err);
    }
  };

  const loadLocations = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/locations`, authConfig);
      setLocations(res.data || []);
      if (res.data && res.data.length > 0) {
        setLocationSelect(res.data[0].locationName);
      }
    } catch (err) {
      console.error("Error loading locations:", err);
    }
  };

  const loadItemsList = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/items`, authConfig);
      setAllItemsList(res.data || []);
    } catch (err) {
      console.error("Error loading items:", err);
    }
  };

  // Debounced auto-fetch as the user types the Item Code — fires 300ms after typing stops
  useEffect(() => {
    if (!itemCode.trim()) {
      setSupplier("");
      setItemDescDetails("");
      setItemData(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (fetchMode === "item") {
        // Look up from the Items master (Admin Dashboard "Items" list)
        const match = allItemsList.find(
          (it) => (it.itemCode || "").trim().toLowerCase() === itemCode.trim().toLowerCase()
        );
        if (match) {
          setSupplier(match.customerName || "");
          setItemDescDetails(match.description || "");
          setItemData(match); // keep full item (incl. pdfPath); no gsm/width/length so those calcs safely fall back to "-"
          if (match.materialType && allMaterialSpecs[match.materialType]) {
            setSelectedMat(match.materialType);
          }
        } else {
          setSupplier("");
          setItemDescDetails("");
          setItemData(null);
        }
        return;
      }

      // fetchMode === "material" — original behavior, unchanged
      try {
        const res = await axios.get(
          `${BASE_URL}/api/master/materials/code/${itemCode.trim()}`,
          authConfig
        );
        const mat = res.data;
        setSupplier(mat.mill || "");
        setItemDescDetails(mat.description || "");
        setItemData(mat);
        if (mat.description && allMaterialSpecs[mat.description]) {
          setSelectedMat(mat.description);
        } else if (mat.group && allMaterialSpecs[mat.group]) {
          setSelectedMat(mat.group);
        }
      } catch (err) {
        setSupplier("");
        setItemDescDetails("");
        setItemData(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [itemCode, fetchMode, allItemsList, allMaterialSpecs]);

  useEffect(() => {
    if (!selectedMat || !allMaterialSpecs[selectedMat]) {
      setRows([]);
      return;
    }
    const params = allMaterialSpecs[selectedMat];
    const count = parseInt(samplingNumber, 10) || 1;
    setRows(params.map(() => ({ readings: Array(count).fill("") })));
  }, [selectedMat, samplingNumber, allMaterialSpecs]);

  const updateReading = (rowIdx, sampleIdx, value) => {
    setRows((prev) => {
      const copy = [...prev];
      const readings = [...copy[rowIdx].readings];
      readings[sampleIdx] = value;
      copy[rowIdx] = { ...copy[rowIdx], readings };
      return copy;
    });
  };

  const checkRemark = (row, matData) => {
    const results = row.readings || [];
    const cleaned = results.filter((val) => val !== "" && val !== null && val !== undefined);
    if (cleaned.length === 0) return "-";

    const quality = (row.parameter || "").toLowerCase();

    const isNumericInput = cleaned.every((val) => !isNaN(parseFloat(val)));

    let baseValue = null;
    if (isNumericInput) {
      if (quality.includes("grammage") || quality.includes("gsm")) {
        baseValue = parseFloat(matData?.gsm);
      } else if (quality.includes("width")) {
        baseValue = parseFloat(matData?.width);
      } else if (quality.includes("length")) {
        baseValue = parseFloat(matData?.length);
      }
    }

    if (isNumericInput && baseValue !== null && !isNaN(baseValue)) {
      const tol = parseFloat((row.tolLimit || "").toString().replace(/[^\d.-]/g, ""));
      if (isNaN(tol)) return "-";

      const min = baseValue - tol;
      const max = baseValue + tol;

      let inside = 0;
      let outside = 0;

      cleaned.forEach((val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        if (num >= min && num <= max) inside++;
        else outside++;
      });

      const total = inside + outside;
      if (total === 0) return "-";
      if (total === 2) return outside > 0 ? "NOT OK" : "OK";
      return inside > outside ? "OK" : "NOT OK";
    }

    let okCount = 0;
    let notOkCount = 0;

    cleaned.forEach((val) => {
      const v = val.toString().trim().toLowerCase();
      if (v === "ok") okCount++;
      else if (v === "not ok") notOkCount++;
    });

    const total = okCount + notOkCount;
    if (total === 0) return "-";
    if (total === 2) return notOkCount > 0 ? "NOT OK" : "OK";
    return okCount > notOkCount ? "OK" : "NOT OK";
  };

  const submitForm = async () => {
    if (!selectedMat) {
      alert("Please select a material type!");
      return;
    }

    const specs = allMaterialSpecs[selectedMat];
    const items = specs.map((specObj, idx) => {
      const readings = rows[idx] ? rows[idx].readings.map((r) => r.trim()) : [];
      const remark = checkRemark(
        { parameter: specObj.parameter, tolLimit: specObj.tolLimit, readings },
        itemData
      );
      return {
        parameter: specObj.parameter,
        specification: specObj.specification,
        tolLimit: specObj.tolLimit,
        uom: specObj.uom,
        readings,
        remarks: remark,
      };
    });

    const payload = {
      meta: {
        rrNo,
        itemCode,
        materialName: selectedMat,
        testedDate,
        supplier,
        poNo,
        girNo,
        itemDescDetails,
        invoiceDetails,
        receivedQty,
        receivedDate,
        location: locationSelect,
        samplingNumber,
        itemPdfPath: fetchMode === "item" ? (itemData?.pdfPath || "") : "",
      },
      footer: {
        acceptanceCriteria: acceptanceRadio,
        defectCriteria: defectRadio,
        comments,
        qcDoneBy,
        checkedBy,
      },
      items,
    };

    try {
      const res = await axios.post(`${BASE_URL}/api/rir/submit`, payload, authConfig);
      alert(res.data.message || "Inspection Report Submitted Successfully!");
      navigate("/receiving-inspection");
    } catch (err) {
      console.error("Submission failed:", err);
      alert(err.response?.data?.message || "Failed to submit inspection report");
    }
  };

  const count = parseInt(samplingNumber, 10) || 1;
  const specs = selectedMat && allMaterialSpecs[selectedMat] ? allMaterialSpecs[selectedMat] : null;

  return (
    <div className="form-page-container">
      <style>{`
        /* ---------- Aqua glass backdrop ---------- */
        .form-page-container {
          min-height: 100vh;
          padding: 16px 22px 28px;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          color: #0b2f4f;
          background:
            radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.85) 0, rgba(255, 255, 255, 0) 30%),
            radial-gradient(circle at 88% 18%, rgba(160, 228, 255, 0.7) 0, rgba(160, 228, 255, 0) 32%),
            radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
            linear-gradient(165deg, #eaf8ff 0%, #c9ecfb 38%, #a6dcf5 72%, #d9f2fd 100%);
          background-attachment: fixed;
        }

        /* ---------- Glossy hero header ---------- */
        .company-header {
          margin-bottom: 16px;
          padding: 10px 20px;
          border-radius: 20px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(222, 244, 254, 0.8) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 14px 30px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140, 210, 245, 0.2);
        }
        .hero-left { display: flex; align-items: center; gap: 14px; }
        .hero-emblem-3d {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; color: #fff;
          background: radial-gradient(circle at 30% 25%, #b6ecff 0%, #34b6f0 40%, #0a6fb8 100%);
          box-shadow: 0 8px 18px rgba(2, 60, 110, 0.45), inset 0 2px 3px rgba(255, 255, 255, 0.8), inset 0 -4px 8px rgba(0, 60, 120, 0.35);
        }
        .company-title { font-weight: 800; font-size: 1.3rem; color: #0a4f8c; letter-spacing: -0.3px; }
        .doc-info { font-size: 0.76rem; color: #4a7391; font-weight: 600; margin-top: 2px; }

        /* ---------- Glass main card ---------- */
        .report-card-3d {
          padding: 24px;
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(226, 246, 255, 0.88) 100%);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 14px 32px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff, inset 0 -12px 26px rgba(140, 210, 245, 0.2);
        }

        /* light header banner */
        .banner-header-3d {
          margin-bottom: 18px;
          padding: 11px;
          text-align: center;
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: #0a4f8c;
          border-radius: 14px;
          background: linear-gradient(180deg, #f4fbff 0%, #d9eefb 100%);
          border: 1px solid #a6d6ee;
          box-shadow: 0 4px 10px rgba(40, 120, 170, 0.12), inset 0 1px 0 #fff;
        }

        /* ---------- Inset inputs ---------- */
        .form-control-3d, .form-select-3d {
          border: 1.5px solid #9ccbe6 !important;
          border-radius: 12px !important;
          background-color: #ffffff !important;
          color: #0b2f4f;
          box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.12), 0 1px 0 rgba(255, 255, 255, 0.9) !important;
          font-size: 0.83rem;
          padding: 6px 12px;
          font-weight: 700;
          transition: all 0.2s ease;
        }
        .form-control-3d::placeholder { color: #7b9db5; font-weight: 600; }
        .form-control-3d:focus, .form-select-3d:focus {
          border-color: #1b9be0 !important;
          box-shadow: inset 0 1px 2px rgba(10, 80, 130, 0.08), 0 0 0 4px rgba(27, 155, 224, 0.22) !important;
        }
        .form-control-readonly {
          background: linear-gradient(180deg, #f1f7fb 0%, #dbe9f2 100%) !important;
          color: #476a85 !important;
          font-weight: 700;
          cursor: not-allowed;
          border-color: #b8d3e4 !important;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.08) !important;
        }

        /* ---------- Metadata grid ---------- */
        .grid-table-3d {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #a6d6ee;
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 20px;
          box-shadow: 0 8px 20px rgba(10, 100, 160, 0.12);
        }
        .grid-table-3d td {
          border: 1px solid #e1f0f9;
          padding: 8px 12px;
          font-size: 0.82rem;
          vertical-align: middle;
          background-color: #ffffff;
        }
        .grid-label-3d {
          background: linear-gradient(180deg, #f4fbff 0%, #e3f3fc 100%) !important;
          font-weight: 800;
          width: 16%;
          color: #0a4f8c;
          border-right: 1px solid #cfe6f5 !important;
        }

        /* ---------- Parameters table (light header) ---------- */
        .table-iqc-3d {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          border-radius: 16px !important;
          overflow: hidden !important;
          border: 1px solid #a6d6ee !important;
          box-shadow: 0 8px 20px rgba(10, 100, 160, 0.12);
        }
        .table-iqc-3d th {
          background: linear-gradient(180deg, #f4fbff 0%, #d9eefb 100%) !important;
          color: #0a4f8c !important;
          font-size: 0.74rem !important;
          font-weight: 800 !important;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          text-align: center;
          vertical-align: middle;
          padding: 10px 8px !important;
          border: 0 !important;
          border-bottom: 2px solid #9ccbe6 !important;
          border-right: 1px solid #e1f0f9 !important;
        }
        .table-iqc-3d td {
          border: 0 !important;
          border-bottom: 1px solid #dcecf6 !important;
          border-right: 1px solid #f1f8fc !important;
          font-size: 0.8rem;
          padding: 6px 8px;
          vertical-align: middle;
          background-color: #ffffff;
          color: #0b2f4f;
          font-weight: 600;
        }
        .table-iqc-3d tbody tr:nth-of-type(even) td { background-color: #f3faff; }
        .table-iqc-3d tbody tr:hover td { background-color: #d9f2fc; }

        .reading-input-3d {
          width: 100%;
          text-align: center;
          font-size: 0.82rem;
          height: 30px;
          font-family: monospace;
          font-weight: 800;
          color: #0a5fa8;
          border: 1.5px solid #9ccbe6;
          border-radius: 10px;
          background: #ffffff;
          box-shadow: inset 0 2px 4px rgba(10, 80, 130, 0.1);
          transition: all 0.2s ease;
        }
        .reading-input-3d:focus {
          border-color: #1b9be0;
          box-shadow: 0 0 0 3px rgba(27, 155, 224, 0.22);
          outline: none;
        }

        /* ---------- Criteria card ---------- */
        .criteria-card-3d {
          margin-bottom: 18px;
          padding: 14px 20px;
          border-radius: 18px;
          background: linear-gradient(180deg, #ffffff 0%, #eaf7fe 100%);
          border: 1px solid #cfe8f6;
          box-shadow: 0 8px 20px rgba(10, 100, 160, 0.12), inset 0 1px 0 #fff;
        }
        .criteria-title { width: 160px; font-weight: 800; font-size: 0.85rem; color: #0a4f8c; }

        /* ---------- Status badges ---------- */
        .badge-la {
          background: linear-gradient(135deg, #22c55e, #15803d); color: #ffffff;
          padding: 5px 14px; border-radius: 20px; font-size: 0.74rem; font-weight: 700; cursor: pointer;
          box-shadow: 0 2px 6px rgba(22, 163, 74, 0.3), inset 0 1px 0 rgba(255,255,255,0.4);
          transition: transform 0.15s ease;
        }
        .badge-lr {
          background: linear-gradient(135deg, #ef4444, #b91c1c); color: #ffffff;
          padding: 5px 14px; border-radius: 20px; font-size: 0.74rem; font-weight: 700; cursor: pointer;
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3), inset 0 1px 0 rgba(255,255,255,0.4);
          transition: transform 0.15s ease;
        }
        .badge-minor {
          background: linear-gradient(135deg, #22c55e, #15803d); color: white;
          padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 6px rgba(34, 197, 94, 0.25);
        }
        .badge-major {
          background: linear-gradient(135deg, #f97316, #c2410c); color: white;
          padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 6px rgba(234, 88, 12, 0.25);
        }
        .badge-critical {
          background: linear-gradient(135deg, #ef4444, #b91c1c); color: white;
          padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);
        }
        .badge-la:hover, .badge-lr:hover, .badge-minor:hover, .badge-major:hover, .badge-critical:hover {
          transform: translateY(-1px);
        }

        .badge-ok-3d {
          background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff;
          padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 800; display: inline-block;
          box-shadow: 0 2px 5px rgba(22, 163, 74, 0.3);
        }
        .badge-not-ok-3d {
          background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff;
          padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 800; display: inline-block;
          box-shadow: 0 2px 5px rgba(220, 38, 38, 0.3);
        }

        /* ---------- Glossy buttons ---------- */
        .btn-3d-secondary {
          padding: 8px 16px; border-radius: 12px; font-weight: 800; font-size: 0.83rem; color: #0a4f8c;
          border: 1.5px solid #9ccbe6;
          background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
          box-shadow: 0 3px 8px rgba(10, 80, 130, 0.12), inset 0 1px 0 #fff;
          transition: all 0.15s ease;
        }
        .btn-3d-secondary:hover {
          transform: translateY(-1px); color: #0a5fa8; border-color: #1b9be0;
          background: linear-gradient(180deg, #ffffff 0%, #d4f0fd 100%);
        }

        .btn-3d-submit {
          padding: 10px 28px; border-radius: 14px; font-weight: 800; font-size: 0.9rem; letter-spacing: 0.3px; color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.6);
          text-shadow: 0 1px 2px rgba(0, 110, 70, 0.45);
          background: linear-gradient(180deg, #b9f5d6 0%, #5fdda6 48%, #2cc58a 52%, #14a870 100%);
          box-shadow: 0 4px 0 #0d8a5a, 0 12px 22px rgba(20, 168, 112, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.85);
          transition: all 0.12s ease;
        }
        .btn-3d-submit:hover { transform: translateY(-2px); color: #ffffff; filter: brightness(1.05); }
        .btn-3d-submit:active { transform: translateY(3px); box-shadow: 0 1px 0 #0d8a5a, 0 4px 8px rgba(20, 168, 112, 0.22); }
      `}</style>



      {/* Main Report Card */}
      <div className="report-card-3d">
        <div className="banner-header-3d position-relative">
          RECEIVING INSPECTION REPORT (NEW INSPECTION)
          <button
            className="btn btn-3d-secondary d-flex align-items-center gap-2 position-absolute top-50 end-0 translate-middle-y me-2"
            style={{ padding: "4px 12px", fontSize: "0.78rem", letterSpacing: 0, textTransform: "none" }}
            onClick={() => navigate("/receiving-inspection")}
          >
            <i className="bi bi-arrow-left-circle-fill"></i> Back to Dashboard
          </button>
        </div>

        {/* Fetch Mode Selector */}
        <div className="d-flex align-items-center gap-4 mb-3 px-1">
          <span className="fw-bold small" style={{ color: "#0a4f8c" }}>Fetch By :</span>
          <div className="form-check form-check-inline d-flex align-items-center">
            <input
              className="form-check-input me-2"
              type="radio"
              id="modeMaterial"
              name="fetchMode"
              checked={fetchMode === "material"}
              onChange={() => {
                setFetchMode("material");
                setItemCode("");
                setSupplier("");
                setItemDescDetails("");
                setItemData(null);
              }}
            />
            <label htmlFor="modeMaterial" className="fw-semibold small">Raw Material</label>
          </div>
          <div className="form-check form-check-inline d-flex align-items-center">
            <input
              className="form-check-input me-2"
              type="radio"
              id="modeItem"
              name="fetchMode"
              checked={fetchMode === "item"}
              onChange={() => {
                setFetchMode("item");
                setItemCode("");
                setSupplier("");
                setItemDescDetails("");
                setItemData(null);
              }}
            />
            <label htmlFor="modeItem" className="fw-semibold small">Semi-Finished Goods</label>
          </div>
        </div>

        {/* Metadata Grid */}
        <table className="grid-table-3d">
          <tbody>
            {/* Row 1: RIR No. & Item Code */}
            <tr>
              <td className="grid-label-3d" style={{ width: "16%" }}>RIR No. :</td>
              <td style={{ width: "34%" }}>
                <input
                  type="text"
                  className="form-control form-control-3d"
                  placeholder="Enter RIR Number"
                  value={rrNo}
                  onChange={(e) => setRrNo(e.target.value)}
                />
              </td>
              <td className="grid-label-3d" style={{ width: "16%" }}>Item Code :</td>
              <td style={{ width: "34%" }}>
                <input
                  type="text"
                  className="form-control form-control-3d font-monospace fw-bold text-primary"
                  placeholder="Type Item Code to Auto-Fetch..."
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                />
              </td>
            </tr>

            {/* Row 2: Material Type & Tested Date */}
            <tr>
              <td className="grid-label-3d">Material Type :</td>
              <td>
                <select
                  className="form-select form-select-3d fw-bold"
                  value={selectedMat}
                  onChange={(e) => setSelectedMat(e.target.value)}
                >
                  <option value="">-- Select Material Type --</option>
                  {Object.keys(allMaterialSpecs).map((mat) => (
                    <option key={mat} value={mat}>{mat}</option>
                  ))}
                </select>
              </td>
              <td className="grid-label-3d">Tested Date :</td>
              <td>
                <input
                  type="date"
                  className="form-control form-control-3d"
                  value={testedDate}
                  onChange={(e) => setTestedDate(e.target.value)}
                />
              </td>
            </tr>

            {/* Row 3: Supplier Name & PO No. */}
            <tr>
              <td className="grid-label-3d">Supplier Name :</td>
              <td>
                <input
                  type="text"
                  className="form-control form-control-3d form-control-readonly"
                  placeholder="Auto-populated Supplier"
                  value={supplier}
                  readOnly
                />
              </td>
              <td className="grid-label-3d">PO No. :</td>
              <td>
                <input
                  type="text"
                  className="form-control form-control-3d"
                  placeholder="Enter PO Number"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                />
              </td>
            </tr>

            {/* Row 4: Material Description & GIR No. */}
            <tr>
              <td className="grid-label-3d">Material Description :</td>
              <td>
                <input
                  type="text"
                  className="form-control form-control-3d form-control-readonly"
                  placeholder="Auto-populated Description"
                  value={itemDescDetails}
                  readOnly
                />
              </td>
              <td className="grid-label-3d">GIR No. :</td>
              <td>
                <input
                  type="text"
                  className="form-control form-control-3d"
                  placeholder="Enter GIR Number"
                  value={girNo}
                  onChange={(e) => setGirNo(e.target.value)}
                />
              </td>
            </tr>

            {/* Row 5: GSM & Width (Material Code mode only) */}
            {fetchMode === "material" && (
              <tr>
                <td className="grid-label-3d">GSM :</td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-3d form-control-readonly"
                    placeholder="Auto-populated GSM"
                    value={itemData?.gsm || ""}
                    readOnly
                  />
                </td>
                <td className="grid-label-3d">Width :</td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-3d form-control-readonly"
                    placeholder="Auto-populated Width"
                    value={itemData?.width || ""}
                    readOnly
                  />
                </td>
              </tr>
            )}

            {/* Row 6: Length (Material mode) OR Item Attachment (Item mode) & Received Date (Rec) */}
            <tr>
              {fetchMode === "material" ? (
                <>
                  <td className="grid-label-3d">Length :</td>
                  <td>
                    <input
                      type="text"
                      className="form-control form-control-3d form-control-readonly"
                      placeholder="Auto-populated Length"
                      value={itemData?.length || ""}
                      readOnly
                    />
                  </td>
                </>
              ) : (
                <>
                  <td className="grid-label-3d">Item Attachment :</td>
                  <td>
                    {itemData?.pdfPath ? (
                      
                     <a   href={`${BASE_URL}${itemData.pdfPath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-3d-secondary btn-sm d-inline-flex align-items-center gap-2"
                      >
                        <i className="bi bi-file-earmark-pdf-fill text-danger"></i> View PDF
                      </a>
                    ) : (
                      <span
                        className="form-control form-control-3d form-control-readonly"
                        style={{ display: "inline-block" }}
                      >
                        No PDF attached
                      </span>
                    )}
                  </td>
                </>
              )}
              <td className="grid-label-3d">Received Date (Rec) :</td>
              <td>
                <input
                  type="date"
                  className="form-control form-control-3d"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </td>
            </tr>

            {/* Row 7: Invoice Details & Received Quantity */}
            <tr>
              <td className="grid-label-3d">Invoice No. & Date :</td>
              <td>
                <input
                  type="text"
                  className="form-control form-control-3d"
                  placeholder="e.g. INV-2024-001 Dt. 12/05"
                  value={invoiceDetails}
                  onChange={(e) => setInvoiceDetails(e.target.value)}
                />
              </td>
              <td className="grid-label-3d">Received Quantity :</td>
              <td>
                <input
                  type="text"
                  className="form-control form-control-3d fw-bold"
                  placeholder="Enter Received Quantity"
                  value={receivedQty}
                  onChange={(e) => setReceivedQty(e.target.value)}
                />
              </td>
            </tr>

            {/* Row 8: Location / Unit & Sampling Number */}
            <tr>
              <td className="grid-label-3d">Location / Unit :</td>
              <td>
                <select
                  className="form-select form-select-3d"
                  value={locationSelect}
                  onChange={(e) => setLocationSelect(e.target.value)}
                >
                  {locations.length === 0 && <option value="">-- No Locations Found --</option>}
                  {locations.map((loc) => (
                    <option key={loc._id} value={loc.locationName}>{loc.locationName}</option>
                  ))}
                </select>
              </td>
              <td className="grid-label-3d">Sampling Number :</td>
              <td>
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="number"
                    className="form-control form-control-3d fw-bold"
                    style={{ width: 90 }}
                    value={samplingNumber}
                    min={1}
                    max={20}
                    onChange={(e) => setSamplingNumber(e.target.value)}
                  />
                  <span className="small text-muted fst-italic text-nowrap">
                    (Adjusts columns)
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Parameters & Readings Table */}
        <div className="table-responsive mb-4">
          <table className="table table-bordered table-iqc-3d align-middle">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: 45 }}>S #</th>
                <th rowSpan={2} style={{ width: 220 }}>PARAMETERS</th>
                <th rowSpan={2}>SPECIFICATION</th>
                <th rowSpan={2} style={{ width: 100 }}>TOL. LIMIT</th>
                <th rowSpan={2} style={{ width: 75 }}>UOM</th>
                <th colSpan={count}>TESTED RESULTS</th>
                <th rowSpan={2} style={{ width: 90 }}>REMARKS</th>
              </tr>
              <tr>
                {specs && Array.from({ length: count }, (_, i) => (
                  <th key={i} className="text-center" style={{ minWidth: 55 }}>{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!specs ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    <i className="bi bi-layers fs-3 d-block mb-1 text-secondary"></i>
                    Select a <strong>Material Type</strong> above to automatically load inspection parameters.
                  </td>
                </tr>
              ) : (
                specs.map((p, idx) => {
                  const remark = checkRemark(
                    { parameter: p.parameter, tolLimit: p.tolLimit, readings: rows[idx]?.readings || [] },
                    itemData
                  );
                  return (
                    <tr key={idx} className="parameter-row">
                      <td className="text-center font-monospace fw-bold">{p.sNo}</td>
                      <td className="fw-semibold text-dark">{p.parameter}</td>
                      <td>{p.specification}</td>
                      <td className="text-center fw-bold">{p.tolLimit}</td>
                      <td className="text-center">{p.uom}</td>
                      {Array.from({ length: count }, (_, i) => (
                        <td key={i} style={{ padding: 4 }}>
                          <input
                            type="text"
                            className="reading-input-3d"
                            placeholder="-"
                            value={rows[idx]?.readings[i] || ""}
                            onChange={(e) => updateReading(idx, i, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-center">
                        {remark === "OK" ? (
                          <span className="badge-ok-3d">OK</span>
                        ) : remark === "NOT OK" ? (
                          <span className="badge-not-ok-3d">NOT OK</span>
                        ) : (
                          <span className="text-muted font-monospace">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Criteria Selection Card */}
        <div className="criteria-card-3d">
          <div className="d-flex flex-wrap align-items-center mb-3">
            <span className="criteria-title">Acceptance Criteria :</span>
            <div className="form-check form-check-inline me-4 d-flex align-items-center">
              <input
                className="form-check-input me-2"
                type="radio"
                id="accLA"
                name="acceptanceRadio"
                checked={acceptanceRadio === "LA (Lot Accept)"}
                onChange={() => setAcceptanceRadio("LA (Lot Accept)")}
              />
              <label htmlFor="accLA" className="badge-la">● LA (Lot Accept)</label>
            </div>
            <div className="form-check form-check-inline d-flex align-items-center">
              <input
                className="form-check-input me-2"
                type="radio"
                id="accLR"
                name="acceptanceRadio"
                checked={acceptanceRadio === "LR (Lot Reject)"}
                onChange={() => setAcceptanceRadio("LR (Lot Reject)")}
              />
              <label htmlFor="accLR" className="badge-lr">● LR (Lot Reject)</label>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center">
            <span className="criteria-title">Defect Criteria :</span>
            <div className="form-check form-check-inline me-4 d-flex align-items-center">
              <input
                className="form-check-input me-2"
                type="radio"
                id="defMinor"
                name="defectRadio"
                checked={defectRadio === "Minor Defect"}
                onChange={() => setDefectRadio("Minor Defect")}
              />
              <label htmlFor="defMinor" className="badge-minor">● Minor</label>
            </div>
            <div className="form-check form-check-inline me-4 d-flex align-items-center">
              <input
                className="form-check-input me-2"
                type="radio"
                id="defMajor"
                name="defectRadio"
                checked={defectRadio === "Major Defect"}
                onChange={() => setDefectRadio("Major Defect")}
              />
              <label htmlFor="defMajor" className="badge-major">● Major</label>
            </div>
            <div className="form-check form-check-inline d-flex align-items-center">
              <input
                className="form-check-input me-2"
                type="radio"
                id="defCritical"
                name="defectRadio"
                checked={defectRadio === "Critical Defect"}
                onChange={() => setDefectRadio("Critical Defect")}
              />
              <label htmlFor="defCritical" className="badge-critical">● Critical</label>
            </div>
          </div>
        </div>

        {/* Remarks Section */}
        <div className="mb-4">
          <label className="fw-bold small mb-2" style={{ color: "#0a4f8c" }}>
            <i className="bi bi-chat-left-text me-1 text-primary"></i> QC Remarks & Observations:
          </label>
          <textarea
            className="form-control form-control-3d"
            rows={2}
            placeholder="Add any quality inspection comments, discrepancies, or notes..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>

        {/* Auditor Signatures Row */}
        <div className="row g-3 small fw-bold mb-4 pt-2 border-top align-items-center" style={{ borderColor: "#cfe6f5" }}>
          <div className="col-md-6 d-flex align-items-center gap-2">
            <span style={{ minWidth: 100, color: "#0a4f8c" }}>QC Done By :</span>
            <input
              type="text"
              className="form-control form-control-3d w-50"
              placeholder="Auditor Name"
              value={qcDoneBy}
              onChange={(e) => setQcDoneBy(e.target.value)}
            />
          </div>
          <div className="col-md-6 d-flex align-items-center justify-content-md-end gap-2">
            <span style={{ minWidth: 100, color: "#0a4f8c" }}>Checked By :</span>
            <input
              type="text"
              className="form-control form-control-3d w-50"
              placeholder="Supervisor Name"
              value={checkedBy}
              onChange={(e) => setCheckedBy(e.target.value)}
            />
          </div>
        </div>

        {/* Submit Action */}
        <div className="text-end pt-2">
          <button className="btn btn-3d-submit d-inline-flex align-items-center gap-2" onClick={submitForm}>
            <i className="bi bi-check2-circle fs-6"></i> Submit Inspection Report
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewInspectionForm;