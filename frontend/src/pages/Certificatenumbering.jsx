import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import JSZip from "jszip";
import QRCode from "qrcode";
import * as XLSX from "xlsx";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

const API = import.meta.env.VITE_API_URL;

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Montserrat:wght@400;700&family=Lato:wght@400;700&family=Poppins:wght@400;700&family=Source+Sans+3:wght@400;700&display=swap";

const BASE_FONTS = [
  "Arial", "Helvetica", "Verdana", "Tahoma", "Times New Roman", "Georgia", "Courier New",
  "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins", "Source Sans 3",
];

const SERIAL = "__serial";

const DEFAULTS = {
  dpi: "300", series: "default", noArt: false,
  word: "S. No:", wc: "#222222", nc: "#f58220",
  from: "", to: "", digits: "6",
  font: "Arial", pt: "16", bold: true, nx: "196", ny: "12",
  bar: true, bw: "50", bh: "10", qz: true, bx: "196", by: "24", benc: SERIAL,
  qr: true, qs: "25", qx: "262", qy: "175", qenc: SERIAL,
  per: "500",
};

const pad = (n, d) => String(n).padStart(d, "0");
const num = (v, d = 0) => { const x = parseFloat(v); return isFinite(x) ? x : d; };
const r1 = (v) => String(Math.round(v * 10) / 10);

const P = (f) => ({
  word: f.word, wc: f.wc, nc: f.nc,
  from: parseInt(f.from, 10), to: parseInt(f.to, 10),
  digits: Math.max(1, parseInt(f.digits, 10) || 1),
  family: f.font, bold: f.bold, pt: num(f.pt) || 12,
  nx: num(f.nx), ny: num(f.ny),
  bar: f.bar, bw: Math.max(5, num(f.bw)), bh: Math.max(2, num(f.bh)), qz: f.qz,
  bx: num(f.bx), by: num(f.by), benc: f.benc,
  qr: f.qr, qs: Math.max(8, num(f.qs)), qx: num(f.qx), qy: num(f.qy), qenc: f.qenc,
  noArt: f.noArt,
  dpi: Math.max(36, parseInt(f.dpi, 10) || 300),
  per: Math.max(1, parseInt(f.per, 10) || 500),
});

/* ---------- barcode ---------- */
function makeBarcode(val, p) {
  const u = p.dpi / 25.4;
  const probe = document.createElement("canvas");
  JsBarcode(probe, val, { format: "CODE128", width: 1, height: 10, displayValue: false, margin: 0 });
  const mods = probe.width;
  const m = Math.max(1, Math.round((p.bw * u) / mods));
  const q = p.qz ? 10 * m : 0;
  const c = document.createElement("canvas");
  JsBarcode(c, val, {
    format: "CODE128", width: m, height: Math.max(1, Math.round(p.bh * u)), displayValue: false,
    margin: 0, marginLeft: q, marginRight: q,
    background: p.qz ? "#ffffff" : "rgba(0,0,0,0)", lineColor: "#000000",
  });
  return c;
}
function getBarcode(S, val, p) {
  const key = ["bc", val, p.bw, p.bh, p.qz, p.dpi].join("|");
  if (S.bc.has(key)) return S.bc.get(key);
  if (S.bc.size > 40) S.bc.clear();
  const c = makeBarcode(val, p);
  S.bc.set(key, c);
  return c;
}

/* ---------- QR code (always on a white tile with a 4-module quiet zone) ---------- */
function makeQR(val, p) {
  const qr = QRCode.create(val, { errorCorrectionLevel: "M" });
  const n = qr.modules.size, m = 4, total = n + 2 * m;
  const cell = Math.max(1, Math.floor((p.qs * (p.dpi / 25.4)) / total));
  const c = document.createElement("canvas");
  c.width = c.height = cell * total;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#000000";
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < n; k++) {
      if (qr.modules.get(r, k)) x.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
    }
  }
  return c;
}
function getQR(S, val, p) {
  const key = ["qr", val, p.qs, p.dpi].join("|");
  if (S.bc.has(key)) return S.bc.get(key);
  if (S.bc.size > 40) S.bc.clear();
  const c = makeQR(val, p);
  S.bc.set(key, c);
  return c;
}

/* ---------- artwork helpers ---------- */
const MAX_ART = 14 * 1024 * 1024; // stays under MongoDB's 16 MB document limit
const JPG_Q = 0.95;               // ZIP (full-page JPEG) export quality
const PATCH_Q = 0.98;             // PDF export: quality of the small number/barcode/QR patches
const toBlob = (cv, type, q) => new Promise((res) => cv.toBlob(res, type, q));
const loadImg = (blob) =>
  new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.decoding = "async";
    img.onload = async () => {
      try { if (img.decode) await img.decode(); } catch { /* ignore */ }
      URL.revokeObjectURL(url);
      res(img);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Could not read that image. Use PNG, JPG, WebP or PDF.")); };
    img.src = url;
  });

/* small copy of the artwork (max 2048 px wide) used only for the on-screen preview */
const PREVIEW_W = 2048;
function makePreviewImg(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || w <= PREVIEW_W) return null;
  const k = PREVIEW_W / w;
  const c = document.createElement("canvas");
  c.width = PREVIEW_W;
  c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
/* Streaming PDF writer: pages are JPEG blobs appended to a Blob list, so the PDF is never one giant string
   (jsPDF fails with "Invalid string length" past ~512 MB; this has no such limit). */
function makePdfWriter(wpt, hpt) {
  const enc = new TextEncoder();
  const parts = [];
  const offs = [];
  let pos = 0, nextId = 3;
  const kids = [];
  const text = (t) => { const b = enc.encode(t); parts.push(b); pos += b.length; };
  const blobPart = (b) => { parts.push(b); pos += b.size; };
  const begin = (id) => { offs[id] = pos; text(`${id} 0 obj\n`); };
  const W = wpt.toFixed(3), H = hpt.toFixed(3);
  let bg = 0;
  const imageObj = (blob, wPx, hPx, filter) => {
    const id = nextId++;
    begin(id);
    text(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${blob.size} >>\nstream\n`);
    blobPart(blob);
    text("\nendstream\nendobj\n");
    return id;
  };
  text("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  return {
    get pages() { return kids.length; },
    /* the artwork is stored ONCE in the file and shared by every page */
    setBackground(blob, wPx, hPx, filter) { bg = imageObj(blob, wPx, hPx, filter); },
    /* a page = shared artwork + small JPEG patches (number / barcode / QR / Excel text) placed on top.
       patches: [{ blob, x, y, w, h }] in artwork pixels, k = points per pixel */
    addPage(patches, k) {
      const refs = [];
      let ops = "";
      if (bg) { refs.push(`/Bg ${bg} 0 R`); ops += `q ${W} 0 0 ${H} 0 0 cm /Bg Do Q\n`; }
      patches.forEach((q, i) => {
        const id = imageObj(q.blob, q.w, q.h, "/DCTDecode");
        refs.push(`/P${i} ${id} 0 R`);
        const w = q.w * k, h = q.h * k, x = q.x * k, y = hpt - q.y * k - h;
        ops += `q ${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /P${i} Do Q\n`;
      });
      const cont = nextId++, page = nextId++;
      begin(cont);
      text(`<< /Length ${ops.length} >>\nstream\n${ops}endstream\nendobj\n`);
      begin(page);
      text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << ${refs.join(" ")} >> >> /Contents ${cont} 0 R >>\nendobj\n`);
      kids.push(page);
    },
    finish() {
      begin(2);
      text(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] >>\nendobj\n`);
      begin(1);
      text("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
      const xref = pos;
      let x = `xref\n0 ${nextId}\n0000000000 65535 f \n`;
      for (let i = 1; i < nextId; i++) x += `${String(offs[i]).padStart(10, "0")} 00000 n \n`;
      text(x + `trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      return new Blob(parts, { type: "application/pdf" });
    },
  };
}
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

/* first page of a PDF -> PNG blob, rendered so that 1 page-mm = 1 artwork-mm at the returned dpi */
async function rasterPdf(file, dpi) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(dpi / 72, 7000 / Math.max(base.width, base.height));
  const vp = page.getViewport({ scale });
  const cv = document.createElement("canvas");
  cv.width = Math.round(vp.width);
  cv.height = Math.round(vp.height);
  const cx = cv.getContext("2d");
  cx.fillStyle = "#fff";
  cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, viewport: vp }).promise;
  let blob = await toBlob(cv, "image/png");
  if (!blob || blob.size > MAX_ART) blob = await toBlob(cv, "image/jpeg", 0.92);
  const pages = pdf.numPages;
  try { page.cleanup(); } catch { /* ignore */ }
  cv.width = 1; cv.height = 1;
  try { await pdf.destroy(); } catch { /* ignore */ }
  return { blob, dpi: Math.round(scale * 72), pages };
}

