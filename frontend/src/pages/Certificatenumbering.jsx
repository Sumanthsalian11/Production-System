import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import * as XLSX from "xlsx";
import PdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline";

const API = import.meta.env.VITE_API_URL;

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Montserrat:wght@400;700&family=Lato:wght@400;700&family=Poppins:wght@400;700&family=Source+Sans+3:wght@400;700&display=swap";

const BASE_FONTS = [
  "Century", "Arial", "Helvetica", "Verdana", "Tahoma", "Times New Roman", "Georgia", "Courier New",
  "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins", "Source Sans 3",
];

const SERIAL = "__serial";
const CUSTOM = "__custom";

const DEFAULTS = {
  dpi: "300", series: "default", noArt: false,
  word: "S. No:", wc: "#222222", nc: "#f58220",
  from: "", to: "", digits: "6",
  font: "Arial", pt: "16", bold: true, nx: "196", ny: "12",
  bar: false, bw: "50", bh: "10", qz: true, bx: "196", by: "24", benc: SERIAL,
  qr: false, qs: "15", qx: "92", qy: "88", qenc: SERIAL,
  cpre: "", cst: "1", cdg: "3",
  qpre: "", qst: "1", qdg: "3",
  per: "500",
  mode: "normal", ups: "5", ucols: "2", ugap: "0",
};

