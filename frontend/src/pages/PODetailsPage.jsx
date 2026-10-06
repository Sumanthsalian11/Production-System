import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";

function PODetailsPage() {
  const [searchPO, setSearchPO] = useState("");
  const [poData, setPoData] = useState(null);
  const [editRow, setEditRow] = useState({
    eachBoxQty: "",
    qty: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [userLocations, setUserLocations] = useState([]);
  const [savedRecords, setSavedRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [baseQty, setBaseQty] = useState(0);

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

  const fetchByPO = async () => {
    if (!searchPO.trim()) {
      toast.error("Enter a PO Number");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.get(
        `${BASE_URL}/api/manual-box/by-po/${encodeURIComponent(searchPO.trim())}`
      );

      setPoData(res.data.data);
      setEditRow({
        eachBoxQty: "",
        qty: "",
      });
      setSearched(true);

      const recRes = await axios.get(
        `${BASE_URL}/api/manual-box/saved-records/${encodeURIComponent(
          searchPO.trim()
        )}`
      );

      const records = recRes.data.data || [];
      setSavedRecords(records);

      if (records.length > 0) {
        setBaseQty(records[0].remainingQty);
      } else {
        setBaseQty(res.data.data.quantity || 0);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "PO not found");
      setPoData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedRecords = async (po) => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/manual-box/saved-records/${encodeURIComponent(po)}`
      );

      const records = res.data.data || [];
      setSavedRecords(records);

      if (records.length > 0) {
        setBaseQty(records[0].remainingQty);
      }
    } catch {
      setSavedRecords([]);
    }
  };

  const eachBoxQty = Math.max(0, Number(editRow.eachBoxQty || 0));
  const qty = Math.max(0, Number(editRow.qty || 0));
  const totalQty = eachBoxQty * qty;
  const remainingQty = Math.max(0, baseQty - totalQty);

  const originalQty = Number(poData?.quantity || 0);
  const usedQty = Math.max(0, originalQty - baseQty + totalQty);
  const progressPercent =
    originalQty > 0 ? Math.min(100, Math.round((usedQty / originalQty) * 100)) : 0;
    const handleEdit = (record) => {
  setEditingId(record._id);

  setEditRow({
    eachBoxQty: record.eachBoxQty,
    qty: record.qty,
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};
const handleDelete = async (id) => {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete this record?"
  );

  if (!confirmDelete) return;

  try {
    const res = await axios.delete(
      `${BASE_URL}/api/manual-box/delete-po-details/${id}`
    );

    toast.success(res.data.message);

    fetchSavedRecords(poData.ponumber);
  } catch (error) {
    toast.error(error.response?.data?.message || "Delete failed");
  }
};
 const handleSave = async () => {
  if (!poData) return;

  if (eachBoxQty < 0 || qty < 0) {
    toast.error("Negative values are not allowed");
    return;
  }

  if (totalQty <= 0) {
    toast.error("Total Quantity must be greater than 0");
    return;
  }

  if (totalQty > baseQty) {
    toast.error("Total Quantity cannot exceed Remaining Quantity");
    return;
  }

  try {
    let res;

    if (editingId) {
      res = await axios.put(
        `${BASE_URL}/api/manual-box/update-po-details/${editingId}`,
        {
          eachBoxQty: Number(editRow.eachBoxQty),
          qty: Number(editRow.qty),
          totalQty,
          remainingQty,
        }
      );
    } else {
      res = await axios.post(
        `${BASE_URL}/api/manual-box/save-po-details`,
        {
          sourceId: poData._id,
          ponumber: poData.ponumber,
          eachBoxQty: Number(editRow.eachBoxQty),
          qty: Number(editRow.qty),
          totalQty,
          remainingQty,
          enteredBy: loggedInUser,
          userLocations: userLocations,
        }
      );
    }

    toast.success(res.data.message);

    setEditRow({
      eachBoxQty: "",
      qty: "",
    });

    setEditingId(null);

    fetchSavedRecords(poData.ponumber);
  } catch (error) {
    toast.error(error.response?.data?.message || "Save failed");
  }
};
  const downloadPDF = (id) => {
    window.open(`${BASE_URL}/api/manual-box/po-details-pdf/${id}`, "_blank");
  };

  const readonlyFields = poData
    ? [
        { label: "PO Number", value: poData.ponumber },
        { label: "PO Date", value: poData.poDate },
        { label: "Delivery Date", value: poData.deliveryDate },
        { label: "Delivery Address", value: poData.deliveryAddress },
        { label: "Total Quantity", value: poData.quantity },
      ]
    : [];

  return (
    <div style={styles.background}>
      <div style={styles.overlay}>
        <div style={styles.page}>
          <div style={styles.hero}>
            <div>
              <div style={styles.kicker}>Purchase Order Dispatch</div>
              <h1 style={styles.headerTitle}>PO Details</h1>
              <p style={styles.headerSub}>
                Search purchase orders, create dispatch records, and download PDFs.
              </p>
            </div>

            <div style={styles.userPanel}>
              <span style={styles.userLabel}>Logged in</span>
              <strong style={styles.userName}>{loggedInUser || "User"}</strong>
              <span style={styles.userLocation}>
                {userLocations.length > 0 ? userLocations.join(", ") : "No location"}
              </span>
            </div>
          </div>

          <div style={styles.searchCard}>
            <div style={styles.searchIcon}>⌕</div>
            <input
              type="text"
              placeholder="Enter PO Number..."
              value={searchPO}
              onChange={(e) => setSearchPO(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchByPO()}
              style={styles.searchInput}
            />

            <button onClick={fetchByPO} disabled={loading} style={styles.searchBtn}>
              {loading ? "Searching..." : "Search PO"}
            </button>
          </div>

          {poData && (
            <>
              {/* <div style={styles.summaryGrid}>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Original Qty</span>
                  <strong style={styles.summaryValue}>{originalQty}</strong>
                </div>

                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Current Base Qty</span>
                  <strong style={styles.summaryValue}>{baseQty}</strong>
                </div>

                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>This Dispatch</span>
                  <strong style={{ ...styles.summaryValue, color: "#2563eb" }}>
                    {totalQty}
                  </strong>
                </div>

                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>After Save Remaining</span>
                  <strong style={{ ...styles.summaryValue, color: "#059669" }}>
                    {remainingQty}
                  </strong>
                </div>
              </div> */}

              {/* <div style={styles.progressCard}>
                <div style={styles.progressTop}>
                  <span style={styles.progressTitle}>Dispatch Progress</span>
                  <strong style={styles.progressPercent}>{progressPercent}%</strong>
                </div>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
                </div>
              </div> */}

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <span style={styles.cardTitle}>Shipment Details</span>
                    <p style={styles.cardCaption}>Core purchase order information</p>
                  </div>
                  <span style={styles.badge}>PO: {poData.ponumber}</span>
                </div>

                <div style={styles.grid}>
                  {readonlyFields.map((field) => (
                    <div key={field.label} style={styles.fieldBox}>
                      <label style={styles.fieldLabel}>{field.label}</label>
                      <div style={styles.fieldValue}>{field.value || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <span style={styles.cardTitle}>Dispatch Schedule</span>
                    <p style={styles.cardCaption}>Enter box quantity and number of boxes</p>
                  </div>
                </div>

                <div style={styles.editGrid}>
                  <div style={styles.editBox}>
                    <label style={styles.fieldLabel}>Each Box Qty</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editRow.eachBoxQty}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, "");
                        const tempEachBoxQty = Number(value || 0);
                        const tempQty = Number(editRow.qty || 0);
                        const tempTotalQty = tempEachBoxQty * tempQty;

                        if (tempTotalQty > baseQty) {
                          toast.error("Remaining qty should not be greater than actual qty");
                          return;
                        }

                        setEditRow({
                          ...editRow,
                          eachBoxQty: value,
                        });
                      }}
                      style={styles.editInput}
                      placeholder="0"
                    />
                  </div>

                  <div style={styles.editBox}>
                    <label style={styles.fieldLabel}>BOX NO</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editRow.qty}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, "");
                        const tempQty = Number(value || 0);
                        const tempEachBoxQty = Number(editRow.eachBoxQty || 0);
                        const tempTotalQty = tempEachBoxQty * tempQty;

                        if (tempTotalQty > baseQty) {
                          toast.error("Remaining qty should not be greater than actual qty");
                          return;
                        }

                        setEditRow({
                          ...editRow,
                          qty: value,
                        });
                      }}
                      style={styles.editInput}
                      placeholder="0"
                    />
                  </div>

                  <div style={styles.resultBox}>
                    <span style={styles.resultLabel}>Total Qty</span>
                    <strong style={styles.resultValueBlue}>{totalQty}</strong>
                    <small style={styles.resultNote}>Each Box × Qty</small>
                  </div>

                  <div style={styles.resultBox}>
                    <span style={styles.resultLabel}>Remaining Qty</span>
                    <strong
                      style={{
                        ...styles.resultValueGreen,
                        color: remainingQty < 0 ? "#dc2626" : "#059669",
                      }}
                    >
                      {remainingQty}
                    </strong>
                    <small style={styles.resultNote}>Quantity − Total Qty</small>
                  </div>
                </div>

                <div style={styles.actionRow}>
                  <button onClick={handleSave} style={styles.saveBtn}>
                    {editingId ? "Update Record" : "Save Record"}
                  </button>
                </div>
              </div>

              {savedRecords.length > 0 && (
                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <span style={styles.cardTitle}>Saved Records</span>
                      <p style={styles.cardCaption}>Previously saved dispatch entries</p>
                    </div>
                    <span style={styles.badge}>{savedRecords.length} record(s)</span>
                  </div>

                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          {[
                            "#",
                            "PO Number",
                            "Each Box Qty",
                            "NO OF BOXES",
                            "Total Qty",
                            "Remaining Qty",
                            "Saved By",
                            "User Location",
                            "Saved At",
                            "PDF",
"Action",
                          ].map((h) => (
                            <th key={h} style={styles.th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {savedRecords.map((rec, idx) => (
                          <tr key={rec._id} style={styles.tr}>
                            <td style={styles.td}>{idx + 1}</td>
                            <td style={styles.tdStrong}>{rec.ponumber}</td>
                            <td style={styles.td}>{rec.eachBoxQty}</td>
                            <td style={styles.td}>{rec.qty}</td>
                            <td style={{ ...styles.td, color: "#2563eb", fontWeight: 900 }}>
                              {rec.totalQty}
                            </td>
                            <td
                              style={{
                                ...styles.td,
                                color: rec.remainingQty < 0 ? "#dc2626" : "#059669",
                                fontWeight: 900,
                              }}
                            >
                              {rec.remainingQty}
                            </td>
                            <td style={styles.td}>{rec.enteredBy || "-"}</td>
                            <td style={styles.td}>
                              {rec.userLocations && rec.userLocations.length > 0
                                ? rec.userLocations.join(", ")
                                : "-"}
                            </td>
                            <td style={styles.td}>
                              {new Date(rec.createdAt).toLocaleString()}
                            </td>
                           <td style={styles.td}>
  <button
    onClick={() => downloadPDF(rec._id)}
    style={styles.pdfBtn}
  >
    PDF
  </button>
</td>

<td style={styles.td}>
  <div style={styles.actionBtns}>
    {/* <button
      onClick={() => handleEdit(rec)}
      style={styles.editBtn}
    >
      Edit
    </button> */}

    <button
      onClick={() => handleDelete(rec._id)}
      style={styles.deleteBtn}
    >
      Delete
    </button>
  </div>
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

          {searched && !poData && (
            <div style={styles.emptyState}>
              <div style={styles.emptyMark}>!</div>
              <h3 style={styles.emptyTitle}>No Data Found</h3>
              <p style={styles.emptyText}>
                No data found for PO: <strong>{searchPO}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const glass = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.88), rgba(240,249,255,0.72))",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "0 22px 60px rgba(14, 116, 144, 0.16)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const styles = {
  background: {
    width: "100%",
    minHeight: "calc(100vh - 70px)",
    backgroundImage: "url('pod.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
    overflowX: "hidden",
    fontFamily: "'Segoe UI', sans-serif",
  },
  overlay: {
    minHeight: "calc(100vh - 70px)",
    padding: "28px",
    boxSizing: "border-box",
    background:
      "linear-gradient(135deg, rgba(239,246,255,0.2), rgba(255,255,255,0.28))",
  },
  page: {
    width: "100%",
    maxWidth: "100%",
    margin: "0 auto",
    color: "#0f172a",
  },
  hero: {
    ...glass,
    minHeight: "145px",
    padding: "28px",
    borderRadius: "24px",
    marginBottom: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
    position: "relative",
    overflow: "hidden",
  },
  kicker: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "rgba(37, 99, 235, 0.1)",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "12px",
  },
  headerTitle: {
    fontSize: "38px",
    lineHeight: "42px",
    fontWeight: 900,
    color: "#0f3f78",
    margin: 0,
    letterSpacing: "0",
  },
  headerSub: {
    color: "#475569",
    margin: "8px 0 0",
    fontSize: "15px",
    fontWeight: 600,
  },
  userPanel: {
    minWidth: "220px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.58)",
    border: "1px solid rgba(147,197,253,0.55)",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  userLabel: {
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
  },
  userName: {
    color: "#0f3f78",
    fontSize: "18px",
  },
  userLocation: {
    color: "#475569",
    fontSize: "13px",
    fontWeight: 600,
  },
  searchCard: {
    ...glass,
    position: "sticky",
    top: "12px",
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    padding: "16px",
    marginBottom: "18px",
    borderRadius: "18px",
  },
  searchIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    background: "#eff6ff",
    color: "#2563eb",
    display: "grid",
    placeItems: "center",
    fontSize: "26px",
    fontWeight: 900,
    border: "1px solid #bfdbfe",
  },
  actionBtns: {
  display: "flex",
  gap: "8px",
  justifyContent: "center",
},

editBtn: {
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  border: "none",
  borderRadius: "10px",
  color: "white",
  padding: "8px 14px",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: "12px",
},

deleteBtn: {
  background: "linear-gradient(135deg, #dc2626, #ef4444)",
  border: "none",
  borderRadius: "10px",
  color: "white",
  padding: "8px 14px",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: "12px",
},
  searchInput: {
    flex: 1,
    minWidth: "230px",
    height: "50px",
    borderRadius: "14px",
    border: "1px solid rgba(96, 165, 250, 0.8)",
    background: "rgba(255, 255, 255, 0.9)",
    color: "#0f172a",
    padding: "0 16px",
    fontSize: "15px",
    outline: "none",
    fontWeight: 700,
  },
  searchBtn: {
    height: "50px",
    padding: "0 30px",
    background: "linear-gradient(135deg, #2563eb, #0891b2)",
    border: "none",
    borderRadius: "14px",
    color: "white",
    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 14px 26px rgba(37, 99, 235, 0.28)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
    marginBottom: "16px",
  },
  summaryCard: {
    ...glass,
    borderRadius: "18px",
    padding: "18px",
  },
  summaryLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: "8px",
  },
  summaryValue: {
    fontSize: "30px",
    lineHeight: "32px",
    color: "#0f3f78",
    fontWeight: 900,
  },
  progressCard: {
    ...glass,
    borderRadius: "18px",
    padding: "16px",
    marginBottom: "18px",
  },
  progressTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  progressTitle: {
    color: "#0f3f78",
    fontWeight: 900,
  },
  progressPercent: {
    color: "#2563eb",
    fontSize: "18px",
  },
  progressTrack: {
    height: "12px",
    borderRadius: "999px",
    background: "rgba(191, 219, 254, 0.75)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #2563eb, #06b6d4, #10b981)",
    transition: "width 0.3s ease",
  },
  card: {
    ...glass,
    borderRadius: "22px",
    padding: "22px",
    marginBottom: "18px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
    flexWrap: "wrap",
    gap: "12px",
  },
  cardTitle: {
    display: "block",
    fontSize: "20px",
    fontWeight: 900,
    color: "#0f3f78",
  },
  cardCaption: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 600,
  },
  badge: {
    background: "rgba(219, 234, 254, 0.8)",
    color: "#1d4ed8",
    padding: "8px 14px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
    border: "1px solid rgba(96,165,250,0.55)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "14px",
  },
  fieldBox: {
    background: "rgba(255,255,255,0.7)",
    borderRadius: "16px",
    padding: "15px",
    border: "1px solid rgba(191,219,254,0.75)",
  },
  fieldLabel: {
    display: "block",
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "7px",
    fontWeight: 900,
  },
  fieldValue: {
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: 800,
    wordBreak: "break-word",
    whiteSpace: "pre-line",
  },
  editGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
  },
  editBox: {
    background: "rgba(255,255,255,0.68)",
    border: "1px solid rgba(191,219,254,0.78)",
    borderRadius: "16px",
    padding: "14px",
  },
  editInput: {
    width: "100%",
    height: "48px",
    boxSizing: "border-box",
    borderRadius: "13px",
    border: "1px solid rgba(59,130,246,0.75)",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    padding: "0 14px",
    fontSize: "16px",
    fontWeight: 900,
    outline: "none",
  },
  resultBox: {
    background: "linear-gradient(135deg, rgba(239,246,255,0.94), rgba(255,255,255,0.75))",
    border: "1px solid rgba(96,165,250,0.5)",
    borderRadius: "16px",
    padding: "14px",
  },
  resultLabel: {
    display: "block",
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
    marginBottom: "6px",
  },
  resultValueBlue: {
    display: "block",
    color: "#2563eb",
    fontSize: "30px",
    lineHeight: "32px",
    fontWeight: 900,
  },
  resultValueGreen: {
    display: "block",
    color: "#059669",
    fontSize: "30px",
    lineHeight: "32px",
    fontWeight: 900,
  },
  resultNote: {
    display: "block",
    color: "#64748b",
    marginTop: "4px",
    fontSize: "11px",
    fontWeight: 700,
  },
  actionRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "18px",
  },
  saveBtn: {
    height: "50px",
    padding: "0 36px",
    background: "linear-gradient(135deg, #059669, #10b981)",
    border: "none",
    borderRadius: "14px",
    color: "white",
    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 14px 26px rgba(5, 150, 105, 0.26)",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    borderRadius: "16px",
    border: "1px solid rgba(191,219,254,0.85)",
    background: "rgba(255,255,255,0.66)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    padding: "14px",
    background: "rgba(219,234,254,0.9)",
    color: "#075985",
    fontWeight: 900,
    textAlign: "center",
    whiteSpace: "nowrap",
    borderBottom: "1px solid rgba(147,197,253,0.8)",
  },
  tr: {
    borderBottom: "1px solid rgba(219,234,254,0.85)",
  },
  td: {
    padding: "13px 14px",
    textAlign: "center",
    color: "#1e293b",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  tdStrong: {
    padding: "13px 14px",
    textAlign: "center",
    color: "#0f3f78",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  pdfBtn: {
    background: "linear-gradient(135deg, #2563eb, #0891b2)",
    border: "none",
    borderRadius: "10px",
    color: "white",
    padding: "8px 16px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: "12px",
  },
  emptyState: {
    ...glass,
    textAlign: "center",
    padding: "58px 20px",
    borderRadius: "22px",
  },
  emptyMark: {
    width: "54px",
    height: "54px",
    margin: "0 auto 14px",
    borderRadius: "18px",
    display: "grid",
    placeItems: "center",
    background: "#eff6ff",
    color: "#2563eb",
    fontSize: "26px",
    fontWeight: 900,
    border: "1px solid #bfdbfe",
  },
  emptyTitle: {
    margin: "0 0 8px",
    color: "#0f3f78",
    fontSize: "22px",
    fontWeight: 900,
  },
  emptyText: {
    fontSize: "15px",
    margin: 0,
    color: "#475569",
    fontWeight: 600,
  },
};

export default PODetailsPage;