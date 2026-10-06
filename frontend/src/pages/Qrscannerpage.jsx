import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Html5QrcodeScanner } from "html5-qrcode";
import BASE_URL from "../config/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
// ─── Shared style constants ───────────────────────────────────────────────────
const S = {
  label: {
    display: "block",
    fontSize: "11.5px",
    fontWeight: 700,
    color: "white",
    marginBottom: "6px",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
  },
  input: {
    height: "48px",
    background: "rgba(255,255,255,0.06)",
    border: "1.5px solid rgba(255,255,255,0.15)",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14.5px",
    fontWeight: 500,
    paddingLeft: "16px",
    paddingRight: "16px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "border 0.2s, background 0.2s",
    boxShadow: "inset 0 1px 4px rgba(0,0,0,0.3)",
  },
  btnBlue: {
    height: "48px",
    width: "100%",
    background: "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)",
    border: "1px solid #1e40af",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.2px",
    boxShadow: "0 3px 10px rgba(29,78,216,0.5)",
    whiteSpace: "nowrap",
  },
  btnDark: {
    height: "48px",
    width: "100%",
    background: "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)",
    border: "1px solid #1e40af",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    boxShadow: "0 3px 10px rgba(29,78,216,0.5)",
    whiteSpace: "nowrap",
  },
  btnRed: {
    height: "48px",
    padding: "0 30px",
    background: "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)",
    border: "1px solid #991b1b",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.2px",
    boxShadow: "0 3px 10px rgba(185,28,28,0.5)",
    whiteSpace: "nowrap",
  },
  divider: {
    border: "none",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    margin: "1.5rem 0",
  },
  alertSuccess: {
    background: "rgba(16,185,129,0.1)",
    border: "1px solid rgba(16,185,129,0.28)",
    borderLeft: "4px solid #10b981",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "13.5px",
    color: "#6ee7b7",
    marginBottom: "1.75rem",
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },
  alertError: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.28)",
    borderLeft: "4px solid #ef4444",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "13.5px",
    color: "#fca5a5",
    marginBottom: "1rem",
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },
  statusBar: {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "14px",
    padding: "1rem 1.25rem",
    marginTop: "1.5rem",
  },
  badgeDone: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 700,
    background: "rgba(16,185,129,0.15)",
    color: "#34d399",
    border: "1px solid rgba(16,185,129,0.3)",
  },
  badgePending: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 700,
    background: "rgba(251,191,36,0.13)",
    color: "#fbbf24",
    border: "1px solid rgba(251,191,36,0.28)",
  },
  stepLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "white",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  card: {
    background: "rgba(2, 7, 23, 0.7)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgb(0,0,0)",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "0 16px 48px rgba(13,181,219,0.8)",
  },
  cardHeader: {
    background: "linear-gradient(135deg, #38bfe4bb 0%, #2d0fb1 100%)",
    borderBottom: "1px solid rgba(255,255,255,0.97)",
    padding: "15px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    position: "relative",
  },
  cardHeaderTitle: {
    margin: 0,
    fontWeight: 800,
    fontSize: "17px",
    color: "#fff",
    letterSpacing: "0.4px",
  },
};

const pageAnimation = `
@keyframes settleIn {
  0%   { opacity: 0; transform: translateY(18px); }
  70%  { opacity: 1; transform: translateY(-3px); }
  100% { opacity: 1; transform: translateY(0); }
}
`;

// ── Parse carton QR: "poNumber#remainingQty#currentBox/totalBoxes#barcodeNo" ──
const parseQR = (text) => {
  const parts = text.split("#");
  if (parts.length < 3) return null;
  const [poNumber, remainingQty, cartonPart, barcodeNo] = parts;
  const [currentBox, totalBoxes] = (cartonPart || "").split("/");
  if (!currentBox || !totalBoxes) return null;
  return {
    poNumber,
    remainingQty: Number(remainingQty),
    currentBox: Number(currentBox),
    totalBoxes: Number(totalBoxes),
    barcodeNo: barcodeNo || "",
  };
};

