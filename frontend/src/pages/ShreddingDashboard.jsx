import { useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import BASE_URL from "../config/api";

function ShreddingDashboard() {
  const [woNumber, setWoNumber] = useState("");
  const [reels, setReels] = useState([]);
  const [history, setHistory] = useState([]);

  const [shreddingDate, setShreddingDate] = useState("");
  const [shreddingTime, setShreddingTime] = useState("");

  const [loggedInUser, setLoggedInUser] = useState("");

  const showAlert = (msg, icon = "success") => {
    Swal.fire({
      toast: true,
      position: "top",
      icon,
      title: msg,
      timer: 3000,
      showConfirmButton: false,
    });
  };

  const getAuthConfig = () => {
    const token = localStorage.getItem("token");

    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name);
    }
  }, []);

  const fetchWO = async () => {
    if (!woNumber) {
      return showAlert("Enter WO Number", "error");
    }

    try {
      // Fetch both active reels and history in parallel
      const [reelsRes, historyRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/shredding/wo/${woNumber}`, getAuthConfig()),
        axios.get(`${BASE_URL}/api/shredding/history/${woNumber}`, getAuthConfig()).catch(() => ({ data: [] }))
      ]);

      const reelsData = reelsRes.data || [];
      const historyData = historyRes.data || [];

      // Validation: If API returns no records, the WO does not exist
      if (reelsData.length === 0) {
        setReels([]);
        setHistory([]);
        return showAlert("Work Order does not exist", "error");
      }

      // Filter: Exclude reels that are already saved in the history
      const activeReels = reelsData.filter((reel) => {
        const isSaved = historyData.some(
          (h) =>
            h.productionId === reel.productionId ||
            (Number(h.efiWoNumber) === Number(woNumber) && String(h.reelNo) === String(reel.reelNo))
        );
        return !isSaved;
      });

      setHistory(historyData);
      setReels(activeReels);
      
      // Success Alert on Fetch
      showAlert("Work Order details loaded successfully", "success");
    } catch (err) {
      // Validation: If API returns an error response (like 404 Not Found)
      setReels([]);
      setHistory([]);
      showAlert(
        err.response?.data?.message || "Work Order does not exist",
        "error"
      );
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/shredding/history/${woNumber}`,
        getAuthConfig()
      );

      setHistory(res.data);
    } catch (err) {
      console.log(err);
      setHistory([]);
    }
  };

  const save = async (row) => {
    if (!shreddingDate) {
      return showAlert("Select Date", "error");
    }

    if (!shreddingTime) {
      return showAlert("Select Time", "error");
    }

    try {
      await axios.post(
        `${BASE_URL}/api/shredding`,
        {
          efiWoNumber: Number(woNumber),

          productionId: row.productionId,

          reelNo: row.reelNo,

          mattWaste: row.mattWaste,
          printWaste: row.printWaste,
          realEndWaste: row.realEndWaste,
          totalWaste: row.totalWaste,

          shreddingDate: `${shreddingDate}T${shreddingTime}`,

          planningUser: loggedInUser,
        },
        getAuthConfig()
      );

      showAlert("Saved Successfully");

      // Disappear from active Reels table immediately after save
      setReels((prevReels) =>
        prevReels.filter((r) => r.productionId !== row.productionId)
      );

      fetchHistory();
    } catch (err) {
      showAlert(
        err.response?.data?.message ||
          "Error Saving",
        "error"
      );
    }
  };

  // Excel (CSV Format) Export function
  const exportToExcel = () => {
    if (history.length === 0) {
      return showAlert("No history data to export", "error");
    }

    // CSV Headers
    const headers = [
      "WO Number",
      "Reel No",
      "Matt Waste",
      "Print Waste",
      "End Waste",
      "Total Waste",
      "User",
      "Date Time"
    ];

    // Format rows
    const csvRows = [
      headers.join(","),
      ...history.map((h) =>
        [
          h.efiWoNumber,
          h.reelNo,
          h.mattWaste,
          h.printWaste,
          h.realEndWaste,
          h.totalWaste,
          h.planningUser,
          `"${new Date(h.shreddingDate).toLocaleString("en-IN")}"`
        ].join(",")
      )
    ];

    // Create Blob with UTF-8 encoding
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Download flow
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Shredding_History_WO_${woNumber || "All"}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAlert("Excel report downloaded successfully");
  };

  return (
    <div className="shredding-dashboard-wrapper">
      {/* ── Scoped Theme Matching Productiondashboard Exactly ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap');

        .shredding-dashboard-wrapper {
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
          --danger: #d64545;

          min-height: 100vh;
          padding: 14px 18px 40px;
          box-sizing: border-box;
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
          font-size: 14px;
          color: #000000;
          background: var(--page);
        }

        .shredding-dashboard-wrapper * {
          box-sizing: border-box;
          font-family: inherit;
        }

        .shred-shell {
          max-width: 1250px;
          margin: 0 auto;
        }

        /* ── Top Header Strip ── */
        .dash-hero-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 12px;
          padding: 12px 20px;
          border-radius: 8px;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
        }

        .hero-left-branding {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hero-emblem-3d {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand);
          background: var(--brand-soft);
          border: 1px solid #f7d3c6;
        }

        .hero-titles h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.2px;
          color: #000000;
        }

        .hero-titles p {
          margin: 2px 0 0;
          font-size: 11.5px;
          font-weight: 600;
          color: #374151;
        }

        .operator-pill-3d {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 14px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 700;
          color: #000000;
          background: var(--teal-soft);
          border: 1px solid #bdd9df;
        }

        .operator-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ok);
          box-shadow: 0 0 0 3px rgba(31, 157, 107, 0.18);
        }

        /* ── Cards ── */
        .forge-card {
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 12px;
          background: var(--surface);
          border: 1px solid var(--line);
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }

        .card-heading-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--line);
        }

        .heading-with-icon {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .heading-icon-badge {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand);
          background: var(--brand-soft);
          border: 1px solid #f7d3c6;
        }

        .card-heading-row h4,
        .card-title-accent {
          font-size: 15px;
          font-weight: 800;
          margin: 0;
          color: #000000;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── Instructions / Date-Time Bar ── */
        .date-time-selection-bar {
          background: var(--surface);
          border: 1px solid var(--line);
          border-left: 4px solid var(--teal-mid);
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 16px;
        }

        .selection-instructions {
          font-size: 11px;
          font-weight: 800;
          color: var(--teal-mid);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ── Form Inputs & Labels ── */
        .custom-input-group label {
          font-size: 11px;
          font-weight: 700;
          color: #000000;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .custom-input {
          width: 100%;
          height: 38px;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid var(--field-line);
          background: #ffffff;
          font-size: 13.5px;
          font-weight: 600;
          color: #000000;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .custom-input:focus {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.18);
        }

        /* ── Buttons ── */
        .btn-forge-primary {
          height: 38px;
          padding: 0 18px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid var(--brand);
          background: var(--brand);
          color: #ffffff;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }

        .btn-forge-primary:hover {
          background: var(--brand-dark);
          border-color: var(--brand-dark);
        }

        .btn-forge-success {
          padding: 6px 14px;
          border-radius: 5px;
          font-size: 11.5px;
          font-weight: 700;
          border: 1px solid var(--teal-mid);
          background: var(--teal-mid);
          color: #ffffff;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-forge-success:hover {
          background: var(--teal);
        }

        .btn-forge-excel {
          height: 34px;
          padding: 0 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid #10b981;
          background: #10b981;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(16, 185, 129, 0.25);
        }

        .btn-forge-excel:hover {
          background: #059669;
        }

        /* ── Tables with Light Header & Black Text ── */
        .custom-table-container {
          width: 100%;
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }

        .custom-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
        }

        /* Light Slate Header with Pure Black Text */
        .custom-table thead th {
          background: #dbe5ed !important;
          color: #000000 !important;
          padding: 10px 12px;
          text-align: left;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid #b2c4d4 !important;
          border-right: 1px solid #cad5e0 !important;
          white-space: nowrap;
        }

        .custom-table thead th:last-child {
          border-right: none !important;
        }

        .custom-table tbody td {
          padding: 8px 12px;
          border-bottom: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          font-weight: 600;
          color: #000000 !important;
          white-space: nowrap;
          vertical-align: middle;
        }

        .custom-table tbody td:last-child {
          border-right: none;
        }

        .custom-table tbody tr:nth-child(even) td {
          background: #fafbfc;
        }

        .custom-table tbody tr:hover td {
          background: var(--brand-soft);
        }

        .waste-highlight {
          font-weight: 700;
          color: #000000;
        }

        .total-waste-highlight {
          font-weight: 800;
          color: var(--danger);
          background: #fee2e2;
          padding: 2px 7px;
          border-radius: 4px;
          border: 1px solid #fecaca;
        }

        .user-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          color: var(--teal-mid);
          background: var(--teal-soft);
          border: 1px solid #bdd9df;
        }

        .no-records-cell {
          text-align: center;
          color: #374151;
          font-weight: 600;
          font-style: normal;
          padding: 28px !important;
        }
      `}</style>

      <div className="shred-shell">
  
        {/* ── Step 1: Work Order Retrieval ── */}
        <div className="forge-card">
          <div className="card-heading-row">
            <div className="heading-with-icon">
              <div className="heading-icon-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <h4>Work Order Retrieval</h4>
            </div>
          </div>

          <div className="row align-items-end g-3">
            <div className="col-md-9 custom-input-group mb-0">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                Work Order (WO) Number
              </label>
              <input
                className="custom-input"
                placeholder="Enter Work Order number (e.g. 104523)..."
                value={woNumber}
                onChange={(e) => setWoNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchWO();
                }}
              />
            </div>

            <div className="col-md-3">
              <button
                className="btn-forge-primary w-100"
                onClick={fetchWO}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Fetch Details
              </button>
            </div>
          </div>
        </div>

        {/* ── Step 2: Reel Waste Processing ── */}
        <div className="forge-card">
          <div className="card-heading-row">
            <div className="heading-with-icon">
              <div className="heading-icon-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5"/><path d="M12 16v5"/><path d="M3 12h5"/><path d="M16 12h5"/>
                </svg>
              </div>
              <h4 className="card-title-accent">Reel Waste Processing</h4>
            </div>
          </div>

          {/* Date & Time Selection Strip */}
          <div className="date-time-selection-bar">
            <div className="selection-instructions">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              Step 1: Set Shredding Date &amp; Time
            </div>
            <div className="row g-3">
              <div className="col-md-6 custom-input-group mb-0">
                <label>Shredding Date</label>
                <input
                  type="date"
                  className="custom-input"
                  value={shreddingDate}
                  onChange={(e) => setShreddingDate(e.target.value)}
                />
              </div>

              <div className="col-md-6 custom-input-group mb-0">
                <label>Shredding Time</label>
                <input
                  type="time"
                  className="custom-input"
                  value={shreddingTime}
                  onChange={(e) => setShreddingTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Reel No</th>
                  <th>Production Date</th>
                  <th>Matt Waste</th>
                  <th>Print Waste</th>
                  <th>End Waste</th>
                  <th>Total Waste</th>
                  <th style={{ textAlign: "center" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {reels.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-records-cell">
                      No Records. Enter WO Number above and click "Fetch Details".
                    </td>
                  </tr>
                ) : (
                  reels.map((r) => (
                    <tr key={r.productionId}>
                      <td style={{ fontWeight: "700" }}>{r.reelNo}</td>
                      <td>
                        {new Date(r.productionDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="waste-highlight">{r.mattWaste}</td>
                      <td className="waste-highlight">{r.printWaste}</td>
                      <td className="waste-highlight">{r.realEndWaste}</td>
                      <td>
                        <span className="total-waste-highlight">{r.totalWaste}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn-forge-success d-inline-flex align-items-center gap-2"
                          onClick={() => save(r)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Save
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Step 3: Shredding History Card ── */}
        <div className="forge-card">
          <div className="card-heading-row">
            <div className="heading-with-icon">
              <div className="heading-icon-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h4 className="card-title-accent">
                Shredding History {woNumber ? `(WO #${woNumber})` : ""}
              </h4>
            </div>
            {history.length > 0 && (
              <button
                className="btn-forge-excel d-inline-flex align-items-center gap-2"
                onClick={exportToExcel}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Excel
              </button>
            )}
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>WO</th>
                  <th>Reel</th>
                  <th>Matt</th>
                  <th>Print</th>
                  <th>End</th>
                  <th>Total</th>
                  <th>User</th>
                  <th>Date Time</th>
                </tr>
              </thead>

              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-records-cell">
                      No Records
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h._id}>
                      <td style={{ fontWeight: "700" }}>{h.efiWoNumber}</td>
                      <td>{h.reelNo}</td>
                      <td>{h.mattWaste}</td>
                      <td>{h.printWaste}</td>
                      <td>{h.realEndWaste}</td>
                      <td>
                        <span className="total-waste-highlight">{h.totalWaste}</span>
                      </td>
                      <td>
                        <span className="user-badge">
                          {h.planningUser}
                        </span>
                      </td>
                      <td>
                        {new Date(h.shreddingDate).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
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
  );
}

export default ShreddingDashboard;