/* artwork as one lossless image for the PDF (Flate); falls back to a near-lossless JPEG if the browser can't deflate */
async function makeBackground(S, p) {
  if (!S.img || p.noArt) return null;
  const c = document.createElement("canvas");
  c.width = S.w; c.height = S.h;
  const x = c.getContext("2d", { alpha: false });
  x.fillStyle = "#fff";
  x.fillRect(0, 0, S.w, S.h);
  x.drawImage(S.img, 0, 0, S.w, S.h);
  try {
    const d = x.getImageData(0, 0, S.w, S.h).data;
    const rgb = new Uint8Array(S.w * S.h * 3);
    for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
    const z = await new Response(new Blob([rgb]).stream().pipeThrough(new CompressionStream("deflate"))).blob();
    return { blob: z, filter: "/FlateDecode" };
  } catch {
    const j = await toBlob(c, "image/jpeg", 1);
    if (!j) throw new Error("Could not prepare the artwork for the PDF.");
    return { blob: j, filter: "/DCTDecode" };
  }
}

/* ---------- render one certificate (row = Excel row for this certificate, if any) ----------
   out (optional): receives the bounding box of every drawn element, used to build PDF patches */
function render(S, ctx, n, s, p, preview, row, out) {
  const B = preview ? S.box : out;
  const u = p.dpi / 25.4, px = (p.pt * p.dpi) / 72, val = pad(n, p.digits);
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, S.w, S.h);
  // the preview always shows the artwork (for positioning); the output leaves it out when ticked
  if (S.img && (preview || !p.noArt)) ctx.drawImage(preview ? (S.prev || S.img) : (S.bmp || S.img), 0, 0, S.w, S.h);

  ctx.textBaseline = "top";
  ctx.font = `${p.bold ? 700 : 400} ${px}px "${p.family}", sans-serif`;
  const x = p.nx * u, y = p.ny * u;
  let off = 0;
  if (p.word) {
    ctx.fillStyle = p.wc;
    ctx.fillText(p.word, x, y);
    off = ctx.measureText(p.word + " ").width;
  }
  ctx.fillStyle = p.nc;
  ctx.fillText(val, x + off, y);
  const w = off + ctx.measureText(val).width;
  if (B) B.num = { x, y, w, h: px * 1.2 };

  /* Excel columns */
  for (const c of S.cols) {
    if (!c.on) continue;
    const cpx = ((num(c.pt) || 12) * p.dpi) / 72;
    const cx = num(c.x) * u, cy = num(c.y) * u;
    const value = String(row ? row[c.header] ?? "" : "");
    const name = c.label ? c.header + ": " : "";
    ctx.font = `${p.bold ? 700 : 400} ${cpx}px "${p.family}", sans-serif`;
    let tw = 0;
    if (name) {
      ctx.fillStyle = c.lc || c.color;
      ctx.fillText(name, cx, cy);
      tw = ctx.measureText(name).width;
    }
    ctx.fillStyle = c.color;
    ctx.fillText(value, cx + tw, cy);
    tw += ctx.measureText(value).width;
    if (B) B[c.id] = { x: cx, y: cy, w: Math.max(tw, cpx * 2), h: cpx * 1.2 };
  }

  /* what the barcode / QR encode: serial number or an Excel column */
  const enc = (key, ascii) => {
    const v = key === SERIAL || !row ? val : String(row[key] ?? "").trim();
    if (!v || (ascii && !/^[ -~]+$/.test(v))) return val;
    return v;
  };
  const safe = (fn, v) => { try { return fn(v); } catch { return fn(val); } };

  if (p.bar) {
    const c = safe((v) => (preview ? getBarcode(S, v, p) : makeBarcode(v, p)), enc(p.benc, true));
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(c, p.bx * u, p.by * u);
    if (B) B.bar = { x: p.bx * u, y: p.by * u, w: c.width, h: c.height };
  }
  if (p.qr) {
    const c = safe((v) => (preview ? getQR(S, v, p) : makeQR(v, p)), enc(p.qenc, false));
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(c, p.qx * u, p.qy * u);
    if (B) B.qr = { x: p.qx * u, y: p.qy * u, w: c.width, h: c.height };
  }
  ctx.restore();
}

