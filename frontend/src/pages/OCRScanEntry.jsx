import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import { createWorker } from "tesseract.js";
import BASE_URL from "../config/api";

const showAlert = (message, icon = "warning") => {
  Swal.fire({ toast: true, position: "top", icon, title: message, timer: 4000, showConfirmButton: false });
};

// Upscale + stretch contrast (no hard cutoff) so faint text on light-colored boxes survives
const preprocessImage = (fileOrBlob) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = 4;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false; // nearest-neighbor: keeps thin text crisp instead of blurring it
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = imgData.data;

      const gray = new Float32Array(px.length / 4);
      let min = 255, max = 0;
      for (let i = 0, j = 0; i < px.length; i += 4, j++) {
        const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        gray[j] = g;
        if (g < min) min = g;
        if (g > max) max = g;
      }
      const range = Math.max(max - min, 1);
      for (let i = 0, j = 0; i < px.length; i += 4, j++) {
        const stretched = ((gray[j] - min) / range) * 255;
        px[i] = px[i + 1] = px[i + 2] = stretched;
      }
      ctx.putImageData(imgData, 0, 0);

      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))), "image/png");
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(fileOrBlob);
  });

const normWord = (w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase();

// Resizes + recompresses an image before it's uploaded to the handwriting OCR endpoint.
// Phone camera photos can be 8-12MP, which adds real upload time AND real Gemini
// vision-processing time for zero legibility benefit on a single ledger page. 1800px on
// the long edge is comfortably more than enough resolution to read handwriting. PDFs are
// left untouched (multi-page, not cheap to resize client-side without a PDF library).
const downscaleForUpload = (file, maxDimension = 1800, quality = 0.85) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

// Exact match, or a prefix match where the shorter string is at least 70% of the longer one
// (handles OCR/Excel truncation like "Productio" for "Production" without letting short
// unrelated words like "Prod" accidentally match a longer token like "production")
const wordMatches = (word, token) => {
  const nw = normWord(word);
  if (!nw) return false;
  if (nw === token) return true;
  const shorter = nw.length < token.length ? nw : token;
  const longer = nw.length < token.length ? token : nw;
  return shorter.length >= 4 && longer.startsWith(shorter) && shorter.length / longer.length >= 0.7;
};

const normalizeDateValue = (raw) => {
  if (!raw) return raw;
  const m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return raw;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;

  const year = Number(y);
  const currentYear = new Date().getFullYear();
  // Wide enough to accept genuine older ledger entries, but still catches
  // clearly-wrong misreads (e.g. a stray "2004"/"20026" instead of "2026").
  if (year < 2015 || year > currentYear + 1) return raw;

  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

// Converts a scanned 12-hour time like "12:46 AM" / "2:43 PM" into 24-hour "HH:MM" — an
// <input type="time"> silently renders blank for anything not already in that format.
const normalizeTimeValue = (raw) => {
  if (!raw) return raw;
  const m = raw.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])/);
  if (!m) return raw;
  let [, h, min, ampm] = m;
  h = parseInt(h, 10);
  if (/pm/i.test(ampm) && h !== 12) h += 12;
  if (/am/i.test(ampm) && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
};

// Tesseract v5 returns hierarchical blocks > paragraphs > lines > words. For sparse grid
// layouts like a spreadsheet screenshot, Tesseract's own line segmentation can occasionally
// merge two visually separate rows into a single "line" object, which would poison every
// downstream column read. To guard against that we ignore Tesseract's line boundaries
// entirely, flatten every word out individually, and re-cluster them into rows ourselves
// using only each word's y-position.
const buildLines = (data) => {
  const allWords = [];
  (data?.blocks || []).forEach((block) => {
    (block.paragraphs || []).forEach((para) => {
      (para.lines || []).forEach((line) => {
        (line.words || []).forEach((w) => {
          if (w && w.bbox && w.text && w.text.trim()) allWords.push(w);
        });
      });
    });
  });
  if (allWords.length === 0) return [];

  // Rows are reliably separated by roughly a full text-line height; anything closer than
  // that is treated as the same row, anything farther is a new row.
  const heights = allWords.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 20;
  const rowThreshold = medianHeight * 0.6;

  const sorted = [...allWords].sort(
    (a, b) => (a.bbox.y0 + a.bbox.y1) / 2 - (b.bbox.y0 + b.bbox.y1) / 2
  );

  const rows = [];
  let current = null;
  sorted.forEach((w) => {
    const yCenter = (w.bbox.y0 + w.bbox.y1) / 2;
    if (!current || yCenter - current.yRef > rowThreshold) {
      if (current) rows.push(current);
      current = { yRef: yCenter, words: [w] };
    } else {
      current.words.push(w);
      // running average so drift doesn't creep across a long, wide row
      current.yRef = (current.yRef * (current.words.length - 1) + yCenter) / current.words.length;
    }
  });
  if (current) rows.push(current);

  return rows
    .map((r) => ({ y: r.yRef, words: [...r.words].sort((a, b) => a.bbox.x0 - b.bbox.x0) }))
    .sort((a, b) => a.y - b.y);
};

// ---------------------------------------------------------------------------------------
// Excel/spreadsheet table extraction.
//
// The Reel Register scan is a screenshot of a fixed Excel export template, so the column
// order never changes. Trying to infer column boundaries purely from pixel gaps between
// header words is unreliable here: most header cells are short single words packed at
// fairly uniform spacing, with only a couple of outliers (e.g. a misread "Job" cell) —
// so any gap-based clustering tends to merge nearly the whole header row into one blob
// and only split off those outliers. Instead, we match the header row directly against
// the known, fixed column sequence below, using fuzzy text similarity to absorb OCR noise
// (merged words like "WODate", typos like "Paper5ize", etc).
// ---------------------------------------------------------------------------------------

const EXCEL_COLUMN_SEQUENCE = [
  { tokens: ["wo", "no"], field: "efiWoNumber" },
  { tokens: ["wo", "date"], field: null },
  { tokens: ["prod", "date"], field: "productionDate" },
  { tokens: ["customer"], field: null },
  { tokens: ["job"], field: null },
  { tokens: ["material"], field: null },
  { tokens: ["material", "group"], field: null },
  { tokens: ["mill"], field: "mill" },
  { tokens: ["gsm"], field: null },
  { tokens: ["paper", "size"], field: null },
  { tokens: ["reel", "no"], field: "reelNo" },
  { tokens: ["production", "type"], field: "productionType" },
  { tokens: ["gross"], field: "grossWeight" },
  { tokens: ["mill", "net"], field: "millNetWeight" },
  { tokens: ["actual", "gsm"], field: "actualGsm" },
  { tokens: ["actual", "net"], field: "actualNetWeight" },
  { tokens: ["output"], field: "productionOutput" },
  { tokens: ["matt"], field: "mattWaste" },
  { tokens: ["print"], field: "printWaste" },
  { tokens: ["end"], field: "realEndWaste" },
  { tokens: ["core"], field: "coreWeight" },
{ tokens: ["total", "waste"], field: "totalWaste" },
{ tokens: ["balance"], field: "balance" },
{ tokens: ["waste"], field: "wastePercent" },
  { tokens: ["remarks"], field: "remarks" },
];

// Standard Levenshtein edit distance, used to tolerate OCR typos/merges when matching
// header words against the known column sequence (e.g. "Paper5ize" vs "PaperSize").
const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

const fuzzySimilar = (a, b, maxErrorRatio = 0.3) =>
  !!a && !!b && levenshtein(a, b) / Math.max(a.length, b.length) <= maxErrorRatio;

// Matches a free-text scanned value (e.g. "NIGTH", "prodution") against a list of known
// dropdown option strings (shift names, machine status names), returning the option's exact
// casing so a <select> can pre-select it, or "" if nothing is a close enough match.
const resolveDropdownValue = (scanned, options) => {
  const n = normWord(scanned);
  if (!n) return "";
  return options.find((opt) => fuzzySimilar(n, normWord(opt))) || "";
};

// Matches a scanned activity name (e.g. "ActivityI") against the fetched activities list,
// returning its _id so the Activity <select> can be pre-filled from the scan.
const resolveActivityId = (scanned, activities) => {
  const n = normWord(scanned);
  if (!n) return "";
  return activities.find((a) => fuzzySimilar(n, normWord(a.activityName || "")))?._id || "";
};

// Matches a scanned machine name (e.g. "M1") against the machines list. Tries the machines
// belonging to the already-resolved activity first (so a short name like "M1" doesn't
// collide with a same-named machine under a different activity), then falls back to the
// full machines list if that comes up empty.
const resolveMachineId = (scanned, machines, matchedActivity) => {
  const n = normWord(scanned);
  if (!n) return "";
  const pool = matchedActivity?.machines
    ? machines.filter((m) => matchedActivity.machines.map(String).includes(String(m._id)))
    : [];
  const inPool = pool.find((m) => fuzzySimilar(n, normWord(m.machineName || "")));
  if (inPool) return inPool._id;
  return machines.find((m) => fuzzySimilar(n, normWord(m.machineName || "")))?._id || "";
};