const pad = (n, d) => String(n).padStart(d, "0");
const blankSlot = () => ({
  img: null, blob: null, prev: null, w: 2480, h: 1754,
  name: "None — blank A4 landscape", box: { num: null, bar: null, qr: null },
});
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
  cpre: f.cpre || "", cst: parseInt(f.cst, 10) || 0, cdg: Math.max(1, parseInt(f.cdg, 10) || 1),
  qpre: f.qpre || "", qst: parseInt(f.qst, 10) || 0, qdg: Math.max(1, parseInt(f.qdg, 10) || 1),
  dpi: Math.max(36, parseInt(f.dpi, 10) || 300),
  per: Math.max(1, parseInt(f.per, 10) || 500),
  mode: f.mode,
  ups: Math.max(1, parseInt(f.ups, 10) || 1),
  ucols: Math.max(1, parseInt(f.ucols, 10) || 1),
  ugap: Math.max(0, num(f.ugap)),
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
const JPG_Q = 0.85;               // JPEG quality used for simplex PDF pages
const PATCH_Q = 0.8;                    // quality of the number / Excel-text patches
const BG_MAX = 1.2 * 1024 * 1024;       // artwork stays lossless only if it compresses below this
const BG_Q = 0.85;                      // otherwise it is stored as a JPEG at this quality
const PDF_TARGET = 3.5 * 1024 * 1024;   // target size of each PDF file             // PDF export: quality of the small number/barcode/QR patches
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
  let bg = 0, shared = [], resId = 0;
  const imageObj = (blob, wPx, hPx, filter, gray) => {
    const id = nextId++;
    begin(id);
    text(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} ${gray ? "/ColorSpace /DeviceGray /BitsPerComponent 1" : "/ColorSpace /DeviceRGB /BitsPerComponent 8"} /Filter ${filter} /Length ${blob.size} >>\nstream\n`);
    blobPart(blob);
    text("\nendstream\nendobj\n");
    return id;
  };
  text("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  return {
    get pages() { return kids.length; },
    /* the artwork is stored ONCE in the file and shared by every page */
    setBackground(blob, wPx, hPx, filter) { bg = imageObj(blob, wPx, hPx, filter); },
    /* shared 1-bit stencil (digit / word / custom text), stored once per file */
    useMask(name, blob, wPx, hPx) {
      const id = nextId++;
      begin(id);
      text(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ImageMask true /BitsPerComponent 1 /Filter /FlateDecode /Length ${blob.size} >>\nstream\n`);
      blobPart(blob);
      text("\nendstream\nendobj\n");
      shared.push(`/${name} ${id} 0 R`);
    },
    /* compact page: compressed content stream + optional patches (Excel text) */
    addCompact(z, patches) {
      let res;
      if (!patches.length) {
        if (!resId) { resId = nextId++; begin(resId); text(`<< /XObject << ${shared.join(" ")} >> >>\nendobj\n`); }
        res = `${resId} 0 R`;
      } else {
        const refs = shared.slice();
        patches.forEach((q, i) => {
          const id = q.bits ? imageObj(q.blob, q.w, q.h, "/FlateDecode", true) : imageObj(q.blob, q.w, q.h, "/DCTDecode");
          refs.push(`/P${i} ${id} 0 R`);
        });
        res = `<< /XObject << ${refs.join(" ")} >> >>`;
      }
      const cont = nextId++, page = nextId++;
      begin(cont);
      text(`<< /Filter /FlateDecode /Length ${z.size} >>\nstream\n`);
      blobPart(z);
      text("\nendstream\nendobj\n");
      begin(page);
      text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${res} /Contents ${cont} 0 R >>\nendobj\n`);
      kids.push(page);
    },
    /* a page = shared artwork + small JPEG patches (number / barcode / QR / Excel text) placed on top.
       patches: [{ blob, x, y, w, h }] in artwork pixels, k = points per pixel */
    addPage(patches, k) {
      const refs = [];
      let ops = "";
      if (bg) { refs.push(`/Bg ${bg} 0 R`); ops += `q ${W} 0 0 ${H} 0 0 cm /Bg Do Q\n`; }
      patches.forEach((q, i) => {
        const id = q.bits ? imageObj(q.blob, q.w, q.h, "/FlateDecode", true) : imageObj(q.blob, q.w, q.h, "/DCTDecode");
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
/* 1-bit black/white image -> Flate-compressed bytes (barcode / QR patches) */
const bitsBlob = (img) => {
  const { width: w, height: h, data: d } = img, rb = (w + 7) >> 3, out = new Uint8Array(rb * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4] >= 128) out[y * rb + (x >> 3)] |= 0x80 >> (x & 7);
  return new Response(new Blob([out]).stream().pipeThrough(new CompressionStream("deflate"))).blob();
};
const nextFrame = () => new Promise((r) => setTimeout(r, 30));
const deflate = (s) => new Response(new Blob([s]).stream().pipeThrough(new CompressionStream("deflate"))).blob();

/* fast "store" ZIP writer (no compression): much quicker than JSZip for hundreds of JPEG pages */
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (u8) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};
function makeZipWriter() {
  const enc = new TextEncoder();
  const parts = [], ents = [];
  let pos = 0;
  return {
    async file(name, blob) {
      const u8 = new Uint8Array(await blob.arrayBuffer());
      const nb = enc.encode(name), crc = crc32(u8), size = u8.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
      h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      ents.push({ nb, crc, size, off: pos });
      parts.push(new Uint8Array(h.buffer), nb, blob);
      pos += 30 + nb.length + size;
    },
    finish() {
      const cdStart = pos;
      for (const e of ents) {
        const d = new DataView(new ArrayBuffer(46));
        d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true);
        d.setUint16(10, 0, true); d.setUint16(12, 0, true); d.setUint16(14, 0x21, true);
        d.setUint32(16, e.crc, true); d.setUint32(20, e.size, true); d.setUint32(24, e.size, true);
        d.setUint16(28, e.nb.length, true); d.setUint32(42, e.off, true);
        parts.push(new Uint8Array(d.buffer), e.nb);
        pos += 46 + e.nb.length;
      }
      const z = new DataView(new ArrayBuffer(22));
      z.setUint32(0, 0x06054b50, true); z.setUint16(8, ents.length, true); z.setUint16(10, ents.length, true);
      z.setUint32(12, pos - cdStart, true); z.setUint32(16, cdStart, true);
      parts.push(new Uint8Array(z.buffer));
      return new Blob(parts, { type: "application/zip" });
    },
  };
}

/* text -> shared 1-bit mask, drawn at 3x so the edges stay sharp (used by the compact PDF) */
async function makeMask(lines, font, px, ul) {
  const SS = 3, pd = Math.ceil(px * 0.25);
  const mc = document.createElement("canvas").getContext("2d");
  mc.font = font;
  const wd = Math.max(1, ...lines.map((l) => mc.measureText(l).width));
  const W = Math.ceil(wd + 2 * pd), H = Math.ceil(px * 1.2 * lines.length + 2 * pd);
  const c = document.createElement("canvas");
  c.width = W * SS; c.height = H * SS;
  const x = c.getContext("2d", { alpha: false });
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.scale(SS, SS);
  x.fillStyle = "#000"; x.font = font; x.textBaseline = "top";
  lines.forEach((ln, i) => {
    const ly = pd + i * px * 1.2;
    x.fillText(ln, pd, ly);
    if (ul && ln) x.fillRect(pd, ly + px * 1.05, x.measureText(ln).width, Math.max(1, px * 0.06));
  });
  const blob = await bitsBlob(x.getImageData(0, 0, c.width, c.height));
  return { blob, w: c.width, h: c.height, pw: W, ph: H, pad: pd };
}

/* first page of a PDF -> PNG blob, rendered so that 1 page-mm = 1 artwork-mm at the returned dpi */
async function rasterPdf(file, dpi) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  }
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
    if (z.size <= BG_MAX) return { blob: z, filter: "/FlateDecode" };
    const j = await toBlob(c, "image/jpeg", BG_Q);
    if (j && j.size < z.size) return { blob: j, filter: "/DCTDecode" };
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
  if (S.img && !p.noArt) ctx.drawImage(preview ? (S.prev || S.img) : (S.bmp || S.img), 0, 0, S.w, S.h);

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

  /* custom text items */
  for (const t of S.texts || []) {
    if (!t.on || !t.text) continue;
    const tpx = ((num(t.pt) || 12) * p.dpi) / 72;
    ctx.font = `${t.italic ? "italic " : ""}${t.bold ? 700 : 400} ${tpx}px "${t.family || p.family}", sans-serif`;
    ctx.fillStyle = t.color;
    const tx = num(t.x) * u, ty = num(t.y) * u;
    const lines = String(t.text).split("\n");
    let maxW = 0;
    lines.forEach((ln, i) => {
      const ly = ty + i * tpx * 1.2;
      const lw = ctx.measureText(ln).width;
      ctx.fillText(ln, tx, ly);
      if (t.underline && ln) ctx.fillRect(tx, ly + tpx * 1.05, lw, Math.max(1, tpx * 0.06));
      maxW = Math.max(maxW, lw);
    });
    if (B) B[t.id] = { x: tx, y: ty, w: Math.max(maxW, tpx * 2), h: tpx * 1.2 * lines.length };
  }

  /* what the barcode / QR encode: serial number or an Excel column */
  const enc = (key, ascii, isQr) => {
    if (key === CUSTOM) {
      const base = isFinite(p.from) ? p.from : 1;
      const c = (isQr ? p.qpre : p.cpre) + pad(Math.max(0, (isQr ? p.qst : p.cst) + n - base), isQr ? p.qdg : p.cdg);
      return ascii && !/^[ -~]+$/.test(c) ? val : c;
    }
    const v = key === SERIAL || !row ? val : String(row[key] ?? "").trim();
    if (!v || (ascii && !/^[ -~]+$/.test(v))) return val;
    return v;
  };
  const safe = (fn, v) => { try { return fn(v); } catch { return fn(val); } };

  if (p.bar) {
    const c = safe((v) => (preview ? getBarcode(S, v, p) : makeBarcode(v, p)), enc(p.benc, true));
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(c, p.bx * u, p.by * u);
    if (B) B.bar = { x: p.bx * u, y: p.by * u, w: c.width, h: c.height, cv: c };
  }
  if (p.qr) {
    const c = safe((v) => (preview ? getQR(S, v, p) : makeQR(v, p)), enc(p.qenc, false, true));
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(c, p.qx * u, p.qy * u);
    if (B) B.qr = { x: p.qx * u, y: p.qy * u, w: c.width, h: c.height, cv: c };
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
  lines: "M4 6h16 M4 12h16 M4 18h10",
  close: "M6 6l12 12 M18 6L6 18",
  fit: "M3 9V5a2 2 0 0 1 2-2h4 M21 9V5a2 2 0 0 0-2-2h-4 M3 15v4a2 2 0 0 0 2 2h4 M21 15v4a2 2 0 0 1-2 2h-4",
};

function Ic({ n, s = 15 }) {
  return (
    <svg className="cn-ic" viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[n] || "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0"} />
    </svg>
  );
}

/* ---------- centre number + barcode + QR on the artwork ---------- */
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
  let qrc = null;
  if (p.qr) { try { qrc = makeQR(val, p); } catch { qrc = null; } }
  const bw = bar ? bar.width : 0, bh = bar ? bar.height : 0;
  const qw = qrc ? qrc.width : 0, qh = qrc ? qrc.height : 0;
  const gap = 2 * u;

  /* stack: number, barcode, QR, centred as one block */
  const total = th + (bar ? gap + bh : 0) + (qrc ? gap + qh : 0);
  const top = Math.max(0, (H - total) / 2);
  const barY = top + th + gap;
  const qrY = top + th + (bar ? gap + bh : 0) + gap;
  const rr = (v) => String(Math.round((Math.max(0, v) / u) * 10) / 10);

  const out = {
    nx: rr((W - tw) / 2), ny: rr(top),
    bx: rr((W - bw) / 2), by: rr(barY),
  };
  if (qrc) { out.qx = rr((W - qw) / 2); out.qy = rr(qrY); }
  return out;
}

/* ---------- persistent custom fonts (IndexedDB) ---------- */
const fontDb = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open("cn-fonts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("fonts", { keyPath: "name" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const fontTx = async (mode, fn) => {
  const db = await fontDb();
  return new Promise((res, rej) => {
    const tx = db.transaction("fonts", mode);
    const req = fn(tx.objectStore("fonts"));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
  });
};
const fontSave = (name, data) => fontTx("readwrite", (s) => s.put({ name, data }));
const fontList = () => fontTx("readonly", (s) => s.getAll());

const defText = (i = 0, pt = "16") => ({
  id: `txt_${Date.now()}_${i}`, text: "New text", on: false, family: "", pt,
  bold: false, italic: false, underline: false, color: "#222222",
  x: "21", y: String(Math.round((14.9 + i * 8) * 10) / 10),
});

export default function CertificateNumbering() {
  const [f, setF] = useState(DEFAULTS);
  const [fonts, setFonts] = useState(BASE_FONTS);
  const [texts, setTexts] = useState(() => [defText()]);   // custom text items (1 by default)
  const [toast, setToast] = useState(null); // { msg, cls } shown at the top
  const toastT = useRef(null);
  const [dims, setDims] = useState([{ w: 2480, h: 1754 }, { w: 2480, h: 1754 }, { w: 2480, h: 1754 }]);
  const [sel, setSel] = useState("num");
  const [artNames, setArtNames] = useState(Array(3).fill("None — blank A4 landscape"));
  const [act, setAct] = useState(0);            // active artwork slot (0..2)
  const actRef = useRef(0);
  actRef.current = act;
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
  const [busy, setBusy] = useState("");
  const [saveDlg, setSaveDlg] = useState(null);   // null | "choose" | "name"
  const [newName, setNewName] = useState("");           // loading message while artwork is being processed

  /* Layout toggles & Zoom to maximize preview window */
  const [sideOpen, setSideOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);
  const [tool, setTool] = useState(null);   // which floating tool card is open
  const [inspPos, setInspPos] = useState(null);   // inspector position next to the selected element
  const areaRef = useRef(null);
  const propsRef = useRef(null);
  const placeRef = useRef(null);
  const [inspManual, setInspManual] = useState(null);   // position chosen by dragging (null = follow element)
  const manRef = useRef(null);
  manRef.current = inspManual;
  const inspDrag = useRef(null);
  const workRef = useRef(null);
  const [flyPos, setFlyPos] = useState(null);   // where the tool card opens (next to the clicked rail button)
  const [zoom, setZoom] = useState("fit"); // "fit", or numeric percentage 50, 75, 100, 125, 150
  const [sheetView, setSheetView] = useState(false);   // Simplex: show the UPS sheet preview
  const shRef = useRef(null);
  const rootRef = useRef(null);
  const [maxed, setMaxed] = useState(false);
  const maxedRef = useRef(false);
  maxedRef.current = maxed;

  const cvRefs = useRef([null, null, null]);
  const S = useRef({ img: null, w: 2480, h: 1754, box: { num: null, bar: null, qr: null }, bc: new Map(), rows: [], cols: [], blob: null, prev: null, tplCols: new Map(), clearBusy: false, slots: [blankSlot(), blankSlot(), blankSlot()] }).current;
  /* S.img / S.w / S.h / S.prev / S.blob / S.box always mirror one slot, so render() and generate() work unchanged */
  const bind = (i) => { const s = S.slots[i]; S.img = s.img; S.blob = s.blob; S.prev = s.prev; S.w = s.w; S.h = s.h; S.box = s.box; };
  const drag = useRef(null);
  const stopFlag = useRef(false);
  const fRef = useRef(f);
  fRef.current = f;
  const colsRef = useRef(cols);
  colsRef.current = cols;
  S.cols = cols;
  const textsRef = useRef(texts);
  textsRef.current = texts;
  S.texts = texts;

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setF((o) => ({ ...o, [k]: v }));
  };
  const setCol = (id, k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setCols((cs) => cs.map((c) => (c.id === id ? { ...c, [k]: v } : c)));
  };
  const say = (msg, cls = "") => {
    if (!msg) { setStatus({ msg: "", cls: "" }); setToast(null); return; }
    // live progress / "Loading…" messages stay in the footer
    if (msg.startsWith("Rendering") || /…$/.test(msg)) { setStatus({ msg, cls }); return; }
    setStatus({ msg: "", cls: "" });
    setToast({ msg, cls });             // results show in the top banner
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), cls === "err" ? 4500 : 3000);
  };
  const fail = (msg, cls = "err") => say(msg, cls);

  const setTxt = (id, k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setTexts((ts) => ts.map((t) => (t.id === id ? { ...t, [k]: v } : t)));
  };
  const addText = () => {
    const id = `txt_${Date.now()}`;
    const u = P(f).dpi / 25.4;
    setTexts((ts) => [...ts, {
      id, text: "New text", on: true, family: "", pt: String(f.pt),
      bold: false, italic: false, underline: false, color: "#222222",
      x: r1((S.w / u) * 0.1), y: r1((S.h / u) * 0.1 + ts.length * 8),
    }]);
    setSel(id);
    setPropsOpen(true);
  };
  const removeText = (id) => {
    setTexts((ts) => ts.filter((t) => t.id !== id));
    if (sel === id) setSel("num");
    if (measure === id) setMeasure(null);
  };
  /* set how many custom text boxes exist (adds new ones / trims from the end) */
  const setTextCount = (v) => {
    const n = Math.min(20, Math.max(0, parseInt(v, 10) || 0));
    const cur = textsRef.current;
    if (n < cur.length) {
      const keep = cur.slice(0, n).map((t) => t.id);
      if (sel.startsWith("txt_") && !keep.includes(sel)) setSel("num");
      if (measure && measure.startsWith("txt_") && !keep.includes(measure)) setMeasure(null);
    } else if (n > cur.length) {
      setPropsOpen(true);
    }
    const u = P(fRef.current).dpi / 25.4;
    setTexts((ts) => {
      if (n <= ts.length) return ts.slice(0, n);
      const add = [];
      for (let i = ts.length; i < n; i++) {
        add.push({
          id: `txt_${Date.now()}_${i}`, text: "New text", on: false, family: "", pt: String(fRef.current.pt),
          bold: false, italic: false, underline: false, color: "#222222",
          x: r1((S.w / u) * 0.1), y: r1((S.h / u) * 0.1 + i * 8),
        });
      }
      return [...ts, ...add];
    });
  };
  const onFont = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      let name = file.name.replace(/\.(ttf|otf|woff2?)$/i, "").replace(/[^\w\s-]/g, "").trim() || "Custom";
      if (name === name.toUpperCase()) name = name[0] + name.slice(1).toLowerCase();
      const data = await file.arrayBuffer();
      const face = new FontFace(name, data.slice(0));
      await face.load();
      document.fonts.add(face);
      await fontSave(name, data);
      setFonts((fs) => (fs.includes(name) ? fs : [name, ...fs]));
      say(`Font "${name}" saved.`, "ok");
    } catch { say("Could not read that font file.", "err"); }
  };

  /* saved custom fonts */
  useEffect(() => {
    (async () => {
      try {
        const saved = await fontList();
        const names = [];
        for (const { name, data } of saved) {
          try {
            const face = new FontFace(name, data.slice(0));
            await face.load();
            document.fonts.add(face);
            names.push(name);
          } catch { /* skip a corrupt entry */ }
        }
        if (names.length) setFonts((fs) => [...names.filter((n) => !fs.includes(n)), ...fs]);
      } catch { /* IndexedDB unavailable */ }
    })();
  }, []);

  /* google fonts */
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONT_LINK;
    document.head.appendChild(l);
    return () => { document.head.removeChild(l); };
  }, []);

  /* keep UI in sync when the browser exits fullscreen (Esc) */
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && maxedRef.current) {
        setMaxed(false);
        setSideOpen(true);
        setPropsOpen(true);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
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

  /* put the inspector next to the selected element */
  const placeInspector = () => {
    const i = actRef.current;
    if (manRef.current) return;
    const area = areaRef.current, cv = cvRefs.current[i];
    const slot = S.slots[i];
    const b = slot && slot.box ? slot.box[sel] : null;
    if (!area || !cv || !b) { setInspPos((o) => (o ? null : o)); return; }
    const ar = area.getBoundingClientRect(), cr = cv.getBoundingClientRect();
    if (!cr.width || !slot.w) return;
    const k = cr.width / slot.w;
    const ex = cr.left - ar.left + b.x * k, ey = cr.top - ar.top + b.y * k;
    const ew = b.w * k, eh = b.h * k;
    const W = 208, H = propsRef.current ? propsRef.current.offsetHeight : 220, gap = 14;
    let left = ex + ew + gap, top = ey;
    if (left + W > ar.width - 8) left = ex - W - gap;            // no room on the right -> left side
    if (left < 8) {                                               // wide element -> below (or above) it
      left = Math.min(Math.max(ex, 8), ar.width - W - 8);
      top = ey + eh + gap;
      if (top + H > ar.height - 8) top = ey - H - gap;
    }
    left = Math.round(Math.max(8, Math.min(left, ar.width - W - 8)));
    top = Math.round(Math.max(8, Math.min(top, ar.height - H - 8)));
    setInspPos((o) => (o && o.left === left && o.top === top ? o : { left, top }));
  };
  placeRef.current = placeInspector;

  /* drag the inspector by its title bar */
  const onInspDown = (e) => {
    if (e.target.closest("button")) return;
    const el = propsRef.current;
    if (!el) return;
    const er = el.getBoundingClientRect();
    inspDrag.current = { dx: e.clientX - er.left, dy: e.clientY - er.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onInspMove = (e) => {
    const d = inspDrag.current, area = areaRef.current, el = propsRef.current;
    if (!d || !area || !el) return;
    const ar = area.getBoundingClientRect();
    const left = Math.round(Math.max(0, Math.min(e.clientX - ar.left - d.dx, ar.width - el.offsetWidth)));
    const top = Math.round(Math.max(0, Math.min(e.clientY - ar.top - d.dy, ar.height - el.offsetHeight)));
    setInspManual({ left, top });
  };
  const onInspUp = () => { inspDrag.current = null; };

  /* re-place on window resize and when panels / full screen change */
  useEffect(() => {
    const onR = () => placeRef.current && placeRef.current();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  useEffect(() => {
    const id = requestAnimationFrame(() => placeRef.current && placeRef.current());
    return () => cancelAnimationFrame(id);
  }, [propsOpen, sideOpen, maxed, zoom]);

  /* preview: one canvas per artwork slot */
  useEffect(() => {
    if (running) return;
    let dead = false;
    (async () => {
      const p = P(f);
      try { await document.fonts.load(`${p.bold ? 700 : 400} 20px "${p.family}"`); } catch { /* ignore */ }
      for (const t of S.texts || []) {
        if (t.family) { try { await document.fonts.load(`20px "${t.family}"`); } catch { /* ignore */ } }
      }
      if (dead) return;
      for (let i = 0; i < 3; i++) {
        const cv = cvRefs.current[i];
        if (!cv) continue;
        bind(i);
        const s = Math.min(1, 1600 / S.w);
        cv.width = Math.round(S.w * s);
        cv.height = Math.round(S.h * s);
        const ctx = cv.getContext("2d");
        const idx = Math.min(Math.max((parseInt(pv, 10) || 1) - 1, 0), Math.max(0, S.rows.length - 1));
        const n = (isFinite(p.from) ? p.from : 1) + idx;
        S.box = { num: null, bar: null, qr: null };
        if (i === actRef.current) {
          render(S, ctx, n, s, p, true, S.rows[idx]);
        } else {
          /* not selected: artwork only, for comparison */
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, cv.width, cv.height);
          if (S.img && !p.noArt) ctx.drawImage(S.prev || S.img, 0, 0, cv.width, cv.height);
        }
        ctx.save();
        ctx.scale(s, s);
        if (!S.img) {
          ctx.fillStyle = "rgba(16,52,61,.28)";
          ctx.font = `600 ${S.w * 0.03}px Figtree, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`Choose artwork ${i + 1}`, S.w / 2, S.h / 2);
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
        S.slots[i].box = S.box;
      }
      bind(actRef.current);
      if (S.clearBusy) { S.clearBusy = false; requestAnimationFrame(() => setBusy("")); }
      placeInspector();
    })();
    return () => { dead = true; };
  }, [f, cols, sheet, pv, dims, artNames, sel, measure, fonts, texts, running, act, S]);

  /* ---------- Simplex: UPS sheet preview ---------- */
  useEffect(() => {
    if (f.mode !== "simplex" || !sheetView) return;
    let dead = false;
    (async () => {
      const p = P(f);
      try { await document.fonts.load(`${p.bold ? 700 : 400} 20px "${p.family}"`); } catch { /* ignore */ }
      for (const t of S.texts || []) {
        if (t.family) { try { await document.fonts.load(`20px "${t.family}"`); } catch { /* ignore */ } }
      }
      if (dead || !shRef.current) return;
      bind(actRef.current);
      const u = p.dpi / 25.4, gap = p.ugap * u;
      const SW = S.w * p.ucols + gap * (p.ucols - 1), SH = S.h * p.ups + gap * (p.ups - 1);
      const k = Math.min(1, 2048 / SW);
      const cv = shRef.current;
      cv.width = Math.max(1, Math.round(SW * k));
      cv.height = Math.max(1, Math.round(SH * k));
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      const start = isFinite(p.from) ? p.from : 1;
      const end = isFinite(p.to) ? p.to : start + p.ups * p.ucols - 1;
      for (let i = 0; i < p.ups * p.ucols; i++) {
        const n = start + i;
        if (n > end) break;
        const col = Math.floor(i / p.ups), row = i % p.ups;
        ctx.save();
        ctx.scale(k, k);
        ctx.translate(col * (S.w + gap), row * (S.h + gap));
        render(S, ctx, n, 1, p, false, S.rows[n - start]);
        ctx.strokeStyle = "#0f7f96";
        ctx.lineWidth = 3 / k;
        ctx.strokeRect(0, 0, S.w, S.h);
        ctx.restore();
      }
    })();
    return () => { dead = true; };
  }, [f, cols, sheet, pv, dims, texts, fonts, sheetView, act, S]);

  /* ---------- move variable matter ---------- */
  const toArt = (e, i) => {
    const r = e.currentTarget.getBoundingClientRect(), s = S.slots[i];
    return { x: ((e.clientX - r.left) * s.w) / r.width, y: ((e.clientY - r.top) * s.h) / r.height };
  };
  const hit = (pt, i) => {
    const s = S.slots[i], m = s.w * 0.008;
    for (const k of Object.keys(s.box).reverse()) {
      const b = s.box[k];
      if (b && pt.x >= b.x - m && pt.x <= b.x + b.w + m && pt.y >= b.y - m && pt.y <= b.y + b.h + m) return k;
    }
    return null;
  };
  const setPos = (k, xmm, ymm) => {
    const sx = String(Math.round(xmm * 10) / 10), sy = String(Math.round(ymm * 10) / 10);
    if (POS_KEYS[k]) {
      const [kx, ky] = POS_KEYS[k];
      setF((o) => ({ ...o, [kx]: sx, [ky]: sy }));
    } else if (k.startsWith("txt_")) {
      setTexts((ts) => ts.map((t) => (t.id === k ? { ...t, x: sx, y: sy } : t)));
    } else {
      setCols((cs) => cs.map((c) => (c.id === k ? { ...c, x: sx, y: sy } : c)));
    }
  };
  const getPos = (k) => {
    if (POS_KEYS[k]) { const [kx, ky] = POS_KEYS[k]; return [num(fRef.current[kx]), num(fRef.current[ky])]; }
    const t = textsRef.current.find((q) => q.id === k);
    if (t) return [num(t.x), num(t.y)];
    const c = colsRef.current.find((q) => q.id === k);
    return c ? [num(c.x), num(c.y)] : [0, 0];
  };
  const onDown = (i) => (e) => {
    setAct(i); actRef.current = i; bind(i);
    const pt = toArt(e, i), k = hit(pt, i);
    if (!k) { setMeasure(null); return; }
    setSel(k);
    if (!propsOpen) setPropsOpen(true);
    drag.current = { k, i, dx: pt.x - S.box[k].x, dy: pt.y - S.box[k].y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
  };
  const onMove = (i) => (e) => {
    const pt = toArt(e, i);
    if (!drag.current) { e.currentTarget.style.cursor = hit(pt, i) ? "move" : "default"; return; }
    if (drag.current.i !== i) return;
    const u = P(fRef.current).dpi / 25.4;
    setPos(drag.current.k, (pt.x - drag.current.dx) / u, (pt.y - drag.current.dy) / u);
  };
  const onUp = () => { drag.current = null; };
  const onDbl = (i) => (e) => {
    const k = hit(toArt(e, i), i);
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
  const setArtImage = (img, blob, label, i = 0) => {
    const s = S.slots[i];
    s.img = img; s.blob = blob; s.w = img.naturalWidth; s.h = img.naturalHeight;
    s.prev = makePreviewImg(img);
    s.name = `${label} · ${s.w}×${s.h}px`;
    setDims((d) => d.map((x, k) => (k === i ? { w: s.w, h: s.h } : x)));
    setArtNames((a) => a.map((x, k) => (k === i ? s.name : x)));
    setAct(i); actRef.current = i; bind(i);
  };
  const clearArt = (i) => {
    S.slots[i] = blankSlot();
    setDims((d) => d.map((x, k) => (k === i ? { w: 2480, h: 1754 } : x)));
    setArtNames((a) => a.map((x, k) => (k === i ? "None — blank A4 landscape" : x)));
    if (actRef.current === i) {
      const nx = S.slots.findIndex((s) => s.img);
      const to = nx >= 0 ? nx : 0;
      setAct(to); actRef.current = to; bind(to);
    }
  };

  /* image (PNG/JPG/WebP) or PDF (first page) — shows a full-screen loader until the preview is painted */
  const onArt = async (e, i = 0) => {
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
      setArtImage(img, blob, label, i);
      /* auto-layout only for the first artwork; the others reuse the shared layout */
      const first = !S.slots.some((s, k) => k !== i && s.img);
      if (!first) {
        /* keep the layout already set up; only repaint */
        S.clearBusy = true;
        setF((o) => ({ ...o }));
        say("");
        return;
      }
      const o = dpiFix ? { ...fRef.current, dpi: String(dpiFix) } : fRef.current;
      const dpi = P(o).dpi;
      const wmm = (S.w * 25.4) / dpi, hmm = (S.h * 25.4) / dpi;
      const qs = Math.round(Math.min(wmm, hmm) * 0.12);
      const next = {
        ...o,
        pt: String(Math.max(4, Math.round(hmm * 0.07 * 2.835))),
        bw: r1(wmm * 0.3), bh: r1(hmm * 0.1),
        qs: o.qs, qx: o.qx, qy: o.qy,
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

  /* "— choose to load —" selected: unload the current template, back to defaults (range kept) */
  const resetTemplate = async () => {
    setTplName("");
    setSel("num");
    setMeasure(null);
    S.tplCols = new Map();
    setTexts([defText()]);
    [0, 1, 2].forEach(clearArt); setAct(0); actRef.current = 0; bind(0);

    const o = fRef.current;
    const n = { ...DEFAULTS, from: o.from, to: o.to };
    const c = await centerLayout(n, S.w, S.h);
    setF({ ...n, ...c });

    /* if an Excel is loaded, put its fields back to the default styling/positions */
    if (sheet && S.rows.length) {
      const dpi = P(n).dpi;
      const wmm = (S.w * 25.4) / dpi, hmm = (S.h * 25.4) / dpi;
      const pt = Math.max(4, Math.round(num(n.pt) * 0.75));
      const step = pt * 0.3528 * 1.7;
      setCols(sheet.headers.map((h, i) => ({
        id: `c${i}`, header: h, on: i < 3, label: false, pt: String(pt),
        color: "#222222", lc: "#222222",
        x: r1(wmm * 0.05), y: r1(hmm * 0.08 + i * step),
      })));
      setSel("c0");
    }
    say("Template unloaded.", "ok");
  };

  const applyTemplate = async (id) => {
    setTplId(id);
    if (!id) { resetTemplate(); return; }
    try {
      say("Loading template…");
      const r = await fetch(`${API}/api/numbering-templates/${id}`, { headers: authHeaders() });
      const t = await r.json();
      if (!r.ok) throw new Error(t.message || "Could not load that template.");

      const metas = Array.isArray(t.arts) && t.arts.length ? t.arts : (t.hasArt ? [{ slot: 0, name: t.artName }] : []);
      for (let i = 0; i < 3; i++) {
        const m = metas.find((a) => a.slot === i);
        if (!m) { clearArt(i); continue; }
        const ar = await fetch(`${API}/api/numbering-templates/${id}/art?slot=${i}`, { headers: authOnly() });
        if (!ar.ok) throw new Error(`Could not load artwork ${i + 1}.`);
        const blob = await ar.blob();
        setArtImage(await loadImg(blob), blob, m.name || "Template artwork", i);
      }
      setAct(0); actRef.current = 0; bind(0);

      /* Excel field styling: kept by header name, applied now and to any Excel uploaded later */
      S.tplCols = new Map((t.cols || []).map((c) => [c.header, c]));
      setTexts(Array.isArray(t.texts) && t.texts.length ? t.texts : [defText()]);
      setCols((cs) => cs.map((c) => (S.tplCols.has(c.header) ? withTpl(c, S.tplCols.get(c.header)) : c)));

      /* everything except the number range */
      setF((o) => {
        const n = { ...DEFAULTS, ...t.settings, from: o.from, to: o.to };
        if (S.rows.length) {
          const hs = Object.keys(S.rows[0]);
          if (n.benc !== SERIAL && n.benc !== CUSTOM && !hs.includes(n.benc)) n.benc = SERIAL;
          if (n.qenc !== SERIAL && n.qenc !== CUSTOM && !hs.includes(n.qenc)) n.qenc = SERIAL;
        }
        return n;
      });
      setTplName(t.name);
      say(`Template "${t.name}" loaded.`, "ok");
    } catch (err) {
      say(err.message || "Could not load that template.", "err");
    }
  };

  /* Save button: loaded template -> ask overwrite / new; otherwise ask for a name */
  const saveTemplate = () => {
    if (tplId && tpls.some((t) => t._id === tplId)) { setSaveDlg("choose"); return; }
    setNewName(tplName);
    setSaveDlg("name");
  };

  const doSave = async (rawName, replaceOk) => {
    const name = String(rawName || "").trim();
    if (!name) { say("Type a template name first.", "err"); return; }
    const same = tpls.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (same && !replaceOk && !window.confirm(`A template named "${same.name}" already exists. Replace it?`)) return;
    setSaveDlg(null);
    setTplBusy(true);
    try {
      const arts = [];
      const used = [0, 1, 2].filter((i) => S.slots[i].img);
      const lim = Math.floor(MAX_ART / Math.max(1, used.length));   // all artworks share one 16 MB document
      for (const i of used) {
        const s = S.slots[i];
        let blob = s.blob;
        if (blob && blob.size > lim) {
          const cv = document.createElement("canvas");
          cv.width = s.w; cv.height = s.h;
          cv.getContext("2d").drawImage(s.img, 0, 0);
          blob = await toBlob(cv, "image/jpeg", 0.9);
        }
        if (!blob || blob.size > lim) throw new Error(`Artwork ${i + 1} is too large to save (limit ${Math.floor(lim / 1048576)} MB each with ${used.length} artworks).`);
        arts.push({ slot: i, blob, name: artNames[i].replace(/\s·\s\d+×\d+px$/, ""), w: s.w, h: s.h });
      }

      const { from, to, ...settings } = fRef.current;
      const live = colsRef.current.length ? colsRef.current.map(pickCol) : [...S.tplCols.values()];
      const res = await fetch(`${API}/api/numbering-templates`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name, settings, cols: live, texts: textsRef.current, createdBy: whoAmI(),
          arts: arts.map(({ slot, name, w, h }) => ({ slot, name, w, h })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Could not save the template.");

      for (const a of arts) {
        const ar = await fetch(`${API}/api/numbering-templates/${d._id}/art?slot=${a.slot}`, {
          method: "PUT",
          headers: { ...authOnly(), "Content-Type": a.blob.type || "image/png" },
          body: a.blob,
        });
        if (!ar.ok) throw new Error(`Saved the settings but artwork ${a.slot + 1} failed to upload.`);
      }
      live.forEach((c) => S.tplCols.set(c.header, c));
      await loadTpls();
      setTplId(d._id);
      setTplName(d.name);
      say(`Template "${d.name}" saved.`, "ok");
    } catch (err) {
      say(err.message || "Could not save the template.", "err");
    } finally {
      bind(actRef.current);
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
        benc: headers.includes(q.benc) || q.benc === CUSTOM ? q.benc : SERIAL,
        qenc: headers.includes(q.qenc) || q.qenc === CUSTOM ? q.qenc : SERIAL,
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
    setF((q) => ({ ...q, benc: q.benc === CUSTOM ? CUSTOM : SERIAL, qenc: q.qenc === CUSTOM ? CUSTOM : SERIAL }));
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

  async function generateSimplex(kind, slot) {
    const p = P(f);
    if (!Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from < 0 || p.to < p.from) {
      say("Enter a valid range: From and To are whole numbers and To ≥ From.", "err"); return;
    }
    if (String(p.to).length > p.digits) {
      say(`"To" needs ${String(p.to).length} digits. Raise Digits to match.`, "err"); return;
    }
    const total = p.to - p.from + 1;
    if (sheet && total > S.rows.length) {
      say(`Range has ${total.toLocaleString()} certificates but the Excel has only ${S.rows.length.toLocaleString()} rows.`, "err"); return;
    }
    const u = p.dpi / 25.4, gap = Math.round(p.ugap * u);
    const per = p.ups * p.ucols;
    const SW = S.w * p.ucols + gap * (p.ucols - 1), SH = S.h * p.ups + gap * (p.ups - 1);
    if (SW * SH > 250e6) { say("Sheet is too large for this browser. Lower UPS / columns or the DPI.", "err"); return; }
    const sheets = Math.ceil(total / per);
    try { await document.fonts.load(`${p.bold ? 700 : 400} 20px "${p.family}"`); } catch { /* ignore */ }
    for (const t of S.texts || []) {
      if (t.family) { try { await document.fonts.load(`20px "${t.family}"`); } catch { /* ignore */ } }
    }
    setRunning(true);
    stopFlag.current = false;
    setProgress(0);
    let reprint = false;
    try { reprint = !!(await reserve(p)).reprint; }
    catch (err) { say(err.message, "err"); setRunning(false); return; }

    const off = document.createElement("canvas");
    off.width = SW; off.height = SH;
    const ctx = off.getContext("2d", { alpha: false });
    const ZIP = kind === "zip";
    const PDF = true;
    const wpt = (SW * 72) / p.dpi, hpt = (SH * 72) / p.dpi;
    let cur = null, done = 0;
    const zipBundle = ZIP ? makeZipWriter() : null;
    let zipCount = 0;
    const closeFile = async (c) => {
      const pdfBlob = c.pdf.finish();
      const base = `sheets_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}_art${slot + 1}`;
      if (ZIP) {
        await zipBundle.file(`Certificates/${base}.pdf`, pdfBlob);
        zipCount++;
      } else saveBlob(`${base}.pdf`, pdfBlob);
    };
    try {
      S.bmp = S.img && !p.noArt && window.createImageBitmap ? await createImageBitmap(S.img) : null;
      for (let si = 0; si < sheets && !stopFlag.current; si++) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, SW, SH);
        let last = p.from + si * per;
        for (let i = 0; i < per; i++) {
          const n = p.from + si * per + i;
          if (n > p.to) break;
          const col = Math.floor(i / p.ups), row = i % p.ups;   // fills down the column first
          ctx.save();
          ctx.translate(col * (S.w + gap), row * (S.h + gap));
          render(S, ctx, n, 1, p, false, S.rows[n - p.from]);
          ctx.restore();
          last = n; done++;
        }
        const blob = await toBlob(off, "image/jpeg", JPG_Q);
        if (!blob) throw new Error("Could not encode a sheet (too large for this browser).");
        if (!cur) cur = { a: p.from + si * per, last, count: 0, bytes: 0, pdf: PDF ? makePdfWriter(wpt, hpt) : null, zip: PDF ? null : makeZipWriter() };
        if (PDF) cur.pdf.addPage([{ blob, x: 0, y: 0, w: SW, h: SH }], 72 / p.dpi);
        else await cur.zip.file(`sheet_${pad(si + 1, 3)}.jpg`, blob);
        cur.last = last; cur.count++; cur.bytes += blob.size;
        setProgress((done / total) * 100);
        say(`Rendering ${done.toLocaleString()} of ${total.toLocaleString()}…`);
        await tick();
        if (cur.count >= p.per || cur.bytes >= 1.9 * 1024 * 1024 * 1024) { const c = cur; cur = null; await closeFile(c); }
      }
      if (!stopFlag.current && cur) await closeFile(cur);
      if (ZIP && zipCount) saveBlob(`sheets_${pad(p.from, p.digits)}-${pad(p.to, p.digits)}_art${slot + 1}.zip`, zipBundle.finish());
      if (stopFlag.current) say("Stopped.");
      else say(`Done. ${total.toLocaleString()} certificates on ${sheets.toLocaleString()} sheets${reprint ? " (re-print of an issued range)" : ""}.`, "ok");
    } catch (err) {
      say("Failed: " + (err.message || err), "err");
    } finally {
      if (S.bmp) { try { S.bmp.close(); } catch { /* ignore */ } S.bmp = null; }
      setRunning(false);
    }
  }

  async function generate(kind, slot = 0) {
    if (running) return;
    bind(slot);
    try { await generateInner(kind, slot); } finally { bind(actRef.current); }
  }

  async function generateInner(kind, slot) {
    if (f.mode === "simplex") return generateSimplex(kind, slot);
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

    for (const t of S.texts || []) {
      if (t.family) { try { await document.fonts.load(`20px "${t.family}"`); } catch { /* ignore */ } }
    }
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
      const ZIP = kind === "zip";
      const PDF = true;
      /* PDF output is generated for both download choices; ZIP wraps that PDF as a single archive entry. */
      const bg = PDF ? await makeBackground(S, p) : null;
      const bgBytes = bg ? bg.blob.size : 0;
      const COMPACT = PDF && p.noArt;   // PDF + hidden background → tiny vector pages
      const pageRoom = PDF && !COMPACT ? Math.max(1024 * 1024, PDF_TARGET - bgBytes) : Infinity;
      const K = 72 / p.dpi;
      const INFLIGHT = PDF ? 8 : S.w * S.h > 24e6 ? 4 : Math.min(16, Math.max(8, navigator.hardwareConcurrency || 8));
      const pending = [];
      let cur = null;
      const zipBundle = ZIP ? makeZipWriter() : null;
      let zipCount = 0;

      /* crop each drawn element (with a small margin) out of the rendered page and JPEG-encode it */
      const patchesFor = (boxes) => {
        const jobs = [];
        for (const k of Object.keys(boxes)) {
          const b = boxes[k];
          if (!b) continue;
          if ((k === "bar" && p.qz) || k === "qr") {
            const bx0 = Math.ceil(b.x), by0 = Math.ceil(b.y);
            const bw = Math.floor(b.x + b.w) - bx0, bh = Math.floor(b.y + b.h) - by0;
            if (bw >= 1 && bh >= 1) {
              const bc = document.createElement("canvas");
              bc.width = bw; bc.height = bh;
              const bctx = bc.getContext("2d", { alpha: false });
              bctx.drawImage(off, bx0, by0, bw, bh, 0, 0, bw, bh);
              jobs.push(bitsBlob(bctx.getImageData(0, 0, bw, bh)).then((blob) => ({ blob, bits: true, x: bx0, y: by0, w: bw, h: bh })));
              continue;
            }
          }
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

      /* ----- compact mode (PDF + hidden background) ----- */
      let stat = null;
      if (COMPACT) {
        const u = p.dpi / 25.4, px = (p.pt * p.dpi) / 72;
        const nf = `${p.bold ? 700 : 400} ${px}px "${p.family}", sans-serif`;
        const mctx = document.createElement("canvas").getContext("2d");
        mctx.font = nf;
        const glyphs = {};
        for (const d of "0123456789") glyphs[d] = await makeMask([d], nf, px, false);
        const word = p.word ? await makeMask([p.word], nf, px, false) : null;
        const items = [];
        for (const t of S.texts || []) {
          if (!t.on || !t.text) continue;
          const tpx = ((num(t.pt) || 12) * p.dpi) / 72;
          const tf = `${t.italic ? "italic " : ""}${t.bold ? 700 : 400} ${tpx}px "${t.family || p.family}", sans-serif`;
          items.push({ m: await makeMask(String(t.text).split("\n"), tf, tpx, t.underline), x: num(t.x) * u, y: num(t.y) * u, c: t.color });
        }
        stat = { u, mctx, glyphs, word, items, offW: p.word ? mctx.measureText(p.word + " ").width : 0 };
      }
      const rgb = (h) => {
        const v = parseInt(h.slice(1), 16);
        return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((a) => (a / 255).toFixed(3)).join(" ");
      };
      const put = (name, m, x, y) =>
        `q ${m.pw} 0 0 ${-m.ph} ${(x - m.pad).toFixed(1)} ${(y - m.pad + m.ph).toFixed(1)} cm /${name} Do Q\n`;
      const compactPage = (n, boxes) => {
        const val = pad(n, p.digits), nx = p.nx * stat.u, ny = p.ny * stat.u;
        let ops = `q ${K.toFixed(6)} 0 0 ${(-K).toFixed(6)} 0 ${hpt.toFixed(3)} cm\n`;
        if (stat.word) ops += `${rgb(p.wc)} rg\n` + put("W", stat.word, nx, ny);
        ops += `${rgb(p.nc)} rg\n`;
        for (let i = 0; i < val.length; i++) {
          const dx = stat.mctx.measureText(val.slice(0, i)).width;
          ops += put("G" + val[i], stat.glyphs[val[i]], nx + stat.offW + dx, ny);
        }
        stat.items.forEach((it, i) => { ops += `${rgb(it.c)} rg\n` + put("T" + i, it.m, it.x, it.y); });

        /* barcode → vector bars */
        if (boxes.bar && boxes.bar.cv) {
          const b = boxes.bar, cv = b.cv;
          const d = cv.getContext("2d").getImageData(0, cv.height >> 1, cv.width, 1).data;
          let rects = "", s = -1;
          for (let i = 0; i <= cv.width; i++) {
            const dark = i < cv.width && d[i * 4 + 3] > 128 && d[i * 4] < 128;
            if (dark && s < 0) s = i;
            else if (!dark && s >= 0) { rects += `${s} 0 ${i - s} ${cv.height} re `; s = -1; }
          }
          ops += `q 1 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} cm 0 g ${rects}f Q\n`;
        }
        /* QR → vector modules */
        if (boxes.qr && boxes.qr.cv) {
          const b = boxes.qr, cv = b.cv, W = cv.width;
          const d = cv.getContext("2d").getImageData(0, 0, W, W).data;
          const at = (x, y) => d[(y * W + x) * 4] < 128;
          let i0 = 0;
          while (i0 < W && !at(i0, i0)) i0++;
          if (i0 < W) {
            const cell = i0 / 4, nm = Math.round(W / cell) - 8;
            let rects = "";
            for (let r = 0; r < nm; r++) {
              let s = -1;
              for (let k = 0; k <= nm; k++) {
                const dark = k < nm && at(Math.floor((k + 4.5) * cell), Math.floor((r + 4.5) * cell));
                if (dark && s < 0) s = k;
                else if (!dark && s >= 0) { rects += `${s} ${r} ${k - s} 1 re `; s = -1; }
              }
            }
            ops += `q ${cell} 0 0 ${cell} ${(b.x + 4 * cell).toFixed(2)} ${(b.y + 4 * cell).toFixed(2)} cm 0 g ${rects}f Q\n`;
          }
        }
        /* Excel columns still go through the normal patches */
        const rest = {};
        for (const k of Object.keys(boxes)) if (k !== "num" && k !== "bar" && k !== "qr" && !k.startsWith("txt_")) rest[k] = boxes[k];
        return patchesFor(rest).then(async (got) => {
          got.forEach((t, i) => { ops += `q ${t.w} 0 0 ${-t.h} ${t.x} ${t.y + t.h} cm /P${i} Do Q\n`; });
          return { z: await deflate(ops + "Q\n"), got };
        });
      };

      const closeFile = async (c) => {
        const pdfBlob = c.pdf.finish();
        const base = `certificates_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}_art${slot + 1}`;
        if (ZIP) {
        await zipBundle.file(`Certificates/${base}.pdf`, pdfBlob);
        zipCount++;
      } else saveBlob(`${base}.pdf`, pdfBlob);
      };
      /* takes the oldest encoded page (order is preserved) and adds it to the current output file */
      const take = async () => {
        const q = pending.shift();
        const got = await q.work;
        if (COMPACT ? got.got.some((t) => !t.blob) : PDF ? got.some((t) => !t.blob) : !got) throw new Error("Could not encode a page (artwork too large for this browser).");
        if (!cur) {
          cur = { a: q.n, last: q.n, bytes: 0, pdf: PDF ? makePdfWriter(wpt, hpt) : null, zip: PDF ? null : makeZipWriter() };
          if (cur.pdf && bg) { cur.pdf.setBackground(bg.blob, S.w, S.h, bg.filter); cur.bytes += bg.blob.size; }
          if (COMPACT) {
            for (const d of Object.keys(stat.glyphs)) { const g = stat.glyphs[d]; cur.pdf.useMask("G" + d, g.blob, g.w, g.h); cur.bytes += g.blob.size; }
            if (stat.word) { cur.pdf.useMask("W", stat.word.blob, stat.word.w, stat.word.h); cur.bytes += stat.word.blob.size; }
            stat.items.forEach((it, i) => { cur.pdf.useMask("T" + i, it.m.blob, it.m.w, it.m.h); cur.bytes += it.m.blob.size; });
          }
        }
        if (COMPACT) {
          cur.pdf.addCompact(got.z, got.got);
          cur.bytes += got.z.size + got.got.reduce((s, t) => s + t.blob.size, 0);
        } else if (PDF) {
          cur.pdf.addPage(got, K);
          cur.bytes += got.reduce((s, t) => s + t.blob.size, 0);
        } else {
          await cur.zip.file(`${pad(q.n, p.digits)}.jpg`, got);
          cur.bytes += got.size;
        }
        cur.last = q.n;
        cur.count = (cur.count || 0) + 1;
        done++;
        if (done % 20 === 0 || done === total) {
          setProgress((done / total) * 100);
          say(`Rendering ${done.toLocaleString()} of ${total.toLocaleString()}…`);
          await tick();
        }
        if (cur.bytes >= MAX_FILE || cur.bytes - bgBytes >= pageRoom || cur.count >= p.per) { const c = cur; cur = null; await closeFile(c); }
      };

      for (let n = p.from; n <= p.to && !stopFlag.current; n++) {
        if (pending.length >= INFLIGHT) await take();
        const boxes = {};
        render(S, ctx, n, 1, p, false, S.rows[n - p.from], boxes);
        pending.push({ n, work: COMPACT ? compactPage(n, boxes) : PDF ? patchesFor(boxes) : toBlob(off, "image/jpeg", JPG_Q) });
      }
      if (!stopFlag.current) {
        while (pending.length) await take();
        if (cur) await closeFile(cur);
      }
      if (ZIP && zipCount) saveBlob(`certificates_${pad(p.from, p.digits)}-${pad(p.to, p.digits)}_art${slot + 1}.zip`, zipBundle.finish());
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
  const showSheet = f.mode === "simplex" && sheetView;
  /* show only uploaded artworks; if none are uploaded yet, show one blank artwork */
  const visible = [0, 1, 2].filter((i) => S.slots[i].img);
  if (!visible.length) visible.push(0);
  const count = okRange ? p.to - p.from + 1 : 0;
  const rangeTxt = okRange ? `${pad(p.from, p.digits)} → ${pad(p.to, p.digits)}` : "Enter a valid range";
  const selCol = cols.find((c) => c.id === sel);
  const selText = texts.find((t) => t.id === sel);
  const selName = sel === "num" ? "Number" : sel === "bar" ? "Barcode" : sel === "qr" ? "QR Code"
    : selText ? "Custom text" : selCol ? selCol.header : "";
  const onCenter = async () => { const c = await centerLayout(f, S.w, S.h); setF((o) => ({ ...o, ...c })); };

  /* zoom control helpers */
  const zoomIn = () => setZoom((z) => (z === "fit" ? 110 : Math.min(250, z + 15)));
  const zoomOut = () => setZoom((z) => (z === "fit" ? 85 : Math.max(30, z - 15)));
  const zoomFit = () => setZoom("fit");
  const isMaximized = maxed;
  const enterMax = async () => {
    setMaxed(true);
    setTool(null);
    setSideOpen(false);
    setPropsOpen(false);
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* overlay fallback still applies */ }
  };
  const exitMax = async () => {
    setMaxed(false);
    setSideOpen(true);
    setPropsOpen(true);
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
  };
  const toggleMaximize = () => (maxed ? exitMax() : enterMax());

  const encOptions = (
    <>
      <option value={SERIAL}>Serial number</option>
      <option value={CUSTOM}>Custom: prefix + running number</option>
      {sheet && sheet.headers.map((h) => <option key={h} value={h}>Excel column: {h}</option>)}
    </>
  );

  const customFields = (
    <>
      <Field span={4} label="Prefix"><input type="text" value={f.cpre} onChange={set("cpre")} placeholder="CRIOK" /></Field>
      <Field span={4} label="Start at"><input type="number" min="0" value={f.cst} onChange={set("cst")} /></Field>
      <Field span={4} label="Digits"><input type="number" min="1" max="20" value={f.cdg} onChange={set("cdg")} /></Field>
      <div className="cn-info" style={{ gridColumn: "1/-1" }}>
        Example: {p.cpre}{pad(p.cst, p.cdg)}, {p.cpre}{pad(p.cst + 1, p.cdg)}, {p.cpre}{pad(p.cst + 2, p.cdg)} …
      </div>
    </>
  );

  const customFieldsQ = (
    <>
      <Field span={4} label="Prefix"><input type="text" value={f.qpre} onChange={set("qpre")} placeholder="QRK" /></Field>
      <Field span={4} label="Start at"><input type="number" min="0" value={f.qst} onChange={set("qst")} /></Field>
      <Field span={4} label="Digits"><input type="number" min="1" max="20" value={f.qdg} onChange={set("qdg")} /></Field>
      <div className="cn-info" style={{ gridColumn: "1/-1" }}>
        Example: {p.qpre}{pad(p.qst, p.qdg)}, {p.qpre}{pad(p.qst + 1, p.qdg)}, {p.qpre}{pad(p.qst + 2, p.qdg)} …
      </div>
    </>
  );

  const textFields = (t) => (
    <div className="cn-row">
      <Field span={12} label="Text"><textarea rows={2} value={t.text} onChange={setTxt(t.id, "text")} /></Field>
      <Field span={12} label="Font">
        <select value={t.family} onChange={setTxt(t.id, "family")}>
          <option value="">Same as numbering ({f.font})</option>
          {fonts.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <Field span={6} label="Size (pt)"><input type="number" min="1" step="0.5" value={t.pt} onChange={setTxt(t.id, "pt")} /></Field>
      <Field span={6} label="Colour"><input type="color" value={t.color} onChange={setTxt(t.id, "color")} /></Field>
      <Switch span={6} checked={t.bold} onChange={setTxt(t.id, "bold")}>Bold</Switch>
      <Switch span={6} checked={t.italic} onChange={setTxt(t.id, "italic")}>Italic</Switch>
      <Switch span={12} checked={t.underline} onChange={setTxt(t.id, "underline")}>Underline</Switch>
      <Field span={6} label="X (Left)"><Mm><input type="number" step="0.5" value={t.x} onChange={setTxt(t.id, "x")} /></Mm></Field>
      <Field span={6} label="Y (Top)"><Mm><input type="number" step="0.5" value={t.y} onChange={setTxt(t.id, "y")} /></Mm></Field>
    </div>
  );

  const props = (() => {
    if (sel === "num") return (
      <div className="cn-row">
        <Field span={6} label="X (Left)"><Mm><input type="number" step="0.5" value={f.nx} onChange={set("nx")} /></Mm></Field>
        <Field span={6} label="Y (Top)"><Mm><input type="number" step="0.5" value={f.ny} onChange={set("ny")} /></Mm></Field>
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
    if (selText) return textFields(selText);
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

  const tools = [
    {
      id: "template", icon: "tpl", label: "Template", title: "Template",
      body: (
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
      ),
    },
    {
      id: "artwork", icon: "art", label: "Artwork", title: "Artwork",
      body: (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} className="cn-artslot">
              <label className="cn-drop">
                <input type="file" accept="image/*,application/pdf,.pdf" hidden onChange={(e) => onArt(e, i)} />
                <Ic n="art" />
                <strong>Artwork {i + 1}</strong>
                <small>PNG, JPG, WebP or PDF</small>
                <span className="cn-btn sm">Upload File</span>
              </label>
              <div className="cn-file"><b>{artNames[i]}</b></div>
              {S.slots[i].img && (
                <button className="cn-btn ghost danger sm" type="button" onClick={() => clearArt(i)}><Ic n="trash" />Remove</button>
              )}
            </div>
          ))}
          <div className="cn-row">
            <Field span={6} label="Artwork DPI"><input type="number" min="36" max="1200" value={f.dpi} onChange={set("dpi")} /></Field>
            <Field span={6} label="Series"><input type="text" value={f.series} onChange={set("series")} /></Field>
            <Switch checked={f.noArt} onChange={set("noArt")}>Hide background (preview &amp; export)</Switch>
          </div>
        </>
      ),
    },
    {
      id: "numbering", icon: "hash", label: "Number", title: "Numbering",
      body: (
        <>
          <div className="cn-range"><strong>{rangeTxt}</strong></div>
          <div className="cn-row">
            <Field span={12} label="Static word"><input type="text" value={f.word} onChange={set("word")} /></Field>
            <Field span={4} label="From *"><input type="number" min="0" value={f.from} onChange={set("from")} /></Field>
            <Field span={4} label="To *"><input type="number" min="0" value={f.to} onChange={set("to")} /></Field>
            <Field span={4} label="Digits"><input type="number" min="1" max="20" value={f.digits} onChange={set("digits")} /></Field>
          </div>
        </>
      ),
    },
    {
      id: "style", icon: "type", label: "Style", title: "Text Styling",
      body: (
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
          <div className="cn-actions">
            <label className="cn-btn ghost">
              <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={onFont} />
              Upload font (TTF/OTF)
            </label>
          </div>
        </div>
      ),
    },
    {
      id: "barcode", icon: "bar", label: "Barcode", title: "Barcode (128)",
      body: (
        <>
          <Switch checked={f.bar} onChange={set("bar")}>Barcode {f.bar ? "ON" : "OFF"}</Switch>
          {f.bar && (
            <div className="cn-row">
              <Field span={6} label="Width"><Mm><input type="number" min="5" step="1" value={f.bw} onChange={set("bw")} /></Mm></Field>
              <Field span={6} label="Height"><Mm><input type="number" min="2" step="0.5" value={f.bh} onChange={set("bh")} /></Mm></Field>
              <Switch span={12} checked={f.qz} onChange={set("qz")}>Quiet zone</Switch>
              <Field span={6} label="X"><Mm><input type="number" step="0.5" value={f.bx} onChange={set("bx")} /></Mm></Field>
              <Field span={6} label="Y"><Mm><input type="number" step="0.5" value={f.by} onChange={set("by")} /></Mm></Field>
              <Field span={12} label="Encodes"><select value={f.benc} onChange={set("benc")}>{encOptions}</select></Field>
              {f.benc === CUSTOM && customFields}
            </div>
          )}
        </>
      ),
    },
    {
      id: "qr", icon: "qr", label: "QR", title: "QR Code",
      body: (
        <>
          <Switch checked={f.qr} onChange={set("qr")}>QR code {f.qr ? "ON" : "OFF"}</Switch>
          {f.qr && (
            <div className="cn-row">
              <Field span={4} label="Size"><Mm><input type="number" min="8" step="1" value={f.qs} onChange={set("qs")} /></Mm></Field>
              <Field span={4} label="X"><Mm><input type="number" step="0.5" value={f.qx} onChange={set("qx")} /></Mm></Field>
              <Field span={4} label="Y"><Mm><input type="number" step="0.5" value={f.qy} onChange={set("qy")} /></Mm></Field>
              <Field span={12} label="Encodes"><select value={f.qenc} onChange={set("qenc")}>{encOptions}</select></Field>
              {f.qenc === CUSTOM && customFieldsQ}
            </div>
          )}
        </>
      ),
    },
    {
      id: "excel", icon: "xls", label: "Excel", title: "Excel Data", badge: sheet ? sheet.count.toLocaleString() : null,
      body: (
        <>
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
        </>
      ),
    },
    {
      id: "texts", icon: "lines", label: "Text", title: "Custom Text", badge: texts.length > 0 ? String(texts.length) : null,
      body: (
        <>
          <div className="cn-row">
            <Field span={12} label="Number of text boxes">
              <input type="number" min="0" max="20" step="1" value={texts.length} onChange={(e) => setTextCount(e.target.value)} />
            </Field>
          </div>
          {texts.map((t) => (
            <details key={t.id} className={`cn-col${t.on ? "" : " off"}`} onFocus={() => setSel(t.id)}>
              <summary>
                <label className="cn-f cn-chk" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={t.on} onChange={setTxt(t.id, "on")} />
                  <span title={t.text}>{t.text.split("\n")[0] || "(empty)"}</span>
                </label>
                <button className="cn-icon-btn" type="button" title="Remove"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeText(t.id); }}>
                  <Ic n="trash" />
                </button>
              </summary>
              {textFields(t)}
            </details>
          ))}
        </>
      ),
    },
    {
      id: "output", icon: "down", label: "Output", title: "Output",
      body: (
        <>
          <div className="cn-row">
            <Field span={12} label="Layout">
              <select value={f.mode} onChange={set("mode")}>
                <option value="normal">Normal (one per page)</option>
                <option value="simplex">Simplex (UPS sheet)</option>
                <option value="duplex">Duplex</option>
              </select>
            </Field>
            {f.mode === "simplex" && (
              <>
                <Field span={4} label="UPS (down)"><input type="number" min="1" max="50" value={f.ups} onChange={set("ups")} /></Field>
                <Field span={4} label="Columns"><input type="number" min="1" max="10" value={f.ucols} onChange={set("ucols")} /></Field>
                <Field span={4} label="Gap"><Mm><input type="number" min="0" step="0.5" value={f.ugap} onChange={set("ugap")} /></Mm></Field>
              </>
            )}
            <Field span={12} label="Pages per output file">
              <input type="number" min="1" value={f.per} onChange={set("per")} />
            </Field>
          </div>
          <div className="cn-info">PDF / ZIP is split into a new file after this many certificates.</div>
        </>
      ),
    },
  ];
  const activeTool = tools.find((t) => t.id === tool);

  return (
    <div className={`cn-root${maxed ? " cn-max" : ""}`} ref={rootRef}>
      <style>{CSS}</style>

      {toast && (
        <div className={`cn-toast ${toast.cls}`} role="alert" onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {saveDlg && (
        <div className="cn-dlg-back" onClick={() => setSaveDlg(null)}>
          <div className="cn-dlg" onClick={(e) => e.stopPropagation()}>
            {saveDlg === "choose" ? (
              <>
                <p>Save your changes to "{(tpls.find((t) => t._id === tplId) || {}).name}"?</p>
                <div className="cn-actions">
                  <button className="cn-btn" type="button"
                    onClick={() => doSave((tpls.find((t) => t._id === tplId) || {}).name, true)}>
                    Overwrite
                  </button>
                  <button className="cn-btn ghost" type="button"
                    onClick={() => { setNewName(""); setSaveDlg("name"); }}>
                    New template
                  </button>
                </div>
                <button className="cn-btn ghost sm" type="button" onClick={() => setSaveDlg(null)}>Cancel</button>
              </>
            ) : (
              <>
                <p>Name for the new template</p>
                <input type="text" autoFocus value={newName} placeholder="e.g. Certificate A4"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") doSave(newName, false); if (e.key === "Escape") setSaveDlg(null); }} />
                <div className="cn-actions">
                  <button className="cn-btn" type="button" onClick={() => doSave(newName, false)}>Save</button>
                  <button className="cn-btn ghost" type="button" onClick={() => setSaveDlg(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* loading overlay: blocks all input until the artwork is processed and painted */}
      {busy && (
        <div className="cn-busy" role="status" aria-live="polite">
          <div className="cn-spin" />
          <b>{busy}</b>
          <span>Please wait…</span>
        </div>
      )}

      {/* workspace grid: dynamically expands preview canvas */}
      <div className={`cn-work ${!sideOpen ? "no-side" : ""} ${!propsOpen ? "no-props" : ""}`} ref={workRef}>
        
       

        {/* ---------- left: slim tool rail ---------- */}
        <nav className="cn-rail" aria-label="Tools">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`cn-rb${tool === t.id ? " on" : ""}`}
              title={t.title}
              onClick={(e) => {
                const w = workRef.current;
                if (w && window.innerWidth > 880) {
                  const wr = w.getBoundingClientRect(), br = e.currentTarget.getBoundingClientRect();
                  const relTop = br.top - wr.top, relBottom = wr.bottom - br.bottom;
                  if (relTop > wr.height / 2) {
                    const b = Math.max(8, relBottom);
                    setFlyPos({ top: "auto", bottom: b, maxHeight: wr.height - b - 8 });
                  } else {
                    const tp = Math.max(8, relTop);
                    setFlyPos({ top: tp, bottom: "auto", maxHeight: wr.height - tp - 8 });
                  }
                } else {
                  setFlyPos(null);
                }
                setTool((cur) => (cur === t.id ? null : t.id));
              }}
            >
              <Ic n={t.icon} s={18} />
              <span>{t.label}</span>
              {t.badge && <i className="cn-rb-badge">{t.badge}</i>}
            </button>
          ))}
          <div className="cn-rail-sp" />
          <button type="button" className="cn-rb" title="Hide tool rail" onClick={() => { setSideOpen(false); setTool(null); }}>
            <Ic n="sidebar" s={18} />
            <span>Hide</span>
          </button>
        </nav>

        {/* floating tool card */}
        {sideOpen && activeTool && (
          <div className="cn-fly" role="dialog" aria-label={activeTool.title} style={flyPos || undefined}>
            <div className="cn-fly-head">
              <strong>{activeTool.title}</strong>
              <button className="cn-icon-btn" type="button" title="Close" onClick={() => setTool(null)}>
                <Ic n="close" />
              </button>
            </div>
            <form className="cn-fly-body" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
              {activeTool.body}
            </form>
          </div>
        )}
        <section className="cn-stage">
          <div className="cn-tool">
            <div className="cn-tool-left">
              {!sideOpen && (
                <button className="cn-btn ghost sm" type="button" title="Show configuration sidebar" onClick={() => setSideOpen(true)}>
                  <Ic n="sidebar" /> Controls
                </button>
              )}
              <strong>Preview</strong>
              {f.mode === "simplex" && (
                <>
                  <button className={`cn-btn ghost sm ${!sheetView ? "active-mode" : ""}`} type="button" onClick={() => setSheetView(false)}>Design</button>
                  <button className={`cn-btn ghost sm ${sheetView ? "active-mode" : ""}`} type="button" onClick={() => setSheetView(true)}>Sheet</button>
                </>
              )}
              <span className="cn-dim">{dims[act].w}×{dims[act].h}px</span>



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

              <button className="cn-btn ghost sm" type="button" disabled={running} onClick={onCenter} title="Centre number and barcode">
                <Ic n="center" />
              </button>
              <button className={`cn-btn ghost sm ${isMaximized ? "active-mode" : ""}`} type="button" onClick={toggleMaximize} title={isMaximized ? "Restore sidebars" : "Maximize preview (hide sidebars)"}>
                <Ic n={isMaximized ? "shrink" : "expand"} />
              </button>
              {!propsOpen && (
                <button className="cn-btn ghost sm" type="button" title="Show inspector panel" onClick={() => setPropsOpen(true)}>
                  <Ic n="panelRight" /> Inspector
                </button>
              )}
              <div className="cn-gen-btns">
                
                {running && <button className="cn-btn stop sm" type="button" onClick={() => { stopFlag.current = true; }}><Ic n="stop" /> Stop</button>}
              </div>            </div>
          </div>

          <div className="cn-canvas-area" ref={areaRef}>
          <div className="cn-canvas-wrap" style={showSheet ? { display: "none" } : undefined}>
            <div className="cn-trio" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0,1fr))`, ...(zoom !== "fit" ? { width: `${zoom * visible.length}%` } : {}) }}>
              {[0, 1, 2].map((i) => (
                <figure key={i} hidden={!visible.includes(i)} className={`cn-card${act === i ? " act" : ""}`}
                  onClick={() => { setAct(i); actRef.current = i; bind(i); }}>
                  <figcaption>
                    <b>Artwork {i + 1}</b>
                    {act === i && <span className="cn-badge">Editing</span>}
                    <span className="cn-dim">{dims[i].w}×{dims[i].h}px</span>
                    <div className="cn-card-dl">
                      <button className="cn-btn primary sm" type="button"
                        disabled={running || (i > 0 && !S.slots[i].img)} onClick={() => generate("pdf", i)}>
                        <Ic n="down" /> PDF
                      </button>
                      <button className="cn-btn ghost sm" type="button"
                        disabled={running || (i > 0 && !S.slots[i].img)} onClick={() => generate("zip", i)}>
                        ZIP
                      </button>
                    </div>
                  </figcaption>
                  <canvas
                    ref={(el) => { cvRefs.current[i] = el; }}
                    tabIndex={0}
                    className="cn-preview-canvas"
                    aria-label={`Artwork ${i + 1} preview. Click and drag elements to position them.`}
                    onPointerDown={onDown(i)}
                    onPointerMove={onMove(i)}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    onDoubleClick={onDbl(i)}
                    onKeyDown={onKey}
                  />
                </figure>
              ))}
            </div>
          </div>

          <div className="cn-canvas-wrap" style={{ display: showSheet ? "flex" : "none" }}>
            <canvas ref={shRef} className="cn-preview-canvas fit-mode" />
          </div>

          {/* floating inspector over the preview */}
          {propsOpen && (
            <aside
              className="cn-props"
              aria-label="Element properties"
              ref={propsRef}
              style={(inspManual || inspPos) ? { left: (inspManual || inspPos).left, top: (inspManual || inspPos).top, right: "auto", bottom: "auto" } : undefined}
            >
              <div
                className="cn-props-head cn-drag"
                onPointerDown={onInspDown}
                onPointerMove={onInspMove}
                onPointerUp={onInspUp}
                onPointerCancel={onInspUp}
                title="Drag to move"
              >
                <span className="cn-props-dot" />
                <strong className="cn-props-n">{selName || "Nothing selected"}</strong>
                {inspManual && (
                  <button className="cn-icon-btn" type="button" title="Follow the selected element again"
                    onClick={() => { setInspManual(null); requestAnimationFrame(() => placeRef.current && placeRef.current()); }}>
                    <Ic n="center" />
                  </button>
                )}
                <button className="cn-icon-btn" type="button" title="Hide inspector" onClick={() => setPropsOpen(false)}>
                  <Ic n="close" />
                </button>
              </div>
              <div className="cn-props-body">
                {props}
                {measure && (
                  <div className="cn-meas">
                    <b>Edge distances</b>
                    <span>X: {r1(getPos(measure)[0])} mm · Y: {r1(getPos(measure)[1])} mm</span>
                    <small>Esc to clear.</small>
                  </div>
                )}
              </div>
            </aside>
          )}
          </div>

          <div className="cn-hints">
            <span><b>Tip:</b> Click &amp; drag elements on the canvas.</span>
            <span>Arrow keys nudge position (Shift = 5 mm).</span>
            <span>Double-click an element to show edge distance guides (Esc hides).</span>
            {f.noArt && <span className="warn">Artwork background is hidden on output.</span>}
          </div>
        </section>

      </div>

      {running && (
        <div className="cn-gen" role="status" aria-live="polite">
          <span className="cn-loader" aria-hidden="true" />
          <div className="cn-gen-info">
            <div className="cn-gen-stats">
              <b>{count.toLocaleString()} certificates</b>
              <span className="cn-badge-inline">{okRange ? `${pad(p.from, p.digits)} → ${pad(p.to, p.digits)}` : "Set range"}</span>
              {sheet && <span className="cn-muted">Excel: {sheet.count.toLocaleString()} rows</span>}
            </div>
            <div className="cn-bar" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
            <div className={`cn-status ${status.cls}`}>{status.msg || "Preparing download…"}</div>
          </div>
        </div>
      )}
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
@font-face{font-family:"Century";src:url("/fonts/CENTURY.TTF") format("truetype");font-display:swap}
.cn-root textarea{width:100%;padding:5px 7px;font:inherit;color:var(--ink);background:#fff;border:1px solid var(--line2);border-radius:6px;resize:vertical}
.cn-root{
  --bg:#f1f4f6;--surface:#ffffff;--ink:#0b2730;--muted:#5c737d;--line:#dce3e7;--line2:#c5d2d8;
  --accent:#0f7f96;--accent-d:#0a6678;--accent-soft:#e6f3f6;--err:#b3261e;--ok:#137358;
  --shadow:0 1px 3px rgba(11,39,48,.05),0 6px 18px rgba(11,39,48,.06);
  position:relative;
  display:flex;flex-direction:column;height:100dvh;min-height:540px;width:100%;max-width:100%;
  background:var(--bg);color:var(--ink);border:none;border-radius:0;overflow:hidden;
  font:13px/1.4 "Figtree","Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
}
.cn-root *,.cn-root *::before,.cn-root *::after{box-sizing:border-box}
.cn-root.cn-max{position:fixed;inset:0;z-index:9999;width:100vw;height:100dvh;max-width:none;border-radius:0;border:none}
.cn-root:fullscreen{width:100vw;height:100dvh;border-radius:0;border:none}
.cn-ic{flex:0 0 auto}
.cn-dlg-back{
  position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;
  background:rgba(11,39,48,.35);backdrop-filter:blur(1.5px);animation:cnfadein .15s ease;
}
  .cn-toast{
  position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:70;
  min-width:300px;max-width:min(680px,92%);padding:16px 26px;border-radius:12px;cursor:pointer;
  font-weight:700;font-size:15px;line-height:1.5;text-align:center;overflow-wrap:anywhere;
  background:#fff;border:1px solid var(--line2);box-shadow:0 10px 34px rgba(11,39,48,.28);
  animation:cntoast .2s ease;
}
.cn-toast.ok{color:var(--ok);border-color:#b7dccf;background:#eefaf5}
.cn-toast.err{color:var(--err);border-color:#efc2bf;background:#fdf0ef}
@keyframes cntoast{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
.cn-dlg{
  width:min(380px,90%);padding:18px 18px 14px;border-radius:10px;background:#fff;
  border:1px solid var(--line2);border-top:4px solid var(--accent);box-shadow:0 12px 40px rgba(11,39,48,.3);
  display:flex;flex-direction:column;gap:14px;
}
.cn-dlg p{margin:0;font-size:13.5px;font-weight:600;line-height:1.45;overflow-wrap:anywhere}
.cn-dlg .cn-btn{align-self:flex-end;min-width:70px}
.cn-dlg.ok{border-top-color:var(--ok)}
.cn-dlg.ok p{color:var(--ok)}
.cn-dlg.err{border-top-color:var(--err)}
.cn-dlg.err p{color:var(--err)}

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

/* Compact settings panels leave more room for the page preview. */
.cn-work{
  flex:1;min-height:0;display:grid;
  grid-template-columns:190px minmax(0,1fr) 170px;
  gap:8px;padding:6px;transition:grid-template-columns .2s ease;
}
.cn-work.no-side{grid-template-columns:0px minmax(0,1fr) 170px}
.cn-work.no-props{grid-template-columns:190px minmax(0,1fr) 0px}
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
  padding:6px 8px;background:var(--surface);border-bottom:1px solid var(--line);
}
.cn-panel-title{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--ink)}
.cn-icon-btn{
  background:transparent;border:none;color:var(--muted);cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;
  width:24px;height:24px;border-radius:5px;
}
.cn-icon-btn:hover{background:var(--accent-soft);color:var(--accent-d)}

.cn-side form{flex:1;min-height:0;overflow-y:auto;padding:5px;display:flex;flex-direction:column;gap:5px}

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
  padding:5px 10px;border-bottom:1px solid var(--line);background:#fafbfc;flex-wrap:nowrap;overflow:hidden;white-space:nowrap;
}
.cn-tool-left,.cn-tool-center,.cn-tool-right{display:flex;align-items:center;gap:6px;flex:0 0 auto}
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
  flex:1;min-height:0;display:flex;padding:6px;overflow:auto;
  background-color:#e9edf0;background-image:radial-gradient(#c7d3db 1px,transparent 1px);background-size:20px 20px;
}
.cn-preview-canvas{
  display:block;margin:auto;box-shadow:0 3px 6px rgba(11,39,48,.1),0 16px 40px rgba(11,39,48,.2);
  touch-action:none;background:#fff;
}
.cn-preview-canvas:not(.fit-mode){flex:none}
.cn-preview-canvas.fit-mode{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}

.cn-hints{
  display:flex;flex-wrap:wrap;gap:4px 14px;padding:5px 10px;border-top:1px solid var(--line);
  font-size:11px;color:var(--muted);background:#fafbfc;
}
.cn-hints .warn{color:#8a5a00;font-weight:600}

/* right inspector */
.cn-props-body{padding:7px 8px;overflow-y:auto;display:flex;flex-direction:column;gap:7px}
.cn-props-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);display:inline-block}
.cn-props-head-info{display:flex;flex-direction:column;gap:1px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.cn-props-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.cn-props-n{font-size:13.5px;color:var(--ink);overflow-wrap:anywhere}
.cn-meas{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:6px;background:#fff4ee;border:1px solid #f3cdb9;font-size:11.5px}
.cn-meas b{color:#d9480f}

/* generation footer bar */
.cn-gen{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;width:min(420px,92%);display:flex;align-items:center;gap:10px;padding:8px 12px;
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
.cn-gen-btns{display:flex;gap:5px;flex-wrap:nowrap}.cn-loader{width:18px;height:18px;flex:0 0 auto;border:2px solid var(--line2);border-top-color:var(--accent);border-radius:50%;animation:cn-rot .8s linear infinite}.cn-gen .cn-gen-info{flex:1 1 auto}.cn-gen .cn-status{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* responsive adjustments */
@media (max-width:1080px){
  .cn-work{grid-template-columns:210px minmax(0,1fr) 170px}
}
@media (max-width:880px){
  .cn-root{height:auto;overflow:visible}
  .cn-work{display:flex;flex-direction:column}
  .cn-stage{order:-1;min-height:480px}
  .cn-canvas-wrap{min-height:360px}
}

/* ---------- entrance animations ---------- */
@keyframes cnfadeup{
  from{opacity:0;transform:translatey(18px)}
  to{opacity:1;transform:translatey(0)}
}
@keyframes cnfadein{from{opacity:0}to{opacity:1}}
@keyframes cnslideleft{
  from{opacity:0;transform:translatex(-24px)}
  to{opacity:1;transform:translatex(0)}
}
@keyframes cnslideright{
  from{opacity:0;transform:translatex(24px)}
  to{opacity:1;transform:translatex(0)}
}
@keyframes cnslideup{
  from{opacity:0;transform:translatey(100%)}
  to{opacity:1;transform:translatey(0)}
}

/* "backwards" fill so nothing stays locked after the animation ends */
.cn-root{animation:cnfadein .4s ease backwards}
.cn-side{animation:cnslideleft .55s cubic-bezier(.22,1,.36,1) .05s backwards}
.cn-stage{animation:cnfadeup .6s cubic-bezier(.22,1,.36,1) .15s backwards}
.cn-props{animation:cnslideright .55s cubic-bezier(.22,1,.36,1) .25s backwards}
.cn-gen{animation:cnslideup .5s cubic-bezier(.22,1,.36,1) .4s backwards}

/* sidebar sections cascade */
.cn-side form>.cn-sec{animation:cnfadeup .45s cubic-bezier(.22,1,.36,1) backwards}
.cn-side form>.cn-sec:nth-child(1){animation-delay:.25s}
.cn-side form>.cn-sec:nth-child(2){animation-delay:.31s}
.cn-side form>.cn-sec:nth-child(3){animation-delay:.37s}
.cn-side form>.cn-sec:nth-child(4){animation-delay:.43s}
.cn-side form>.cn-sec:nth-child(5){animation-delay:.49s}
.cn-side form>.cn-sec:nth-child(6){animation-delay:.55s}
.cn-side form>.cn-sec:nth-child(7){animation-delay:.61s}

/* canvas fades in after the stage */
.cn-preview-canvas{animation:cnfadein .6s ease .45s backwards}

/* excel column items and inspector content */
.cn-col{animation:cnfadein .3s ease backwards}
.cn-props-body{animation:cnfadein .4s ease .5s backwards}

.cn-artslot{display:flex;flex-direction:column;gap:4px;padding-bottom:8px;border-bottom:1px dashed var(--line)}
.cn-trio{flex:none;align-self:flex-start;width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}
.cn-card{margin:0;min-width:0;background:var(--surface);border:2px solid var(--line);border-radius:8px;overflow:hidden}
.cn-card.act{border-color:var(--accent)}
.cn-card figcaption{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:5px 8px;border-bottom:1px solid var(--line);font-size:12px}
.cn-card-dl{margin-left:auto;display:flex;gap:5px}
.cn-card canvas{display:block;width:100%;height:auto;margin:0;box-shadow:none}
@media (max-width:880px){.cn-trio{grid-template-columns:1fr}}

/* ===== tool rail + floating panels (large preview) ===== */
.cn-work,.cn-work.no-props{display:grid;grid-template-columns:56px minmax(0,1fr);gap:4px;padding:4px}
.cn-work.no-side,.cn-work.no-side.no-props{grid-template-columns:0px minmax(0,1fr);gap:0}
.cn-work{position:relative}
.cn-stage{min-height:0;min-width:0}
.cn-rail{
  display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 3px;min-height:0;overflow-y:auto;overflow-x:hidden;
  background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow);
}
.cn-work.no-side .cn-rail{opacity:0;pointer-events:none;border:none;padding:0;overflow:hidden}
.cn-rail-sp{flex:1}
.cn-rb{
  position:relative;width:48px;padding:6px 0 4px;display:flex;flex-direction:column;align-items:center;gap:2px;
  border:none;background:transparent;border-radius:8px;color:var(--muted);cursor:pointer;font:600 9.5px/1.1 inherit;
}
.cn-rb:hover{background:var(--accent-soft);color:var(--accent-d)}
.cn-rb.on{background:var(--accent);color:#fff}
.cn-rb-badge{
  position:absolute;top:2px;right:2px;min-width:15px;height:15px;padding:0 3px;border-radius:999px;
  background:var(--accent);color:#fff;font:700 8.5px/15px inherit;font-style:normal;text-align:center;
}
.cn-rb.on .cn-rb-badge{background:#fff;color:var(--accent-d)}
.cn-fly{
  position:absolute;left:64px;top:8px;z-index:30;width:286px;max-height:calc(100% - 16px);
  display:flex;flex-direction:column;overflow:hidden;
  background:var(--surface);border:1px solid var(--line2);border-radius:10px;
  box-shadow:0 14px 40px rgba(11,39,48,.28);animation:cnfadein .12s ease;
}
.cn-fly-head{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 12px;border-bottom:1px solid var(--line);background:#fafbfc}
.cn-fly-head strong{font-size:12.5px}
.cn-fly-body{padding:10px 12px 12px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;min-height:0}
.cn-canvas-area{flex:1;min-height:0;position:relative;display:flex}
.cn-canvas-wrap{padding:4px}
.cn-trio{gap:8px}
.cn-hints{padding:3px 10px;font-size:10.5px}
.cn-props{
  position:absolute;right:12px;bottom:12px;top:auto;left:auto;z-index:15;width:208px;max-height:calc(100% - 24px);
  display:flex;flex-direction:column;overflow:hidden;
  background:rgba(255,255,255,.97);border:1px solid var(--line2);border-radius:10px;
  box-shadow:0 10px 30px rgba(11,39,48,.25);animation:cnfadein .12s ease;
}
.cn-props-head{display:flex;align-items:center;gap:6px;padding:5px 6px 5px 10px;border-bottom:1px solid var(--line);background:#fafbfc}
.cn-props-head .cn-props-n{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cn-props-body{padding:8px;min-height:0}
@media (max-width:880px){
  .cn-root{height:100dvh;overflow:hidden}
  .cn-work,.cn-work.no-props{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
  .cn-work.no-side,.cn-work.no-side.no-props{grid-template-columns:minmax(0,1fr);grid-template-rows:0px minmax(0,1fr)}
  .cn-stage{order:0;min-height:0}
  .cn-rail{flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:3px}
  .cn-rail-sp{display:none}
  .cn-fly{left:8px;right:8px;top:64px;width:auto;max-height:calc(100% - 72px)}
  .cn-props{width:180px}
  .cn-trio{grid-template-columns:1fr!important}
}

.cn-drag{cursor:grab;touch-action:none;user-select:none}
.cn-drag:active{cursor:grabbing}

@media (prefers-reduced-motion:reduce){
  .cn-root,.cn-root *,.cn-root *::before,.cn-root *::after{animation:none!important}
}
`;
