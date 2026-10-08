import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
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
const toBlob = (cv, type, q) => new Promise((res) => cv.toBlob(res, type, q));
const loadImg = (blob) =>
  new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Could not read that image. Use PNG, JPG, WebP or PDF."));
    img.src = url;
  });

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
  try { await pdf.destroy(); } catch { /* ignore */ }
  return { blob, dpi: Math.round(scale * 72), pages };
}

/* ---------- render one certificate (row = Excel row for this certificate, if any) ---------- */
function render(S, ctx, n, s, p, preview, row) {
  const u = p.dpi / 25.4, px = (p.pt * p.dpi) / 72, val = pad(n, p.digits);
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, S.w, S.h);
  // the preview always shows the artwork (for positioning); the output leaves it out when ticked
  if (S.img && (preview || !p.noArt)) ctx.drawImage(S.img, 0, 0, S.w, S.h);

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
  if (preview) S.box.num = { x, y, w, h: px * 1.2 };

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
    if (preview) S.box[c.id] = { x: cx, y: cy, w: Math.max(tw, cpx * 2), h: cpx * 1.2 };
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
    if (preview) S.box.bar = { x: p.bx * u, y: p.by * u, w: c.width, h: c.height };
  }
  if (p.qr) {
    const c = safe((v) => (preview ? getQR(S, v, p) : makeQR(v, p)), enc(p.qenc, false));
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(c, p.qx * u, p.qy * u);
    if (preview) S.box.qr = { x: p.qx * u, y: p.qy * u, w: c.width, h: c.height };
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

  const cvRef = useRef(null);
  const S = useRef({ img: null, w: 2480, h: 1754, box: { num: null, bar: null, qr: null }, bc: new Map(), rows: [], cols: [], blob: null, tplCols: new Map() }).current;
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
      const s = Math.min(1, 1400 / S.w);
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
        const k = rect.width && cv.width ? rect.width / cv.width : 1;   // how much the canvas is shrunk on screen
        drawMeasure(ctx, S, mb, p.dpi / 25.4, k, s);
      }
      ctx.restore();
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
    setDims({ w: S.w, h: S.h });
    setArtName(`${label} · ${S.w}×${S.h}px`);
  };
  const clearArt = () => {
    S.img = null; S.blob = null; S.w = 2480; S.h = 1754;
    setDims({ w: S.w, h: S.h });
    setArtName("None — blank A4 landscape");
  };

  /* image (PNG/JPG/WebP) or PDF (first page) */
  const onArt = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      let blob = file, label = file.name, dpiFix = null;
      if (isPdf) {
        say("Reading PDF…");
        const r = await rasterPdf(file, P(fRef.current).dpi);
        blob = r.blob; dpiFix = r.dpi;
        label = r.pages > 1 ? `${file.name} (page 1 of ${r.pages})` : file.name;
      }
      const img = await loadImg(blob);
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
      setF({ ...next, ...c });
      say(isPdf && dpiFix && dpiFix !== P(fRef.current).dpi ? `PDF read. Artwork DPI set to ${dpiFix} so millimetres stay exact.` : "");
    } catch (err) {
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
      const r = await fetch(`${API}/api/numbering-templates`, { headers: authHeaders() });
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
      setTplId("");
      setTplName("");
      await loadTpls();
      say(`Template "${t.name}" deleted.`, "ok");
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
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
      if (aoa.length < 2) throw new Error("the first sheet needs a header row and at least one data row.");

      const seen = {};
      const headers = aoa[0].map((h, i) => {
        let name = String(h).trim() || `Column ${i + 1}`;
        if (seen[name]) { seen[name] += 1; name = `${name} (${seen[name]})`; } else seen[name] = 1;
        return name;
      });
      const rows = aoa.slice(1)
        .map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? "").trim()])))
        .filter((r) => headers.some((h) => r[h] !== ""));
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
        const t = S.tplCols.get(h);   // styling from the loaded template, if this header is in it
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
    const ctx = off.getContext("2d");
    const wpt = (S.w * 72) / p.dpi, hpt = (S.h * 72) / p.dpi, orient = S.w >= S.h ? "l" : "p";
    let done = 0;

    try {
      for (let a = p.from; a <= p.to && !stopFlag.current; a += p.per) {
        const b = Math.min(p.to, a + p.per - 1);
        const base = `certificates_${pad(a, p.digits)}-${pad(b, p.digits)}`;
        let pdf = null, zip = null;
        if (kind === "pdf") pdf = new jsPDF({ orientation: orient, unit: "pt", format: [wpt, hpt], compress: true });
        else zip = new JSZip();

        for (let n = a; n <= b && !stopFlag.current; n++) {
          render(S, ctx, n, 1, p, false, S.rows[n - p.from]);
          if (pdf) {
            if (n > a) pdf.addPage([wpt, hpt], orient);
            pdf.addImage(off.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, wpt, hpt, "", "FAST");
          } else {
            const blob = await new Promise((res) => off.toBlob(res, "image/jpeg", 0.95));
            zip.file(`${pad(n, p.digits)}.jpg`, blob);
          }
          done++;
          setProgress((done / total) * 100);
          if (done % 4 === 0) { say(`Rendering ${done.toLocaleString()} of ${total.toLocaleString()}…`); await tick(); }
        }
        if (stopFlag.current) break;
        const blob = pdf ? pdf.output("blob") : await zip.generateAsync({ type: "blob", compression: "STORE" });
        saveBlob(`${base}.${pdf ? "pdf" : "zip"}`, blob);
      }
      if (stopFlag.current) say("Stopped.");
      else say(`Done. ${total.toLocaleString()} certificates generated${reprint ? " (re-print of an issued range)" : ""}.`, "ok");
    } catch (err) {
      say("Failed: " + (err.message || err), "err");
    } finally {
      setRunning(false);
    }
  }

  /* ---------- view ---------- */
  const p = P(f);
  const okRange = Number.isInteger(p.from) && Number.isInteger(p.to) && p.to >= p.from;
  const summary = okRange
    ? `${(p.to - p.from + 1).toLocaleString()} certificates · ${pad(p.from, p.digits)} to ${pad(p.to, p.digits)} · ${dims.w}×${dims.h}px${sheet ? ` · Excel ${sheet.count.toLocaleString()} rows` : ""}`
    : "Enter a valid From / To range";

  const encOptions = (
    <>
      <option value={SERIAL}>Serial number</option>
      {sheet && sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
    </>
  );

  return (
    <div className="cn-root">
      <style>{CSS}</style>

      <section className="cn-glass cn-panel">
        <div className="cn-head">
          <div className="cn-logo" aria-hidden="true">No.</div>
          <div>
            <h1>Certificate numbering</h1>
            <p>Serial numbers, Excel data, Code 128 and QR on your artwork</p>
          </div>
        </div>

        <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div className="cn-cap">Template</div>
          <div className="cn-row">
            <Field span={6} label="Saved templates">
              <select value={tplId} onChange={(e) => applyTemplate(e.target.value)} disabled={tplBusy}>
                <option value="">{tpls.length ? "— choose to load —" : "— none saved yet —"}</option>
                {tpls.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </Field>
            <Field span={6} label="Template name">
              <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Cheque A4" />
            </Field>
            <div className="cn-actions">
              <button className="cn-btn" type="button" onClick={saveTemplate} disabled={tplBusy}>{tplBusy ? "Working…" : "Save template"}</button>
              <button className="cn-btn ghost" type="button" onClick={deleteTemplate} disabled={tplBusy || !tplId}>Delete</button>
            </div>
          </div>

          <div className="cn-cap">Artwork</div>
          <div className="cn-row">
            <label className="cn-f cn-s5">
              <span>Base artwork (PNG / JPG / WebP / PDF)</span>
              <span className="cn-pick">
                <input type="file" accept="image/*,application/pdf,.pdf" hidden onChange={onArt} />
                <span className="cn-btn ghost">Choose image / PDF</span>
                <em>{artName}</em>
              </span>
            </label>
            <Field span={2} label="Artwork DPI"><input type="number" min="36" max="1200" value={f.dpi} onChange={set("dpi")} /></Field>
            <Field span={5} label="Series"><input type="text" value={f.series} onChange={set("series")} /></Field>
            <label className="cn-f cn-chk cn-s12">
              <input type="checkbox" checked={f.noArt} onChange={set("noArt")} />
              <span>Remove background image when generating</span>
            </label>
          </div>

          <div className="cn-cap">Numbering</div>
          <div className="cn-row">
            <Field span={6} label="Static word"><input type="text" value={f.word} onChange={set("word")} /></Field>
            <Field span={3} label="Word colour"><input type="color" value={f.wc} onChange={set("wc")} /></Field>
            <Field span={3} label="Number colour"><input type="color" value={f.nc} onChange={set("nc")} /></Field>
          </div>
          <div className="cn-row">
            <Field span={4} label="From *"><input type="number" min="0" value={f.from} onChange={set("from")} /></Field>
            <Field span={4} label="To *"><input type="number" min="0" value={f.to} onChange={set("to")} /></Field>
            <Field span={4} label="Digits (zero-pad)"><input type="number" min="1" max="20" value={f.digits} onChange={set("digits")} /></Field>
          </div>

          <div className="cn-cap">Text</div>
          <div className="cn-row">
            <Field span={12} label="Font name *">
              <select value={f.font} onChange={set("font")}>
                {fonts.map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
          </div>
          <div className="cn-row">
            <Field span={3} label="Font size (pt) *"><input type="number" min="1" step="0.5" value={f.pt} onChange={set("pt")} /></Field>
            <label className="cn-f cn-chk cn-s3"><input type="checkbox" checked={f.bold} onChange={set("bold")} /><span>Bold</span></label>
            <Field span={3} label="Number X (mm)"><input type="number" step="0.5" value={f.nx} onChange={set("nx")} /></Field>
            <Field span={3} label="Number Y (mm)"><input type="number" step="0.5" value={f.ny} onChange={set("ny")} /></Field>
          </div>

          <div className="cn-cap">Barcode</div>
          <div className="cn-row">
            <label className="cn-f cn-chk cn-s3"><input type="checkbox" checked={f.bar} onChange={set("bar")} /><span>Code 128</span></label>
            <Field span={3} label="Width (mm)"><input type="number" min="5" step="1" value={f.bw} onChange={set("bw")} /></Field>
            <Field span={3} label="Height (mm)"><input type="number" min="2" step="0.5" value={f.bh} onChange={set("bh")} /></Field>
            <label className="cn-f cn-chk cn-s3"><input type="checkbox" checked={f.qz} onChange={set("qz")} /><span>Quiet zone</span></label>
          </div>
          <div className="cn-row">
            <Field span={3} label="Barcode X (mm)"><input type="number" step="0.5" value={f.bx} onChange={set("bx")} /></Field>
            <Field span={3} label="Barcode Y (mm)"><input type="number" step="0.5" value={f.by} onChange={set("by")} /></Field>
            <Field span={6} label="Barcode encodes"><select value={f.benc} onChange={set("benc")}>{encOptions}</select></Field>
          </div>

          <div className="cn-cap">QR code</div>
          <div className="cn-row">
            <label className="cn-f cn-chk cn-s3"><input type="checkbox" checked={f.qr} onChange={set("qr")} /><span>QR code</span></label>
            <Field span={3} label="Size (mm)"><input type="number" min="8" step="1" value={f.qs} onChange={set("qs")} /></Field>
            <Field span={3} label="QR X (mm)"><input type="number" step="0.5" value={f.qx} onChange={set("qx")} /></Field>
            <Field span={3} label="QR Y (mm)"><input type="number" step="0.5" value={f.qy} onChange={set("qy")} /></Field>
          </div>
          <div className="cn-row">
            <Field span={6} label="QR encodes"><select value={f.qenc} onChange={set("qenc")}>{encOptions}</select></Field>
            <Field span={6} label="Pages per output file"><input type="number" min="1" value={f.per} onChange={set("per")} /></Field>
          </div>

          <div className="cn-cap">Excel data</div>
          <div className="cn-row">
            <label className="cn-f cn-s8">
              <span>Excel file (.xlsx / .xls / .csv) · row 1 = headers</span>
              <span className="cn-pick">
                <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onSheet} />
                <span className="cn-btn ghost">Choose Excel</span>
                <em>{sheet ? `${sheet.name} · ${sheet.count.toLocaleString()} rows` : "None"}</em>
              </span>
            </label>
            <Field span={4} label="Preview row">
              <input type="number" min="1" max={sheet ? sheet.count : 1} value={pv} disabled={!sheet} onChange={(e) => setPv(e.target.value)} />
            </Field>
          </div>
          {sheet && (
            <>
              <div className="cn-info">First data row prints on the "From" number, the next row on the next number, and so on. Tick the columns to print, then drag them on the preview.</div>
              {cols.map((c) => (
                <div key={c.id} className={`cn-col${c.on ? "" : " off"}`} onFocus={() => setSel(c.id)}>
                  <div className="cn-row">
                    <label className="cn-f cn-chk cn-s8"><input type="checkbox" checked={c.on} onChange={setCol(c.id, "on")} /><span title={c.header}>{c.header}</span></label>
                    <label className="cn-f cn-chk cn-s4"><input type="checkbox" checked={c.label} onChange={setCol(c.id, "label")} /><span>Show name</span></label>
                  </div>
                  <div className="cn-row">
                    <Field span={4} label="Size (pt)"><input type="number" min="1" step="0.5" value={c.pt} onChange={setCol(c.id, "pt")} /></Field>
                    <Field span={4} label="Value colour"><input type="color" value={c.color} onChange={setCol(c.id, "color")} /></Field>
                    <Field span={4} label="Name colour"><input type="color" value={c.lc || c.color} disabled={!c.label} onChange={setCol(c.id, "lc")} /></Field>
                  </div>
                  <div className="cn-row">
                    <Field span={6} label="X (mm)"><input type="number" step="0.5" value={c.x} onChange={setCol(c.id, "x")} /></Field>
                    <Field span={6} label="Y (mm)"><input type="number" step="0.5" value={c.y} onChange={setCol(c.id, "y")} /></Field>
                  </div>
                </div>
              ))}
              <button className="cn-btn ghost" type="button" style={{ alignSelf: "flex-start" }} onClick={removeSheet}>Remove Excel</button>
            </>
          )}

          <div className="cn-actions">
            <button className="cn-btn" type="button" disabled={running} onClick={() => generate("pdf")}>Download PDF</button>
            <button className="cn-btn ghost" type="button" disabled={running} onClick={() => generate("zip")}>Download images (ZIP)</button>
            <button
              className="cn-btn ghost"
              type="button"
              disabled={running}
              onClick={async () => { const c = await centerLayout(f, S.w, S.h); setF((o) => ({ ...o, ...c })); }}
            >
              Center
            </button>
            {running && <button className="cn-btn ghost stop" type="button" onClick={() => { stopFlag.current = true; }}>Stop</button>}
          </div>
          <div className="cn-bar" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
          <div className={`cn-status ${status.cls}`} role="status" aria-live="polite">{status.msg}</div>
        </form>
      </section>

      <section className="cn-glass cn-stage">
        <div className="cn-stage-top">
          <span>
            {summary}
            {f.noArt && " · background image will not be printed"}
            {nextFree != null && ` · next free in "${f.series.trim()}": ${pad(nextFree, p.digits)}`}
          </span>
          <span>Drag the number, barcode, QR or Excel fields to move · double-click one to see its distance from the page edges (Esc hides) · arrow keys nudge (Shift = 5 mm)</span>
        </div>
        <div className="cn-canvas-wrap">
          <canvas
            ref={cvRef}
            tabIndex={0}
            aria-label="Certificate preview. Drag to move the number, barcode, QR or Excel fields. Double-click a field to show its distance from the page edges."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDoubleClick={onDbl}
            onKeyDown={onKey}
          />
        </div>
      </section>
    </div>
  );
}

/* ---------- helpers that depend on your app's auth storage (adjust if different) ---------- */
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
  --glass:rgba(255,255,255,.78);--glass-b:rgba(255,255,255,.95);
  --ink:#0b2b33;--muted:#2f5560;--label:#0b2b33;--line:rgba(16,52,61,.26);
  --field:rgba(255,255,255,.95);--accent:#0f7f96;--accent-ink:#fff;
  --head:rgba(255,255,255,.85);--ghost:rgba(15,127,150,.12);--ghost-ink:#0a5f72;
  --err:#b3261e;--ok:#17715a;--canvas-bg:rgba(255,255,255,.35);
  --cn-h:calc(100dvh - 28px);
  display:grid;grid-template-columns:clamp(300px,30vw,420px) minmax(0,1fr);gap:14px;align-items:stretch;height:var(--cn-h);color:var(--ink);
  width:100%;max-width:100%;
  font:13px/1.35 "Figtree",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
}
.cn-root *,.cn-root *::before,.cn-root *::after{box-sizing:border-box}
.cn-glass{background:var(--glass);border:1px solid var(--glass-b);border-radius:16px;
  -webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);
  box-shadow:0 6px 24px rgba(20,90,110,.10)}
