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
          `"${new Date(h.shreddingDate).toLocaleString("en-IN")}"` // Wrap date in quotes to avoid comma breakage
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
      {/* Light Theme "Amber Forge" CSS Overrides */}
      <style>{`
        .shredding-dashboard-wrapper {
          background: #f1f5f9; /* Slate 100 - clear contrast from white cards */
          color: #1e293b; /* Slate 800 for high-contrast legible text */
          font-family: 'Outfit', 'Inter', sans-serif;
          min-height: 100vh;
          padding: 2.5rem 1rem;
        }

        .dashboard-title {
          font-weight: 800;
          color: #0266c4; /* Deep amber brown */
          letter-spacing: -0.02em;
          font-size: 2.5rem;
          margin-bottom: 1.5rem;
          text-align: center; /* Centering the title */
        }

        .forge-card {
          background: #ffffff; /* Pure white */
          border: 1px solid #cbd5e1; /* Clearly visible card border */
          border-top: 5px solid #0a6ae0; /* Luminous Amber top accent line */
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
          margin-bottom: 2rem;
        }

        .card-title-accent {
          font-size: 1.4rem;
          font-weight: 700;
          color: #1679ea; /* Deep amber brown */
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        /* Attention-grabbing Date & Time Area */
        .selection-instructions {
          font-size: 0.85rem;
          font-weight: 700;
          color: #1083ef;
          text-transform: uppercase;
          margin-bottom: 0.5rem;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .date-time-selection-bar {
          background: #fffbeb; /* Light amber background */
          border: 2px dashed #0b8cf5; /* Luminous dashed amber border */
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.75rem;
        }

        .custom-input-group label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #066cb1;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: block;
        }

        .custom-input {
          background: #ffffff !important;
          border: 2px solid #cbd5e1 !important; /* Thick visible input borders */
          color: #1e293b !important; /* High contrast dark text */
          border-radius: 10px !important;
          padding: 0.75rem 1rem !important;
          font-size: 0.95rem !important;
          font-weight: 600 !important;
          transition: all 0.2s ease !important;
        }

        .custom-input:focus {
          border-color: #0477f2 !important;
          box-shadow: 0 0 0 3px rgba(45, 180, 233, 0.2) !important;
          outline: none !important;
        }

        .btn-forge-primary {
          background: #0675f4 !important;
          border: none !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border-radius: 10px !important;
          padding: 0.75rem 1.5rem !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.2) !important;
        }

        .btn-forge-primary:hover {
          background: #0a84dc !important;
          transform: translateY(-1px);
        }

        .btn-forge-success {
          background: #10b981 !important; /* Green save button for success */
          border: none !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border-radius: 8px !important;
          padding: 0.5rem 1.25rem !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2) !important;
        }

        .btn-forge-success:hover {
          background: #059669 !important;
          transform: translateY(-1px);
        }

        .btn-forge-excel {
          background: #22c55e !important; /* Classy green button for Excel */
          border: none !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          border-radius: 8px !important;
          padding: 0.5rem 1.25rem !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.2) !important;
          font-size: 0.9rem !important;
        }

        .btn-forge-excel:hover {
          background: #16a34a !important;
          transform: translateY(-1px);
        }

        .custom-table-container {
          overflow-x: auto;
          border-radius: 12px;
          border: 2px solid #cbd5e1; /* Visible table boundary */
          background: #ffffff;
        }

        .custom-table {
          width: 100%;
          margin-bottom: 0 !important;
          color: #1e293b !important;
          border-collapse: collapse;
        }

        .custom-table th {
          background: #1b88d0 !important; /* Rich Dark Amber Header background */
          color: #ffffff !important; /* Legible white text */
          font-size: 0.75rem !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          padding: 1.1rem 1.25rem !important;
          border-bottom: 2px solid #451a03 !important;
        }

        .custom-table td {
          padding: 1.1rem 1.25rem !important;
          vertical-align: middle !important;
          border-bottom: 1.5px solid #e2e8f0 !important; /* Visible cell lines */
          font-size: 0.95rem !important;
          font-weight: 600; /* Bolder cell values for clarity */
        }

        .custom-table tbody tr {
          transition: all 0.2s ease;
        }

        .custom-table tbody tr:hover {
          background: #f8fafc !important; /* Subtle row hover */
        }

        .no-records-cell {
          text-align: center;
          color: #64748b;
          font-style: italic;
          padding: 2.5rem !important;
        }

        .user-badge {
          background: #fffbeb;
          border: 2px solid #f59e0b;
          color: #b45309;
          padding: 0.4rem 0.9rem;
          border-radius: 30px;
          font-size: 0.85rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
        }

        .waste-highlight {
          font-weight: 700;
          color: #b45309;
        }

        .total-waste-highlight {
          font-weight: 800;
          color: #b91c1c; /* Bold red for highlights */
          background: #fee2e2;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          border: 1px solid #fca5a5;
        }

        /* ===== Customer-page look ===== */
        .shredding-dashboard-wrapper {
          color: #0b2f4f;
          background:
            radial-gradient(circle at 12% 6%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 30%),
            radial-gradient(circle at 88% 18%, rgba(160,222,250,0.7) 0, rgba(160,222,250,0) 32%),
            radial-gradient(circle at 50% 100%, rgba(255,255,255,0.7) 0, rgba(255,255,255,0) 45%),
            linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%);
          background-attachment: fixed;
          font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
        }

        /* hero */
        .shredding-dashboard-wrapper .container > .position-relative {
          z-index: 0; min-height: 64px; padding: 12px 36px;
          display: flex; align-items: center; justify-content: center;
        }
        .shredding-dashboard-wrapper .container > .position-relative::before {
          content: ""; position: absolute; inset: 0; z-index: -1;
          transform: skewX(-20deg); border-radius: 14px;
          background: linear-gradient(180deg, #c9eafb 0%, #b5dff6 100%);
          border: 1px solid #6fb5dc;
          box-shadow: 0 8px 20px rgba(40,120,170,.25);
        }
        .dashboard-title { font-size: 26px; color: #0a4f8c; letter-spacing: -0.3px; }
        .sd-emblem {
          display: inline-flex; align-items: center; justify-content: center;
          width: 46px; height: 46px; border-radius: 50%; color: #0a6fb8;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 50%, #8fd0f0 100%);
          border: 1px solid #86c6e8;
          box-shadow: 0 6px 14px rgba(40,120,170,.22), inset 0 2px 3px rgba(255,255,255,.9);
        }
        .sd-emblem svg { width: 22px; height: 22px; }
        .shredding-dashboard-wrapper .position-absolute.end-0 { right: 36px !important; }
        .shredding-dashboard-wrapper .position-absolute .user-badge {
          background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
          border: 1px solid #a9d9f2; color: #0a4f8c;
          box-shadow: 0 4px 12px rgba(40,120,170,.15), inset 0 1px 0 #fff;
        }
        .shredding-dashboard-wrapper .position-absolute .user-badge svg { display: none; }
        .shredding-dashboard-wrapper .position-absolute .user-badge::before {
          content: ""; width: 10px; height: 10px; margin-right: 8px; border-radius: 50%;
          background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.25);
        }

        /* cards */
        .forge-card {
          background: linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(228,246,255,.9) 100%);
          border: 1px solid rgba(255,255,255,.95); border-top: 1px solid rgba(255,255,255,.95);
          border-radius: 22px;
          box-shadow: 0 12px 28px rgba(40,120,170,.12), inset 0 1px 0 #fff;
        }
        .card-title-accent { color: #0a4f8c; }
        .card-title-accent svg, .custom-input-group label svg { color: #0a6fb8 !important; }
        .selection-instructions { color: #0a6fb8; }
        .date-time-selection-bar {
          background: rgba(255,255,255,.72); border: 2px dashed #7fc3e8; border-radius: 16px;
          box-shadow: inset 0 1px 0 #fff;
        }
        .custom-input-group label { color: #0b2f4f; }
        .custom-input {
          border: 1.5px solid #9ccbe6 !important; border-radius: 12px !important;
          color: #0b2f4f !important; box-shadow: inset 0 2px 5px rgba(10,80,130,.1) !important;
        }
        .custom-input:hover { border-color: #5fb4de !important; }
        .custom-input:focus {
          border-color: #1b9be0 !important;
          box-shadow: 0 0 0 4px rgba(27,155,224,.2), 0 6px 14px rgba(27,155,224,.12) !important;
        }

        /* buttons */
        .btn-forge-primary, .btn-forge-success, .btn-forge-excel {
          border: 1px solid transparent !important; border-radius: 12px !important;
        }
        .btn-forge-primary {
          background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%) !important;
          color: #08406b !important; border-color: #7fc3e8 !important;
          box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40,120,170,.18), inset 0 1px 0 rgba(255,255,255,.8) !important;
        }
        .btn-forge-success, .btn-forge-excel {
          background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%) !important;
          color: #07583b !important; border-color: #7fd3ab !important;
          box-shadow: 0 3px 0 #84cba9, 0 7px 12px rgba(20,168,112,.18), inset 0 1px 0 rgba(255,255,255,.8) !important;
        }
        .btn-forge-primary:hover { background: linear-gradient(180deg, #e2f5fe 0%, #b0def6 100%) !important; }
        .btn-forge-success:hover, .btn-forge-excel:hover {
          background: linear-gradient(180deg, #e0f9ec 0%, #b0ecd0 100%) !important;
        }

        /* tables */
        .custom-table-container { border: 1px solid #9ccbe6; border-radius: 18px; }
        .custom-table th {
          background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%) !important;
          color: #08406b !important; border: 1px solid #7fbfe4 !important;
        }
        .custom-table td { border-bottom: 1px solid #d3e8f4 !important; color: #0b2f4f; }
        .custom-table tbody tr:nth-child(even) { background: #f3faff; }
        .custom-table tbody tr:hover { background: #d9f2fc !important; }
        .waste-highlight { color: #0a4f8c; }
        .no-records-cell { color: #4a6f8c; }
        .custom-table .user-badge {
          background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%) !important;
          color: #0a4f8c !important; border: 1px solid #a9d9f2 !important;
        }

        @media (max-width: 768px) {
          .shredding-dashboard-wrapper .container > .position-relative { flex-direction: column; gap: 8px; }
          .shredding-dashboard-wrapper .position-absolute.end-0 {
            position: static !important; transform: none !important; right: auto !important;
          }
        }

        /* Adjust internal browser calendar indicators to fit dark icons */
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: sepia(100%) saturate(200%) hue-rotate(350deg) brightness(0.4) contrast(1.4);
          cursor: pointer;
        }
      `}</style>

      <div className="container">
        {/* Header Section (Centered Title with User badge positioned on the far right) */}
        {/* Work Order Card */}
        <div className="forge-card">
          <div className="row align-items-end">
            <div className="col-md-9 custom-input-group mb-0 mb-md-0">
              <label className="d-flex align-items-center gap-2">
                <svg  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#d97706'}}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                Work Order (WO) Number
              </label>
              <input
                className="form-control custom-input"
                placeholder="Enter Work Order number..."
                value={woNumber}
                onChange={(e) => setWoNumber(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <button
                className="btn btn-forge-primary w-100 d-flex align-items-center justify-content-center gap-2"
                onClick={fetchWO}
                style={{ height: '46px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Fetch Details
              </button>
            </div>
          </div>
        </div>

        {/* Reel Waste details card with nested Date/Time fields */}
        <div className="forge-card">
          <h4 className="card-title-accent">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#d97706'}}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Reel Waste
          </h4>

          {/* Attention-grabbing Date & Time bar */}
          <div className="date-time-selection-bar">
            <div className="selection-instructions">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Step 1: Set Shredding Date & Time
            </div>
            <div className="row">
              <div className="col-md-6 custom-input-group mb-2 mb-md-0">
                <label>Date</label>
                <input
                  type="date"
                  className="form-control custom-input"
                  value={shreddingDate}
                  onChange={(e) => setShreddingDate(e.target.value)}
                />
              </div>

              <div className="col-md-6 custom-input-group mb-0">
                <label>Time</label>
                <input
                  type="time"
                  className="form-control custom-input"
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
                  <th style={{ textAlign: 'center' }}>Action</th>
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
                      <td style={{ fontWeight: '600' }}>{r.reelNo}</td>
                      <td>
                        {new Date(r.productionDate).toLocaleDateString("en-IN", {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="waste-highlight">{r.mattWaste}</td>
                      <td className="waste-highlight">{r.printWaste}</td>
                      <td className="waste-highlight">{r.realEndWaste}</td>
                      <td>
                        <span className="total-waste-highlight">{r.totalWaste}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-forge-success d-inline-flex align-items-center gap-2"
                          onClick={() => save(r)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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

        {/* Shredding History Card */}
        <div className="forge-card">
          <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
            <h4 className="card-title-accent mb-0" style={{ paddingBottom: 0, marginBottom: 0 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#d97706'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><path d="M12 2a10 10 0 1 0 10 10H12V2z" opacity="0.2"/></svg>
              Shredding History
            </h4>
            {history.length > 0 && (
              <button
                className="btn-forge-excel d-inline-flex align-items-center gap-2"
                onClick={exportToExcel}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
                      <td style={{ fontWeight: '600' }}>{h.efiWoNumber}</td>
                      <td>{h.reelNo}</td>
                      <td>{h.mattWaste}</td>
                      <td>{h.printWaste}</td>
                      <td>{h.realEndWaste}</td>
                      <td>
                        <span className="total-waste-highlight">{h.totalWaste}</span>
                      </td>
                      <td>
                        <span className="user-badge" style={{ background: 'rgba(217, 119, 6, 0.06)', color: '#78350f', border: '1px solid rgba(217, 119, 6, 0.15)' }}>
                          {h.planningUser}
                        </span>
                      </td>
                      <td>
                        {new Date(h.shreddingDate).toLocaleString("en-IN", {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
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