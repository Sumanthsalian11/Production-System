import { useEffect, useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";


function ManualBoxPage() {
  const [formData, setFormData] = useState({
    poNumber: "",
    dispatchLocation: "",
    fromNo: "",
    toNumber: "",
    qtyInBox: "",
    boxNumber: "",
  });
  const [loggedInUser, setLoggedInUser] = useState("");
  const [userLocations, setUserLocations] = useState([]);
  const fileInputRef = useRef(null);
  const [excelFile, setExcelFile] = useState(null);
  const [savedData, setSavedData] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setLoggedInUser(decoded.name || "");
        setUserLocations(decoded.locations || []);
      } catch {
        console.error("Invalid token");
      }
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/manual-box/all`);
      setSavedData(res.data.data || []);
    } catch (error) {
      console.log(error);
    }
  };

  const uploadExcel = async () => {
    if (!excelFile) {
      toast.error("Please select a file first");
      return;
    }

    // Frontend duplicate PO check
    try {
      const payload = new FormData();
      payload.append("file", excelFile);
      payload.append("enteredBy", loggedInUser);
      payload.append("userLocations", JSON.stringify(userLocations));
      const res = await axios.post(
        `${BASE_URL}/api/manual-box/upload-excel`,
        payload,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
toast.success(res.data.message);
setExcelFile(null);
if (fileInputRef.current) fileInputRef.current.value = "";
fetchData();
    } catch (error) {
      console.log(error);
      const msg = error.response?.data?.message || "Upload failed";
      // Show duplicate PO error clearly
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("po number")) {
        toast.error("❌ Duplicate PO Number: " + msg, { duration: 5000 });
      } else {
        toast.error(msg);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveData = async () => {
    try {
      const res = await axios.post(`${BASE_URL}/api/manual-box/save`, formData);
      toast.success(res.data.message);
      setFormData({
        poNumber: "",
        dispatchLocation: "",
        fromNo: "",
        toNumber: "",
        qtyInBox: "",
        boxNumber: "",
      });
      fetchData();
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Save failed");
    }
  };

  const downloadPDF = (id) => {
    window.open(`${BASE_URL}/api/manual-box/pdf/${id}`, "_blank");
  };

  const toggleExpand = (id, field) => {
    setSavedData((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, [field]: !item[field] } : item
      )
    );
  };

  return (
    <div style={pageStyle}>
      {/* Background image */}
      <div style={bgImageStyle} />
      {/* Light overlay — enough to read text, image still visible */}
      <div style={bgOverlayStyle} />

      {/* Decorative orbs */}
      <div style={orb1Style} />
      <div style={orb2Style} />
      <div style={orb3Style} />

      {/* Content */}
      <div style={contentWrapStyle}>

        {/* Header */}
       <div style={headerStyle}>
  <div style={{ textAlign: "center", width: "100%" }}>
    <h1 style={titleStyle}>Dispatch</h1>
    <p style={subtitleStyle}>
      Upload Excel dispatch data and review saved records.
    </p>
  </div>
          <div style={badgeStyle}>
            <span style={badgeDotStyle} />
            Live
          </div>
        </div>

        {/* Upload Card */}
        <div style={glassCardStyle}>
          <div style={cardInnerTopStyle}>
            <div style={cardIconWrapStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p style={cardLabelStyle}>Excel Upload</p>
              <p style={cardSubLabelStyle}>Import dispatch records — duplicate PO Numbers will be rejected</p>
            </div>
          </div>

          <div style={dividerStyle} />

          <div style={uploadActionsStyle}>
            <label style={fileLabelStyle}>
            <input
  ref={fileInputRef}
  type="file"
  accept=".xlsx,.xls"
  onChange={(e) => setExcelFile(e.target.files[0])}
  style={fileInputStyle}
/>
              <span style={fileButtonStyle}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Choose File
              </span>
              <span style={fileNameStyle}>
                {excelFile ? excelFile.name : "No file selected"}
              </span>
            </label>

            <button onClick={uploadExcel} style={uploadButtonStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 7 }}>
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
                <path d="M5 20h14" />
              </svg>
              Upload Excel
            </button>
          </div>
        </div>

        {/* Table Card */}
        <div style={glassCardStyle}>
          <div style={tableHeaderStyle}>
            <div style={cardInnerTopStyle}>
              <div style={{ ...cardIconWrapStyle, background: "rgba(56,189,248,0.18)", color: "#38bdf8" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </div>
              <div>
                <p style={cardLabelStyle}>Saved Records</p>
                <p style={cardSubLabelStyle}>
                  {savedData.length} record{savedData.length === 1 ? "" : "s"} found
                </p>
              </div>
            </div>
            <div style={recordCountBadgeStyle}>{savedData.length}</div>
          </div>

          <div style={dividerStyle} />

      <div className="table-responsive">
            <div style={tableWrapperStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      "PO Number",
                      "PO Date",
                      "Delivery Date",
                      "Delivery Address",
                      "GSTIN",
                      "Quantity",
                      "Article No\nHSN Code",
                      "EAN No\nVendor Article No.\nVendor Item No",
                      "Material Description\nDelivery Date\nSite",
                      "Each Box Qty",
                      "No of Box",
                      "Total Qty",
                      "Uploaded By",
                      "User Location",
                    ].map((h, i) => (
                      <th key={i} style={thStyle}>
                        {h.split("\n").map((line, j) => (
                          <span key={j}>
                            {line}
                            {j < h.split("\n").length - 1 && <br />}
                          </span>
                        ))}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {savedData.length === 0 ? (
                    <tr>
                      <td style={emptyStyle} colSpan="14">
                        <div style={emptyInnerStyle}>
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                          </svg>
                          No saved data available
                        </div>
                      </td>
                    </tr>
                  ) : (
                    savedData.slice(0, 50).map((item, idx) => (
                      <tr
                        key={item._id}
                        style={{
                          ...trStyle,
                          background:
                            idx % 2 === 0
                              ? "rgba(10,15,30,0.55)"
                              : "rgba(15,22,40,0.40)",
                        }}
                      >
                        <td style={{ ...tdStyle, color: "#00ee9f", fontWeight: 700 }}>
                          {item.ponumber}
                        </td>
                        <td style={tdStyle}>{item.poDate}</td>
                        <td style={tdStyle}>{item.deliveryDate}</td>
                        <td
                          onClick={() => toggleExpand(item._id, "expanded")}
                          style={{ ...tdStyle, ...expandTdStyle, minWidth: "280px", maxWidth: "280px" }}
                        >
                          <div style={{
                            whiteSpace: item.expanded ? "pre-line" : "nowrap",
                            overflow: "hidden",
                            textOverflow: item.expanded ? "unset" : "ellipsis",
                            wordBreak: "break-word",
                            width: "100%",
                            lineHeight: "1.6",
                          }}>
                            {item.deliveryAddress}
                          </div>
                          {item.deliveryAddress?.length > 80 && (
                            <div style={readMoreStyle}>
                              {item.expanded ? "Show Less ↑" : "Read More ↓"}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>{item.gstinNo}</td>
                        <td style={tdStyle}>{item.quantity}</td>
                        <td style={{ ...tdStyle, whiteSpace: "pre-line" }}>{item.articleNo}</td>
                        <td
                          onClick={() => toggleExpand(item._id, "eanExpanded")}
                          style={{ ...tdStyle, ...expandTdStyle, minWidth: "220px", maxWidth: "220px" }}
                        >
                          <div style={{
                            whiteSpace: item.eanExpanded ? "pre-line" : "nowrap",
                            overflow: "hidden",
                            textOverflow: item.eanExpanded ? "unset" : "ellipsis",
                            wordBreak: "break-word",
                            width: "100%",
                            lineHeight: "1.6",
                          }}>
                            {item.eanNo}
                          </div>
                          {item.eanNo?.length > 80 && (
                            <div style={readMoreStyle}>
                              {item.eanExpanded ? "Show Less ↑" : "Read More ↓"}
                            </div>
                          )}
                        </td>
                        <td
                          onClick={() => toggleExpand(item._id, "materialExpanded")}
                          style={{ ...tdStyle, ...expandTdStyle, minWidth: "250px", maxWidth: "250px" }}
                        >
                          <div style={{
                            whiteSpace: item.materialExpanded ? "pre-line" : "nowrap",
                            overflow: "hidden",
                            textOverflow: item.materialExpanded ? "unset" : "ellipsis",
                            wordBreak: "break-word",
                            width: "100%",
                            lineHeight: "1.6",
                          }}>
                            {item.materialDescription}
                          </div>
                          {item.materialDescription?.length > 80 && (
                            <div style={readMoreStyle}>
                              {item.materialExpanded ? "Show Less ↑" : "Read More ↓"}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>{item.eachBoxQty}</td>
                        <td style={tdStyle}>{item.qty}</td>
                        <td style={totalTdStyle}>
                          {Number(item.eachBoxQty || 0) * Number(item.qty || 0)}
                        </td>
                        <td style={tdStyle}>{item.enteredBy || "-"}</td>
                        <td style={tdStyle}>
                          {item.userLocations && item.userLocations.length > 0
                            ? item.userLocations.join(", ")
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const pageStyle = {
  position: "relative",
  minHeight: "100vh",
  color: "#f8fafc",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  overflow: "hidden",
};

const bgImageStyle = {
  position: "fixed",
  inset: 0,
  backgroundImage: "url('dispatch.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  zIndex: 0,
};

/* ✅ Much lighter overlay — image is clearly visible */
const bgOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "linear-gradient(135deg, rgba(2,6,23,0.55) 0%, rgba(7,15,35,0.50) 50%, rgba(4,12,28,0.58) 100%)",
  zIndex: 1,
};

/* Decorative glow orbs */
const orb1Style = {
  position: "fixed",
  top: "-120px",
  left: "-120px",
  width: "480px",
  height: "480px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(56,189,248,0.10) 0%, transparent 70%)",
  zIndex: 1,
  pointerEvents: "none",
};

const orb2Style = {
  position: "fixed",
  bottom: "-80px",
  right: "-100px",
  width: "420px",
  height: "420px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)",
  zIndex: 1,
  pointerEvents: "none",
};

const orb3Style = {
  position: "fixed",
  top: "50%",
  left: "60%",
  width: "300px",
  height: "300px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(22,163,74,0.07) 0%, transparent 70%)",
  zIndex: 1,
  pointerEvents: "none",
};

const contentWrapStyle = {
  position: "relative",
  zIndex: 2,
  padding: "32px 28px 48px",
  maxWidth: "1600px",
  margin: "0 auto",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "28px",
};

const titleStyle = {
  margin: 0,
  fontSize: "32px",
  fontWeight: "800",
  letterSpacing: "-0.5px",
  color: "#ffffff",
  textShadow: "0 2px 12px rgba(0,0,0,0.6)",
};

const subtitleStyle = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontSize: "14px",
  textShadow: "0 1px 6px rgba(0,0,0,0.5)",
};

const badgeStyle = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  padding: "6px 14px",
  background: "rgba(22,163,74,0.25)",
  border: "1px solid rgba(34,197,94,0.4)",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#4ade80",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const badgeDotStyle = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow: "0 0 6px #22c55e",
};

/* ✅ Glass card — frosted, clearly see bg through it */
const glassCardStyle = {
  background: "rgba(8, 14, 30, 0.52)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
  borderRadius: "18px",
  padding: "24px",
  marginBottom: "22px",
};

const cardInnerTopStyle = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
};

const cardIconWrapStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  background: "rgba(22,163,74,0.22)",
  color: "#4ade80",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const cardLabelStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: "700",
  color: "#f1f5f9",
};

const cardSubLabelStyle = {
  margin: "3px 0 0",
  fontSize: "13px",
  color: "#94a3b8",
};

const dividerStyle = {
  height: "1px",
  background: "rgba(255,255,255,0.08)",
  margin: "18px 0",
};

const uploadActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
};

const fileLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minHeight: "46px",
};

const fileInputStyle = {
  display: "none",
};

const fileButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "44px",
  padding: "0 18px",
  background: "rgba(30,41,59,0.7)",
  border: "1px solid rgba(148,163,184,0.25)",
  borderRadius: "10px",
  color: "#e2e8f0",
  fontWeight: "700",
  fontSize: "13px",
  cursor: "pointer",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const fileNameStyle = {
  maxWidth: "220px",
  color: "#94a3b8",
  fontSize: "13px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const uploadButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  height: "44px",
  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
  border: "1px solid rgba(34,197,94,0.4)",
  color: "white",
  padding: "0 22px",
  borderRadius: "10px",
  fontWeight: "800",
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 4px 20px rgba(22,163,74,0.40)",
  letterSpacing: "0.01em",
};

const tableHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "4px",
};

const recordCountBadgeStyle = {
  padding: "4px 14px",
  background: "rgba(80, 201, 253, 0.18)",
  border: "1px solid rgba(5, 180, 255, 0.35)",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: "800",
  color: "#ffffff",
};

const tableWrapperStyle = {
  overflowX: "auto",
  overflowY: "auto",        // ← add this
  maxHeight: "450px",       // ← add this
  border: "1px solid rgba(255, 255, 255, 0)",
  borderRadius: "12px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: "1450px",
};

const thStyle = {
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  borderRight: "1px solid rgba(255,255,255,0.07)",
  padding: "13px 12px",
 background: "#0a0f1e",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: "700",
  textAlign: "center",
  verticalAlign: "middle",
  lineHeight: "1.5",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const trStyle = {
  transition: "background 0.15s",
};

const tdStyle = {
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  borderRight: "1px solid rgba(255,255,255,0.04)",
  padding: "12px",
  textAlign: "center",
  color: "#ffffff",
  fontSize: "13px",
  verticalAlign: "middle",
};

const expandTdStyle = {
  textAlign: "left",
  cursor: "pointer",
  verticalAlign: "top",
};

const readMoreStyle = {
  marginTop: "6px",
  color: "#08efa2",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.03em",
};

const totalTdStyle = {
  ...tdStyle,
  color: "#86efac",
  fontWeight: "800",
  // background: "rgba(75, 91, 81, 0.12)",
};

const emptyStyle = {
  padding: "50px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "15px",
};

const emptyInnerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
};

export default ManualBoxPage;