.cn-panel{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.cn-panel form{flex:1;min-height:0;overflow-y:auto}
.cn-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--head);border-bottom:1px solid var(--glass-b)}
.cn-logo{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:700;font-size:12px;color:var(--accent);
  background:linear-gradient(145deg,rgba(255,255,255,.95),rgba(190,235,246,.7));border:1px solid var(--glass-b);box-shadow:0 2px 8px rgba(20,90,110,.14)}
.cn-head h1{margin:0;font-size:15px;font-weight:700;color:var(--ink)}
.cn-head p{margin:0;font-size:12px;color:var(--muted)}
.cn-root form{padding:10px 14px 14px;display:flex;flex-direction:column;gap:9px}
.cn-cap{font-size:12.5px;font-weight:700;color:var(--ink);margin:2px 0 -2px;display:flex;align-items:center;gap:8px;letter-spacing:.02em}
.cn-cap::after{content:"";flex:1;height:1px;background:var(--line)}
.cn-row{display:grid;grid-template-columns:repeat(12,1fr);gap:7px;align-items:end}
.cn-s2{grid-column:span 2}.cn-s3{grid-column:span 3}.cn-s4{grid-column:span 4}.cn-s5{grid-column:span 5}.cn-s6{grid-column:span 6}.cn-s8{grid-column:span 8}.cn-s12{grid-column:span 12}
.cn-f{display:flex;flex-direction:column;gap:3px;min-width:0}
.cn-f>span{font-size:12px;font-weight:600;color:var(--label);line-height:1.25}
.cn-f>span.cn-pick{font-weight:400;color:var(--ink)}
.cn-root input[type=text],.cn-root input[type=number],.cn-root select{
  width:100%;height:30px;padding:0 8px;font:inherit;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px}
