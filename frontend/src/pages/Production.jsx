import { useState,useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import "../styles/production.css";
import BASE_URL from "../config/api";

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
    productionType: "" 
  };
const showAlert = (message, icon = "warning") => {

  let bgColor = "#ffc0cb"; // default pink for warning

  if (icon === "success") bgColor = "#ffffff";   // blue
  if (icon === "error") bgColor = "#e5e8e8";     // red
  if (icon === "info") bgColor = "#17a2b8";      // cyan

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
    const decoded = jwtDecode(token);
    setLoggedInUser(decoded.name);
  }
}, []);

  const validateDigits = (value, limit) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length > limit) {
    showAlert(`Only ${limit} digits allowed`,"error");
    return false;
  }
  return true;
};
const truncateText = (text, length = 7) => {
  if (!text) return "-";
  return text.length > length ? text.substring(0, length) + "..." : text;
};
const deleteReel = async (id) => {
  if (!window.confirm("Delete this reel?")) return;

  try {
    await axios.delete(`${BASE_URL}/api/production/${id}`, getAuthConfig());
    showAlert("Reel Deleted Successfully 🗑️", "success");

    fetchReels(form.efiWoNumber); // refresh table
  } catch (err) {
    showAlert("Error deleting reel", "error");
  }
};

const handleChange = async (e) => {

  const { name, value } = e.target;

  // ✅ SKIP ALL VALIDATION FOR REEL NO — handle separately
  if (name === "reelNo") {
    setAutoFetchedNet(false);

    setForm(prev => ({
      ...prev,
      reelNo: value,
      actualNetWeight: ""
    }));

    if (!value) return;

    try {
      const res = await axios.get(
        `${BASE_URL}/api/production/reel/${value}`, getAuthConfig()
      );

      setForm(prev => {
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

    return; // ✅ EXIT early — skip all validation below
  }

  // ✅ FETCH MILL ONLY FOR MAKE READY
  if (value === "Make Ready") {
  try {
    const res = await axios.get(
      `${BASE_URL}/api/master/materials/mills`,
      getAuthConfig()
    );

    setMills(res.data); // store mills from admin
  } catch (err) {
    console.error("Mill fetch error:", err);
  }
}
  
  if (name === "actualNetWeight") {
  setAutoFetchedNet(false); // 🔥 user typing manually
}
  // ✅ Skip validation for productionDate
  if (name !== "productionDate") {

    // 🚫 Block minus & negative values
    if (value.includes("-") || (!isNaN(value) && Number(value) < 0)) {
      showAlert("Negative values are not allowed","error");
      return;
    }
if (
  name === "grossWeight" ||
  name === "millNetWeight" ||
  name === "actualNetWeight"
) {
  // 🚫 Max 3 digits before decimal & 2 after
  if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) {
    showAlert("Max 3 digits before decimal & 2 after decimal allowed","error");
    return;
  }
  

  // 🚫 Actual Net should not exceed Gross
  if (name === "actualNetWeight") {
    const gross = Number(form.grossWeight || 0);
    const actual = Number(value || 0);

   // validate only if gross entered
if (gross && actual > gross) {
  showAlert("Actual Net Weight cannot be greater than Gross Weight","error");
  return;
}
  }
}
  // 🚫 ReelNo special character block (paste safe)
if (name === "reelNo") {
 
  setAutoFetchedNet(false); // 🔥 reset readonly state

  setForm(prev => ({
    ...prev,
    reelNo: cleanValue,
    actualNetWeight: ""
  }));

  if (!cleanValue) return;

  try {
    const res = await axios.get(
     `${BASE_URL}/api/production/reel/${cleanValue}`,getAuthConfig()
    );

    // ✅ VERY IMPORTANT CHECK
    // only update if reelNo still same
    setForm(prev => {
      if (prev.reelNo !== cleanValue) return prev;

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
// 🚨 For printWaste & coreWeight
if (name === "printWaste" || name === "realEndWaste") {

  // 🚫 Block +, -, e
  if (value.includes("+") || value.includes("-") || value.toLowerCase().includes("e")) {
    showAlert("Invalid characters are not allowed","error");
    return;
  }

  // 🚫 Allow max 3 digits before decimal & 2 after
  if (!/^\d{0,2}(\.\d{0,2})?$/.test(value)) {
    showAlert("Maximum 2 digits and 2 decimal places allowed","error");
    return;
  }
  // 🚫 Balance cannot be greater than Actual Net Weight
if (name === "balance") {

  const actualNet = Number(form.actualNetWeight || 0);
  const balanceValue = Number(value || 0);

  if (balanceValue > actualNet) {
    showAlert("Balance cannot be greater than Actual Net Weight","error");
    return;
  }
}

setForm(prev => ({ ...prev, [name]: value }));    
}
  setForm(prev => ({ ...prev, [name]: value }));

  // 🔥 Reel auto-fetch logic
// 🔥 Reel auto-fetch logic
if (name === "reelNo" && value) {
  try {
    const res = await axios.get(
      `${BASE_URL}/api/production/reel/${value}`,getAuthConfig()
    );

    if (res.data) {
      setForm(prev => ({
        ...prev,
        reelNo: value,
        actualNetWeight: res.data.balance ?? "",
      }));
    }
  } catch (err) {
    console.log("No previous reel found");
  }
}
};

  // FETCH WORK ORDER
  const fetchWO = async () => {
    if (!form.efiWoNumber) return showAlert("Enter WO Number","error");

    try {
    const res = await axios.get(
  `${BASE_URL}/api/production/workorder/${form.efiWoNumber}`,
  getAuthConfig()
);
     const woData = res.data;

setJob(woData);
fetchReels(form.efiWoNumber);

// ✅ auto-select mill if only one exists
if (woData.materials && woData.materials.length === 1) {
  setForm(prev => ({
    ...prev,
    mill: woData.materials[0].mill || ""
  }));
}
    } catch {
      showAlert("Work Order not found","error");
    }
  };
  const fetchReels = async (wo) => {
  if (!wo) return;

  try {
   const res = await axios.get(
  `${BASE_URL}/api/production/workorder/${wo}/reels`,
  getAuthConfig()
);

    console.log("Reels API Response:", res.data);

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
    setRemarks(""); // clear if not required
  }
}, [wastePercent]);
 


  // SAVE PRODUCTION
  const save = async () => {
  if (!job) return showAlert("Fetch Work Order first","error");

  // 🚫 WO number inside reel must match fetched WO
if (Number(form.reelWoNumber) !== Number(form.efiWoNumber)) {
  showAlert("WO Number does not match fetched Work Order","error");
  return;
}

  // ✅ REQUIRED FIELD VALIDATION
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
  showAlert("Production Date is required","error");
  return;
}

  for (let field of requiredFields) {
    if (form[field] === "" || form[field] === null) {
      showAlert(`${field.replace(/([A-Z])/g, " $1")} is required`,"error");
      return;
    }
  }

  if (remarksRequired) {
  if (!remarks || remarks.length < 10) {
    showAlert("Remarks must be at least 10 characters long","error");
    return;
  }
  // optional: ensure no special characters again
  if (/[-+,.&*^%$#@_<>/e{}[]\|]/.test(remarks)) {
    showAlert("Special characters not allowed","error");
    return;
  }
}
  // 🚫 Block saving if Actual Net Weight is 0
if (Number(form.actualNetWeight) === 0) {
  showAlert("Actual Net Weight cannot be 0","error");
  return;
}
    if (!job) return showAlert("Fetch Work Order first","error");

    try {
          // 🚫 Final validation before saving
if (
  Number(form.grossWeight) > 0 &&
  Number(form.actualNetWeight) > Number(form.grossWeight)
) {
  showAlert("Actual Net Weight cannot be greater than Gross Weight","error");
  return;
}
// 🚫 Balance should not be greater than Actual Net Weight
if (Number(form.balance) > Number(form.actualNetWeight)) {
  showAlert("Balance cannot be greater than Actual Net Weight","error");
  return;
}
     if (editingReelId) {

  await axios.put(
    `${BASE_URL}/api/production/${editingReelId}`,
    {
      ...form,
      productionDate,
      productionUser: loggedInUser,
      remarks: remarksRequired ? remarks : ""
    },
      getAuthConfig()
  );

  showAlert("Reel Updated Successfully ✅","success");
  setEditingReelId(null);

} else {

  await axios.post(`${BASE_URL}/api/production`, {
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
    productionUser: loggedInUser,
    remarks: remarksRequired ? remarks : ""
    
  },
  getAuthConfig()
  );
   

  showAlert("Reel Saved Successfully ✅","success");
}
// reset only reel fields
setForm(prev => ({
  ...emptyForm,
  efiWoNumber: prev.efiWoNumber,
  mill: prev.mill
}));

fetchReels(form.efiWoNumber);

    } catch (err) {
      console.error("SAVE ERROR:", err.response?.data || err.message);
      showAlert(err.response?.data?.message || "Error saving","error");
    }
  };

  return (
   <div className="prod-contain" style={{ background: "#90d1fa4c" }}>
  <div className="header-row d-flex flex-wrap align-items-center justify-content-between mb-3">

  {/* Empty div to balance left side */}
  <div style={{ width: "200px" }}></div>

  <h1 className="text-center m-0 flex-grow-1">
    Reel Register Entry
  </h1>

  <div className="date-box d-flex align-items-center gap-2">
    <label className="mb-0"><b>Production Date:</b></label>

    <input
      type="date"
      value={productionDate}
      onChange={(e) => setProductionDate(e.target.value)}
      className="form-control"
       style={{ maxWidth: "180px", width: "100%" }}
    />
  </div>

</div>
{/* WORK ORDER */}
<div
  className="card p-3 mt-0  "
  style={{
  border: "1px solid #dcdfe4",
  borderRadius: "10px",
  background: "#e9f8f7",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.69)"
}}
>
  <div className="row align-items-end mb-3">
    <div className="col-md-9">
      <label className="form-label text-black"><h6><b>WO number</b></h6></label>
      <input
        name="efiWoNumber"
        placeholder="Enter WO Number"
        value={form.efiWoNumber}
        onChange={handleChange}
        className="form-control border-dark"
      />
    </div>

    <div className="col-md-2">
      <button className="btn btn-primary w-100 mt-4" onClick={fetchWO}>
        Fetch
      </button>
    </div>
  </div>

 {/* FETCHED JOB DETAILS */}
{job && (
  <div
    className="card shadow-lg border-0 mb-2"
    style={{ background: "#bfeeec", borderRadius: "12px" }}
  >
    <div className="card-body">
      <div className="row g-2 text-center">

        <div className="col-md-2">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>WO Date:</b></small>
            <h6>{new Date(job.date).toLocaleDateString("en-IN")}</h6>
          </div>
        </div>

        <div className="col-md-3">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>Customer Name:</b></small>
            <h6>{job.customerName}</h6>
          </div>
        </div>

        <div className="col-md-4">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>Job Description:</b></small>
            <h6>{job.jobDescription}</h6>
          </div>
        </div>

        <div className="col-md-2">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>Job Size:</b></small>
            <h6>{job.jobSize}</h6>
          </div>
        </div>

        <div className="col-md-2">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>UPS:</b></small>
            <h6>{job.ups}</h6>
          </div>
        </div>

        <div className="col-md-2">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>Paper Code:</b></small>
            <h6>
              {job.materials?.map((m, i) => (
                <div key={i}>{m.materialCode}</div>
              ))}
            </h6>
          </div>
        </div>

        <div className="col-md-4">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>Material Description:</b></small>
            <h6>
              {job.materials?.map((m, i) => (
                <div key={i}>{m.materialDescription}</div>
              ))}
            </h6>
          </div>
        </div>

        <div className="col-md-3">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>Material Group:</b></small>
            <h6>
              {job.materials?.map((m, i) => (
                <div key={i}>{m.materialGroupDescription}</div>
              ))}
            </h6>
          </div>
        </div>

        <div className="col-md-2">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>Mill Name:</b></small>
            <h6>
              {[...new Set(job.materials?.map(m => m.mill))].map((mill, i) => (
                <div key={i}>{mill}</div>
              ))}
            </h6>
          </div>
        </div>

        <div className="col-md-2">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>GSM:</b></small>
            <h6>
              {job.materials?.map((m, i) => (
                <div key={i}>{m.gsm}</div>
              ))}
            </h6>
          </div>
        </div>

        <div className="col-md-2">
          <div className="p-2 border rounded bg-light">
            <small className="text-black"><b>Paper Size:</b></small>
            <h6>
              {job.materials?.map((m, i) => (
                <div key={i}>{m.paperSize}</div>
              ))}
            </h6>
          </div>
        </div>

      </div>
    </div>
  </div>
)}
</div>

     {job && (
  <>
   <div
      className="card"
      style={{ border: "1px solid #d6dfdc", borderRadius: "10px", padding: "15px", marginBottom: "20px", background: "#e9f8f7" }}
    >
    {/* REEL DETAILS */}
    <div className="card shadow-lg" style={{ background: "#bfeeec"}}>
      <h3 className="text-center">Reel Details</h3>
      <div className="form-grid">
        <div>
  <label className="text-black">WO Number</label>
  <input
    type="number"
    name="reelWoNumber"
    value={form.reelWoNumber}
    onChange={handleChange}
    onKeyDown={(e) => {
      if (e.key === "-" || e.key === "+" || e.key === "e") {
        e.preventDefault();
        showAlert("Invalid characters are not allowed","error");
      }
    }}
  />
</div>

        <div>
          <label className="text-black">Reel No</label>
         <input
  name="reelNo"
  value={form.reelNo}
  onChange={handleChange}
onKeyDown={(e) => {
  if (!/^[a-zA-Z0-9\-\/\\]$/.test(e.key) &&
      e.key !== "Backspace" &&
      e.key !== "Delete" &&
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight" &&
      e.key !== "Tab") {
    e.preventDefault();
  }
}}
/>
        </div>

       <div>
          <label className="text-black">Gross Net Weight</label>
       <input
  type="number"
  step="0.01"
  name="grossWeight"
  value={form.grossWeight}
  onChange={handleChange}
  readOnly={autoFetchedNet}
  onKeyDown={(e) => {
              if (e.key === "-" ||e.key === "+" || e.key === "e") {
                e.preventDefault();
                showAlert("Negative values are not allowed","error");
              }
            }}
/>
        </div>

        <div>
          <label className="text-black">Mill Net Weight</label>
         <input
  type="number"
  step="0.01"
  name="millNetWeight"
  value={form.millNetWeight}
  onChange={handleChange}
  readOnly={autoFetchedNet}
 onKeyDown={(e) => {
              if (e.key === "-" ||e.key === "+" || e.key === "e") {
                e.preventDefault();
                showAlert("Negative values are not allowed","error");
              }
            }}
/>
        </div>

        <div>
          <label className="text-black">Actual Net Weight</label>
       <input
  type="number"
  name="actualNetWeight"
  value={form.actualNetWeight}
  onChange={handleChange}
  readOnly={autoFetchedNet}
   onKeyDown={(e) => {
              if (e.key === "-" ||e.key === "+" || e.key === "e") {
                e.preventDefault();
                showAlert("Negative values are not allowed","error");
              }
            }}
/>
        </div>

        <div>
          <label className="text-black">Actual GSM</label>
         <input
  type="number"
  name="actualGsm"
  value={form.actualGsm}
  onChange={handleChange}
  onInput={(e) => {
  if (e.target.value.length > 3) {
    showAlert("Only 5 digits allowed","error");
    e.target.value = e.target.value.slice(0,3);
  }
  
}}
  onKeyDown={(e) => {
              if (e.key === "-" ||e.key === "+" || e.key === "e") {
                e.preventDefault();
                showAlert("Negative values are not allowed","error");
              }
            }}
/>
        </div>
        <div>
          <label className="text-black"> Production Output</label>
          <input
            type="number"
            min="0"
            name="productionOutput"
            value={form.productionOutput}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === "-" ||e.key === "+" || e.key === "e") {
                e.preventDefault();
                showAlert("Negative values are not allowed","error");
              }
            }}
          />
        </div>

        <div>
          <label className="text-black">Reel Balance</label>
        <input
  type="number"
  name="balance"
  value={form.balance}
  onChange={(e) => {

    const value = e.target.value;

    const actualNet = Number(form.actualNetWeight || 0);
    const balanceValue = Number(value || 0);

    if (balanceValue > actualNet) {
      showAlert("Balance cannot be greater than Actual Net Weight","error");
      return;
    }

    handleChange(e);
  }}
  onKeyDown={(e) => {
    if (e.key === "-" || e.key === "+" || e.key === "e") {
      e.preventDefault();
      showAlert("Negative values are not allowed","error");
    }
  }}
/>
        </div>
    <div className="mill-field">
  <label className="text-black">Mill Name</label>
  <select
    name="mill"
    value={form.mill || ""}
    onChange={handleChange}
    className="input"
  >
    <option value="">Select Mill</option>

    {(form.productionType === "Make Ready"
      ? mills // ✅ from admin
      : job.materials?.map((m) => m.mill) // ✅ existing logic
    )?.map((m, i) => (
      <option key={i} value={m}>
        {m}
      </option>
    ))}
  </select>
</div>
<div>
  <label className="text-black">Production Type</label>
  <select
    name="productionType"
    value={form.productionType}
    onChange={handleChange}
    className="input"
  >
    <option value="">Select Type</option>
    <option value="Make Ready">Make Ready</option>
    <option value="Production">Production</option>
  </select>
</div>
      </div>
    </div>
    </div>

    {/* WASTE DETAILS */}
    <div
      className="card"
      style={{ border: "1px solid #d6dfdc", borderRadius: "10px", padding: "15px", marginBottom: "20px", background: "#e9f8f7" }}
    >
    <div className="card shadow-lg"  style={{ background:"#bfeeec"}}>
      <h3 className="text-center">Reel Waste Details</h3>
      <div className="form-grid">
        <div>
          <label className="text-black">Reel Matt Waste</label>
          <input
            type="number"
            min="0"
            name="mattWaste"
            value={form.mattWaste}
            onChange={handleChange}
           onInput={(e) => {
  if (e.target.value.length > 5) {
    showAlert("Only 2 digits allowed","error");
    e.target.value = e.target.value.slice(0,5);
  }
}}
            onKeyDown={(e) => {
              if (e.key === "-" ||e.key === "+" || e.key === "e") {
                e.preventDefault();
                showAlert("Negative values are not allowed","error");
              }
            }}
          />
        </div>
              <div>
                <label className="text-black">Reel Print Waste</label>
                <input type="number"  min="0" name="printWaste" value={form.printWaste}
               onInput={(e) => {
  if (e.target.value.length > 5) {
    showAlert("Only 5 digits allowed","error");
    e.target.value = e.target.value.slice(0,5);
  }
}}
                 onChange={handleChange} 
                onKeyDown={(e) => {
  if (e.key === "-" ||e.key === "+" || e.key === "e") {
    e.preventDefault();
    showAlert("Negative values are not allowed","error");
  }
}}/>
              </div>
              <div>
                <label className="text-black">Reel End Waste</label>
                <input type="number"  min="0" name="realEndWaste" value={form.realEndWaste}
                onChange={handleChange} onKeyDown={(e) => {
  if (e.key === "-" || e.key === "+" ||e.key === "e") {
    e.preventDefault();
    showAlert("Negative values are not allowed","error");
  }
}}/>
              </div>
              <div>
                <label className="text-black">Reel Core Waste</label>
                <input type="number"  min="0" name="coreWeight" value={form.coreWeight}
               onInput={(e) => {
  if (e.target.value.length > 5) {
    showAlert("Only 5 digits allowed","error");
    e.target.value = e.target.value.slice(0,5);
  }
}}
                onChange={handleChange} onKeyDown={(e) => {
  if (e.key === "-" ||e.key === "+" || e.key === "e") {
    e.preventDefault();
    showAlert("Negative values are not allowed","error");
  }
}}/>
              </div>
            </div>
          </div>
{remarksRequired && (
  <div className="card shadow-lg"  style={{ background:"#bfeeec"}}>
    <h3 className="text-black">Remarks</h3>
    <div>
      <input
        type="text"
        placeholder="Reason for wastage"
        value={remarks}
        onChange={(e) => {
          // Only allow letters, numbers and spaces
          const cleanValue = e.target.value.replace(/[^a-zA-Z0-9 ]/g, "");
          setRemarks(cleanValue);
        }}
        onKeyDown={(e) => {
          // Block all special characters
          if (!/^[a-zA-Z0-9 ]$/.test(e.key) &&
              e.key !== "Backspace" &&
              e.key !== "Delete" &&
              e.key !== "ArrowLeft" &&
              e.key !== "ArrowRight" &&
              e.key !== "Tab") {
            e.preventDefault();
            showAlert("Special characters are not allowed","error");
          }
        }}
      />
    </div>
  </div>
)}
</div>  

          {/* SUMMARY */}
           <div
      className="card"
      style={{ border: "1px solid #d6dfdc", borderRadius: "10px", padding: "15px", marginBottom: "20px", background: "#e9f8f7" }}
    >
         <div className="summary-box shadow-lg "  style={{ background: "#bfeeec"}}>
  <h3 className="summary-title text-center">Production Summary</h3>

  <div className="summary-grid">
    <div className="summary-item">
      <span>Total Waste :</span>
      <strong>{TotalWaste} KG</strong>
    </div>

    <div className="summary-item">
      <span>Waste % :</span>
      <strong>{wastePercent}%</strong>
    </div>
            </div>
          </div>
          </div>

           <div className="col-md-12 d-flex justify-content-center">
  <div className="col-md-1">
    <button className="btn btn-primary w-100 mt-3" onClick={save}>
      Save
    </button>
  </div>
</div>
          {/* SAVED REELS FULL TABLE */}
          
   
<div className="reel-card"  style={{ border: "2px solid black" ,background: "#bfeeec45"}}>
  <h3 className="reel-title text-center">Reel Entries</h3>

  <div className="reel-table-wrapper" >
    <table className="reel-table" >
      <thead>
        <tr>
          <th>Reel No</th>
          <th>Gross Weight</th>
          <th>Mill Net Weight</th>
          <th>Actual Net Weight</th>
          <th>Actual GSM</th>
          <th>Production Output</th>
          <th>Reel Matt Waste</th>
          <th>Reel Print Waste</th>
          <th>Reel End Waste</th>
          <th>Reel Core Waste</th>
          <th>Total Waste</th>
          <th>Waste %</th>
          <th>Reel Balance Weight</th>
          <th>Mill name</th>
          <th>Production Type</th>
          <th>Entered By</th>
          <th>Remarks</th>
          <th>User Location</th>
          <th>Action</th>
          <th>Delete</th>
        </tr>
      </thead>

     <tbody>
  {reels.length === 0 ? (
    <tr>
      <td colSpan="18" className="reel-empty">
        No entries yet
      </td>
    </tr>
  ) : (
    [...reels]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => {

        const totalWaste =
          r.mattWaste +
          r.printWaste +
          r.realEndWaste +
          r.coreWeight;

        const netAfterBalance =
          Number(r.actualNetWeight || 0) - Number(r.balance || 0);

        const wastePercent =
          netAfterBalance > 0
            ? ((totalWaste / netAfterBalance) * 100).toFixed(2)
            : 0;

        return (
          <tr key={r._id}>

            <td className="reel-highlight">{r.reelNo}</td>
            <td>{r.grossWeight}</td>
            <td>{r.millNetWeight}</td>
            <td>{r.actualNetWeight}</td>
            <td>{r.actualGsm}</td>
            <td>{r.productionOutput}</td>
            <td>{r.mattWaste}</td>
            <td>{r.printWaste}</td>
            <td>{r.realEndWaste}</td>
            <td>{r.coreWeight}</td>

           <td className="reel-waste">{Number(totalWaste || 0).toFixed(2)}</td>
            <td>{Number(wastePercent || 0).toFixed(2)}%</td>

            <td className="reel-balance">{r.balance}</td>

            <td>{r.mill}</td>
            <td>{r.productionType}</td>

            <td className="reel-user">
              <div>{r.productionUser || "-"}</div>
              <small>
                {new Date(r.createdAt).toLocaleDateString("en-IN")} <br />
                {new Date(r.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </td>

            <td
  style={{
    cursor: "pointer",
    whiteSpace: expandedCell === `remarks-${r._id}` ? "normal" : "nowrap"
  }}
  onClick={() =>
    setExpandedCell(
      expandedCell === `remarks-${r._id}` ? null : `remarks-${r._id}`
    )
  }
>
  {expandedCell === `remarks-${r._id}`
    ? r.remarks || "-"
    : truncateText(r.remarks)}
</td>
         <td>
  {r.userLocations?.filter(Boolean).length > 0
    ? r.userLocations.filter(Boolean).join(", ")
    : "-"}
</td>

            <td>
              {loggedInUser &&
              r.productionUser?.trim() === loggedInUser.trim() ? (
                <button
                  className="reel-edit-btn"
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
                    });

                    setProductionDate(
                      new Date(r.productionDate).toISOString().slice(0, 10)
                    );

                    setRemarks(r.remarks || "");
                    setAutoFetchedNet(false);

                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Edit
                </button>
              ) : (
                "-"
              )}
            </td>

            <td>
  {loggedInUser &&
  r.productionUser?.trim() === loggedInUser.trim() ? (
    <button
      className="btn btn-danger btn-sm"
      onClick={() => deleteReel(r._id)}
    >
      Delete
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
</div>
  </>
      )}
    </div>
  );
}
export default Productiondashboard;