// Try to consume 1-3 consecutive OCR words starting at `wi` whose combined text fuzzily
// matches the target column's tokens (handles both merged and split OCR words).
const tryConsumeColumn = (headerWords, wi, tokens) => {
  const target = tokens.join("");
  for (let take = 1; take <= 3 && wi + take <= headerWords.length; take++) {
    const slice = headerWords.slice(wi, wi + take);
    const combined = slice.map((w) => normWord(w.text)).join("");
    if (combined && fuzzySimilar(combined, target)) return { words: slice, nextWi: wi + take };
  }
  return null;
};

// Walk the known column sequence left-to-right against the header row's words, allowing a
// small skip if a particular column's OCR text is unreadable or missing entirely.
const matchHeaderSequence = (headerWords) => {
  const results = [];
  let wi = 0;
  for (const entry of EXCEL_COLUMN_SEQUENCE) {
    let match = null;
    for (let skip = 0; skip <= 2 && !match; skip++) {
      match = tryConsumeColumn(headerWords, wi + skip, entry.tokens);
      if (match) wi = match.nextWi;
    }
    if (match) {
      const x0 = Math.min(...match.words.map((w) => w.bbox.x0)) - 20;
      const x1 = Math.max(...match.words.map((w) => w.bbox.x1)) + 20;
      results.push({ ...entry, header: entry.tokens.join(" "), x0, x1 });
    } else {
      results.push({ ...entry, header: entry.tokens.join(" "), x0: null, x1: null });
    }
  }
  return results;
};

// Find a header-row/data-row pair (the widest line is treated as the header) and read every
// column using the known sequence above. Returns { fields, extra } or null if this doesn't
// look like a table at all (e.g. a photographed paper form instead of a spreadsheet export).
const extractExcelRow = (lines) => {
  if (!Array.isArray(lines) || lines.length < 2) return null;
  let headerLi = -1, bestCount = 0;
  for (let li = 0; li < lines.length - 1; li++) {
    if (lines[li].words.length > bestCount) {
      bestCount = lines[li].words.length;
      headerLi = li;
    }
  }
  if (headerLi === -1 || bestCount < 4 || headerLi + 1 >= lines.length) return null;

  const columns = matchHeaderSequence(lines[headerLi].words);
  const valueLine = lines[headerLi + 1];
  const fields = {};
  const extraParts = [];

  columns.forEach((col) => {
    if (col.x0 == null) return;
    const value = valueLine.words
      .filter((w) => w.bbox.x1 > col.x0 && w.bbox.x0 < col.x1)
      .map((w) => w.text)
      .join(" ")
      .trim();
    if (col.field) fields[col.field] = value;
    else if (value) extraParts.push(`${col.header}: ${value}`);
  });

  if (fields.productionDate) fields.productionDate = normalizeDateValue(fields.productionDate);
  return { fields, extra: extraParts.join(", ") };
};

// ---------------------------------------------------------------------------------------
// Photographed paper-form extraction (label on one line, value on the line(s) below it).
// ---------------------------------------------------------------------------------------

// Find a label, then read the value in the same column on the line(s) below it
const findLabelValue = (lines, variants) => {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  for (const tokens of variants) {
    for (let li = 0; li < lines.length; li++) {
      const words = lines[li]?.words || [];
      if (words.length < tokens.length) continue;
      for (let start = 0; start <= words.length - tokens.length; start++) {
        const slice = words.slice(start, start + tokens.length);
        const isMatch = slice.every((w, i) => wordMatches(w.text, tokens[i]));
        if (isMatch) {
          const x0 = slice[0].bbox.x0 - 25;
          const x1 = slice[slice.length - 1].bbox.x1 + 25;
          for (let lj = li + 1; lj < lines.length && lj <= li + 2; lj++) {
            const valWords = lines[lj].words.filter((w) => w.bbox.x1 > x0 && w.bbox.x0 < x1);
            if (!valWords.length) continue;
            const isLabelLike = valWords.every((w) => ALL_LABEL_WORDS.has(normWord(w.text)));
            if (isLabelLike) continue;
            return valWords.map((w) => w.text).join(" ").trim();
          }
        }
      }
    }
  }
  return "";
};

const REEL_LABELS = {
  efiWoNumber: [["wo", "number"], ["efi", "wo", "number"], ["wo", "no"]],
  productionDate: [["prod", "date"], ["production", "date"], ["date"]],
  reelNo: [["reel", "no"]],
  grossWeight: [["gross", "net", "weight"], ["gross", "weight"], ["gross"]],
  millNetWeight: [["mill", "net", "weight"], ["mill", "net"]],
  actualNetWeight: [["actual", "net", "weight"], ["actual", "net"]],
  actualGsm: [["actual", "gsm"]],
  productionOutput: [["production", "output"], ["output"]],
  balance: [["reel", "balance"], ["balance"]],
  mill: [["mill", "name"], ["mill"]],
  productionType: [["production", "type"], ["production"]],
  mattWaste: [["reel", "matt", "waste"], ["matt", "waste"], ["matt"]],
  printWaste: [["reel", "print", "waste"], ["print", "waste"], ["print"]],
  realEndWaste: [["reel", "end", "waste"], ["end", "waste"], ["end"]],
  coreWeight: [["reel", "core", "waste"], ["core", "waste"], ["core"]],
  remarks: [["remarks"]],
};

const PRODUCTION_LABELS = {
  efiWoNumber: [["wo", "no"], ["work", "order", "no"], ["efi", "wo", "number"]],
  productionDate: [["production", "date"], ["prod", "date"], ["date"]],
  productionFromTime: [["from", "time"], ["start", "time"], ["from"]],
  productionToTime: [["to", "time"], ["end", "time"], ["to"]],
  shift: [["shift"]],
  productionImpression: [["production", "impression"]],
  wasteImpression: [["waste", "impression"]],
  productionUps: [["production", "ups"], ["ups"]],
  remarks: [["remarks"]],
};

// Every word that appears in any label, so a "value" match can be rejected if it's actually the next label row
const ALL_LABEL_WORDS = new Set(
  [...Object.values(REEL_LABELS), ...Object.values(PRODUCTION_LABELS)].flat(2)
);

const parseReelFields = (lines) => {
  const out = {};
  for (const [field, variants] of Object.entries(REEL_LABELS)) out[field] = findLabelValue(lines, variants);
  if (out.productionDate) out.productionDate = normalizeDateValue(out.productionDate);
  return out;
};

const parseProductionFields = (lines) => {
  const out = {};
  for (const [field, variants] of Object.entries(PRODUCTION_LABELS)) out[field] = findLabelValue(lines, variants);
  return out;
};

// ---------------------------------------------------------------------------------------
// Handwriting extraction fields (kept in one place so the frontend and the /api/ocr/handwriting
// backend prompt stay in sync — see ocrHandwriting.routes.js).
// ---------------------------------------------------------------------------------------
const REEL_HANDWRITING_FIELDS = [
  "efiWoNumber", "productionDate", "reelNo", "grossWeight", "millNetWeight",
  "actualNetWeight", "actualGsm", "productionOutput", "mattWaste", "printWaste",
  "realEndWaste", "coreWeight", "balance", "mill", "productionType","totalWaste", "wastePercent", "remarks",
];
const PRODUCTION_HANDWRITING_FIELDS = [
  "efiWoNumber", "productionDate", "activity", "machine", "productionFromTime", "productionToTime",
  "shift", "machineStatus", "productionImpression", "wasteImpression", "productionUps", "remarks",
];

// Recomputes Total Waste and Waste % for a reel row from its waste + weight fields — the
// same formula used on the Production Dashboard page:
//   Total Waste   = Matt Waste + Print Waste + End Waste + Core Waste
//   Waste %       = Total Waste / (Actual Net Weight − Balance) × 100
// Returns just the two derived fields, meant to be spread onto a reel row object.
const computeReelWasteFields = (fields = {}) => {
  const mattWaste = Number(fields.mattWaste) || 0;
  const printWaste = Number(fields.printWaste) || 0;
  const realEndWaste = Number(fields.realEndWaste) || 0;
  const coreWeight = Number(fields.coreWeight) || 0;
  const actualNetWeight = Number(fields.actualNetWeight) || 0;
  const balance = Number(fields.balance) || 0;

  const totalWaste = mattWaste + printWaste + realEndWaste + coreWeight;
  const netAfterBalance = actualNetWeight - balance;
  const wastePercent = netAfterBalance > 0 ? ((totalWaste / netAfterBalance) * 100).toFixed(2) : "0.00";

  return {
    totalWaste: Number(totalWaste.toFixed(2)),
    wastePercent,
  };
};