.cn-root input[type=color]{width:100%;height:30px;padding:2px;background:var(--field);border:1px solid var(--line);border-radius:8px;cursor:pointer}
.cn-root input:disabled{opacity:.55;cursor:not-allowed}
.cn-root input:focus-visible,.cn-root select:focus-visible,.cn-root button:focus-visible,.cn-root canvas:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.cn-f.cn-chk{flex-direction:row;align-items:center;gap:6px;height:30px;cursor:pointer}
.cn-f.cn-chk span{font-size:12.5px;font-weight:600;color:var(--ink)}
.cn-chk input{width:15px;height:15px;accent-color:var(--accent);margin:0;flex:0 0 auto}
.cn-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;border-radius:8px;
  font:600 12.5px/1 inherit;font-family:inherit;border:1px solid transparent;cursor:pointer;white-space:nowrap;background:var(--accent);color:var(--accent-ink)}
.cn-btn:disabled{opacity:.5;cursor:not-allowed}
.cn-btn.ghost{background:var(--ghost);color:var(--ghost-ink);border-color:var(--line)}
.cn-actions{grid-column:1/-1;display:flex;gap:8px}
.cn-btn:disabled{opacity:.55;cursor:default}
.cn-pick{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0}
.cn-pick em{font-style:normal;font-weight:400;color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cn-info{font-size:12px;color:var(--muted)}
.cn-col{display:flex;flex-direction:column;gap:6px;padding:7px 8px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.55)}
.cn-col.off{opacity:.7}
.cn-col .cn-chk span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cn-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:2px}
.cn-actions .cn-btn{flex:1 1 auto;height:34px;min-width:0}
.cn-actions .stop{flex:0 0 auto}
.cn-bar{height:5px;border-radius:5px;background:var(--line);overflow:hidden}
.cn-bar i{display:block;height:100%;background:var(--accent);transition:width .15s}
.cn-status{font-size:12px;color:var(--muted);min-height:16px}
.cn-status.err{color:var(--err)}.cn-status.ok{color:var(--ok)}
.cn-stage{padding:12px;display:flex;flex-direction:column;gap:8px;min-height:0;min-width:0;overflow:hidden}
.cn-stage-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;font-size:12.5px;font-weight:500;color:var(--muted)}
.cn-stage-top>span{min-width:0;overflow-wrap:anywhere}
.cn-canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--canvas-bg);border:1px dashed var(--line);padding:12px;min-height:0;overflow:auto}
.cn-canvas-wrap canvas{display:block;max-width:100%;max-height:calc(100vh - 160px);height:auto;box-shadow:0 8px 30px rgba(10,70,90,.25);background:#fff;touch-action:none}
@media (max-height:700px){
  .cn-panel{position:static}
}
@media (max-width:900px){
  .cn-root{grid-template-columns:1fr}
  .cn-panel{position:static}
  .cn-stage{min-height:0}
  .cn-canvas-wrap canvas{max-height:none}
}
@media (max-width:480px){
  .cn-root{gap:10px}
  .cn-root form{padding:10px}
  .cn-row{grid-template-columns:repeat(6,1fr)}
  .cn-s2,.cn-s3,.cn-s4{grid-column:span 3}
  .cn-s5,.cn-s6,.cn-s8,.cn-s12{grid-column:span 6}
  .cn-stage{padding:8px}
  .cn-canvas-wrap{padding:6px}
}
`;