export default function QRScannerPage() {
  // ── Step 1: PO lookup ──
  const [poInput, setPoInput] = useState("");
  const [poInfo, setPoInfo] = useState(null);       // fetched PO data
  const [poLoading, setPoLoading] = useState(false);
  const [step, setStep] = useState(1);              // 1 = PO entry, 2 = carton scan
const [batches, setBatches] = useState([]);
  // ── Step 2: Carton scanning ──
  const [qrText, setQrText] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanLog, setScanLog] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
const [selectedBatch, setSelectedBatch] = useState(null);
  const scannerRef = useRef(null);
  const gunTimerRef = useRef(null);
  const lastScanRef = useRef("");
  const inputRef = useRef(null);
  const poInputRef = useRef(null);

  // ── Stop camera ──
  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.clear(); } catch (e) { console.log(e); }
      scannerRef.current = null;
      setScannerStarted(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
      if (gunTimerRef.current) clearTimeout(gunTimerRef.current);
    };
  }, []);

  // Auto-focus PO input on mount
  useEffect(() => {
    poInputRef.current?.focus();
  }, []);

  // ── STEP 1: Fetch PO by PO number ──
  const handleFetchPO = async () => {
    const trimmed = poInput.trim();
    if (!trimmed) { toast.error("Enter a PO number"); return; }

    setPoLoading(true);
    try {
      const res = await axios.get(
        `${BASE_URL}/api/manual-box/by-po/${encodeURIComponent(trimmed)}`
      );
      const data = res.data.data;
      if (!data) { toast.error("PO not found"); return; }
      setPoInfo(data);

      // Also load existing scan log for this PO
      await fetchScanLog(trimmed);

      setStep(2);
      toast.success("PO loaded — ready to scan cartons");
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      toast.error(err.response?.data?.message || "PO not found");
    } finally {
      setPoLoading(false);
    }
  };

  const handlePoKeyDown = (e) => {
    if (e.key === "Enter") handleFetchPO();
  };

  // ── STEP 2: Core carton scan handler ──
  const handleScan = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (lastScanRef.current === trimmed) return;
    lastScanRef.current = trimmed;
    setTimeout(() => { lastScanRef.current = ""; }, 1500);

    const parsed = parseQR(trimmed);
    if (!parsed) {
      toast.error("Invalid QR code format");
      return;
    }

    // ── PO mismatch check ──
    const activePO = poInput.trim();
    if (parsed.poNumber !== activePO) {
      toast.error(
        `PO mismatch! Expected "${activePO}" but scanned "${parsed.poNumber}"`,
        { duration: 4000 }
      );
      setQrText("");
      inputRef.current?.focus();
      return;
    }

 // Duplicate check
// Duplicate check — match all 4 fields same as backend
const alreadyScanned = scanLog.some(
  (log) =>
    String(log.poNumber) === String(parsed.poNumber) &&
    Number(log.currentBox) === Number(parsed.currentBox) &&
    Number(log.totalBoxes) === Number(parsed.totalBoxes) &&       // ✅
    Number(log.remainingQty) === Number(parsed.remainingQty)      // ✅
);

if (alreadyScanned) {
  toast.error(
    `Carton ${parsed.currentBox} already scanned for PO ${parsed.poNumber}`
  );

  setQrText("");
  inputRef.current?.focus();
  return;
}

setScanResult(parsed);
setLoading(true);