// ---------------------------------------------------------------------------------------
// Premium enterprise SaaS visual theme (styling only — no changes to any behaviour above
// or to any handler / state logic below). Injected once as a scoped <style> block.
// ---------------------------------------------------------------------------------------
const OcrTheme = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    .ocr-shell {
      --ocr-primary: #1d5d91;
      --ocr-secondary: #2878b7;
      --ocr-accent: #1b9b73;
      --ocr-ink: #16212e;
      --ocr-muted: #64748b;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      position: relative;
      min-height: 100vh;
      padding: 48px 16px 72px;
      background: #fbfcfe;
      overflow: hidden;
      color: var(--ocr-ink);
    }

    .ocr-shell::before,
    .ocr-shell::after {
      content: "";
      position: absolute;
      border-radius: 50%;
      filter: blur(70px);
      z-index: 0;
      pointer-events: none;
    }
    .ocr-shell::before {
      width: 520px;
      height: 520px;
      top: -220px;
      left: -160px;
      background: radial-gradient(circle at 30% 30%, rgba(40,120,183,0.22), rgba(29,93,145,0.06) 70%);
    }
    .ocr-shell::after {
      width: 480px;
      height: 480px;
      bottom: -200px;
      right: -140px;
      background: radial-gradient(circle at 70% 70%, rgba(27,155,115,0.16), rgba(40,120,183,0.05) 70%);
    }

    .ocr-inner { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; }

    /* ---------- Header ---------- */
    .ocr-header { text-align: center; margin-bottom: 40px; }
    .ocr-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 18px;
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(29,93,145,0.10), rgba(27,155,115,0.10));
      border: 1px solid rgba(29,93,145,0.18);
      color: var(--ocr-primary);
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 18px;
    }
    .ocr-badge .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--ocr-accent);
      box-shadow: 0 0 0 4px rgba(27,155,115,0.18);
    }
    .ocr-title {
      font-weight: 800;
      font-size: clamp(28px, 4vw, 40px);
      letter-spacing: -0.02em;
      margin: 0 0 8px;
      background: linear-gradient(135deg, var(--ocr-ink) 0%, var(--ocr-primary) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .ocr-subtitle {
      color: var(--ocr-muted);
      font-size: 15.5px;
      font-weight: 500;
      max-width: 520px;
      margin: 0 auto;
    }

    /* ---------- Doc type picker ---------- */
    .ocr-picker { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
    .ocr-picker-btn {
      border: none;
      border-radius: 18px;
      padding: 22px 34px;
      font-weight: 700;
      font-size: 15.5px;
      letter-spacing: 0.01em;
      color: #fff;
      cursor: pointer;
      min-width: 220px;
      box-shadow: 0 10px 24px -8px rgba(29,93,145,0.35);
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    }
    .ocr-picker-btn.reel { background: linear-gradient(135deg, var(--ocr-primary), var(--ocr-secondary)); }
    .ocr-picker-btn.production { background: linear-gradient(135deg, var(--ocr-accent), #17b98a); box-shadow: 0 10px 24px -8px rgba(27,155,115,0.35); }
    .ocr-picker-btn:hover { transform: translateY(-3px); filter: brightness(1.05); }
    .ocr-picker-btn:active { transform: translateY(-1px); }

    /* ---------- Glass card ---------- */
    .ocr-card {
      background: rgba(255,255,255,0.72);
      backdrop-filter: blur(22px);
      -webkit-backdrop-filter: blur(22px);
      border: 1px solid rgba(255,255,255,0.6);
      border-radius: 20px;
      box-shadow: 0 20px 50px -20px rgba(23,63,97,0.22), 0 2px 8px rgba(23,63,97,0.06);
      overflow: hidden;
    }
    .ocr-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 22px 28px;
      background: linear-gradient(135deg, var(--ocr-primary) 0%, var(--ocr-secondary) 100%);
      color: #fff;
    }
    .ocr-card-header h5 {
      margin: 0;
      font-weight: 700;
      font-size: 17px;
      letter-spacing: 0.01em;
      color: #fff !important;
    }
    .ocr-card-body { padding: 28px; }

    .ocr-ghost-btn {
      border: 1px solid rgba(255,255,255,0.55);
      background: rgba(255,255,255,0.12);
      color: #fff;
      border-radius: 999px;
      padding: 7px 16px;
      font-weight: 600;
      font-size: 12.5px;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .ocr-ghost-btn:hover { background: rgba(255,255,255,0.24); color: #fff; transform: translateY(-1px); }

    /* ---------- Capture toggle ---------- */
    .ocr-toggle-group { display: inline-flex; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(23,63,97,0.10); }
    .ocr-toggle-btn {
      border: 1px solid rgba(29,93,145,0.25) !important;
      background: #fff;
      color: var(--ocr-primary);
      font-weight: 600;
      padding: 10px 22px;
      transition: all 0.15s ease;
    }
    .ocr-toggle-btn.active {
      background: linear-gradient(135deg, var(--ocr-primary), var(--ocr-secondary));
      color: #fff !important;
      border-color: transparent !important;
    }
    .ocr-toggle-btn:hover { filter: brightness(1.03); }

    .ocr-file-input {
      border-radius: 12px !important;
      border: 1.5px dashed rgba(29,93,145,0.35) !important;
      background: rgba(29,93,145,0.03);
      padding: 12px 14px !important;
      font-size: 14px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .ocr-file-input:hover { border-color: var(--ocr-primary) !important; background: rgba(29,93,145,0.06); }
    .ocr-file-input:focus { box-shadow: 0 0 0 4px rgba(40,120,183,0.15) !important; border-color: var(--ocr-secondary) !important; }

    .ocr-preview-img {
      border-radius: 16px !important;
      border: 1px solid rgba(29,93,145,0.15) !important;
      box-shadow: 0 12px 28px -12px rgba(23,63,97,0.3) !important;
    }

    .ocr-scanning {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--ocr-primary) !important;
      font-weight: 600 !important;
    }
    .ocr-scanning::before {
      content: "";
      width: 14px; height: 14px;
      border-radius: 50%;
      border: 2px solid rgba(29,93,145,0.25);
      border-top-color: var(--ocr-primary);
      animation: ocr-spin 0.8s linear infinite;
    }
    @keyframes ocr-spin { to { transform: rotate(360deg); } }

    /* ---------- Buttons ---------- */
    .ocr-btn-save {
      background: linear-gradient(135deg, var(--ocr-accent), #17b98a) !important;
      border: none !important;
      border-radius: 10px !important;
      font-weight: 600 !important;
      box-shadow: 0 6px 16px -6px rgba(27,155,115,0.5);
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
    }
    .ocr-btn-save:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 10px 20px -6px rgba(27,155,115,0.55); }
    .ocr-btn-submit {
      background: linear-gradient(135deg, var(--ocr-primary), var(--ocr-secondary)) !important;
      border: none !important;
      border-radius: 12px !important;
      font-weight: 700 !important;
      padding: 12px 34px !important;
      box-shadow: 0 10px 22px -8px rgba(29,93,145,0.45);
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
    }
    .ocr-btn-submit:hover { transform: translateY(-2px); filter: brightness(1.05); }

    /* ---------- Inputs / selects inside tables & forms ---------- */
    .ocr-input, .ocr-select {
      border-radius: 8px !important;
      border: 1px solid rgba(29,93,145,0.18) !important;
      background: #fff;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .ocr-input:focus, .ocr-select:focus {
      border-color: var(--ocr-secondary) !important;
      box-shadow: 0 0 0 3px rgba(40,120,183,0.15) !important;
    }
    .ocr-input:hover, .ocr-select:hover { border-color: rgba(29,93,145,0.4) !important; }

    /* ---------- Tables ---------- */
    .ocr-table-wrap {
      border-radius: 16px !important;
      border: 1px solid rgba(29,93,145,0.12) !important;
      box-shadow: 0 10px 26px -14px rgba(23,63,97,0.25);
      background: #fff;
    }
    .ocr-table thead th {
      background: linear-gradient(135deg, #16324a 0%, var(--ocr-primary) 55%, var(--ocr-secondary) 100%) !important;
      color: #fff !important;
      font-weight: 600;
      font-size: 12.5px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      border: none !important;
      padding: 12px 10px !important;
      white-space: nowrap;
    }
    .ocr-table tbody tr { transition: background 0.15s ease; }
    .ocr-table tbody tr:nth-child(even) { background: rgba(40,120,183,0.045); }
    .ocr-table tbody tr:nth-child(odd) { background: #ffffff; }
    .ocr-table tbody tr:hover { background: rgba(27,155,115,0.09) !important; }
    .ocr-table tbody td {
      border-color: rgba(29,93,145,0.08) !important;
      vertical-align: middle;
      padding: 8px !important;
      font-size: 13.5px;
    }

    /* Bootstrap sm form control base sizing kept intact — only visuals layered on top */
    .form-control-sm.ocr-input, .form-select-sm.ocr-select { font-size: 13px; }

    @media (max-width: 576px) {
      .ocr-picker { flex-direction: column; align-items: stretch; }
      .ocr-card-header { flex-direction: column; align-items: flex-start; gap: 12px; }
    }
  `}</style>
);

function ImageCapture({ onImage }) {
  const [mode, setMode] = useState("upload");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      showAlert("Camera access denied", "error");
      setMode("upload");
    }
  };

  const stopCamera = () => streamRef.current?.getTracks().forEach((t) => t.stop());

  const capture = () => {
    const video = videoRef.current;
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      onImage(blob);
      stopCamera();
    }, "image/jpeg", 0.85);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) onImage(file);
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="text-center">
      <div className="ocr-toggle-group mb-3">
        <button
          className={`btn ocr-toggle-btn ${mode === "upload" ? "active" : ""}`}
          onClick={() => { stopCamera(); setMode("upload"); }}
        >
          📁 Upload Image
        </button>
        <button
          className={`btn ocr-toggle-btn ${mode === "camera" ? "active" : ""}`}
          onClick={startCamera}
        >
          📷 Use Camera
        </button>
      </div>

      {mode === "upload" && (
        <div className="mx-auto" style={{ maxWidth: "420px" }}>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="form-control ocr-file-input"
            onChange={handleFile}
          />
          {/* <small className="text-muted d-block mt-2">Accepts a scanned image or a PDF (single or multi-page)</small> */}
        </div>
      )}

      {mode === "camera" && (
        <div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: "100%", maxWidth: "400px", border: "2px solid #1d5d91", borderRadius: "16px", boxShadow: "0 12px 28px -12px rgba(23,63,97,0.35)" }}
          />
          <div className="mt-3">
            <button className="btn ocr-btn-submit text-white" onClick={capture}>Capture</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OCRScanEntry() {
  const [docType, setDocType] = useState(null); // "reel" | "production"
  const [inputMode, setInputMode] = useState("handwritten"); // "printed" | "handwritten" — printed path is currently disabled below
  const [ocrRunning, setOcrRunning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewIsPdf, setPreviewIsPdf] = useState(false);

  const [reelRows, setReelRows] = useState([]); // each: { id, ...reel fields, extra }
  const [productionRows, setProductionRows] = useState([]);

  const [prodForm, setProdForm] = useState({ productionDate: "", productionFromTime: "", productionToTime: "" });
  const [workOrderDetails, setWorkOrderDetails] = useState(null);
  const [activities, setActivities] = useState([]);
  const [machines, setMachines] = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [activityId, setActivityId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [machineStatus, setMachineStatus] = useState("");
  const [wastePercent, setWastePercent] = useState(0);

  const [loggedInUser, setLoggedInUser] = useState("");
  const [userLocations, setUserLocations] = useState([]);
  const [fetchingRows, setFetchingRows] = useState(new Set()); // row ids currently doing a WO lookup (reel + production share this)
  const [autoFetchedBalanceRows, setAutoFetchedBalanceRows] = useState(new Set()); // row ids whose Actual Net Weight was auto-filled from a previous reel's balance
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return;
    const decoded = jwtDecode(token);
    setLoggedInUser(decoded.name);
    axios.get(`${BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setUserLocations(res.data.locations || []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (docType !== "production") return;
    axios.get(`${BASE_URL}/api/master/activities`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setActivities(r.data || []));
    axios.get(`${BASE_URL}/api/master/machines`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setMachines(r.data || []));
    axios.get(`${BASE_URL}/api/master/machine-status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setMachineStatuses(r.data || []));
  }, [docType, token]);

  const fetchWorkOrder = async (efi) => {
    if (!efi) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/production/workorder/${efi}`, { headers: { Authorization: `Bearer ${token}` } });
      setWorkOrderDetails({ ...res.data, orderQty: res.data.qty });
    } catch {
      showAlert("Work Order not found", "error");
    }
  };

  // Same lookup as fetchWorkOrder, but merges the result straight onto one specific reel
  // row instead of shared state — so if several reels (possibly for different WO numbers)
  // get scanned before any of them are saved, an earlier row's job data never gets
  // clobbered by a later scan. Everything fetched here (customer, WO date, job description,
  // job size, UPS, and each material's code/description/group/mill/GSM/paper size) rides
  // along in the row object and goes out with the save payload, same as the Production flow.
  const attachJobDetailsToRow = async (efi, rowId) => {
    if (!efi) return;
    setFetchingRows((prev) => new Set(prev).add(rowId));
    try {
      const res = await axios.get(`${BASE_URL}/api/production/workorder/${efi}`, { headers: { Authorization: `Bearer ${token}` } });
      const wo = res.data;
      setReelRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                customerName: wo.customerName || "",
                woDate: wo.date || "",
                jobDescription: wo.jobDescription || "",
                jobSize: wo.jobSize || "",
                ups: wo.ups || "",
                materials: wo.materials || [],
                mill: r.mill || wo.materials?.[0]?.mill || "",
              }
            : r
        )
      );
    } catch {
      showAlert("Work Order not found — job details not attached", "error");
    } finally {
      setFetchingRows((prev) => { const next = new Set(prev); next.delete(rowId); return next; });
    }
  };

  // Same "carry forward the previous reel's leftover balance" behaviour as the Production
  // Dashboard page: looks up the last saved reel with this Reel No, and if found, uses its
  // balance as this row's Actual Net Weight (auto-filled + read-only, same as there).
  const attachBalanceToRow = async (reelNo, rowId) => {
    if (!reelNo) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/production/reel/${reelNo}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.balance === undefined || res.data?.balance === null) return;
      setReelRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const updated = { ...r, actualNetWeight: res.data.balance, grossWeight: 0, millNetWeight: 0, balance: "" };
          return { ...updated, ...computeReelWasteFields(updated) };
        })
      );
      setAutoFetchedBalanceRows((prev) => new Set(prev).add(rowId));
    } catch {
      console.log("No previous reel found");
    }
  };

  const attachWorkOrderToProductionRow = async (efi, rowId) => {
    if (!efi) return;
    setFetchingRows((prev) => new Set(prev).add(rowId));
    try {
      const { data: wo } = await axios.get(`${BASE_URL}/api/production/workorder/${efi}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProductionRows((prev) => prev.map((row) => row.id === rowId ? {
        ...row, woDate: wo.date || "", customerName: wo.customerName || "",
        jobDescription: wo.jobDescription || "", jobSize: wo.jobSize || "",
        productType: wo.productType || "", materials: wo.materials || [],
        ups: wo.ups || "", orderQty: wo.qty || wo.orderQty || "",
      } : row));
    } catch {
      showAlert("Work Order not found", "error");
    } finally {
      setFetchingRows((prev) => { const next = new Set(prev); next.delete(rowId); return next; });
    }
  };

  const addProductionRows = (rows) => {
    rows.forEach((rawRow, index) => {
      const rowId = Date.now() + index;
      const row = {
        id: rowId, activityId: "", machineId: "", machineStatus: "", productionDate: "",
        productionFromTime: "", productionToTime: "", shift: "", productionImpression: "",
        wasteImpression: "", productionUps: "", productionQty: "", wastageQty: "", remarks: "",
        ...rawRow,
      };
      if (row.productionDate) row.productionDate = normalizeDateValue(row.productionDate);
      if (row.productionFromTime) row.productionFromTime = normalizeTimeValue(row.productionFromTime);
      if (row.productionToTime) row.productionToTime = normalizeTimeValue(row.productionToTime);
      if (row.shift) row.shift = resolveDropdownValue(row.shift, ["Day", "Night"]);
      if (row.machineStatus) row.machineStatus = resolveDropdownValue(row.machineStatus, machineStatuses.map((s) => s.statusName));
      if (row.activity) row.activityId = resolveActivityId(row.activity, activities);
      if (row.machine) {
        const matchedActivity = activities.find((a) => a._id === row.activityId);
        row.machineId = resolveMachineId(row.machine, machines, matchedActivity);
      }
      const ups = Number(row.productionUps);
      const prodImp = Number(row.productionImpression);
      const wasteImp = Number(row.wasteImpression);
      row.productionQty = ups > 0 && prodImp > 0 ? ups * prodImp : "";
      row.wastageQty = ups > 0 && wasteImp > 0 ? ups * wasteImp : "";
      setProductionRows((prev) => [...prev, row]);
      if (row.efiWoNumber) attachWorkOrderToProductionRow(row.efiWoNumber, rowId);
    });
  };

  // ---- Printed / spreadsheet screenshot path: local Tesseract OCR (unchanged) ----
  const runPrintedOcr = async (image) => {
    const processed = await preprocessImage(image);
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(processed, {}, { blocks: true });
    await worker.terminate();

    const lines = buildLines(data);
    console.log("OCR raw text:\n", data.text);
    console.log("OCR lines:", lines.map(l => l.words.map(w => `${w.text}[x:${Math.round(w.bbox.x0)}-${Math.round(w.bbox.x1)}]`)));

    if (docType === "reel") {
      const excelRow = extractExcelRow(lines);
      const fields = excelRow ? excelRow.fields : parseReelFields(lines);
      const extra = excelRow ? excelRow.extra : "";
      if (fields.productionType) {
        fields.productionType =
          resolveDropdownValue(fields.productionType, ["Make Ready", "Production"]) ||
          fields.productionType;
      }
      const rowId = Date.now();
      setReelRows((prev) => [
        ...prev,
        { id: rowId, productionType: "Production", reelWoNumber: "", ...fields, ...computeReelWasteFields(fields), extra },
      ]);
      if (fields.efiWoNumber) attachJobDetailsToRow(fields.efiWoNumber, rowId);
      if (fields.reelNo) attachBalanceToRow(fields.reelNo, rowId);
    } else {
      addProductionRows([parseProductionFields(lines)]);
    }
  };

  // ---- Handwritten path: send the raw scan (image OR pdf — a scanner may produce either,
  // and a scanned ledger page may hold many rows under one header) to the backend, which
  // asks a vision LLM to read the handwriting and return the known field names directly as
  // JSON, once per row. No bounding-box/column-matching needed here — that's the whole
  // point of this path. Every row it finds becomes its own editable table entry, same as a
  // manually-added row, so nothing downstream (attachJobDetailsToRow, save, etc.) changes. ----
  const runHandwritingOcr = async (file) => {
    const fieldList = docType === "reel" ? REEL_HANDWRITING_FIELDS : PRODUCTION_HANDWRITING_FIELDS;
    const isPdf = file.type === "application/pdf";
    const uploadFile = isPdf ? file : await downscaleForUpload(file);

    const formData = new FormData();
    formData.append("image", uploadFile, isPdf ? "scan.pdf" : "scan.jpg");
    formData.append("docType", docType);
    formData.append("fields", JSON.stringify(fieldList));

    const { data } = await axios.post(`${BASE_URL}/api/ocr/handwriting`, formData, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
    });

    // Backend always returns { rows: [...], extra }, one entry per handwritten row found
    // (across every page if a multi-page PDF was uploaded).
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    if (rows.length === 0) {
      showAlert("No rows could be read from this scan — fill in manually", "warning");
      return;
    }

    if (docType === "reel") {
      let lastWoNumber = "";
      rows.forEach((rawFields, i) => {
        const fields = { ...rawFields };
        if (!fields.efiWoNumber && lastWoNumber) fields.efiWoNumber = lastWoNumber;
        if (fields.efiWoNumber) lastWoNumber = fields.efiWoNumber;
        if (fields.productionDate) fields.productionDate = normalizeDateValue(fields.productionDate);
        if (fields.productionType) {
          fields.productionType =
            resolveDropdownValue(fields.productionType, ["Make Ready", "Production"]) ||
            fields.productionType;
        }
        const rowId = Date.now() + i; // offset so rows added in the same tick get distinct ids
        setReelRows((prev) => [
          ...prev,
          { id: rowId, productionType: "Production", reelWoNumber: "", ...fields, ...computeReelWasteFields(fields), extra: data?.extra || "" },
        ]);
        if (fields.efiWoNumber) attachJobDetailsToRow(fields.efiWoNumber, rowId);
        if (fields.reelNo) attachBalanceToRow(fields.reelNo, rowId);
      });
      showAlert(`Scan complete — ${rows.length} row${rows.length > 1 ? "s" : ""} added, review below`, "success");
    } else {
      // The production form only holds one entry at a time — if a multi-row scan came
      // through, take the first row and let the person re-scan/re-select for the rest.
      addProductionRows(rows);
      showAlert("Scan complete — review the fields below", "success");
    }
  };

  const runOcr = async (file) => {
    // Starting a new scan (a fresh file/photo chosen) replaces whatever was already on
    // screen from a previous scan, rather than appending on top of it.
    setReelRows([]);
    setProductionRows([]);
    setWorkOrderDetails(null);
    setFetchingRows(new Set());
    setAutoFetchedBalanceRows(new Set());

    setOcrRunning(true);
    const isPdf = file.type === "application/pdf";
    setPreviewIsPdf(isPdf);
    setPreviewUrl(isPdf ? null : URL.createObjectURL(file));
    try {
      if (inputMode === "handwritten") {
        await runHandwritingOcr(file);
      } else {
        if (isPdf) {
          showAlert("PDF upload is only supported in Handwritten mode", "warning");
          return;
        }
        await runPrintedOcr(file);
        showAlert("Scan complete — review the fields below", "success");
      }
    } catch (err) {
      console.error(err);
      showAlert("OCR failed, fill the form manually", "error");
    } finally {
      setOcrRunning(false);
    }
  };

  const handleReelRowChange = (id, name, value) => {
    if (name === "reelNo" || name === "actualNetWeight") {
      setAutoFetchedBalanceRows((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    setReelRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [name]: value };
      // Keep Total Waste / Waste % in sync any time a field that feeds the formula changes
      return { ...updated, ...computeReelWasteFields(updated) };
    }));
  };

  const handleProductionRowChange = (id, name, value) => {
    setProductionRows((prev) => prev.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row, [name]: value };
      const ups = Number(updated.productionUps);
      const productionImpression = Number(updated.productionImpression);
      const wasteImpression = Number(updated.wasteImpression);
      updated.productionQty = ups > 0 && productionImpression > 0 ? ups * productionImpression : "";
      updated.wastageQty = ups > 0 && wasteImpression > 0 ? ups * wasteImpression : "";
      if (name === "activityId") updated.machineId = "";
      return updated;
    }));
  };

  const formatMaterials = (materials = []) => {
  if (!Array.isArray(materials) || materials.length === 0) return "-";

  return materials
    .map((m) =>
      [
        m.materialCode || m.code,
        m.materialDescription || m.description || m.materialName,
        m.materialGroup || m.group,
        m.mill,
        m.gsm,
        m.paperSize,
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .filter(Boolean)
    .join("; ") || "-";
};

  const handleProdChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...prodForm, [name]: value };
    const ups = Number(updated.productionUps);
    const prodImp = Number(updated.productionImpression);
    const wasteImp = Number(updated.wasteImpression);
    updated.productionQty = ups > 0 && prodImp > 0 ? prodImp * ups : "";
    updated.wastageQty = ups > 0 && wasteImp > 0 ? wasteImp * ups : "";
    setProdForm(updated);
    setWastePercent(updated.productionQty ? ((updated.wastageQty / updated.productionQty) * 100).toFixed(2) : 0);
  };

  // Reel numeric fields go through OCR or manual typing, so they can arrive empty, blank,
  // or containing stray characters — the backend schema casts them to Number and throws if
  // it gets anything it can't parse. Sanitize here the same way submitProduction already does.
  const REEL_NUMERIC_FIELDS = [
    "grossWeight", "millNetWeight", "actualNetWeight", "actualGsm",
    "productionOutput", "mattWaste", "printWaste", "realEndWaste",
"coreWeight", "totalWaste", "wastePercent", "balance",
  ];

  // Fields that must be non-empty before a reel row can be saved.
  const REEL_REQUIRED_FIELDS = [
    ["productionDate", "Production Date"],
    ["reelNo", "Reel No"],
    ["actualNetWeight", "Actual Net Weight"],
    ["actualGsm", "Actual GSM"],
    ["productionOutput", "Production Output"],
    ["balance", "Reel Balance"],
    ["mattWaste", "Reel Matt Waste"],
    ["printWaste", "Reel Print Waste"],
    ["realEndWaste", "Reel End Waste"],
    ["coreWeight", "Reel Core Waste"],
    ["mill", "Mill Name"],
    ["productionType", "Production Type"],
  ];

  // Reel No may contain letters, numbers, hyphens, and slashes only.
  const REEL_NO_PATTERN = /^[A-Za-z0-9\-\/\\]+$/;

  const ALLOWED_NUMERIC_CONTROL_KEYS = [
    "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "Tab", "Home", "End",
  ];

  const blockInvalidNumberKeys = (e) => {
    if (ALLOWED_NUMERIC_CONTROL_KEYS.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return; // allow copy/paste/select-all shortcuts
    // Only a single digit, or a single "." if the field doesn't already have one
    const isDigit = /^[0-9]$/.test(e.key);
    const isFirstDecimal = e.key === "." && !e.target.value.includes(".");
    if (!isDigit && !isFirstDecimal) e.preventDefault();
  };

  const validateReelRow = (row) => {
    const errors = [];

    REEL_REQUIRED_FIELDS.forEach(([field, label]) => {
      const value = row[field];
      if (value === undefined || value === null || String(value).trim() === "") {
        errors.push(`${label} is required`);
      }
    });

    if (row.reelNo && !REEL_NO_PATTERN.test(String(row.reelNo).trim())) {
      errors.push("Reel No allows only letters, numbers, -, /, \\");
    }

    let hasNegative = false;
    let hasInvalidChars = false;
    REEL_NUMERIC_FIELDS.forEach((f) => {
      if (row[f] === undefined || row[f] === "") return;
      const raw = String(row[f]).trim();
      if (!/^[0-9]+(\.[0-9]+)?$/.test(raw)) hasInvalidChars = true;
      const n = Number(raw);
      if (Number.isFinite(n) && n < 0) hasNegative = true;
    });
    if (hasInvalidChars) errors.push("Only numbers are allowed, no special characters");
    if (hasNegative) errors.push("Negative values are not allowed");

    const gross = Number(row.grossWeight);
    const actualNet = Number(row.actualNetWeight);
    const balance = Number(row.balance);

    if (row.actualNetWeight !== undefined && row.actualNetWeight !== "" && actualNet === 0) {
      errors.push("Actual Net Weight cannot be 0");
    }

    if (
      !autoFetchedBalanceRows.has(row.id) &&
      row.grossWeight !== undefined && row.grossWeight !== "" &&
      row.actualNetWeight !== undefined && row.actualNetWeight !== "" &&
      Number.isFinite(gross) && Number.isFinite(actualNet) &&
      actualNet > gross
    ) {
      errors.push("Actual Net Weight cannot be greater than Gross Weight");
    }

    if (
      row.balance !== undefined && row.balance !== "" &&
      row.actualNetWeight !== undefined && row.actualNetWeight !== "" &&
      Number.isFinite(balance) && Number.isFinite(actualNet) &&
      balance > actualNet
    ) {
      errors.push("Reel Balance cannot be greater than Actual Net Weight");
    }

    return errors;
  };

  // ---------------------------------------------------------------------------------------
  // Production row validation
  //
  // Mirrors the reel validation above, but for the Production table. Rules implemented:
  // - Production Date / Activity / Machine / From Time / To Time / Shift / Machine Status
  //   are always required.
  // - Production Impression / Waste Impression / Production UPS are required only when
  //   Machine Status = "Production" (and are disabled in the table otherwise — see the
  //   input rendering below).
  // - Production Qty / Wastage Qty / Waste % stay auto-calculated (handleProductionRowChange
  //   already does this) — this just enforces that Qty can't be 0 when status = Production.
  // - No -, +, or e/E in numeric fields (enforced live via blockInvalidNumberKeys on the
  //   inputs, and re-checked here in case a value was pasted in).
  // - No special characters in Remarks (stripped live via sanitizeRemarks on the input,
  //   and re-checked here) — and Remarks becomes mandatory once Wastage Qty > Production Qty.
  // - From/To Time duration (handling an overnight shift that crosses midnight) is checked
  //   against previously-saved entries for the same machine + date so the combined total
  //   never exceeds 24 hours.
  // ---------------------------------------------------------------------------------------

  const isProductionStatus = (status) => (status || "").trim().toLowerCase() === "production";

  // Letters, numbers, spaces, and a few basic punctuation marks only.
  const REMARKS_SAFE_PATTERN = /^[A-Za-z0-9\s.,\-\/]*$/;
  const sanitizeRemarks = (value) => value.replace(/[^A-Za-z0-9\s.,\-\/]/g, "");

  const PRODUCTION_NUMERIC_FIELDS = ["productionImpression", "wasteImpression", "productionUps"];

  const timeToMinutes = (t) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t || "");
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };

  // Duration in hours between From/To time, treating To <= From as running past midnight
  // into the next day (a normal overnight/night shift) rather than a negative/zero span.
  const computeEntryHours = (fromTime, toTime) => {
    const fromMin = timeToMinutes(fromTime);
    const toMin = timeToMinutes(toTime);
    if (fromMin == null || toMin == null) return null;
    let diff = toMin - fromMin;
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
  };

  // Sums the hours of every already-saved entry for the same machine + date, so the new
  // entry can be checked against the combined 24-hour ceiling.
  //
  // NOTE: this assumes a backend endpoint — e.g.
  //   GET /api/production-real/machine-hours?machine=<id>&date=<YYYY-MM-DD>
  //   -> { entries: [{ productionFromTime, productionToTime }, ...] }
  // If that endpoint doesn't exist yet, this fails soft (logs a warning, returns 0) so the
  // rest of the validation still works — add the endpoint to make this check fully live.
  const fetchExistingMachineHours = async (mId, date) => {
    try {
      const { data } = await axios.get(`${BASE_URL}/api/production-real/machine-hours`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { machine: mId, date },
      });
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      return entries.reduce(
        (sum, en) => sum + (computeEntryHours(en.productionFromTime, en.productionToTime) || 0),
        0
      );
    } catch (err) {
      console.warn("Could not fetch existing machine hours — skipping the 24h/day check against saved entries", err);
      return 0;
    }
  };

  const validateProductionRow = (row) => {
    const errors = [];
    const isProd = isProductionStatus(row.machineStatus);

    const requiredAlways = [
      ["productionDate", "Production Date"],
      ["activityId", "Activity"],
      ["machineId", "Machine"],
      ["productionFromTime", "From Time"],
      ["productionToTime", "To Time"],
      ["shift", "Shift"],
      ["machineStatus", "Machine Status"],
    ];
    requiredAlways.forEach(([field, label]) => {
      const value = row[field];
      if (value === undefined || value === null || String(value).trim() === "") {
        errors.push(`${label} is required`);
      }
    });

    if (isProd) {
      [
        ["productionImpression", "Production Impression"],
        ["wasteImpression", "Waste Impression"],
        ["productionUps", "Production UPS"],
      ].forEach(([field, label]) => {
        const value = row[field];
        if (value === undefined || value === null || String(value).trim() === "") {
          errors.push(`${label} is required when Machine Status is Production`);
        }
      });
    }

    PRODUCTION_NUMERIC_FIELDS.forEach((f) => {
      const raw = row[f];
      if (raw === undefined || raw === null || String(raw).trim() === "") return;
      if (!/^[0-9]+(\.[0-9]+)?$/.test(String(raw).trim())) {
        errors.push("Only positive numbers are allowed (no -, +, e/E) in numeric fields");
      }
    });

    if (row.remarks && !REMARKS_SAFE_PATTERN.test(row.remarks)) {
      errors.push("Special characters are not allowed in Remarks");
    }

    if (isProd) {
      const qty = Number(row.productionQty) || 0;
      const wastage = Number(row.wastageQty) || 0;
      if (qty === 0) errors.push("Production Quantity cannot be 0 when Machine Status is Production");
      if (wastage > qty && !String(row.remarks || "").trim()) {
        errors.push("Remarks are required when Wastage Quantity exceeds Production Quantity");
      }
    }

    let entryHours = null;
    if (row.productionFromTime && row.productionToTime) {
      entryHours = computeEntryHours(row.productionFromTime, row.productionToTime);
      if (entryHours == null) errors.push("From Time / To Time must be valid");
    }

    return { errors, entryHours };
  };

  const submitReelRow = async (row) => {
    const errors = validateReelRow(row);
    if (errors.length > 0) {
      showAlert(errors[0], "error");
      return;
    }
    try {
      const { id, extra, ...rest } = row;
      const payload = { ...rest };
      if (!["Make Ready", "Production"].includes(payload.productionType)) {
        payload.productionType = "Production";
      }
      REEL_NUMERIC_FIELDS.forEach((f) => {
        const n = Number(payload[f]);
        payload[f] = Number.isFinite(n) ? n : 0;
      });
      await axios.post(
        `${BASE_URL}/api/production`,
        { ...payload, productionType: payload.productionType || "Production", productionUser: loggedInUser },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showAlert("Reel Register saved ✅", "success");
      setReelRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      showAlert(err.response?.data?.message || "Save failed", "error");
    }
  };

  const submitProduction = async (e) => {
    e.preventDefault();
    if (!workOrderDetails) return showAlert("Fetch Work Order first (enter EFI WO No and re-scan or type it manually)", "warning");
    if (!activityId || !machineId) return showAlert("Select activity & machine", "warning");

    try {
      const payload = {
        workOrder: Number(prodForm.efiWoNumber),
        currentStage: activities.find((a) => a._id === activityId)?.activityName,
        machine: machineId,
        productionDate: prodForm.productionDate,
        productionFromTime: prodForm.productionFromTime,
        productionToTime: prodForm.productionToTime,
        shift: prodForm.shift,
        productType: workOrderDetails.productType || "",
        machineStatus,
        productionQty: Number(prodForm.productionQty) || 0,
        wastageQty: Number(prodForm.wastageQty) || 0,
        wastePercent: Number(wastePercent) || 0,
        remarks: prodForm.remarks,
        customerName: workOrderDetails.customerName,
        jobDescription: workOrderDetails.jobDescription,
        jobSize: workOrderDetails.jobSize,
        materials: workOrderDetails.materials || [],
        ups: workOrderDetails.ups,
        productionImpression: Number(prodForm.productionImpression) || 0,
        wasteImpression: Number(prodForm.wasteImpression) || 0,
        productionUps: Number(prodForm.productionUps) || 0,
        orderQty: workOrderDetails.orderQty,
        machiness: [{ activityId, machineId }],
        enteredBy: loggedInUser,
        locations: userLocations,
      };

      await axios.post(`${BASE_URL}/api/production-real`, payload, { headers: { Authorization: `Bearer ${token}` } });
      showAlert("Production entry saved ✅", "success");
      setProdForm({ productionDate: "", productionFromTime: "", productionToTime: "" });
      setWorkOrderDetails(null);
      setActivityId("");
      setMachineId("");
      setMachineStatus("");
      setPreviewUrl(null);
    } catch (err) {
      showAlert(err.response?.data?.message || "Save failed", "error");
    }
  };

  const submitProductionRow = async (row) => {
    if (!row.efiWoNumber) return showAlert("WO Number is required", "warning");

    const { errors, entryHours } = validateProductionRow(row);
    if (errors.length > 0) {
      showAlert(errors[0], "error");
      return;
    }

    if (entryHours != null) {
      const existingHours = await fetchExistingMachineHours(row.machineId, row.productionDate);
      if (existingHours + entryHours > 24) {
        showAlert("Total machine running hours for this machine on this date cannot exceed 24 hours", "error");
        return;
      }
    }

    try {
      const isProduction = row.machineStatus?.toLowerCase() === "production";
      const productionQty = isProduction ? Number(row.productionQty) || 0 : 0;
      const wastageQty = isProduction ? Number(row.wastageQty) || 0 : 0;
      const payload = {
        workOrder: Number(row.efiWoNumber),
        currentStage: activities.find((a) => a._id === row.activityId)?.activityName || "",
        machine: row.machineId,
        productionDate: row.productionDate,
        productionFromTime: row.productionFromTime,
        productionToTime: row.productionToTime,
        shift: row.shift,
        productType: row.productType || "",
        machineStatus: row.machineStatus,
        productionQty,
        wastageQty,
        wastePercent: productionQty > 0 ? Number(((wastageQty / productionQty) * 100).toFixed(2)) : 0,
        remarks: row.remarks || "",
        customerName: row.customerName || "",
        jobDescription: row.jobDescription || "",
        jobSize: row.jobSize || "",
        materials: row.materials || [],
        ups: row.ups || "",
        productionImpression: Number(row.productionImpression) || 0,
        wasteImpression: Number(row.wasteImpression) || 0,
        productionUps: Number(row.productionUps) || 0,
        orderQty: row.orderQty || "",
        machiness: [{ activityId: row.activityId, machineId: row.machineId }],
        enteredBy: loggedInUser,
        locations: userLocations,
      };
      await axios.post(`${BASE_URL}/api/production-real`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setProductionRows((prev) => prev.filter((item) => item.id !== row.id));
      showAlert("Production entry saved", "success");
    } catch (err) {
      showAlert(err.response?.data?.message || "Save failed", "error");
    }
  };

  return (
    <div className="ocr-shell">
      <OcrTheme />
      <div className="ocr-inner">
        <div className="ocr-header">
          <span className="ocr-badge"><span className="dot" />AI Document Capture </span>
          <h2 className="ocr-title">OCR Scan Entry</h2>
          <p className="ocr-subtitle">Scan reel registers and production sheets — and review the extracted data before saving.</p>
        </div>

        {!docType && (
          <div className="ocr-picker">
            <button
              className="ocr-picker-btn reel"
              onClick={() => setDocType("reel")}
            >
              📋 Reel Register
            </button>
            <button
              className="ocr-picker-btn production"
              onClick={() => setDocType("production")}
            >
              🏭 Production
            </button>
          </div>
        )}

        {docType && (
          <div className="ocr-card mt-3">
            <div className="ocr-card-header">
              <h5>
                {docType === "reel" ? "Reel Register Scan" : "Production Scan"}
              </h5>
              <button
                className="btn ocr-ghost-btn"
                onClick={() => { setDocType(null); setPreviewUrl(null); setWorkOrderDetails(null); setReelRows([]); setProductionRows([]); }}
              >
                Change Type
              </button>
            </div>

            <div className="ocr-card-body">
            <ImageCapture onImage={runOcr} />

            {previewIsPdf && (
              <p className="mt-3 text-center" style={{ color: "#495057" }}>📄 PDF selected — pages will be scanned for handwritten rows</p>
            )}
            {!previewIsPdf && previewUrl && (
              <div className="text-center">
                <img
                  src={previewUrl}
                  alt="scanned"
                  className="ocr-preview-img"
                  style={{ maxWidth: "250px", marginTop: "14px" }}
                />
              </div>
            )}
            {ocrRunning && (
              <p className="text-center mt-3 ocr-scanning">Scanning document…</p>
            )}

            {!ocrRunning && docType === "reel" && reelRows.length > 0 && (
              <div className="table-responsive mt-4 ocr-table-wrap" style={{ maxHeight: "520px", overflowY: "auto" }}>
                <table
                  className="table table-bordered table-sm align-middle mb-0 ocr-table"
                  style={{ borderCollapse: "separate", borderSpacing: "6px 4px" }}
                >
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th>WO No</th>
<th>WO Date</th>
<th>Customer Name</th>
<th>Job Description</th>
<th>Job Size</th>
<th>UPS</th>
<th>Materials</th>
                      <th>Prod Date</th>
                      <th>Reel No</th>
                      <th>Gross</th>
                      <th>Mill Net</th>
                      <th>Actual Net</th>
                      <th>Actual GSM</th>
                      <th>Output</th>
                      <th>Matt</th>
                      <th>Print</th>
                      <th>End</th>
                      <th>Core</th>
                      <th>Total Waste</th>
<th>Waste %</th>
                      <th>Balance</th>
                      <th>Mill</th>
                      <th>Type</th>
                      <th>Remarks</th>
                      {/* <th>Other Scanned Data</th> */}
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reelRows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ minWidth: "100px" }}>
    <input
      type="text"
      value={row.efiWoNumber || ""}
      onChange={(e) => handleReelRowChange(row.id, "efiWoNumber", e.target.value)}
      onBlur={(e) => {
        if (e.target.value) attachJobDetailsToRow(e.target.value, row.id);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
      className="form-control form-control-sm ocr-input"
    />
    {fetchingRows.has(row.id) && (
      <div style={{ fontSize: "11px", color: "var(--ocr-primary)" }}>Fetching…</div>
    )}
  </td>

<td>{row.woDate || "-"}</td>
<td>{row.customerName || "-"}</td>
<td style={{ minWidth: "180px" }}>{row.jobDescription || "-"}</td>
<td>{row.jobSize || "-"}</td>
<td>{row.ups && row.ups !== "" ? ` ${row.ups}` : ""}</td>
<td style={{ minWidth: "260px", fontSize: "12px" }}>
  {formatMaterials(row.materials)}
</td>

{[["productionDate", "date"]].map(([name, type]) => (
  <td key={name} style={{ minWidth: "100px" }}>
    <input
      type={type}
      value={row[name] || ""}
      onChange={(e) => handleReelRowChange(row.id, name, e.target.value)}
      className="form-control form-control-sm ocr-input"
    />
  </td>
))}

<td style={{ minWidth: "100px" }}>
  <input
    type="text"
    value={row.reelNo || ""}
    onChange={(e) => handleReelRowChange(row.id, "reelNo", e.target.value)}
    onBlur={(e) => { if (e.target.value) attachBalanceToRow(e.target.value, row.id); }}
    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
    className="form-control form-control-sm ocr-input"
  />
</td>

{[["grossWeight", "text"], ["millNetWeight", "text"]].map(([name, type]) => (
  <td key={name} style={{ minWidth: "100px" }}>
    <input
      type={type}
      value={row[name] || ""}
      onChange={(e) => handleReelRowChange(row.id, name, e.target.value)}
      onKeyDown={blockInvalidNumberKeys}
      readOnly={autoFetchedBalanceRows.has(row.id)}
      className="form-control form-control-sm ocr-input"
      style={autoFetchedBalanceRows.has(row.id) ? { background: "#f1f5f9" } : undefined}
    />
  </td>
))}

<td style={{ minWidth: "100px" }}>
  <input
    type="text"
    value={row.actualNetWeight || ""}
    onChange={(e) => handleReelRowChange(row.id, "actualNetWeight", e.target.value)}
    onKeyDown={blockInvalidNumberKeys}
    readOnly={autoFetchedBalanceRows.has(row.id)}
    className="form-control form-control-sm ocr-input"
    style={autoFetchedBalanceRows.has(row.id) ? { background: "#f1f5f9" } : undefined}
  />
</td>

{[
  ["actualGsm", "text"],
  ["productionOutput", "text"],
  ["mattWaste", "text"],
  ["printWaste", "text"],
  ["realEndWaste", "text"],
  ["coreWeight", "text"],
].map(([name, type]) => (
  <td key={name} style={{ minWidth: "100px" }}>
    <input
      type={type}
      value={row[name] || ""}
      onChange={(e) => handleReelRowChange(row.id, name, e.target.value)}
      onKeyDown={blockInvalidNumberKeys}
      className="form-control form-control-sm ocr-input"
    />
  </td>
))}
                        {/* Total Waste / Waste % are auto-calculated (Matt+Print+End+Core, and
                            TotalWaste / (Actual Net - Balance) * 100) — same formula as the
                            Production Dashboard page — so they're shown read-only here. */}
                        <td style={{ minWidth: "100px" }}>
                          <input
                            type="text"
                            value={row.totalWaste ?? ""}
                            readOnly
                            className="form-control form-control-sm ocr-input"
                            style={{ background: "#f1f5f9" }}
                          />
                        </td>
                        <td style={{ minWidth: "100px" }}>
                          <input
                            type="text"
                            value={row.wastePercent !== undefined && row.wastePercent !== "" ? `${row.wastePercent}%` : ""}
                            readOnly
                            className="form-control form-control-sm ocr-input"
                            style={{ background: "#f1f5f9" }}
                          />
                        </td>
                        <td style={{ minWidth: "100px" }}>
                          <input
                            type="text"
                            value={row.balance || ""}
                            onChange={(e) => handleReelRowChange(row.id, "balance", e.target.value)}
                            onKeyDown={blockInvalidNumberKeys}
                            className="form-control form-control-sm ocr-input"
                          />
                        </td>
                        <td style={{ minWidth: "100px" }}>
                          <input
                            type="text"
                            value={row.mill || ""}
                            onChange={(e) => handleReelRowChange(row.id, "mill", e.target.value)}
                            className="form-control form-control-sm ocr-input"
                          />
                        </td>
                        <td style={{ minWidth: "110px" }}>
                          <select
                            value={row.productionType || ""}
                            onChange={(e) => handleReelRowChange(row.id, "productionType", e.target.value)}
                            className="form-select form-select-sm ocr-select"
                          >
                            <option value="">Select</option>
                            <option value="Make Ready">Make Ready</option>
                            <option value="Production">Production</option>
                          </select>
                        </td>
                        <td style={{ minWidth: "120px" }}>
                          <input
                            type="text"
                            value={row.remarks || ""}
                            onChange={(e) => handleReelRowChange(row.id, "remarks", e.target.value)}
                            className="form-control form-control-sm ocr-input"
                          />
                        </td>
                        {/* <td style={{ minWidth: "160px", fontSize: "12px" }} className="text-muted">
                          {row.extra || "-"}
                        </td> */}
                        <td>
                          <button type="button" className="btn btn-sm ocr-btn-save text-white" onClick={() => submitReelRow(row)}>
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!ocrRunning && docType === "production" && productionRows.length > 0 && (
              <div className="table-responsive mt-4 ocr-table-wrap" style={{ maxHeight: "520px", overflowY: "auto" }}>
                <table
                  className="table table-bordered table-sm align-middle mb-0 ocr-table"
                  style={{ borderCollapse: "separate", borderSpacing: "6px 4px" }}
                >
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th>WO No</th><th>Customer</th><th>Job</th><th>Materials</th><th>Order Qty</th><th>Date*</th><th>From*</th><th>To*</th><th>Shift*</th>
                      <th>Activity*</th><th>Machine*</th><th>Status*</th><th>Prod. Imp.</th><th>Waste Imp.</th>
                      <th>UPS</th><th>Production Qty</th><th>Wastage Qty</th><th>Waste %</th><th>Remarks</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionRows.map((row) => {
                      const waste = Number(row.productionQty) > 0
                        ? ((Number(row.wastageQty) / Number(row.productionQty)) * 100).toFixed(2)
                        : "0.00";
                      return <tr key={row.id}>
                        <td style={{ minWidth: "110px" }}>
                          <input
                            type="text"
                            value={row.efiWoNumber || ""}
                            onChange={(e) => handleProductionRowChange(row.id, "efiWoNumber", e.target.value)}
                            onBlur={(e) => attachWorkOrderToProductionRow(e.target.value, row.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                            className="form-control form-control-sm ocr-input"
                          />
                          {fetchingRows.has(row.id) && (
                            <div style={{ fontSize: "11px", color: "var(--ocr-primary)" }}>Fetching…</div>
                          )}
                        </td>
                        <td style={{ minWidth: "130px" }}>{row.customerName || "-"}</td>
                        <td style={{ minWidth: "150px" }}>{row.jobDescription || "-"}</td>
                        <td style={{ minWidth: "260px", fontSize: "12px" }}>{formatMaterials(row.materials)}</td>
                        <td style={{ minWidth: "100px" }}>{row.orderQty || "-"}</td>
                        {[['productionDate', 'date'], ['productionFromTime', 'time'], ['productionToTime', 'time']].map(([name, type]) => <td key={name} style={{ minWidth: "140px" }}><input type={type} value={row[name] || ""} onChange={(e) => handleProductionRowChange(row.id, name, e.target.value)} className="form-control form-control-sm ocr-input" /></td>)}
                        <td style={{ minWidth: "110px" }}><select value={row.shift || ""} onChange={(e) => handleProductionRowChange(row.id, "shift", e.target.value)} className="form-select form-select-sm ocr-select"><option value="">Select</option><option value="Day">Day</option><option value="Night">Night</option></select></td>
                        <td style={{ minWidth: "140px" }}><select value={row.activityId || ""} onChange={(e) => handleProductionRowChange(row.id, "activityId", e.target.value)} className="form-select form-select-sm ocr-select"><option value="">Select</option>{activities.map((a) => <option key={a._id} value={a._id}>{a.activityName}</option>)}</select></td>
                        <td style={{ minWidth: "140px" }}><select value={row.machineId || ""} onChange={(e) => handleProductionRowChange(row.id, "machineId", e.target.value)} className="form-select form-select-sm ocr-select" disabled={!row.activityId}><option value="">Select</option>{machines.filter((m) => activities.find((a) => a._id === row.activityId)?.machines?.map(String).includes(String(m._id))).map((m) => <option key={m._id} value={m._id}>{m.machineName}</option>)}</select></td>
                        <td style={{ minWidth: "130px" }}><select value={row.machineStatus || ""} onChange={(e) => handleProductionRowChange(row.id, "machineStatus", e.target.value)} className="form-select form-select-sm ocr-select"><option value="">Select</option>{machineStatuses.map((s) => <option key={s._id} value={s.statusName}>{s.statusName}</option>)}</select></td>
                        {['productionImpression', 'wasteImpression', 'productionUps'].map((name) => (
                          <td key={name} style={{ minWidth: "110px" }}>
                            <input
                              type="text"
                              value={row[name] || ""}
                              onChange={(e) => handleProductionRowChange(row.id, name, e.target.value)}
                              onKeyDown={blockInvalidNumberKeys}
                              disabled={!isProductionStatus(row.machineStatus)}
                              className="form-control form-control-sm ocr-input"
                            />
                          </td>
                        ))}
                        <td style={{ minWidth: "110px" }}>{row.productionQty || 0}</td><td style={{ minWidth: "110px" }}>{row.wastageQty || 0}</td><td style={{ minWidth: "90px" }}>{waste}%</td>
                        <td style={{ minWidth: "130px" }}>
                          <input
                            type="text"
                            value={row.remarks || ""}
                            onChange={(e) => handleProductionRowChange(row.id, "remarks", sanitizeRemarks(e.target.value))}
                            className="form-control form-control-sm ocr-input"
                          />
                        </td>
                        <td style={{ minWidth: "90px" }}><button type="button" className="btn btn-sm ocr-btn-save text-white" onClick={() => submitProductionRow(row)}>Save</button></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {false && !ocrRunning && docType === "production" && (
              <form onSubmit={submitProduction}>
                {workOrderDetails && (
                  <p className="mt-3 mb-1"><small>{workOrderDetails.customerName} — {workOrderDetails.jobDescription}</small></p>
                )}
                <table className="table table-bordered mt-2">
                  <thead className="table-dark">
                    <tr><th>Field</th><th>Scanned Value (edit if needed)</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="fw-semibold">EFI WO Number</td>
                      <td>
                        <input type="text" name="efiWoNumber" value={prodForm.efiWoNumber || ""} onChange={handleProdChange} className="form-control form-control-sm" />
                      </td>
                    </tr>
                    {[
                      ["productionDate", "Production Date", "date"],
                      ["productionFromTime", "From Time", "time"],
                      ["productionToTime", "To Time", "time"],
                    ].map(([name, label, type]) => (
                      <tr key={name}>
                        <td className="fw-semibold">{label}</td>
                        <td>
                          <input type={type} name={name} value={prodForm[name] || ""} onChange={handleProdChange} className="form-control form-control-sm" />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="fw-semibold">Shift</td>
                      <td>
                        <select name="shift" value={prodForm.shift || ""} onChange={handleProdChange} className="form-select form-select-sm">
                          <option value="">Select</option>
                          <option value="Day">Day</option>
                          <option value="Night">Night</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td className="fw-semibold">Activity <small className="text-muted">(not on paper — select)</small></td>
                      <td>
                        <select value={activityId} onChange={(e) => { setActivityId(e.target.value); setMachineId(""); }} className="form-select form-select-sm">
                          <option value="">Select Activity</option>
                          {activities.map((a) => <option key={a._id} value={a._id}>{a.activityName}</option>)}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td className="fw-semibold">Machine <small className="text-muted">(not on paper — select)</small></td>
                      <td>
                        <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="form-select form-select-sm" disabled={!activityId}>
                          <option value="">Select Machine</option>
                          {machines
                            .filter((m) => activities.find((a) => a._id === activityId)?.machines?.map(String).includes(String(m._id)))
                            .map((m) => <option key={m._id} value={m._id}>{m.machineName}</option>)}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td className="fw-semibold">Machine Status <small className="text-muted">(not on paper — select)</small></td>
                      <td>
                        <select value={machineStatus} onChange={(e) => setMachineStatus(e.target.value)} className="form-select form-select-sm">
                          <option value="">Select Status</option>
                          {machineStatuses.map((s) => <option key={s._id} value={s.statusName}>{s.statusName}</option>)}
                        </select>
                      </td>
                    </tr>
                    {[
                      ["productionImpression", "Production Impression"],
                      ["wasteImpression", "Waste Impression"],
                      ["productionUps", "Production UPS"],
                    ].map(([name, label]) => (
                      <tr key={name}>
                        <td className="fw-semibold">{label}</td>
                        <td>
                          <input type="number" name={name} value={prodForm[name] || ""} onChange={handleProdChange} className="form-control form-control-sm" />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="fw-semibold">Production Qty</td>
                      <td><input type="number" value={prodForm.productionQty || ""} readOnly className="form-control form-control-sm" /></td>
                    </tr>
                    <tr>
                      <td className="fw-semibold">Wastage Qty</td>
                      <td><input type="number" value={prodForm.wastageQty || ""} readOnly className="form-control form-control-sm" /></td>
                    </tr>
                    <tr>
                      <td className="fw-semibold">Waste %</td>
                      <td><input type="text" value={wastePercent + "%"} readOnly className="form-control form-control-sm" /></td>
                    </tr>
                    <tr>
                      <td className="fw-semibold">Remarks</td>
                      <td><textarea name="remarks" value={prodForm.remarks || ""} onChange={handleProdChange} className="form-control form-control-sm" /></td>
                    </tr>
                  </tbody>
                </table>
                <div className="text-center mt-3">
                  <button className="btn ocr-btn-submit text-white" type="submit">Save Production Entry</button>
                </div>
              </form>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default OCRScanEntry;