/* ---------- distance guides from the page edges (shown on double-click) ---------- */
function drawMeasure(ctx, S, b, u, k, s) {
  const fs = 13 / (k * s);   // label text ≈ 13 px on screen
  const lw = 1.6 / (k * s);
  const L = b.x / u, T = b.y / u, R = (S.w - b.x - b.w) / u, B = (S.h - b.y - b.h) / u;
  const mm = (v) => `${(Math.round(v * 10) / 10).toFixed(1)} mm`;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;

  const line = (x1, y1, x2, y2, color, dash) => {
    const tk = fs * 0.5;
    ctx.setLineDash(dash ? [9 / (k * s), 6 / (k * s)] : []);
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    if (y1 === y2) {
      ctx.moveTo(x1, y1 - tk); ctx.lineTo(x1, y1 + tk);
      ctx.moveTo(x2, y2 - tk); ctx.lineTo(x2, y2 + tk);
    } else {
      ctx.moveTo(x1 - tk, y1); ctx.lineTo(x1 + tk, y1);
      ctx.moveTo(x2 - tk, y2); ctx.lineTo(x2 + tk, y2);
    }
    ctx.stroke();
  };

  const tag = (text, x, y, bg, fg) => {
    ctx.setLineDash([]);
    ctx.font = `700 ${fs}px Figtree, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + fs, h = fs * 1.7;
    const tx = Math.min(Math.max(x, w / 2 + 2), S.w - w / 2 - 2);
    const ty = Math.min(Math.max(y, h / 2 + 2), S.h - h / 2 - 2);
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(tx - w / 2, ty - h / 2, w, h, h / 3);
    else ctx.rect(tx - w / 2, ty - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, tx, ty);
  };

  // right / bottom (secondary)
  line(b.x + b.w, cy, S.w, cy, "#5b7a85", true);
  line(cx, b.y + b.h, cx, S.h, "#5b7a85", true);
  // X (left edge -> field) and Y (top edge -> field)
  line(0, cy, b.x, cy, "#d9480f");
  line(cx, 0, cx, b.y, "#d9480f");

  tag(mm(R), (b.x + b.w + S.w) / 2, cy - fs * 1.4, "#e6eef1", "#27434d");
  tag(mm(B), cx + fs * 3.2, (b.y + b.h + S.h) / 2, "#e6eef1", "#27434d");
  tag(`X ${mm(L)}`, b.x / 2, cy - fs * 1.4, "#d9480f", "#ffffff");
  tag(`Y ${mm(T)}`, cx + fs * 3.2, b.y / 2, "#d9480f", "#ffffff");
}

const POS_KEYS = { num: ["nx", "ny"], bar: ["bx", "by"], qr: ["qx", "qy"] };

function Field({ span, label, children }) {
  return (
    <label className={`cn-f cn-s${span}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/* ---------- view-only helpers ---------- */
function Switch({ checked, onChange, children, span = 12 }) {
  return (
    <label className={`cn-f cn-sw cn-s${span}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <i aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}
function Mm({ children }) {
  return <div className="cn-mm">{children}</div>;
}

const ICONS = {
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h4",
  tpl: "M3 4h18v6H3z M3 14h8v6H3z M15 14h6v6h-6z",
  art: "M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M9 9h.01",
  hash: "M5 9h14 M5 15h14 M10 4L8 20 M16 4l-2 16",
  type: "M4 7V5h16v2 M12 5v14 M9 19h6",
  bar: "M4 5v14 M7 5v14 M11 5v14 M14 5v14 M18 5v14 M20 5v14",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 18h2v2h-2z M14 18h2 M18 14h2",
  xls: "M4 4h16v16H4z M4 10h16 M4 15h16 M10 4v16",
  save: "M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  center: "M12 3v4 M12 17v4 M3 12h4 M17 12h4 M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
  down: "M12 4v11 M7 11l5 5 5-5 M5 20h14",
  stop: "M7 7h10v10H7z",
  sidebar: "M4 4h16v16H4z M9 4v16",
  panelRight: "M4 4h16v16H4z M15 4v16",
  expand: "M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7",
  shrink: "M4 14h6v6 M20 10h-6V4 M14 10l7-7 M10 14l-7 7",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  fit: "M3 9V5a2 2 0 0 1 2-2h4 M21 9V5a2 2 0 0 0-2-2h-4 M3 15v4a2 2 0 0 0 2 2h4 M21 15v4a2 2 0 0 1-2 2h-4",
};

function Ic({ n }) {
  return (
    <svg className="cn-ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[n] || "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0"} />
    </svg>
  );
}

/* ---------- centre number + barcode on the artwork ---------- */
async function centerLayout(f, W, H) {
  const p = P(f);
  const u = p.dpi / 25.4;
  const px = (p.pt * p.dpi) / 72;
  try { await document.fonts.load(`${p.bold ? 700 : 400} 20px "${p.family}"`); } catch { /* ignore */ }

  const val = pad(isFinite(p.from) ? p.from : 1, p.digits);
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `${p.bold ? 700 : 400} ${px}px "${p.family}", sans-serif`;
  const tw = (p.word ? ctx.measureText(p.word + " ").width : 0) + ctx.measureText(val).width;
  const th = px * 1.2;

  const bar = p.bar ? makeBarcode(val, p) : null;
  const bw = bar ? bar.width : 0, bh = bar ? bar.height : 0;
  const gap = bar ? 2 * u : 0;

  const top = Math.max(0, (H - (th + gap + bh)) / 2);
  const rr = (v) => String(Math.round((Math.max(0, v) / u) * 10) / 10);
  return {
    nx: rr((W - tw) / 2), ny: rr(top),
    bx: rr((W - bw) / 2), by: rr(top + th + gap),
  };
}

export default function CertificateNumbering() {
  const [f, setF] = useState(DEFAULTS);
  const [fonts] = useState(BASE_FONTS);
  const [dims, setDims] = useState({ w: 2480, h: 1754 });
  const [sel, setSel] = useState("num");
  const [artName, setArtName] = useState("None — blank A4 landscape");
  const [status, setStatus] = useState({ msg: "", cls: "" });
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [nextFree, setNextFree] = useState(null);
  const [sheet, setSheet] = useState(null);   // { name, headers, count }
  const [cols, setCols] = useState([]);       // one entry per Excel header
  const [pv, setPv] = useState("1");          // preview row (1-based)
  const [tpls, setTpls] = useState([]);       // saved templates [{ _id, name }]
  const [tplId, setTplId] = useState("");
  const [tplName, setTplName] = useState("");
  const [tplBusy, setTplBusy] = useState(false);
  const [measure, setMeasure] = useState(null);   // field whose edge distances are shown
  const [busy, setBusy] = useState("");           // loading message while artwork is being processed

  /* Layout toggles & Zoom to maximize preview window */
  const [sideOpen, setSideOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);
  const [zoom, setZoom] = useState("fit"); // "fit", or numeric percentage 50, 75, 100, 125, 150

  const cvRef = useRef(null);
  const S = useRef({ img: null, w: 2480, h: 1754, box: { num: null, bar: null, qr: null }, bc: new Map(), rows: [], cols: [], blob: null, prev: null, tplCols: new Map(), clearBusy: false }).current;
  const drag = useRef(null);
  const stopFlag = useRef(false);
  const fRef = useRef(f);
  fRef.current = f;
  const colsRef = useRef(cols);
  colsRef.current = cols;
  S.cols = cols;

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setF((o) => ({ ...o, [k]: v }));
  };
  const setCol = (id, k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setCols((cs) => cs.map((c) => (c.id === id ? { ...c, [k]: v } : c)));
  };
  const say = (msg, cls = "") => setStatus({ msg, cls });

  /* google fonts */
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONT_LINK;
    document.head.appendChild(l);
    return () => { document.head.removeChild(l); };
  }, []);

  /* centre by default on first load */
  useEffect(() => {
    centerLayout(DEFAULTS, S.w, S.h).then((c) => setF((o) => ({ ...o, ...c })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* next free number for the series */
  useEffect(() => {
    const series = f.series.trim();
    if (!series) { setNextFree(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/numbering-jobs?series=${encodeURIComponent(series)}`, { headers: authHeaders() });
        const d = await r.json();
        setNextFree(r.ok ? d.next : null);
      } catch { setNextFree(null); }
    }, 400);
    return () => clearTimeout(t);
  }, [f.series, running]);

  /* preview */
  useEffect(() => {
    let dead = false;
    (async () => {
      const p = P(f);
      try { await document.fonts.load(`${p.bold ? 700 : 400} 20px "${p.family}"`); } catch { /* ignore */ }
      if (dead) return;
      const cv = cvRef.current;
      if (!cv) return;
      // High-resolution preview render
      const s = Math.min(1, 2048 / S.w);
      cv.width = Math.round(S.w * s);
      cv.height = Math.round(S.h * s);
      const ctx = cv.getContext("2d");
      const idx = Math.min(Math.max((parseInt(pv, 10) || 1) - 1, 0), Math.max(0, S.rows.length - 1));
      const n = (isFinite(p.from) ? p.from : 1) + idx;
      S.box = { num: null, bar: null, qr: null };
      render(S, ctx, n, s, p, true, S.rows[idx]);
      ctx.save();
      ctx.scale(s, s);
      if (!S.img) {
        ctx.fillStyle = "rgba(16,52,61,.28)";
        ctx.font = `600 ${S.w * 0.022}px Figtree, Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Choose base artwork to place numbers on it", S.w / 2, S.h / 2);
      }
      const b = S.box[sel];
      if (b) {
        ctx.setLineDash([12, 8]);
        ctx.lineWidth = (3 / s) * 0.6;
        ctx.strokeStyle = "#0f7f96";
        ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
      }
      const mb = measure ? S.box[measure] : null;
      if (mb) {
        const rect = cv.getBoundingClientRect();
        const k = rect.width && cv.width ? rect.width / cv.width : 1;
        drawMeasure(ctx, S, mb, p.dpi / 25.4, k, s);
      }
      ctx.restore();
      /* artwork upload finished painting → remove the loading overlay */
      if (S.clearBusy) { S.clearBusy = false; requestAnimationFrame(() => setBusy("")); }
    })();
    return () => { dead = true; };
  }, [f, cols, sheet, pv, dims, sel, measure, fonts, S]);

  /* ---------- move variable matter ---------- */
  const toArt = (e) => {
    const r = cvRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * S.w) / r.width, y: ((e.clientY - r.top) * S.h) / r.height };
  };
  const hit = (pt) => {
    const m = S.w * 0.008;
    for (const k of Object.keys(S.box).reverse()) {
      const b = S.box[k];
      if (b && pt.x >= b.x - m && pt.x <= b.x + b.w + m && pt.y >= b.y - m && pt.y <= b.y + b.h + m) return k;
    }
    return null;
  };
  const setPos = (k, xmm, ymm) => {
    const sx = String(Math.round(xmm * 10) / 10), sy = String(Math.round(ymm * 10) / 10);
    if (POS_KEYS[k]) {
      const [kx, ky] = POS_KEYS[k];
      setF((o) => ({ ...o, [kx]: sx, [ky]: sy }));
    } else {
      setCols((cs) => cs.map((c) => (c.id === k ? { ...c, x: sx, y: sy } : c)));
    }
  };
  const getPos = (k) => {
    if (POS_KEYS[k]) { const [kx, ky] = POS_KEYS[k]; return [num(fRef.current[kx]), num(fRef.current[ky])]; }
    const c = colsRef.current.find((q) => q.id === k);
    return c ? [num(c.x), num(c.y)] : [0, 0];
  };
  const onDown = (e) => {
    const pt = toArt(e), k = hit(pt);
    if (!k) { setMeasure(null); return; }
    setSel(k);
    if (!propsOpen) setPropsOpen(true);
    drag.current = { k, dx: pt.x - S.box[k].x, dy: pt.y - S.box[k].y };
    cvRef.current.setPointerCapture(e.pointerId);
    cvRef.current.focus();
  };
  const onMove = (e) => {
    const pt = toArt(e);
    if (!drag.current) { cvRef.current.style.cursor = hit(pt) ? "move" : "default"; return; }
    const u = P(fRef.current).dpi / 25.4;
    setPos(drag.current.k, (pt.x - drag.current.dx) / u, (pt.y - drag.current.dy) / u);
  };
  const onUp = () => { drag.current = null; };
  const onDbl = (e) => {
    const k = hit(toArt(e));
    if (k) { setSel(k); setMeasure(k); } else setMeasure(null);
  };
  const onKey = (e) => {
    if (e.key === "Escape") { setMeasure(null); return; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || !S.box[sel]) return;
    e.preventDefault();
    const step = e.shiftKey ? 5 : 0.5, [cx, cy] = getPos(sel);
    setPos(sel, cx + d[0] * step, cy + d[1] * step);
  };

  /* ---------- uploads ---------- */
  const setArtImage = (img, blob, label) => {
    S.img = img; S.blob = blob; S.w = img.naturalWidth; S.h = img.naturalHeight;
    S.prev = makePreviewImg(img);
    setDims({ w: S.w, h: S.h });
    setArtName(`${label} · ${S.w}×${S.h}px`);
  };
  const clearArt = () => {
    S.img = null; S.prev = null; S.blob = null; S.w = 2480; S.h = 1754;
    setDims({ w: S.w, h: S.h });
    setArtName("None — blank A4 landscape");
  };

  /* image (PNG/JPG/WebP) or PDF (first page) — shows a full-screen loader until the preview is painted */
  const onArt = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    setBusy(isPdf ? "Reading PDF…" : "Loading image…");
    await nextFrame();
    try {
      let blob = file, label = file.name, dpiFix = null;
      if (isPdf) {
        const r = await rasterPdf(file, P(fRef.current).dpi);
        blob = r.blob; dpiFix = r.dpi;
        label = r.pages > 1 ? `${file.name} (page 1 of ${r.pages})` : file.name;
      }
      const img = await loadImg(blob);
      setBusy("Preparing preview…");
      await nextFrame();
      setArtImage(img, blob, label);
      const o = dpiFix ? { ...fRef.current, dpi: String(dpiFix) } : fRef.current;
      const dpi = P(o).dpi;
      const wmm = (S.w * 25.4) / dpi, hmm = (S.h * 25.4) / dpi;
      const qs = Math.round(Math.min(wmm, hmm) * 0.12);
      const next = {
        ...o,
        pt: String(Math.max(4, Math.round(hmm * 0.07 * 2.835))),
        bw: r1(wmm * 0.3), bh: r1(hmm * 0.1),
        qs: String(qs), qx: r1(wmm - qs - wmm * 0.03), qy: r1(hmm - qs - hmm * 0.04),
      };
      const c = await centerLayout(next, S.w, S.h);
      S.clearBusy = true;
      setF({ ...next, ...c });
      say(isPdf && dpiFix && dpiFix !== P(fRef.current).dpi ? `PDF read. Artwork DPI set to ${dpiFix} so millimetres stay exact.` : "");
    } catch (err) {
      S.clearBusy = false;
      setBusy("");
      say(err.message || "Could not read that file.", "err");
    }
  };

  /* ---------- templates (saved on the server, picked from a dropdown) ---------- */
  const authOnly = () => { const h = authHeaders(); delete h["Content-Type"]; return h; };
  const COL_KEYS = ["header", "on", "label", "pt", "color", "lc", "x", "y"];
  const pickCol = (c) => Object.fromEntries(COL_KEYS.map((k) => [k, c[k]]));
  const withTpl = (c, t) => ({
    ...c, on: !!t.on, label: !!t.label, pt: String(t.pt), color: t.color,
    lc: t.lc || t.color, x: String(t.x), y: String(t.y),
  });

  const loadTpls = async () => {
    try {
      const r = await fetch(`${API}/api/numbering-templates`, { headers: authHeaders(), cache: "no-store" });
      const d = await r.json();
      if (r.ok) setTpls(d);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadTpls(); }, []);

  const applyTemplate = async (id) => {
    setTplId(id);
    if (!id) return;
    try {
      say("Loading template…");
      const r = await fetch(`${API}/api/numbering-templates/${id}`, { headers: authHeaders() });
      const t = await r.json();
      if (!r.ok) throw new Error(t.message || "Could not load that template.");

      if (t.hasArt) {
        const ar = await fetch(`${API}/api/numbering-templates/${id}/art`, { headers: authOnly() });
        if (!ar.ok) throw new Error("Could not load the template artwork.");
        const blob = await ar.blob();
        setArtImage(await loadImg(blob), blob, t.artName || "Template artwork");
      } else {
        clearArt();
      }

      /* Excel field styling: kept by header name, applied now and to any Excel uploaded later */
      S.tplCols = new Map((t.cols || []).map((c) => [c.header, c]));
      setCols((cs) => cs.map((c) => (S.tplCols.has(c.header) ? withTpl(c, S.tplCols.get(c.header)) : c)));

      /* everything except the number range */
      setF((o) => {
        const n = { ...DEFAULTS, ...t.settings, from: o.from, to: o.to };
        if (S.rows.length) {
          const hs = Object.keys(S.rows[0]);
          if (n.benc !== SERIAL && !hs.includes(n.benc)) n.benc = SERIAL;
          if (n.qenc !== SERIAL && !hs.includes(n.qenc)) n.qenc = SERIAL;
        }
        return n;
      });
      setTplName(t.name);
      say(`Template "${t.name}" loaded.`, "ok");
    } catch (err) {
      say(err.message || "Could not load that template.", "err");
    }
  };

  const saveTemplate = async () => {
    const name = tplName.trim();
    if (!name) { say("Type a template name first.", "err"); return; }
    const same = tpls.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (same && !window.confirm(`A template named "${same.name}" already exists. Replace it?`)) return;
    setTplBusy(true);
    try {
      let art = S.blob;
      if (S.img && art && art.size > MAX_ART) {
        const cv = document.createElement("canvas");
        cv.width = S.w; cv.height = S.h;
        cv.getContext("2d").drawImage(S.img, 0, 0);
        art = await toBlob(cv, "image/jpeg", 0.9);
      }
      if (S.img && (!art || art.size > MAX_ART)) throw new Error("Artwork is too large to save (limit 14 MB).");

      const { from, to, ...settings } = fRef.current;
      const live = colsRef.current.length ? colsRef.current.map(pickCol) : [...S.tplCols.values()];
      const res = await fetch(`${API}/api/numbering-templates`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name, settings, cols: live, createdBy: whoAmI(),
          artName: S.img ? artName.replace(/\s·\s\d+×\d+px$/, "") : "", artW: S.w, artH: S.h, clearArt: !S.img,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Could not save the template.");

      if (S.img && art) {
        const ar = await fetch(`${API}/api/numbering-templates/${d._id}/art`, {
          method: "PUT",
          headers: { ...authOnly(), "Content-Type": art.type || "image/png" },
          body: art,
        });
        if (!ar.ok) throw new Error("Saved the settings but the artwork upload failed.");
      }
      live.forEach((c) => S.tplCols.set(c.header, c));
      await loadTpls();
      setTplId(d._id);
      setTplName(d.name);
      say(`Template "${d.name}" saved.`, "ok");
    } catch (err) {
      say(err.message || "Could not save the template.", "err");
    } finally {
      setTplBusy(false);
    }
  };

  const deleteTemplate = async () => {
    const t = tpls.find((q) => q._id === tplId);
    if (!t || !window.confirm(`Delete template "${t.name}"?`)) return;
    setTplBusy(true);
    try {
      const r = await fetch(`${API}/api/numbering-templates/${t._id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error("Could not delete the template.");
      window.location.reload();
      return;
    } catch (err) {
      say(err.message || "Could not delete the template.", "err");
    } finally {
      setTplBusy(false);
    }
  };

  /* Excel: row 1 = headers, every next row = one certificate (first row ↔ "From") */
  const onSheet = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      say("Reading Excel…");
      await nextFrame();
      const wb = XLSX.read(await file.arrayBuffer(), {
        type: "array", sheets: 0, cellFormula: false, cellHTML: false, cellStyles: false,
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (ws && ws["!ref"]) {
        const full = XLSX.utils.decode_range(ws["!ref"]);
        let mr = -1, mc = -1;
        for (const k in ws) {
          if (k.charCodeAt(0) === 33) continue; // "!ref", "!merges" …
          const c = ws[k];
          if (!c || c.v === undefined || c.v === null || String(c.v).trim() === "") continue;
          const a = XLSX.utils.decode_cell(k);
          if (a.r > mr) mr = a.r;
          if (a.c > mc) mc = a.c;
        }
        if (mr >= 0 && (mr < full.e.r || mc < full.e.c)) {
          ws["!ref"] = XLSX.utils.encode_range(full.s, { r: Math.min(mr, full.e.r), c: Math.min(mc, full.e.c) });
        }
      }
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
      if (aoa.length < 2) throw new Error("the first sheet needs a header row and at least one data row.");

      const seen = {};
      const headers = aoa[0].map((h, i) => {
        let name = String(h).trim() || `Column ${i + 1}`;
        if (seen[name]) { seen[name] += 1; name = `${name} (${seen[name]})`; } else seen[name] = 1;
        return name;
      });
      const rows = [];
      for (let ri = 1; ri < aoa.length; ri++) {
        const r = aoa[ri], o = {};
        let any = false;
        for (let i = 0; i < headers.length; i++) {
          const v = String(r[i] ?? "").trim();
          o[headers[i]] = v;
          if (v !== "") any = true;
        }
        if (any) rows.push(o);
      }
      if (!rows.length) throw new Error("no data rows found under the header row.");

      const o = fRef.current, dpi = P(o).dpi;
      const wmm = (S.w * 25.4) / dpi, hmm = (S.h * 25.4) / dpi;
      const pt = Math.max(4, Math.round(num(o.pt) * 0.75));
      const step = pt * 0.3528 * 1.7;
      S.rows = rows;
      setSheet({ name: file.name, headers, count: rows.length });
      setCols(headers.map((h, i) => {
        const base = {
          id: `c${i}`, header: h, on: i < 3, label: false, pt: String(pt), color: "#222222", lc: "#222222",
          x: r1(wmm * 0.05), y: r1(hmm * 0.08 + i * step),
        };
        const t = S.tplCols.get(h);
        return t ? withTpl(base, t) : base;
      }));
      setPv("1");
      setSel("c0");
      const from = parseInt(o.from, 10);
      const start = Number.isInteger(from) && from >= 0 ? from : 1;
      setF((q) => ({
        ...q, from: String(start), to: String(start + rows.length - 1),
        benc: headers.includes(q.benc) ? q.benc : SERIAL, qenc: headers.includes(q.qenc) ? q.qenc : SERIAL,
      }));
      say(`Loaded ${rows.length.toLocaleString()} rows · ${headers.length} columns. Range set to match.`, "ok");
    } catch (err) {
      say("Could not read that Excel file: " + (err.message || err), "err");
    }
  };
  const removeSheet = () => {
    S.rows = [];
    setSheet(null);
    setCols([]);
    setPv("1");
    setSel("num");
    setMeasure(null);
    setF((q) => ({ ...q, benc: SERIAL, qenc: SERIAL }));
    say("");
  };

  /* ---------- generate ---------- */
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const saveBlob = (name, blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  async function reserve(p) {
    const res = await fetch(`${API}/api/numbering-jobs/reserve`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        series: f.series.trim() || "default",
        from: p.from, to: p.to, digits: p.digits, word: p.word, createdBy: whoAmI(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Could not reserve this number range.");
    return data;
  }

  async function generate(kind) {
    if (running) return;
    const p = P(f);
    if (!Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from < 0 || p.to < p.from) {
      say("Enter a valid range: From and To are whole numbers and To ≥ From.", "err"); return;
    }
    if (String(p.to).length > p.digits) {
      say(`"To" needs ${String(p.to).length} digits. Raise Digits to match.`, "err"); return;
    }
    const total = p.to - p.from + 1;
    if (sheet && total > S.rows.length) {
      say(`Range has ${total.toLocaleString()} certificates but the Excel has only ${S.rows.length.toLocaleString()} rows. Lower "To" or add rows.`, "err"); return;
    }
    try { await document.fonts.load(`${p.bold ? 700 : 400} 20px "${p.family}"`); } catch { /* ignore */ }

    setRunning(true);
    stopFlag.current = false;
    setProgress(0);
    let reprint = false;
    try {
      const r = await reserve(p);
      reprint = !!r.reprint;
    } catch (err) {
      say(err.message, "err");
      setRunning(false);
      return;
    }

    const off = document.createElement("canvas");
    off.width = S.w; off.height = S.h;
    const ctx = off.getContext("2d", { alpha: false });   // opaque canvas: faster fill + JPEG encode
    const wpt = (S.w * 72) / p.dpi, hpt = (S.h * 72) / p.dpi;
    let done = 0;

    try {
      /* decode the artwork once; drawImage from a bitmap avoids re-decoding it on every page */
      S.bmp = S.img && !p.noArt && window.createImageBitmap ? await createImageBitmap(S.img) : null;

      /* split output by size: a new file starts once ~1.9 GB is reached (viewers fail on PDFs of 2 GB+) */
      const MAX_FILE = 1.9 * 1024 * 1024 * 1024;
      const PDF = kind === "pdf";
      /* PDF: the artwork is embedded once (lossless); each page only adds small patches for the variable matter.
         ZIP: full-page JPEGs, encoded in parallel while the next page is being drawn. */
      const bg = PDF ? await makeBackground(S, p) : null;
      const K = 72 / p.dpi;
      const INFLIGHT = PDF ? 8 : S.w * S.h > 24e6 ? 2 : 4;
      const pending = [];
      let cur = null;

      /* crop each drawn element (with a small margin) out of the rendered page and JPEG-encode it */
      const patchesFor = (boxes) => {
        const jobs = [];
        for (const k of Object.keys(boxes)) {
          const b = boxes[k];
          if (!b) continue;
          const pad4 = Math.ceil(Math.max(4, Math.min(b.h * 0.25, 40)));
          const x0 = Math.max(0, Math.floor(b.x - pad4)), y0 = Math.max(0, Math.floor(b.y - pad4));
          const x1 = Math.min(S.w, Math.ceil(b.x + b.w + pad4)), y1 = Math.min(S.h, Math.ceil(b.y + b.h + pad4));
          const w = x1 - x0, h = y1 - y0;
          if (w < 1 || h < 1) continue;
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d", { alpha: false }).drawImage(off, x0, y0, w, h, 0, 0, w, h);
          jobs.push(toBlob(c, "image/jpeg", PATCH_Q).then((blob) => ({ blob, x: x0, y: y0, w, h })));
        }
        return Promise.all(jobs);
      };

      const closeFile = async (c) => {
        const blob = c.pdf ? c.pdf.finish() : await c.zip.generateAsync({ type: "blob", compression: "STORE" });
        saveBlob(`certificates_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}.${c.pdf ? "pdf" : "zip"}`, blob);
      };
      /* takes the oldest encoded page (order is preserved) and adds it to the current output file */
      const take = async () => {
        const q = pending.shift();
        const got = await q.work;
        if (PDF ? got.some((t) => !t.blob) : !got) throw new Error("Could not encode a page (artwork too large for this browser).");
        if (!cur) {
          cur = { a: q.n, last: q.n, bytes: 0, pdf: PDF ? makePdfWriter(wpt, hpt) : null, zip: PDF ? null : new JSZip() };
          if (cur.pdf && bg) { cur.pdf.setBackground(bg.blob, S.w, S.h, bg.filter); cur.bytes += bg.blob.size; }
        }
        if (PDF) {
          cur.pdf.addPage(got, K);
          cur.bytes += got.reduce((s, t) => s + t.blob.size, 0);
        } else {
          cur.zip.file(`${pad(q.n, p.digits)}.jpg`, got);
          cur.bytes += got.size;
        }
        cur.last = q.n;
        done++;
        if (done % 4 === 0 || done === total) {
          setProgress((done / total) * 100);
          say(`Rendering ${done.toLocaleString()} of ${total.toLocaleString()}…`);
          await tick();
        }
        if (cur.bytes >= MAX_FILE) { const c = cur; cur = null; await closeFile(c); }
      };

      for (let n = p.from; n <= p.to && !stopFlag.current; n++) {
        if (pending.length >= INFLIGHT) await take();
        const boxes = {};
        render(S, ctx, n, 1, p, false, S.rows[n - p.from], boxes);
        pending.push({ n, work: PDF ? patchesFor(boxes) : toBlob(off, "image/jpeg", JPG_Q) });
      }
      if (!stopFlag.current) {
        while (pending.length) await take();
        if (cur) await closeFile(cur);
      }
      if (stopFlag.current) say("Stopped.");
      else say(`Done. ${total.toLocaleString()} certificates generated${reprint ? " (re-print of an issued range)" : ""}.`, "ok");
    } catch (err) {
      say("Failed: " + (err.message || err), "err");
    } finally {
      if (S.bmp) { try { S.bmp.close(); } catch { /* ignore */ } S.bmp = null; }
      setRunning(false);
    }
  }

  /* ---------- view ---------- */
  const p = P(f);
  const okRange = Number.isInteger(p.from) && Number.isInteger(p.to) && p.to >= p.from;
  const count = okRange ? p.to - p.from + 1 : 0;
  const rangeTxt = okRange ? `${pad(p.from, p.digits)} → ${pad(p.to, p.digits)}` : "Enter a valid range";
  const selCol = cols.find((c) => c.id === sel);
  const selName = sel === "num" ? "Number" : sel === "bar" ? "Barcode" : sel === "qr" ? "QR Code" : selCol ? selCol.header : "";
  const onCenter = async () => { const c = await centerLayout(f, S.w, S.h); setF((o) => ({ ...o, ...c })); };

  /* zoom control helpers */
  const zoomIn = () => setZoom((z) => (z === "fit" ? 110 : Math.min(250, z + 15)));
  const zoomOut = () => setZoom((z) => (z === "fit" ? 85 : Math.max(30, z - 15)));
  const zoomFit = () => setZoom("fit");
  const isMaximized = !sideOpen && !propsOpen;
  const toggleMaximize = () => {
    if (isMaximized) {
      setSideOpen(true);
      setPropsOpen(true);
    } else {
      setSideOpen(false);
      setPropsOpen(false);
    }
  };

  const encOptions = (
    <>
      <option value={SERIAL}>Serial number</option>
      {sheet && sheet.headers.map((h) => <option key={h} value={h}>Excel column: {h}</option>)}
    </>
  );

  const props = (() => {
    if (sel === "num") return (
      <div className="cn-row">
        <Field span={6} label="X (Left)"><Mm><input type="number" step="0.5" value={f.nx} onChange={set("nx")} /></Mm></Field>
        <Field span={6} label="Y (Top)"><Mm><input type="number" step="0.5" value={f.ny} onChange={set("ny")} /></Mm></Field>
        <Field span={6} label="Font size (pt)"><input type="number" min="1" step="0.5" value={f.pt} onChange={set("pt")} /></Field>
        <Switch span={6} checked={f.bold} onChange={set("bold")}>Bold</Switch>
        <Field span={6} label="Word colour"><input type="color" value={f.wc} onChange={set("wc")} /></Field>
        <Field span={6} label="Number colour"><input type="color" value={f.nc} onChange={set("nc")} /></Field>
      </div>
    );
    if (sel === "bar") return f.bar ? (
      <div className="cn-row">
        <Field span={6} label="X (Left)"><Mm><input type="number" step="0.5" value={f.bx} onChange={set("bx")} /></Mm></Field>
        <Field span={6} label="Y (Top)"><Mm><input type="number" step="0.5" value={f.by} onChange={set("by")} /></Mm></Field>
        <Field span={6} label="Width"><Mm><input type="number" min="5" step="1" value={f.bw} onChange={set("bw")} /></Mm></Field>
        <Field span={6} label="Height"><Mm><input type="number" min="2" step="0.5" value={f.bh} onChange={set("bh")} /></Mm></Field>
        <Switch span={12} checked={f.qz} onChange={set("qz")}>Quiet zone</Switch>
      </div>
    ) : <div className="cn-info">Barcode is currently OFF. Turn it on in the Barcode section.</div>;
    if (sel === "qr") return f.qr ? (
      <div className="cn-row">
        <Field span={6} label="X (Left)"><Mm><input type="number" step="0.5" value={f.qx} onChange={set("qx")} /></Mm></Field>
        <Field span={6} label="Y (Top)"><Mm><input type="number" step="0.5" value={f.qy} onChange={set("qy")} /></Mm></Field>
        <Field span={12} label="Tile Size"><Mm><input type="number" min="8" step="1" value={f.qs} onChange={set("qs")} /></Mm></Field>
      </div>
    ) : <div className="cn-info">QR code is currently OFF. Turn it on in the QR Code section.</div>;
    if (selCol) return (
      <div className="cn-row">
        <Field span={6} label="X (Left)"><Mm><input type="number" step="0.5" value={selCol.x} onChange={setCol(selCol.id, "x")} /></Mm></Field>
        <Field span={6} label="Y (Top)"><Mm><input type="number" step="0.5" value={selCol.y} onChange={setCol(selCol.id, "y")} /></Mm></Field>
        <Field span={6} label="Size (pt)"><input type="number" min="1" step="0.5" value={selCol.pt} onChange={setCol(selCol.id, "pt")} /></Field>
        <Field span={6} label="Value colour"><input type="color" value={selCol.color} onChange={setCol(selCol.id, "color")} /></Field>
        <Switch span={12} checked={selCol.label} onChange={setCol(selCol.id, "label")}>Show column header prefix</Switch>
      </div>
    );
    return <div className="cn-info">Click any element on the certificate to inspect and adjust its properties.</div>;
  })();

  return (
    <div className="cn-root">
      <style>{CSS}</style>

      {/* loading overlay: blocks all input until the artwork is processed and painted */}
      {busy && (
        <div className="cn-busy" role="status" aria-live="polite">
          <div className="cn-spin" />
          <b>{busy}</b>
          <span>Please wait…</span>
        </div>
      )}

      {/* workspace grid: dynamically expands preview canvas */}
      <div className={`cn-work ${!sideOpen ? "no-side" : ""} ${!propsOpen ? "no-props" : ""}`}>
        
        {/* ---------- left: configuration sidebar ---------- */}
        <aside className="cn-side" aria-label="Settings and controls">
          <div className="cn-panel-header">
            <div className="cn-panel-title">
              <Ic n="tpl" />
              <span>Configuration</span>
            </div>
            <button className="cn-icon-btn" type="button" title="Collapse sidebar" onClick={() => setSideOpen(false)}>
              <Ic n="sidebar" />
            </button>
          </div>

          <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <details className="cn-sec" open>
              <summary><Ic n="tpl" /><em>01</em>Template</summary>
              <div className="cn-body">
                <div className="cn-row">
                  <Field span={12} label="Saved templates">
                    <select value={tplId} onChange={(e) => applyTemplate(e.target.value)} disabled={tplBusy}>
                      <option value="">{tpls.length ? "— choose to load —" : "— none saved yet —"}</option>
                      {tpls.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  </Field>
                  <Field span={12} label="Template name">
                    <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Certificate A4" />
                  </Field>
                  <div className="cn-actions">
                    <button className="cn-btn ghost" type="button" onClick={saveTemplate} disabled={tplBusy}><Ic n="save" />{tplBusy ? "Working…" : "Save"}</button>
                    <button className="cn-btn ghost danger" type="button" onClick={deleteTemplate} disabled={tplBusy || !tplId}><Ic n="trash" />Delete</button>
                  </div>
                </div>
              </div>
            </details>

            <details className="cn-sec" open>
              <summary><Ic n="art" /><em>02</em>Artwork</summary>
              <div className="cn-body">
                <label className="cn-drop">
                  <input type="file" accept="image/*,application/pdf,.pdf" hidden onChange={onArt} />
                  <Ic n="art" />
                  <strong>Artwork</strong>
                  <small>PNG, JPG, WebP or PDF</small>
                  <span className="cn-btn sm">Upload File</span>
                </label>
                <div className="cn-file"><b>{artName}</b><span>DPI {f.dpi}</span></div>
                <div className="cn-row">
                  <Field span={6} label="Artwork DPI"><input type="number" min="36" max="1200" value={f.dpi} onChange={set("dpi")} /></Field>
                  <Field span={6} label="Series"><input type="text" value={f.series} onChange={set("series")} /></Field>
                  <Switch checked={f.noArt} onChange={set("noArt")}>Hide background on export</Switch>
                </div>
              </div>
            </details>

            <details className="cn-sec" open>
              <summary><Ic n="hash" /><em>03</em>Numbering</summary>
              <div className="cn-body">
                <div className="cn-range">
                  <strong>{rangeTxt}</strong>
                </div>
                <div className="cn-row">
                  <Field span={12} label="Static word"><input type="text" value={f.word} onChange={set("word")} /></Field>
                  <Field span={4} label="From *"><input type="number" min="0" value={f.from} onChange={set("from")} /></Field>
                  <Field span={4} label="To *"><input type="number" min="0" value={f.to} onChange={set("to")} /></Field>
                  <Field span={4} label="Digits"><input type="number" min="1" max="20" value={f.digits} onChange={set("digits")} /></Field>
                </div>
              </div>
            </details>

            <details className="cn-sec">
              <summary><Ic n="type" /><em>04</em>Text Styling</summary>
              <div className="cn-body">
                <div className="cn-row">
                  <Field span={12} label="Font family *">
                    <select value={f.font} onChange={set("font")}>
                      {fonts.map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field span={6} label="Size (pt) *"><input type="number" min="1" step="0.5" value={f.pt} onChange={set("pt")} /></Field>
                  <Switch span={6} checked={f.bold} onChange={set("bold")}>Bold</Switch>
                  <Field span={6} label="Word colour"><input type="color" value={f.wc} onChange={set("wc")} /></Field>
                  <Field span={6} label="Number colour"><input type="color" value={f.nc} onChange={set("nc")} /></Field>
                  <Field span={6} label="Number X"><Mm><input type="number" step="0.5" value={f.nx} onChange={set("nx")} /></Mm></Field>
                  <Field span={6} label="Number Y"><Mm><input type="number" step="0.5" value={f.ny} onChange={set("ny")} /></Mm></Field>
                </div>
              </div>
            </details>

            <details className="cn-sec">
              <summary><Ic n="bar" /><em>05</em>Barcode (128)</summary>
              <div className="cn-body">
                <Switch checked={f.bar} onChange={set("bar")}>Barcode {f.bar ? "ON" : "OFF"}</Switch>
                {f.bar && (
                  <div className="cn-row">
                    <Field span={6} label="Width"><Mm><input type="number" min="5" step="1" value={f.bw} onChange={set("bw")} /></Mm></Field>
                    <Field span={6} label="Height"><Mm><input type="number" min="2" step="0.5" value={f.bh} onChange={set("bh")} /></Mm></Field>
                    <Switch span={12} checked={f.qz} onChange={set("qz")}>Quiet zone</Switch>
                    <Field span={6} label="X"><Mm><input type="number" step="0.5" value={f.bx} onChange={set("bx")} /></Mm></Field>
                    <Field span={6} label="Y"><Mm><input type="number" step="0.5" value={f.by} onChange={set("by")} /></Mm></Field>
                    <Field span={12} label="Encodes"><select value={f.benc} onChange={set("benc")}>{encOptions}</select></Field>
                  </div>
                )}
              </div>
            </details>

            <details className="cn-sec">
              <summary><Ic n="qr" /><em>06</em>QR Code</summary>
              <div className="cn-body">
                <Switch checked={f.qr} onChange={set("qr")}>QR code {f.qr ? "ON" : "OFF"}</Switch>
                {f.qr && (
                  <div className="cn-row">
                    <Field span={4} label="Size"><Mm><input type="number" min="8" step="1" value={f.qs} onChange={set("qs")} /></Mm></Field>
                    <Field span={4} label="X"><Mm><input type="number" step="0.5" value={f.qx} onChange={set("qx")} /></Mm></Field>
                    <Field span={4} label="Y"><Mm><input type="number" step="0.5" value={f.qy} onChange={set("qy")} /></Mm></Field>
                    <Field span={12} label="Encodes"><select value={f.qenc} onChange={set("qenc")}>{encOptions}</select></Field>
                  </div>
                )}
                <div className="cn-row">
                  <Field span={12} label="Pages per output batch"><input type="number" min="1" value={f.per} onChange={set("per")} /></Field>
                </div>
              </div>
            </details>

            <details className="cn-sec" open={!!sheet}>
              <summary><Ic n="xls" /><em>07</em>Excel Data {sheet && <span className="cn-pill">{sheet.count.toLocaleString()} rows</span>}</summary>
              <div className="cn-body">
                <label className="cn-drop">
                  <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onSheet} />
                  <Ic n="xls" />
                  <strong>Excel Import</strong>
                  <small>Merge tabular rows onto certificates</small>
                  <span className="cn-btn sm">Upload Spreadsheet</span>
                </label>
                <div className="cn-file">
                  <b>{sheet ? sheet.name : "No file attached"}</b>
                  {sheet && <span>{sheet.count.toLocaleString()} rows · {sheet.headers.length} columns</span>}
                </div>
                {sheet && (
                  <>
                    {cols.map((c) => (
                      <details key={c.id} className={`cn-col${c.on ? "" : " off"}`} onFocus={() => setSel(c.id)}>
                        <summary>
                          <label className="cn-f cn-chk" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={c.on} onChange={setCol(c.id, "on")} />
                            <span title={c.header}>{c.header}</span>
                          </label>
                          <label className="cn-f cn-chk cn-mini" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={c.label} onChange={setCol(c.id, "label")} />
                            <span>Name</span>
                          </label>
                        </summary>
                        <div className="cn-row">
                          <Field span={4} label="Size (pt)"><input type="number" min="1" step="0.5" value={c.pt} onChange={setCol(c.id, "pt")} /></Field>
                          <Field span={4} label="Colour"><input type="color" value={c.color} onChange={setCol(c.id, "color")} /></Field>
                          <Field span={4} label="Label"><input type="color" value={c.lc || c.color} disabled={!c.label} onChange={setCol(c.id, "lc")} /></Field>
                          <Field span={6} label="X"><Mm><input type="number" step="0.5" value={c.x} onChange={setCol(c.id, "x")} /></Mm></Field>
                          <Field span={6} label="Y"><Mm><input type="number" step="0.5" value={c.y} onChange={setCol(c.id, "y")} /></Mm></Field>
                        </div>
                      </details>
                    ))}
                    <button className="cn-btn ghost danger" type="button" style={{ alignSelf: "flex-start" }} onClick={removeSheet}><Ic n="trash" />Remove Excel</button>
                  </>
                )}
              </div>
            </details>
          </form>
        </aside>

        {/* ---------- centre: large preview stage ---------- */}
        <section className="cn-stage">
          <div className="cn-tool">
            <div className="cn-tool-left">
              {!sideOpen && (
                <button className="cn-btn ghost sm" type="button" title="Show configuration sidebar" onClick={() => setSideOpen(true)}>
                  <Ic n="sidebar" /> Controls
                </button>
              )}
              <strong>Preview</strong>
              <span className="cn-dim">{dims.w}×{dims.h}px</span>

              <span className="cn-rowsel">
                Row
                <input type="number" min="1" max={sheet ? sheet.count : 1} value={pv} disabled={!sheet} onChange={(e) => setPv(e.target.value)} aria-label="Preview row" />
                of {sheet ? sheet.count.toLocaleString() : 1}
              </span>
            </div>

            <div className="cn-tool-center">
              {/* Zoom Toolbar for larger viewing */}
              <div className="cn-zoom-group">
                <button className="cn-zoom-btn" type="button" onClick={zoomOut} title="Zoom out">
                  <Ic n="minus" />
                </button>
                <button className={`cn-zoom-btn ${zoom === "fit" ? "active" : ""}`} type="button" onClick={zoomFit} title="Fit to screen">
                  <Ic n="fit" /> Fit
                </button>
                <button className="cn-zoom-btn" type="button" onClick={zoomIn} title="Zoom in">
                  <Ic n="plus" />
                </button>
                {zoom !== "fit" && <span className="cn-zoom-lbl">{Math.round(zoom)}%</span>}
              </div>
            </div>

            <div className="cn-tool-right">
              {selName && <span className="cn-badge" title={`Active: ${selName}`}>{selName}</span>}
              <button className="cn-btn ghost sm" type="button" disabled={running} onClick={onCenter} title="Centre number and barcode">
                <Ic n="center" /> Centre
              </button>
              <button className={`cn-btn ghost sm ${isMaximized ? "active-mode" : ""}`} type="button" onClick={toggleMaximize} title={isMaximized ? "Restore sidebars" : "Maximize preview (hide sidebars)"}>
                <Ic n={isMaximized ? "shrink" : "expand"} /> {isMaximized ? "Restore" : "Maximize"}
              </button>
              {!propsOpen && (
                <button className="cn-btn ghost sm" type="button" title="Show inspector panel" onClick={() => setPropsOpen(true)}>
                  <Ic n="panelRight" /> Inspector
                </button>
              )}
            </div>
          </div>

          <div className="cn-canvas-wrap">
            <canvas
              ref={cvRef}
              tabIndex={0}
              className={`cn-preview-canvas ${zoom === "fit" ? "fit-mode" : ""}`}
              style={zoom !== "fit" ? { width: `${zoom}%`, maxWidth: "none", maxHeight: "none" } : undefined}
              aria-label="Certificate preview canvas. Click and drag elements to position them."
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onDoubleClick={onDbl}
              onKeyDown={onKey}
            />
          </div>

          <div className="cn-hints">
            <span><b>Tip:</b> Click &amp; drag elements on the canvas.</span>
            <span>Arrow keys nudge position (Shift = 5 mm).</span>
            <span>Double-click an element to show edge distance guides (Esc hides).</span>
            {f.noArt && <span className="warn">Artwork background is hidden on output.</span>}
          </div>
        </section>

        {/* ---------- right: selected element inspector ---------- */}
        <aside className="cn-props" aria-label="Element properties">
          <div className="cn-panel-header">
            <div className="cn-panel-title">
              <span className="cn-props-dot" />
              <span>Inspector</span>
            </div>
            <button className="cn-icon-btn" type="button" title="Collapse inspector" onClick={() => setPropsOpen(false)}>
              <Ic n="panelRight" />
            </button>
          </div>

          <div className="cn-props-body">
            <div className="cn-props-head-info">
              <span className="cn-props-tag">Active Selection</span>
              <strong className="cn-props-n">{selName || "Nothing selected"}</strong>
            </div>

            {props}

            {measure && (
              <div className="cn-meas">
                <b>Measuring Distances</b>
                <span>X: {r1(getPos(measure)[0])} mm</span>
                <span>Y: {r1(getPos(measure)[1])} mm</span>
                <small>Distance guides from all 4 page edges are active. Press Esc to clear.</small>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ---------- generation footer bar ---------- */}
      <footer className="cn-gen">
        <div className="cn-gen-info">
          <div className="cn-gen-stats">
            <b>{count.toLocaleString()} certificates</b>
            <span className="cn-badge-inline">{okRange ? `${pad(p.from, p.digits)} → ${pad(p.to, p.digits)}` : "Set range"}</span>
            {sheet && <span className="cn-muted">Excel: {sheet.count.toLocaleString()} rows</span>}
          </div>
          <div className="cn-bar" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
          <div className={`cn-status ${status.cls}`} role="status" aria-live="polite">
            {status.cls === "ok" && status.msg.startsWith("Done") ? "✓ " : ""}{status.msg}
          </div>
        </div>

        <div className="cn-gen-btns">
          <button className="cn-btn primary" type="button" disabled={running} onClick={() => generate("pdf")}>
            <Ic n="down" /> Download PDF
          </button>
          <button className="cn-btn ghost" type="button" disabled={running} onClick={() => generate("zip")}>
            Download Images (ZIP)
          </button>
          {running && (
            <button className="cn-btn stop" type="button" onClick={() => { stopFlag.current = true; }}>
              <Ic n="stop" /> Stop
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ---------- helpers that depend on your app's auth storage ---------- */
function authHeaders() {
  const h = { "Content-Type": "application/json" };
  const t = localStorage.getItem("token");
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}
function whoAmI() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.username || u.name || u.email || "";
  } catch { return ""; }
}

const CSS = `
.cn-root{
  --bg:#f1f4f6;--surface:#ffffff;--ink:#0b2730;--muted:#5c737d;--line:#dce3e7;--line2:#c5d2d8;
  --accent:#0f7f96;--accent-d:#0a6678;--accent-soft:#e6f3f6;--err:#b3261e;--ok:#137358;
  --shadow:0 1px 3px rgba(11,39,48,.05),0 6px 18px rgba(11,39,48,.06);
  position:relative;
  display:flex;flex-direction:column;height:calc(100dvh - 16px);min-height:540px;width:100%;max-width:100%;
  background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:10px;overflow:hidden;
  font:13px/1.4 "Figtree","Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
}
.cn-root *,.cn-root *::before,.cn-root *::after{box-sizing:border-box}
.cn-ic{flex:0 0 auto}

/* loading overlay (artwork upload) */
.cn-busy{
  position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  background:rgba(241,244,246,.82);backdrop-filter:blur(2px);cursor:progress;
}
.cn-busy b{font-size:14px}
.cn-busy span{font-size:11.5px;color:var(--muted)}
.cn-spin{
  width:34px;height:34px;border-radius:50%;border:3px solid var(--line2);border-top-color:var(--accent);
  animation:cn-rot .8s linear infinite;
}
@keyframes cn-rot{to{transform:rotate(360deg)}}

/* workspace grid: defaults to 280px left, 1fr center, 225px right */
.cn-work{
  flex:1;min-height:0;display:grid;
  grid-template-columns:280px minmax(0,1fr) 225px;
  gap:8px;padding:6px;transition:grid-template-columns .2s ease;
}
.cn-work.no-side{grid-template-columns:0px minmax(0,1fr) 225px}
.cn-work.no-props{grid-template-columns:280px minmax(0,1fr) 0px}
.cn-work.no-side.no-props{grid-template-columns:0px minmax(0,1fr) 0px}

.cn-side,.cn-stage,.cn-props{
  background:var(--surface);border:1px solid var(--line);border-radius:8px;
  box-shadow:var(--shadow);min-height:0;min-width:0;
}

/* collapsible panels */
.cn-side,.cn-props{display:flex;flex-direction:column;overflow:hidden;transition:opacity .15s}
.cn-work.no-side .cn-side,.cn-work.no-props .cn-props{
  opacity:0;pointer-events:none;border:none;margin:0;padding:0;
}

.cn-panel-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:7px 10px;background:var(--surface);border-bottom:1px solid var(--line);
}
.cn-panel-title{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--ink)}
.cn-icon-btn{
  background:transparent;border:none;color:var(--muted);cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;
  width:24px;height:24px;border-radius:5px;
}
.cn-icon-btn:hover{background:var(--accent-soft);color:var(--accent-d)}

.cn-side form{flex:1;min-height:0;overflow-y:auto;padding:6px;display:flex;flex-direction:column;gap:6px}

/* sections inside accordion */
.cn-sec{border:1px solid var(--line);border-radius:7px;background:var(--surface)}
.cn-sec>summary,.cn-col>summary{list-style:none;cursor:pointer}
.cn-sec>summary::-webkit-details-marker,.cn-col>summary::-webkit-details-marker{display:none}
.cn-sec>summary{display:flex;align-items:center;gap:7px;padding:8px 10px;font-size:12.5px;font-weight:700;position:relative}
.cn-sec>summary em{font-style:normal;font-size:10px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:4px;padding:1px 4px}
.cn-sec>summary::after{content:"";margin-left:auto;width:6px;height:6px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);transition:transform .15s}
.cn-sec[open]>summary::after{transform:rotate(-135deg)}
.cn-sec[open]>summary{border-bottom:1px solid var(--line)}
.cn-body{padding:8px 10px 10px;display:flex;flex-direction:column;gap:8px}

/* fields layout */
.cn-row{display:grid;grid-template-columns:repeat(12,1fr);gap:6px;align-items:end}
.cn-s2{grid-column:span 2}.cn-s3{grid-column:span 3}.cn-s4{grid-column:span 4}.cn-s5{grid-column:span 5}.cn-s6{grid-column:span 6}.cn-s8{grid-column:span 8}.cn-s12{grid-column:span 12}
.cn-f{display:flex;flex-direction:column;gap:2px;min-width:0}
.cn-f>span:first-child{font-size:11px;font-weight:600;color:var(--muted)}
.cn-root input[type=text],.cn-root input[type=number],.cn-root select{
  width:100%;height:28px;padding:0 7px;font:inherit;color:var(--ink);background:#fff;border:1px solid var(--line2);border-radius:6px;
}
.cn-root input[type=color]{width:100%;height:28px;padding:1px;background:#fff;border:1px solid var(--line2);border-radius:6px;cursor:pointer}
.cn-root input:disabled{opacity:.5;cursor:not-allowed}
.cn-root input:focus-visible,.cn-root select:focus-visible,.cn-root button:focus-visible,.cn-root canvas:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.cn-mm{position:relative}
.cn-mm input{padding-right:26px!important}
.cn-mm::after{content:"mm";position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:10.5px;color:var(--muted);pointer-events:none}
.cn-f.cn-chk{flex-direction:row;align-items:center;gap:6px;height:28px;cursor:pointer}
.cn-f.cn-chk span{font-size:12px;font-weight:600;color:var(--ink)}
.cn-chk input{width:14px;height:14px;accent-color:var(--accent);margin:0}
.cn-info{font-size:11px;color:var(--muted)}

/* switches */
.cn-sw{flex-direction:row;align-items:center;gap:7px;height:28px;cursor:pointer;position:relative}
.cn-sw input{position:absolute;opacity:0;width:32px;height:18px;margin:0;cursor:pointer}
.cn-sw i{flex:0 0 auto;width:32px;height:18px;border-radius:999px;background:var(--line2);position:relative;transition:background .15s}
.cn-sw i::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s}
.cn-sw input:checked+i{background:var(--accent)}
.cn-sw input:checked+i::after{transform:translateX(14px)}
.cn-sw>span{font-size:12px;font-weight:600}

/* buttons */
.cn-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:5px;
  height:30px;padding:0 10px;border-radius:6px;font:600 12px/1 inherit;border:1px solid var(--accent);
  cursor:pointer;white-space:nowrap;background:var(--accent);color:#fff;
}
.cn-btn.primary{background:var(--accent);color:#fff;font-weight:700}
.cn-btn:hover:not(:disabled){background:var(--accent-d)}
.cn-btn:disabled{opacity:.5;cursor:not-allowed}
.cn-btn.ghost{background:#fff;color:var(--accent-d);border-color:var(--line2)}
.cn-btn.ghost:hover:not(:disabled){background:var(--accent-soft)}
.cn-btn.ghost.active-mode{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-d)}
.cn-btn.danger{color:var(--err)}
.cn-btn.stop{background:var(--err);border-color:var(--err);color:#fff}
.cn-btn.sm{height:25px;padding:0 8px;font-size:11.5px}
.cn-actions{grid-column:1/-1;display:flex;gap:6px}
.cn-actions .cn-btn{flex:1}

/* drop zone */
.cn-drop{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;padding:10px 8px;border:1.5px dashed var(--line2);border-radius:8px;background:var(--bg);cursor:pointer;color:var(--muted)}
.cn-drop:hover{border-color:var(--accent);background:var(--accent-soft)}
.cn-drop strong{color:var(--ink);font-size:12px}
.cn-drop small{font-size:10.5px}
.cn-file{display:flex;flex-direction:column;gap:1px;font-size:11.5px;color:var(--muted);min-width:0}
.cn-file b{color:var(--ink);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cn-range{display:flex;align-items:baseline;gap:4px 10px;flex-wrap:wrap;padding:6px 8px;border-radius:6px;background:var(--accent-soft);border:1px solid #b9dce4}
.cn-range strong{font-size:13.5px;font-variant-numeric:tabular-nums;color:var(--accent-d)}
.cn-range span{font-size:11.5px;color:var(--muted)}

/* excel column item */
.cn-col{border:1px solid var(--line);border-radius:6px;background:#fff}
.cn-col.off{opacity:.75}
.cn-col>summary{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 8px}
.cn-col>summary .cn-chk span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px}
.cn-col .cn-mini span{font-weight:500;color:var(--muted);font-size:11px}
.cn-col[open]>summary{border-bottom:1px solid var(--line)}
.cn-col>.cn-row{padding:6px 8px 8px}

/* large stage */
.cn-stage{display:flex;flex-direction:column;overflow:hidden;position:relative}
.cn-tool{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:5px 10px;border-bottom:1px solid var(--line);background:#fafbfc;flex-wrap:nowrap;
}
.cn-tool-left,.cn-tool-center,.cn-tool-right{display:flex;align-items:center;gap:6px}
.cn-tool-left strong{font-size:13px;font-weight:700}
.cn-rowsel{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted)}
.cn-rowsel input{width:50px!important;height:24px!important;padding:0 4px}
.cn-dim{font-size:11.5px;color:var(--muted);background:var(--bg);border:1px solid var(--line);padding:1px 6px;border-radius:4px}
.cn-badge{font-size:11px;font-weight:700;color:var(--accent-d);background:var(--accent-soft);border:1px solid #b9dce4;border-radius:5px;padding:2px 7px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* zoom toolbar */
.cn-zoom-group{display:inline-flex;align-items:center;background:#fff;border:1px solid var(--line2);border-radius:6px;overflow:hidden;height:26px}
.cn-zoom-btn{background:transparent;border:none;border-right:1px solid var(--line2);padding:0 7px;height:100%;color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600}
.cn-zoom-btn:last-child{border-right:none}
.cn-zoom-btn:hover{background:var(--accent-soft);color:var(--accent-d)}
.cn-zoom-btn.active{background:var(--accent-soft);color:var(--accent-d)}
.cn-zoom-lbl{padding:0 6px;font-size:11px;font-weight:600;color:var(--muted)}

/* canvas view wrap */
.cn-canvas-wrap{
  flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:10px;overflow:auto;
  background-color:#e9edf0;background-image:radial-gradient(#c7d3db 1px,transparent 1px);background-size:20px 20px;
}
.cn-preview-canvas{
  display:block;box-shadow:0 3px 6px rgba(11,39,48,.1),0 16px 40px rgba(11,39,48,.2);
  touch-action:none;background:#fff;
}
.cn-preview-canvas.fit-mode{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}

.cn-hints{
  display:flex;flex-wrap:wrap;gap:4px 14px;padding:5px 10px;border-top:1px solid var(--line);
  font-size:11px;color:var(--muted);background:#fafbfc;
}
.cn-hints .warn{color:#8a5a00;font-weight:600}

/* right inspector */
.cn-props-body{padding:8px 10px;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.cn-props-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);display:inline-block}
.cn-props-head-info{display:flex;flex-direction:column;gap:1px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.cn-props-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.cn-props-n{font-size:13.5px;color:var(--ink);overflow-wrap:anywhere}
.cn-meas{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:6px;background:#fff4ee;border:1px solid #f3cdb9;font-size:11.5px}
.cn-meas b{color:#d9480f}

/* generation footer bar */
.cn-gen{
  display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 12px;
  background:var(--surface);border-top:1px solid var(--line);box-shadow:0 -2px 10px rgba(11,39,48,.04);
}
.cn-gen-info{flex:1 1 280px;min-width:0;display:flex;flex-direction:column;gap:3px}
.cn-gen-stats{display:flex;gap:4px 10px;align-items:center;font-size:12px}
.cn-badge-inline{font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:var(--accent-soft);color:var(--accent-d)}
.cn-muted{color:var(--muted);font-size:11.5px}
.cn-bar{height:5px;border-radius:5px;background:var(--line);overflow:hidden}
.cn-bar i{display:block;height:100%;background:var(--accent);transition:width .15s}
.cn-status{font-size:11.5px;color:var(--muted);min-height:14px}
.cn-status.err{color:var(--err)}.cn-status.ok{color:var(--ok);font-weight:600}
.cn-gen-btns{display:flex;gap:6px;flex-wrap:wrap}

/* responsive adjustments */
@media (max-width:1080px){
  .cn-work{grid-template-columns:260px minmax(0,1fr) 200px}
}
@media (max-width:880px){
  .cn-root{height:auto;overflow:visible}
  .cn-work{display:flex;flex-direction:column}
  .cn-stage{order:-1;min-height:480px}
  .cn-canvas-wrap{min-height:360px}
}
`;