try {
const userData =
  JSON.parse(
    localStorage.getItem(
      "user"
    )
  ) || {};

const username =
  userData.username ||
  "Unknown";

const userLocations =
  userData.userLocations ||
  userData.locations ||
  [];

await axios.post(`${BASE_URL}/api/scan-log/save`, {
  poNumber: parsed.poNumber,
  poDate: poInfo?.poDate || "",
  deliveryDate: poInfo?.deliveryDate || "",
  deliveryAddress: poInfo?.deliveryAddress || "",
  username,
userLocations,
  currentBox: parsed.currentBox,
  totalBoxes: parsed.totalBoxes,
  remainingQty: parsed.remainingQty,
  barcodeNo: parsed.barcodeNo,
},  {
    headers: {
      Authorization: `Bearer ${localStorage.getItem(
        "token"
      )}`,
    },
  }
);

      toast.success(`Carton ${parsed.currentBox}/${parsed.totalBoxes} scanned!`);

      // Refresh log + progress
      await fetchScanLog(parsed.poNumber);

      // Auto-clear for next scan
      setTimeout(() => {
        setQrText("");
        setScanResult(null);
        inputRef.current?.focus();
      }, 900);
    } catch (err) {
      toast.error(err.response?.data?.message || "Scan processing failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Gun scanner: debounced input ──
  const handleGunChange = (e) => {
    const value = e.target.value;
    setQrText(value);
    if (gunTimerRef.current) clearTimeout(gunTimerRef.current);
    gunTimerRef.current = setTimeout(() => {
      if (value.trim().includes("#")) handleScan(value.trim());
    }, 300);
  };

  const handleGunKeyDown = (e) => {
    if (e.key === "Enter" && qrText.trim().includes("#")) {
      handleScan(qrText.trim());
    }
  };

  // ── Camera scanner ──
  const startCameraScanner = async () => {
    if (scannerStarted) { await stopScanner(); return; }
    await stopScanner();
    setScannerStarted(true);
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader-carton",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scannerRef.current.render(
      async (decodedText) => {
        setQrText(decodedText);
        await handleScan(decodedText);
      },
      () => {}
    );
  };

  // ── Fetch scan log ──
  const fetchScanLog = async (poNumber) => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/scan-log/by-po/${encodeURIComponent(poNumber)}`
      );
      setScanLog(res.data.data || []);
      setProgress(res.data.progress || null);
      setBatches(res.data.batches || []);
    } catch {
      setScanLog([]);
    }
  };

  // ── Full reset ──
  const reset = () => {
    setStep(1);
    setPoInput("");
    setPoInfo(null);
    setScanResult(null);
    setScanLog([]);
    setProgress(null);
    setQrText("");
    stopScanner();
    setTimeout(() => poInputRef.current?.focus(), 100);
  };

  const donePct = progress
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

    // ── Export helpers ──
const exportPDF = (rows, batchLabel) => {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(13);
  doc.text(`Scan History — PO: ${poInput.trim()} | ${batchLabel}`, 14, 14);
  autoTable(doc, {
    startY: 22,
    head: [["SNO", "PO Number", "Carton No", "Total Cartons", "Username", "Locations", "Scanned At", "Status"]],
    body: rows.map((log, idx) => [
      idx + 1,
      log.poNumber,
      log.currentBox,
      log.totalBoxes,
      log.username,
      log.userLocations?.join(", ") || "—",
      new Date(log.scannedAt).toLocaleString("en-IN"),
      "Done",
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [29, 78, 216] },
    alternateRowStyles: { fillColor: [240, 245, 255] },
  });
  doc.save(`ScanHistory_${poInput.trim()}_${batchLabel}.pdf`);
};

const exportExcel = (rows, batchLabel) => {
  const data = rows.map((log, idx) => ({
    SNO: idx + 1,
    "PO Number": log.poNumber,
    "Carton No": log.currentBox,
    "Total Cartons": log.totalBoxes,
    Username: log.username,
    Locations: log.userLocations?.join(", ") || "—",
    "Scanned At": new Date(log.scannedAt).toLocaleString("en-IN"),
    Status: "Done",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Scan History");
  XLSX.writeFile(wb, `ScanHistory_${poInput.trim()}_${batchLabel}.xlsx`);
};

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        animation: "settleIn 0.42s ease-out",
        overflowX: "hidden",
        backgroundImage: "url('/scan.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        minHeight: "calc(100vh - 70px)",
        padding: "20px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "22px",
      }}
    >
      <style>{pageAnimation}</style>

      {/* ══════════════════════════════════════════
          STEP 1 — PO Number Entry
      ══════════════════════════════════════════ */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={{ fontSize: "19px" }}>📋</span>
          <h4 style={S.cardHeaderTitle}>
            {step === 1 ? "Step 1 — Enter PO Number" : `Step 1 — PO: ${poInput.trim()}`}
          </h4>
          {step === 2 && (
            <button
              onClick={reset}
              style={{
                position: "absolute",
                right: "20px",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "8px",
                color: "#fff",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✕ Reset
            </button>
          )}
        </div>

        <div style={{ padding: "2rem 1.75rem" }}>
          {/* <div style={S.stepLabel}>Purchase Order Number</div> */}

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>PO Number</label>
              <input
                ref={poInputRef}
                type="text"
                style={{
                  ...S.input,
                  ...(step === 2
                    ? {
                        background: "rgba(34,197,94,0.12)",
                        border: "1.5px solid rgba(34,197,94,0.45)",
                        color: "#86efac",
                      }
                    : {}),
                }}
                value={poInput}
                onChange={(e) => setPoInput(e.target.value)}
                onKeyDown={handlePoKeyDown}
                placeholder="Enter PO number..."
                disabled={step === 2}
              />
            </div>
            <div style={{ flexShrink: 0, width: "160px" }}>
              {step === 1 ? (
                <button
                  style={{
                    ...S.btnBlue,
                    opacity: poLoading ? 0.65 : 1,
                    cursor: poLoading ? "not-allowed" : "pointer",
                  }}
                  onClick={handleFetchPO}
                  disabled={poLoading}
                >
                  {poLoading ? "⏳ Loading..." : "🔍 Fetch PO"}
                </button>
              ) : (
                <button
                  style={{ ...S.btnRed, width: "100%", padding: 0 }}
                  onClick={reset}
                >
                  ✕ Change PO
                </button>
              )}
            </div>
          </div>

          {/* PO Info grid — shown after fetch */}
          {step === 2 && poInfo && (
            <>
              <hr style={{ ...S.divider, marginTop: "1.5rem" }} />
              <div style={S.stepLabel}>PO Details</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: "12px",
                }}
              >
                {[
                  ["PO Number", poInfo.ponumber],
                  ["PO Date", poInfo.poDate],
                  ["Delivery Date", poInfo.deliveryDate],
                  // ["GSTIN No", poInfo.gstinNo],
                  // ["Article No", poInfo.articleNo],
                  // ["EAN No", poInfo.eanNo],
                  // ["Material", poInfo.materialDescription],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: "10px",
                      padding: "10px 14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 500, wordBreak: "break-word" }}>
                      {val || "—"}
                    </div>
                  </div>
                ))}

                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 700,
                      marginBottom: "4px",
                    }}
                  >
                    Delivery Address
                  </div>
                  <div style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 500, whiteSpace: "pre-line" }}>
                    {poInfo.deliveryAddress || "—"}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          STEP 2 — Carton QR Scanning
          Only shown after PO is loaded
      ══════════════════════════════════════════ */}
      {step === 2 && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={{ fontSize: "19px" }}>▣</span>
            <h4 style={S.cardHeaderTitle}>Step 2 — Scan Cartons</h4>
          </div>

          <div style={{ padding: "2rem 1.75rem" }}>
            <div style={S.stepLabel}>Scan Carton QR Code</div>

            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "1rem" }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Gun Scanner / Barcode Reader</label>
                <input
                  ref={inputRef}
                  type="text"
                  style={{
                    ...S.input,
                    ...(scanResult
                      ? {
                          background: "rgba(34,197,94,0.12)",
                          border: "1.5px solid rgba(34,197,94,0.45)",
                          color: "#86efac",
                        }
                      : {}),
                  }}
                  value={qrText}
                  onChange={handleGunChange}
                  onKeyDown={handleGunKeyDown}
                  placeholder={`Scan carton QR for PO: ${poInput.trim()}...`}
                  autoFocus
                  disabled={loading}
                />
              </div>
              <div style={{ flexShrink: 0, width: "160px" }}>
                <button
                  style={{
                    ...S.btnDark,
                    opacity: loading ? 0.65 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
                    ...(scannerStarted
                      ? {
                          background: "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)",
                          border: "1px solid #991b1b",
                          boxShadow: "0 3px 10px rgba(185,28,28,0.5)",
                        }
                      : {}),
                  }}
                  onClick={startCameraScanner}
                  disabled={loading}
                >
                  {scannerStarted ? "⏹ Stop Camera" : "📷 Camera Scan"}
                </button>
              </div>
            </div>

            {/* Camera preview */}
            <div style={{ marginBottom: "1rem" }}>
              <div id="qr-reader-carton" style={{ maxWidth: "400px" }} />
            </div>

            {/* Success alert */}
            {scanResult && (
              <div style={S.alertSuccess}>
                <span>✅</span>
                <span>
                  Carton <strong style={{ color: "#fff" }}>{scanResult.currentBox} / {scanResult.totalBoxes}</strong> scanned
                  {scanResult.barcodeNo && (
                    <> &nbsp;·&nbsp; Barcode: <strong style={{ color: "#fff" }}>{scanResult.barcodeNo}</strong></>
                  )}
                  &nbsp;·&nbsp; PO: <strong style={{ color: "#fff" }}>{scanResult.poNumber}</strong>
                </span>
              </div>
            )}

            {/* Progress bar + stats */}
          {progress && (
  <>
    <hr style={S.divider} />
    <div style={S.stepLabel}>Carton Progress</div>

    {/* ✅ Per-batch progress */}
    {batches
  .filter((batch) => batch.done < batch.totalBoxes)
  .map((batch, i) => {
      const pct = Math.round((batch.done / batch.totalBoxes) * 100);
      return (
        <div key={i} style={{ marginBottom: "16px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#94a3b8",
            marginBottom: "6px",
          }}>
            <span>Batch {i + 1} — {batch.totalBoxes} boxes (Remaining Qty: {batch.remainingQty})</span>
            <span>{batch.done}/{batch.totalBoxes} scanned</span>
          </div>
          <div style={{
            height: "8px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "99px",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg, #0ea5e9, #22c55e)",
              borderRadius: "99px",
              transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      );
    })}

    {/* Overall totals */}
    <div style={S.statusBar}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={S.badgeDone}>
          ✔ Scanned: <strong style={{ fontSize: "24px" }}>{progress.done}</strong>
        </span>
        <span style={S.badgePending}>
          ⏳ Pending: <strong style={{ fontSize: "24px" }}>{progress.pending}</strong>
        </span>
        <span style={{
          ...S.badgeDone,
          background: "rgba(56,189,248,0.13)",
          color: "#38bdf8",
          border: "1px solid rgba(56,189,248,0.3)",
        }}>
          📦 Total: <strong style={{ fontSize: "24px" }}>{progress.total}</strong>
        </span>
        <span style={{
          ...S.badgeDone,
          background: "rgba(168,85,247,0.13)",
          color: "#c084fc",
          border: "1px solid rgba(168,85,247,0.3)",
        }}>
          {Math.round((progress.done / progress.total) * 100) || 0}% Done
        </span>
      </div>
    </div>
  </>
)}
          </div>
        </div>
      )}

    {/* ── Scan History Table ── */}
{scanLog.length > 0 && (() => {
  // Use selectedBatch if user picked one, else default to scanResult or first batch
  const activeBatch = selectedBatch ?? {
    totalBoxes: scanResult?.totalBoxes ?? scanLog[0]?.totalBoxes,
    remainingQty: scanResult?.remainingQty ?? scanLog[0]?.remainingQty,
  };

  const currentBatchLog = scanLog.filter(
    (log) =>
      Number(log.totalBoxes) === Number(activeBatch.totalBoxes) &&
      Number(log.remainingQty) === Number(activeBatch.remainingQty)
  );

  const currentBatch = batches.find(
    (b) =>
      Number(b.totalBoxes) === Number(activeBatch.totalBoxes) &&
      Number(b.remainingQty) === Number(activeBatch.remainingQty)
  );

  const pct = currentBatch
    ? Math.round((currentBatch.done / currentBatch.totalBoxes) * 100)
    : 0;

  return (
    <div style={{ ...S.card, width: "100%", maxWidth: "100%" }}>
    <div style={S.cardHeader}>
        <span style={{ fontSize: "19px" }}>🗂</span>
        <h4 style={S.cardHeaderTitle}>
          Scan History — {currentBatchLog.length} / {activeBatch.totalBoxes} scanned
        </h4>
        <div style={{ position: "absolute", right: "16px", display: "flex", gap: "8px" }}>
          <button
            onClick={() => exportPDF(currentBatchLog, `Batch_${activeBatch.totalBoxes}boxes`)}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(239,68,68,0.5)",
              background: "rgba(239,68,68,0.15)",
              color: "#fca5a5",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            📄 PDF
          </button>
          <button
            onClick={() => exportExcel(currentBatchLog, `Batch_${activeBatch.totalBoxes}boxes`)}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(34,197,94,0.5)",
              background: "rgba(34,197,94,0.15)",
              color: "#86efac",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            📊 Excel
          </button>
        </div>
      </div>

      <div style={{ padding: "1.25rem 1.75rem" }}>

        {/* ── Batch Selector Tabs ── */}
        {batches.length > 1 && (
          <div style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}>
            {batches.map((batch, i) => {
              const isActive =
                Number(batch.totalBoxes) === Number(activeBatch.totalBoxes) &&
                Number(batch.remainingQty) === Number(activeBatch.remainingQty);
              const bPct = Math.round((batch.done / batch.totalBoxes) * 100);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedBatch({ totalBoxes: batch.totalBoxes, remainingQty: batch.remainingQty })}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: isActive
                      ? "1.5px solid rgba(56,189,248,0.7)"
                      : "1.5px solid rgba(255,255,255,0.1)",
                    background: isActive
                      ? "rgba(56,189,248,0.15)"
                      : "rgba(255,255,255,0.04)",
                    color: isActive ? "#38bdf8" : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  Batch {i + 1} &nbsp;·&nbsp; {batch.totalBoxes} boxes &nbsp;·&nbsp;
                  <span style={{ color: bPct === 100 ? "#34d399" : "#fbbf24" }}>
                    {bPct}%
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#94a3b8",
            marginBottom: "6px",
          }}>
            <span>Batch — {activeBatch.totalBoxes} boxes</span>
            <span>{currentBatch?.done ?? 0} done · {currentBatch?.pending ?? 0} pending · {pct}%</span>
          </div>
          <div style={{
            height: "8px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "99px",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg, #0ea5e9, #22c55e)",
              borderRadius: "99px",
              transition: "width 0.5s ease",
            }} />
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
            <span style={S.badgeDone}>
              ✔ Done: <strong style={{ fontSize: "20px" }}>{currentBatch?.done ?? 0}</strong>
            </span>
            <span style={S.badgePending}>
              ⏳ Pending: <strong style={{ fontSize: "20px" }}>{currentBatch?.pending ?? 0}</strong>
            </span>
            <span style={{
              ...S.badgeDone,
              background: "rgba(56,189,248,0.13)",
              color: "#38bdf8",
              border: "1px solid rgba(56,189,248,0.3)",
            }}>
              📦 Total: <strong style={{ fontSize: "20px" }}>{activeBatch.totalBoxes}</strong>
            </span>
          </div>
        </div>

        {/* Table */}
        <div style={{
          width: "100%",
          maxHeight: "360px",
          overflowX: "auto",
          overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "10px",
        }}>
          <table
            className="table table-bordered table-striped table-hover align-middle text-nowrap mb-0"
            style={{ width: "max-content", minWidth: "100%" }}
          >
            <thead className="table-dark" style={{ position: "sticky", top: 0, zIndex: 5 }}>
              <tr>
                <th>SNO</th>
                <th>PO Number</th>
                <th>Carton No</th>
                <th>Total Cartons</th>
                <th>User Details</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentBatchLog.map((log, idx) => (
                <tr key={log._id}>
                  <td>{idx + 1}</td>
                  <td style={{ fontWeight: 700, color: "#38bdf8" }}>{log.poNumber}</td>
                  <td style={{ fontWeight: 700, color: "#22c55e" }}>{log.currentBox}</td>
                  <td>{log.totalBoxes}</td>
                  <td style={{
                    width: "165px", minWidth: "165px", maxWidth: "165px",
                    textAlign: "left", lineHeight: "1.25", padding: "6px", fontSize: "11px",
                  }}>
                    <div style={{ fontWeight: 700, color: "#38bdf8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      👤 {log.username}
                    </div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      📍 {log.userLocations?.join(", ") || "—"}
                    </div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                      🕒 {new Date(log.scannedAt).toLocaleString("en-IN")}
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-success">✓ Done</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
})()}
    </div>
  );
}