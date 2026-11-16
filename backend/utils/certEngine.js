"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const JsBarcode = require("jsbarcode");
const QRCode = require("qrcode");
const opentype = require("opentype.js");
const fontIndex = require("./fontIndex");

const SERIAL = "__serial";
const CUSTOM = "__custom";

const pad = (n, d) => String(n).padStart(d, "0");
const num = (v, d = 0) => { const x = parseFloat(v); return isFinite(x) ? x : d; };

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

const JPG_Q = 1;
const BG_MAX = 1.2 * 1024 * 1024;
const BG_Q = 1;
const PDF_TARGET = 6 * 1024 * 1024;

const mk = (w = 1, h = 1) => createCanvas(w, h);
const toBlob = (cv, type, q) => cv.encode(type === "image/png" ? "png" : "jpeg", Math.round(q * 100));
const deflateAsync = promisify(zlib.deflate);
const deflate = (s) => deflateAsync(typeof s === "string" ? Buffer.from(s, "utf8") : s);
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const tick = () => new Promise((r) => setTimeout(r, 0));

/* ---------- vector text (glyph outlines for the PDF) ---------- */
const FONT_BYTES = new Map();   // uploaded fonts: family -> Buffer
const OT_CACHE = new Map();
async function getOtFont(family, bold, italic) {
  const key = `${family}|${bold}|${italic}`;
  if (OT_CACHE.has(key)) return OT_CACHE.get(key);
  let ent = null;
  try {
    let buf = FONT_BYTES.get(family) || null, fake = !!bold;
    if (!buf && family === "Century") { const cp = fontIndex.centuryPath(); if (cp) buf = fs.readFileSync(cp); }
    if (buf && italic) buf = null;   // no real italic face -> keep the image fallback
    if (!buf && !FONT_BYTES.has(family) && family !== "Century") {
      const all = fontIndex.findFonts(family);
      const isB = (x) => /bold|black|heavy/i.test(x.style), isI = (x) => /italic|oblique/i.test(x.style);
      let m = all.find((x) => isB(x) === !!bold && isI(x) === !!italic);
      fake = false;
      if (!m && bold) { m = all.find((x) => !isB(x) && isI(x) === !!italic); fake = !!m; }
      if (m) buf = fs.readFileSync(m.path);
    }
    if (buf) ent = { font: opentype.parse(toAB(buf)), fake };
  } catch { ent = null; }
  OT_CACHE.set(key, ent);
  return ent;
}
const otPeek = (family, bold, italic) => OT_CACHE.get(`${family}|${!!bold}|${!!italic}`) || null;
const hexRgb = (h) => {
  const v = parseInt(String(h).slice(1), 16) || 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((a) => (a / 255).toFixed(3)).join(" ");
};
let MC = null;
const mc = () => (MC ||= mk().getContext("2d"));

function vecBox(b) {
  if (!b || !b.runs || !b.runs.length) return null;
  const ctx = mc();
  const n2 = (v) => v.toFixed(1);
  let out = "";
  for (const r of b.runs) {
    if (!r.t) continue;
    const ent = otPeek(r.family, r.bold, r.italic);
    if (!ent) return null;
    ctx.font = `${r.italic ? "italic " : ""}${r.bold ? 700 : 400} ${r.px}px "${r.family}", sans-serif`;
    ctx.textBaseline = "top";
    const ab = ctx.measureText(r.t).alphabeticBaseline;
    const base = r.y + (typeof ab === "number" && ab < 0 ? -ab : r.px * (ent.font.ascender / ent.font.unitsPerEm));
    const path_ = ent.font.getPath(r.t, r.x, base, r.px);
    let d = "", cx = 0, cy = 0;
    for (const c of path_.commands) {
      if (c.type === "M") { d += `${n2(c.x)} ${n2(c.y)} m `; cx = c.x; cy = c.y; }
      else if (c.type === "L") { d += `${n2(c.x)} ${n2(c.y)} l `; cx = c.x; cy = c.y; }
      else if (c.type === "C") { d += `${n2(c.x1)} ${n2(c.y1)} ${n2(c.x2)} ${n2(c.y2)} ${n2(c.x)} ${n2(c.y)} c `; cx = c.x; cy = c.y; }
      else if (c.type === "Q") {
        d += `${n2(cx + (2 / 3) * (c.x1 - cx))} ${n2(cy + (2 / 3) * (c.y1 - cy))} ${n2(c.x + (2 / 3) * (c.x1 - c.x))} ${n2(c.y + (2 / 3) * (c.y1 - c.y))} ${n2(c.x)} ${n2(c.y)} c `;
        cx = c.x; cy = c.y;
      } else if (c.type === "Z") d += "h ";
    }
    const col = hexRgb(r.c);
    out += ent.fake
      ? `${col} rg ${col} RG ${n2(r.px * 0.035)} w 1 j ${d}B\n`
      : `${col} rg ${d}f\n`;
    if (r.ul && r.w) out += `${col} rg ${n2(r.x)} ${n2(r.y + r.px * 1.05)} ${n2(r.w)} ${n2(Math.max(1, r.px * 0.06))} re f\n`;
  }
  return `q\n${out}Q\n`;
}

/* ---------- shared digit font + shared page head ---------- */
const T3 = { on: false, fast: false, font: null, form: null, headZ: null, head: "" };
function buildT3(ent) {
  const f = ent.font, upm = f.unitsPerEm, q = (v) => v.toFixed(1);
  const glyphs = [];
  let X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
  for (const ch of "0123456789") {
    const g = f.charToGlyph(ch);
    if (!g || !g.index) return null;
    const path_ = f.getPath(ch, 0, 0, upm);
    const bb = path_.getBoundingBox();
    let d = "", cx = 0, cy = 0;
    for (const c of path_.commands) {
      if (c.type === "M" || c.type === "L") { d += `${q(c.x)} ${q(-c.y)} ${c.type === "M" ? "m" : "l"} `; cx = c.x; cy = -c.y; }
      else if (c.type === "C") { d += `${q(c.x1)} ${q(-c.y1)} ${q(c.x2)} ${q(-c.y2)} ${q(c.x)} ${q(-c.y)} c `; cx = c.x; cy = -c.y; }
      else if (c.type === "Q") {
        const x1 = c.x1, y1 = -c.y1, x = c.x, y = -c.y;
        d += `${q(cx + (2 / 3) * (x1 - cx))} ${q(cy + (2 / 3) * (y1 - cy))} ${q(x + (2 / 3) * (x1 - x))} ${q(y + (2 / 3) * (y1 - y))} ${q(x)} ${q(y)} c `;
        cx = x; cy = y;
      } else if (c.type === "Z") d += "h ";
    }
    const w = q(g.advanceWidth);
    const x0 = Math.floor(bb.x1) - 1, y0 = Math.floor(-bb.y2) - 1, x1 = Math.ceil(bb.x2) + 1, y1 = Math.ceil(-bb.y1) + 1;
    X0 = Math.min(X0, x0); Y0 = Math.min(Y0, y0); X1 = Math.max(X1, x1); Y1 = Math.max(Y1, y1);
    glyphs.push({ w, proc: `${w} 0 ${x0} ${y0} ${x1} ${y1} d1\n${d}f` });
  }
  return { upm, bbox: [X0, Y0, X1, Y1], glyphs };
}
function t3Base(r, ent) {
  const ctx = mc();
  ctx.font = `${r.italic ? "italic " : ""}${r.bold ? 700 : 400} ${r.px}px "${r.family}", sans-serif`;
  ctx.textBaseline = "top";
  const ab = ctx.measureText(r.t).alphabeticBaseline;
  return r.y + (typeof ab === "number" && ab < 0 ? -ab : r.px * (ent.font.ascender / ent.font.unitsPerEm));
}
const t3Setup = (r, ent) => `${hexRgb(r.c)} rg\nBT ${r.px.toFixed(4)} 0 0 ${(-r.px).toFixed(4)} ${r.x.toFixed(2)} ${t3Base(r, ent).toFixed(2)} Tm /F1 1 Tf\n`;
const t3Tail = (b) => `(${b.runs[b.runs.length - 1].t}) Tj ET Q\n`;
function t3Num(b) {
  const r = b.runs[b.runs.length - 1], ent = otPeek(r.family, r.bold, false);
  if (!ent) return null;
  return `q\n${T3.form ? "/Stat Do\n" : ""}${t3Setup(r, ent)}(${r.t}) Tj ET\nQ\n`;
}
const vecT = (b, key) => {
  if (T3.on && key) {
    if (key === "num") return T3.fast ? t3Tail(b) : t3Num(b);
    if (key.startsWith("txt_")) return "\n";
  }
  return vecBox(b);
};

/* ---------- barcode ---------- */
function makeBarcode(val, p) {
  const u = p.dpi / 25.4;
  const probe = mk();
  JsBarcode(probe, val, { format: "CODE128", width: 1, height: 10, displayValue: false, margin: 0 });
  const mods = probe.width;
  const m = Math.max(1, Math.round((p.bw * u) / mods));
  const q = p.qz ? 10 * m : 0;
  const c = mk();
  JsBarcode(c, val, {
    format: "CODE128", width: m, height: Math.max(1, Math.round(p.bh * u)), displayValue: false,
    margin: 0, marginLeft: q, marginRight: q,
    background: p.qz ? "#ffffff" : "rgba(0,0,0,0)", lineColor: "#000000",
  });
  return c;
}

/* ---------- QR code ---------- */
function makeQR(val, p) {
  const qr = QRCode.create(val, { errorCorrectionLevel: "M" });
  const n = qr.modules.size, m = 4, total = n + 2 * m;
  const cell = Math.max(1, Math.floor((p.qs * (p.dpi / 25.4)) / total));
  const c = mk(cell * total, cell * total);
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

/* ---------- streaming PDF writer (writes straight to disk) ---------- */
function makePdfWriter(wpt, hpt, filePath) {
  const fd = fs.openSync(filePath, "w");
  let chunks = [], clen = 0, pos = 0;
  const flush = () => {
    if (!clen) return;
    const b = Buffer.concat(chunks, clen);
    let o = 0;
    while (o < b.length) o += fs.writeSync(fd, b, o, b.length - o);
    chunks = []; clen = 0;
  };
  const push = (b) => { chunks.push(b); clen += b.length; pos += b.length; if (clen > (4 << 20)) flush(); };
  const text = (t) => push(Buffer.from(t, "utf8"));
  const blobPart = (b) => push(b);
  const offs = [];
  let nextId = 3;
  const kids = [];
  const packed = [];
  const begin = (id) => { offs[id] = pos; text(`${id} 0 obj\n`); };
  const W = wpt.toFixed(3), H = hpt.toFixed(3);
  let bg = 0, shared = [], fonts = [], resId = 0, headId = 0, tplRes = 0;
  const resStr = (x) => `<< /XObject << ${x.join(" ")} >>${fonts.length ? ` /Font << ${fonts.join(" ")} >>` : ""} >>`;
  const imageObj = (blob, wPx, hPx, filter, gray) => {
    const id = nextId++;
    begin(id);
    text(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} ${gray ? "/ColorSpace /DeviceGray /BitsPerComponent 1" : "/ColorSpace /DeviceRGB /BitsPerComponent 8"} /Filter ${filter} /Length ${blob.length} >>\nstream\n`);
    blobPart(blob);
    text("\nendstream\nendobj\n");
    return id;
  };
  text("%PDF-1.5\n%\u00e2\u00e3\u00cf\u00d3\n");
  return {
    get pages() { return kids.length; },
    abort() { try { fs.closeSync(fd); } catch { /* ignore */ } try { fs.unlinkSync(filePath); } catch { /* ignore */ } },
    setBackground(blob, wPx, hPx, filter) { bg = imageObj(blob, wPx, hPx, filter); },
    useMask(name, blob, wPx, hPx) {
      const id = nextId++;
      begin(id);
      text(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ImageMask true /BitsPerComponent 1 /Filter /FlateDecode /Length ${blob.length} >>\nstream\n`);
      blobPart(blob);
      text("\nendstream\nendobj\n");
      shared.push(`/${name} ${id} 0 R`);
    },
    useFont(name, f) {
      const ids = f.glyphs.map((g) => {
        const id = nextId++;
        begin(id);
        text(`<< /Length ${g.proc.length} >>\nstream\n${g.proc}\nendstream\nendobj\n`);
        return id;
      });
      const fid = nextId++;
      begin(fid);
      text(`<< /Type /Font /Subtype /Type3 /FontBBox [${f.bbox.join(" ")}] /FontMatrix [${1 / f.upm} 0 0 ${1 / f.upm} 0 0] /CharProcs << ${ids.map((id, i) => `/g${i} ${id} 0 R`).join(" ")} >> /Encoding << /Type /Encoding /Differences [48 ${ids.map((_, i) => `/g${i}`).join(" ")}] >> /FirstChar 48 /LastChar 57 /Widths [${f.glyphs.map((g) => g.w).join(" ")}] /Resources << >> >>\nendobj\n`);
      fonts.push(`/${name} ${fid} 0 R`);
    },
    useForm(name, z, w, h) {
      const id = nextId++;
      begin(id);
      text(`<< /Type /XObject /Subtype /Form /BBox [0 0 ${w} ${h}] /Filter /FlateDecode /Length ${z.length} >>\nstream\n`);
      blobPart(z);
      text("\nendstream\nendobj\n");
      shared.push(`/${name} ${id} 0 R`);
    },
    useHead(z) {
      headId = nextId++;
      begin(headId);
      text(`<< /Filter /FlateDecode /Length ${z.length} >>\nstream\n`);
      blobPart(z);
      text("\nendstream\nendobj\n");
    },
    addTail(s) {
      if (!tplRes) { tplRes = nextId++; packed.push({ id: tplRes, s: resStr(bg ? [...shared, `/Bg ${bg} 0 R`] : shared) }); }
      const cont = nextId++, page = nextId++;
      begin(cont);
      text(`<< /Length ${s.length} >>\nstream\n${s}endstream\nendobj\n`);
      packed.push({ id: page, s: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${tplRes} 0 R /Contents [${headId} 0 R ${cont} 0 R] >>` });
      kids.push(page);
    },
    addCompact(z, patches) {
      let res;
      if (!patches.length) {
        if (!resId) { resId = nextId++; packed.push({ id: resId, s: resStr(shared) }); }
        res = `${resId} 0 R`;
      } else {
        const refs = shared.slice();
        patches.forEach((q, i) => {
          const id = q.bits ? imageObj(q.blob, q.w, q.h, "/FlateDecode", true) : q.flate ? imageObj(q.blob, q.w, q.h, "/FlateDecode") : imageObj(q.blob, q.w, q.h, "/DCTDecode");
          refs.push(`/P${i} ${id} 0 R`);
        });
        res = resStr(refs);
      }
      const cont = nextId++, page = nextId++;
      begin(cont);
      text(`<< /Filter /FlateDecode /Length ${z.length} >>\nstream\n`);
      blobPart(z);
      text("\nendstream\nendobj\n");
      packed.push({ id: page, s: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${res} /Contents ${cont} 0 R >>` });
      kids.push(page);
    },
    async addPage(patches, k, extra = "") {
      const refs = shared.slice();
      let ops = "";
      if (bg) { refs.push(`/Bg ${bg} 0 R`); ops += `q ${W} 0 0 ${H} 0 0 cm /Bg Do Q\n`; }
      patches.forEach((q, i) => {
        const id = q.bits ? imageObj(q.blob, q.w, q.h, "/FlateDecode", true) : q.flate ? imageObj(q.blob, q.w, q.h, "/FlateDecode") : imageObj(q.blob, q.w, q.h, "/DCTDecode");
        refs.push(`/P${i} ${id} 0 R`);
        const w = q.w * k, h = q.h * k, x = q.x * k, y = hpt - q.y * k - h;
        ops += `q ${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /P${i} Do Q\n`;
      });
      const all = extra ? ops + `q ${k.toFixed(6)} 0 0 ${(-k).toFixed(6)} 0 ${hpt.toFixed(3)} cm\n${extra}Q\n` : ops;
      const zc = await deflate(all);
      const cont = nextId++, page = nextId++;
      begin(cont);
      text(`<< /Filter /FlateDecode /Length ${zc.length} >>\nstream\n`);
      blobPart(zc);
      text("\nendstream\nendobj\n");
      packed.push({ id: page, s: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${resStr(refs)} /Contents ${cont} 0 R >>` });
      kids.push(page);
    },
    async finish() {
      packed.push({ id: 2, s: `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((q) => `${q} 0 R`).join(" ")}] >>` });
      const loc = new Map();
      for (let i = 0; i < packed.length; i += 200) {
        const chunk = packed.slice(i, i + 200);
        let head = "", body = "";
        chunk.forEach((o) => { head += `${o.id} ${body.length} `; body += o.s + "\n"; });
        const z = await deflate(head + body);
        const sid = nextId++;
        begin(sid);
        text(`<< /Type /ObjStm /N ${chunk.length} /First ${head.length} /Filter /FlateDecode /Length ${z.length} >>\nstream\n`);
        blobPart(z);
        text("\nendstream\nendobj\n");
        chunk.forEach((o, j) => loc.set(o.id, [sid, j]));
      }
      begin(1);
      text("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
      const xr = nextId++, xoff = pos, total = xr + 1, row = 7;
      const raw = new Uint8Array(total * row);
      const put = (id, t, a, b) => {
        const o = id * row;
        raw[o] = t;
        raw[o + 1] = (a >>> 24) & 255; raw[o + 2] = (a >>> 16) & 255; raw[o + 3] = (a >>> 8) & 255; raw[o + 4] = a & 255;
        raw[o + 5] = (b >>> 8) & 255; raw[o + 6] = b & 255;
      };
      put(0, 0, 0, 65535);
      for (let id = 1; id < total; id++) {
        if (id === xr) put(id, 1, xoff, 0);
        else if (loc.has(id)) put(id, 2, loc.get(id)[0], loc.get(id)[1]);
        else if (offs[id] !== undefined) put(id, 1, offs[id], 0);
        else put(id, 0, 0, 0);
      }
      const pr = new Uint8Array(total * (row + 1));
      for (let r = 0; r < total; r++) {
        pr[r * (row + 1)] = 2;
        for (let c = 0; c < row; c++) pr[r * (row + 1) + 1 + c] = (raw[r * row + c] - (r ? raw[(r - 1) * row + c] : 0)) & 255;
      }
      const zx = await deflate(pr);
      begin(xr);
      text(`<< /Type /XRef /Size ${total} /W [1 4 2] /Root 1 0 R /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns ${row} >> /Length ${zx.length} >>\nstream\n`);
      blobPart(zx);
      text(`\nendstream\nendobj\nstartxref\n${xoff}\n%%EOF\n`);
      flush();
      fs.closeSync(fd);
      return { path: filePath, size: pos };
    },
  };
}

/* 1-bit black/white image -> Flate-compressed bytes (barcode / QR patches) */
const bitsBlob = (img) => {
  const { width: w, height: h, data: d } = img, rb = (w + 7) >> 3, out = new Uint8Array(rb * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4] >= 128) out[y * rb + (x >> 3)] |= 0x80 >> (x & 7);
  return deflate(out);
};

/* canvas -> lossless RGB (Flate) bytes */
const rgbFlate = async (cv) => {
  const w = cv.width, h = cv.height;
  const d = cv.getContext("2d").getImageData(0, 0, w, h).data;
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
  return deflate(rgb);
};

/* "store" ZIP writer, streams files from disk */
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crcUpdate = (c, u8, len) => { for (let i = 0; i < len; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return c; };

function makeZipWriter(filePath) {
  const fd = fs.openSync(filePath, "w");
  const enc = (s) => Buffer.from(s, "utf8");
  const ents = [];
  let pos = 0;
  const w = (b) => { let o = 0; while (o < b.length) o += fs.writeSync(fd, b, o, b.length - o); };
  const chunk = Buffer.allocUnsafe(4 << 20);
  return {
    async file(name, srcPath) {
      const nb = enc(name);
      const sfd = fs.openSync(srcPath, "r");
      const size = fs.fstatSync(sfd).size;
      let c = 0xFFFFFFFF, r, at = 0;
      while ((r = fs.readSync(sfd, chunk, 0, chunk.length, at)) > 0) { c = crcUpdate(c, chunk, r); at += r; }
      const crc = (c ^ 0xFFFFFFFF) >>> 0;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
      h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      ents.push({ nb, crc, size, off: pos });
      w(Buffer.from(h.buffer)); w(nb);
      at = 0;
      while ((r = fs.readSync(sfd, chunk, 0, chunk.length, at)) > 0) { w(chunk.subarray(0, r)); at += r; }
      fs.closeSync(sfd);
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
        w(Buffer.from(d.buffer)); w(e.nb);
        pos += 46 + e.nb.length;
      }
      const z = new DataView(new ArrayBuffer(22));
      z.setUint32(0, 0x06054b50, true); z.setUint16(8, ents.length, true); z.setUint16(10, ents.length, true);
      z.setUint32(12, pos - cdStart, true); z.setUint32(16, cdStart, true);
      w(Buffer.from(z.buffer));
      fs.closeSync(fd);
      return { path: filePath, size: pos + 22 };
    },
    abort() { try { fs.closeSync(fd); } catch { /* ignore */ } try { fs.unlinkSync(filePath); } catch { /* ignore */ } },
  };
}

/* text -> shared 1-bit mask, drawn at up to 8x (compact PDF) */
async function makeMask(lines, font, px, ul) {
  const pd = Math.ceil(px * 0.25);
  const m = mk().getContext("2d");
  m.font = font;
  const wd = Math.max(1, ...lines.map((l) => m.measureText(l).width));
  const W = Math.ceil(wd + 2 * pd), H = Math.ceil(px * 1.2 * lines.length + 2 * pd);
  const SS = Math.max(3, Math.min(8, Math.floor(16000 / Math.max(W, H))));
  const c = mk(W * SS, H * SS);
  const x = c.getContext("2d");
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

/* artwork as one lossless image for the PDF (Flate); near-lossless JPEG if smaller */
async function makeBackground(S, p) {
  if (!S.img || p.noArt) return null;
  const c = mk(S.w, S.h);
  const x = c.getContext("2d");
  x.fillStyle = "#fff";
  x.fillRect(0, 0, S.w, S.h);
  x.drawImage(S.img, 0, 0, S.w, S.h);
  try {
    const d = x.getImageData(0, 0, S.w, S.h).data;
    const rgb = new Uint8Array(S.w * S.h * 3);
    for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
    const z = await deflate(rgb);
    if (z.length <= BG_MAX) return { blob: z, filter: "/FlateDecode" };
    const j = await toBlob(c, "image/jpeg", BG_Q);
    if (j && j.length < z.length) return { blob: j, filter: "/DCTDecode" };
    return { blob: z, filter: "/FlateDecode" };
  } catch {
    const j = await toBlob(c, "image/jpeg", 1);
    if (!j) throw new Error("Could not prepare the artwork for the PDF.");
    return { blob: j, filter: "/DCTDecode" };
  }
}

/* ---------- render one certificate (B receives the bounding box of every drawn element) ---------- */
function render(S, ctx, n, p, row, B) {
  const u = p.dpi / 25.4, px = (p.pt * p.dpi) / 72, val = pad(n, p.digits);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, S.w, S.h);
  if (S.img && !p.noArt) ctx.drawImage(S.img, 0, 0, S.w, S.h);

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
  if (B) B.num = { x, y, w, h: px * 1.2, runs: [
    ...(p.word ? [{ t: p.word, x, y, c: p.wc, px, bold: p.bold, family: p.family }] : []),
    { t: val, x: x + off, y, c: p.nc, px, bold: p.bold, family: p.family },
  ] };

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
    const vx = cx + tw;
    ctx.fillText(value, vx, cy);
    tw += ctx.measureText(value).width;
    if (B) B[c.id] = { x: cx, y: cy, w: Math.max(tw, cpx * 2), h: cpx * 1.2, runs: [
      ...(name ? [{ t: name, x: cx, y: cy, c: c.lc || c.color, px: cpx, bold: p.bold, family: p.family }] : []),
      { t: value, x: vx, y: cy, c: c.color, px: cpx, bold: p.bold, family: p.family },
    ] };
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
    const runs = [];
    lines.forEach((ln, i) => {
      const ly = ty + i * tpx * 1.2;
      const lw = ctx.measureText(ln).width;
      runs.push({ t: ln, x: tx, y: ly, c: t.color, px: tpx, bold: t.bold, italic: t.italic, family: t.family || p.family, ul: t.underline, w: lw });
      ctx.fillText(ln, tx, ly);
      if (t.underline && ln) ctx.fillRect(tx, ly + tpx * 1.05, lw, Math.max(1, tpx * 0.06));
      maxW = Math.max(maxW, lw);
    });
    if (B) B[t.id] = { x: tx, y: ty, w: Math.max(maxW, tpx * 2), h: tpx * 1.2 * lines.length, runs };
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
    const c = safe((v) => makeBarcode(v, p), enc(p.benc, true));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, p.bx * u, p.by * u);
    if (B) B.bar = { x: p.bx * u, y: p.by * u, w: c.width, h: c.height, cv: c };
  }
  if (p.qr) {
    const c = safe((v) => makeQR(v, p), enc(p.qenc, false, true));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, p.qx * u, p.qy * u);
    if (B) B.qr = { x: p.qx * u, y: p.qy * u, w: c.width, h: c.height, cv: c };
  }
  ctx.restore();
}

/* ====================== SIMPLEX (UPS sheet) ====================== */
async function generateSimplex(S, f, kind, slot, hooks, outDir) {
  const p = P(f);
  if (!Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from < 0 || p.to < p.from)
    throw new Error("Enter a valid range: From and To are whole numbers and To ≥ From.");
  if (String(p.to).length > p.digits) throw new Error(`"To" needs ${String(p.to).length} digits. Raise Digits to match.`);
  const total = p.to - p.from + 1;
  if (S.rows.length && total > S.rows.length)
    throw new Error(`Range has ${total.toLocaleString()} certificates but the Excel has only ${S.rows.length.toLocaleString()} rows.`);
  const u = p.dpi / 25.4, gap = Math.round(p.ugap * u);
  const per = p.ups * p.ucols;
  const SW = S.w * p.ucols + gap * (p.ucols - 1), SH = S.h * p.ups + gap * (p.ups - 1);
  if (SW * SH > 250e6) throw new Error("Sheet is too large for this browser. Lower UPS / columns or the DPI.");
  const sheets = Math.ceil(total / per);
  hooks.progress(0, total);

  const off = mk(SW, SH);
  const ctx = off.getContext("2d", { alpha: false });
  const ZIP = kind === "zip";
  const wpt = (SW * 72) / p.dpi, hpt = (SH * 72) / p.dpi;
  let cur = null, done = 0, fileNo = 0;
  const zipName = `sheets_${pad(p.from, p.digits)}-${pad(p.to, p.digits)}_art${slot + 1}.zip`;
  const zipBundle = ZIP ? makeZipWriter(path.join(outDir, zipName)) : null;
  let zipCount = 0;
  const closeFile = async (c) => {
    const info = await c.pdf.finish();
    const base = `sheets_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}_art${slot + 1}`;
    if (ZIP) {
      await zipBundle.file(`Certificates/${base}.pdf`, info.path);
      fs.unlinkSync(info.path);
      zipCount++;
    } else {
      const final = path.join(outDir, `${base}.pdf`);
      fs.renameSync(info.path, final);
      hooks.file(`${base}.pdf`, final, info.size);
    }
  };
  try {
    for (let si = 0; si < sheets && !hooks.isStopped(); si++) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, SW, SH);
      let last = p.from + si * per;
      for (let i = 0; i < per; i++) {
        const n = p.from + si * per + i;
        if (n > p.to) break;
        const col = Math.floor(i / p.ups), row = i % p.ups;   // fills down the column first
        ctx.save();
        ctx.translate(col * (S.w + gap), row * (S.h + gap));
        render(S, ctx, n, p, S.rows[n - p.from]);
        ctx.restore();
        last = n; done++;
      }
      const blob = await toBlob(off, "image/jpeg", JPG_Q);
      if (!blob) throw new Error("Could not encode a sheet (too large for this browser).");
      if (!cur) cur = { a: p.from + si * per, last, count: 0, bytes: 0, pdf: makePdfWriter(wpt, hpt, path.join(outDir, `tmp_${++fileNo}.pdf`)) };
      await cur.pdf.addPage([{ blob, x: 0, y: 0, w: SW, h: SH }], 72 / p.dpi);
      cur.last = last; cur.count++; cur.bytes += blob.length;
      hooks.progress(done, total);
      await tick();
      if (cur.count >= p.per || cur.bytes >= 1.9 * 1024 * 1024 * 1024) { const c = cur; cur = null; await closeFile(c); }
    }
    if (!hooks.isStopped() && cur) { const c = cur; cur = null; await closeFile(c); }
    if (cur) { cur.pdf.abort(); cur = null; }
    if (ZIP) {
      if (zipCount) { const info = zipBundle.finish(); hooks.file(zipName, info.path, info.size); }
      else zipBundle.abort();
    }
  } catch (err) {
    if (cur) cur.pdf.abort();
    if (zipBundle) zipBundle.abort();
    throw err;
  }
  return { total, sheets };
}

/* ====================== NORMAL (one certificate per page) ====================== */
async function generateNormal(S, f, kind, slot, hooks, outDir) {
  const p = P(f);
  if (!Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from < 0 || p.to < p.from)
    throw new Error("Enter a valid range: From and To are whole numbers and To ≥ From.");
  if (String(p.to).length > p.digits) throw new Error(`"To" needs ${String(p.to).length} digits. Raise Digits to match.`);
  const total = p.to - p.from + 1;
  if (S.rows.length && total > S.rows.length)
    throw new Error(`Range has ${total.toLocaleString()} certificates but the Excel has only ${S.rows.length.toLocaleString()} rows. Lower "To" or add rows.`);
  hooks.progress(0, total);

  const off = mk(S.w, S.h);
  const ctx = off.getContext("2d", { alpha: false });
  const wpt = (S.w * 72) / p.dpi, hpt = (S.h * 72) / p.dpi;
  let done = 0, fileNo = 0;

  const MAX_FILE = 1.9 * 1024 * 1024 * 1024;
  const ZIP = kind === "zip";
  const bg = await makeBackground(S, p);
  const bgBytes = bg ? bg.blob.length : 0;
  const COMPACT = p.noArt;   // PDF + hidden background -> tiny vector pages
  const pageRoom = !COMPACT ? Math.max(1024 * 1024, PDF_TARGET - bgBytes) : Infinity;
  const K = 72 / p.dpi;
  const INFLIGHT = 8;
  const pending = [];
  let cur = null;
  const zipName = `certificates_${pad(p.from, p.digits)}-${pad(p.to, p.digits)}_art${slot + 1}.zip`;
  const zipBundle = ZIP ? makeZipWriter(path.join(outDir, zipName)) : null;
  let zipCount = 0;

  try {
    /* crop each drawn element (with a small margin) out of the rendered page and encode it */
    const patchesFor = (boxes) => {
      const jobs = [];
      let vec = "";
      for (const k of Object.keys(boxes)) {
        const b = boxes[k];
        if (!b) continue;
        if (b.runs) { const v = vecT(b, k); if (v) { vec += v; continue; } }
        if ((k === "bar" && p.qz) || k === "qr") {
          const bx0 = Math.ceil(b.x), by0 = Math.ceil(b.y);
          const bw = Math.floor(b.x + b.w) - bx0, bh = Math.floor(b.y + b.h) - by0;
          if (bw >= 1 && bh >= 1) {
            const bc = mk(bw, bh);
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
        const c = mk(w, h);
        c.getContext("2d", { alpha: false }).drawImage(off, x0, y0, w, h, 0, 0, w, h);
        jobs.push(rgbFlate(c).then((blob) => ({ blob, flate: true, x: x0, y: y0, w, h })));
      }
      return Promise.all(jobs).then((arr) => { arr.vec = vec; return arr; });
    };

    /* fonts for vector text */
    const vecFonts = [[p.family, p.bold, false], ...(S.texts || []).filter((t) => t.on && t.text).map((t) => [t.family || p.family, t.bold, t.italic])];
    for (const [fa, bo, it] of vecFonts) await getOtFont(fa, !!bo, !!it);
    const fontsOK = vecFonts.every(([fa, bo, it]) => otPeek(fa, bo, it));

    /* shared digit font + shared fixed text / page head: stored once per file */
    T3.on = false; T3.fast = false; T3.font = null; T3.form = null; T3.headZ = null;
    if (fontsOK) {
      const ent = otPeek(p.family, p.bold, false);
      const t3 = ent && !ent.fake ? buildT3(ent) : null;
      if (t3) {
        const sb = {};
        render(S, ctx, p.from, p, S.rows[0], sb);
        let sv = "";
        if (sb.num.runs.length > 1) sv += vecBox({ runs: sb.num.runs.slice(0, -1) }) || "";
        for (const k of Object.keys(sb)) if (k.startsWith("txt_")) sv += vecBox(sb[k]) || "";
        T3.font = t3;
        T3.form = sv ? await deflate(sv) : null;
        T3.on = true;
        T3.fast = !p.bar && !p.qr && !S.cols.some((c) => c.on);
        if (T3.fast) {
          const r = sb.num.runs[sb.num.runs.length - 1];
          T3.head = (bg ? `q ${wpt.toFixed(3)} 0 0 ${hpt.toFixed(3)} 0 0 cm /Bg Do Q\n` : "")
            + `q ${K.toFixed(6)} 0 0 ${(-K).toFixed(6)} 0 ${hpt.toFixed(3)} cm\n`
            + (T3.form ? "/Stat Do\n" : "") + t3Setup(r, ent);
          T3.headZ = await deflate(T3.head);
        }
      }
    }

    /* ----- compact mode (PDF + hidden background) ----- */
    let stat = null;
    if (COMPACT) {
      const u = p.dpi / 25.4, px = (p.pt * p.dpi) / 72;
      const nf = `${p.bold ? 700 : 400} ${px}px "${p.family}", sans-serif`;
      const mctx = mk().getContext("2d");
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
      stat = fontsOK
        ? { u, mctx, glyphs, word: null, items: [], offW: 0, vec: true }
        : { u, mctx, glyphs, word, items, offW: p.word ? mctx.measureText(p.word + " ").width : 0 };
    }
    const rgb = (h) => {
      const v = parseInt(h.slice(1), 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((a) => (a / 255).toFixed(3)).join(" ");
    };
    const put = (name, m, x, y) =>
      `q ${m.pw} 0 0 ${-m.ph} ${(x - m.pad).toFixed(1)} ${(y - m.pad + m.ph).toFixed(1)} cm /${name} Do Q\n`;
    const compactPage = (n, boxes) => {
      if (T3.fast) return Promise.resolve({ tail: t3Tail(boxes.num), got: [] });
      const val = pad(n, p.digits), nx = p.nx * stat.u, ny = p.ny * stat.u;
      let ops = `q ${K.toFixed(6)} 0 0 ${(-K).toFixed(6)} 0 ${hpt.toFixed(3)} cm\n`;
      if (stat.word) ops += `${rgb(p.wc)} rg\n` + put("W", stat.word, nx, ny);
      ops += `${rgb(p.nc)} rg\n`;
      for (let i = 0; !stat.vec && i < val.length; i++) {
        const dx = stat.mctx.measureText(val.slice(0, i)).width;
        ops += put("G" + val[i], stat.glyphs[val[i]], nx + stat.offW + dx, ny);
      }
      stat.items.forEach((it, i) => { ops += `${rgb(it.c)} rg\n` + put("T" + i, it.m, it.x, it.y); });

      /* barcode -> vector bars */
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
      /* QR -> vector modules */
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
        if (stat.vec) {
          ops += vecT(boxes.num, "num") || "";
          for (const k of Object.keys(boxes)) if (k.startsWith("txt_")) ops += vecT(boxes[k], k) || "";
        }
        ops += got.vec || "";
        got.forEach((t, i) => { ops += `q ${t.w} 0 0 ${-t.h} ${t.x} ${t.y + t.h} cm /P${i} Do Q\n`; });
        return { z: await deflate(ops + "Q\n"), got };
      });
    };

    const closeFile = async (c) => {
      const info = await c.pdf.finish();
      const base = `certificates_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}_art${slot + 1}`;
      if (ZIP) {
        await zipBundle.file(`Certificates/${base}.pdf`, info.path);
        fs.unlinkSync(info.path);
        zipCount++;
      } else {
        const final = path.join(outDir, `${base}.pdf`);
        fs.renameSync(info.path, final);
        hooks.file(`${base}.pdf`, final, info.size);
      }
    };

    /* takes the oldest encoded page (order is preserved) and adds it to the current output file */
    const take = async () => {
      const q = pending.shift();
      const got = await q.work;
      if (COMPACT ? got.got.some((t) => !t.blob) : got.some((t) => !t.blob)) throw new Error("Could not encode a page (artwork too large for this browser).");
      if (!cur) {
        cur = { a: q.n, last: q.n, bytes: 0, pdf: makePdfWriter(wpt, hpt, path.join(outDir, `tmp_${++fileNo}.pdf`)) };
        if (bg) { cur.pdf.setBackground(bg.blob, S.w, S.h, bg.filter); cur.bytes += bg.blob.length; }
        if (T3.on) {
          cur.pdf.useFont("F1", T3.font);
          if (T3.form) { cur.pdf.useForm("Stat", T3.form, S.w, S.h); cur.bytes += T3.form.length; }
          if (T3.fast) cur.pdf.useHead(T3.headZ);
        }
        if (COMPACT) {
          for (const d of (stat.vec ? [] : Object.keys(stat.glyphs))) { const g = stat.glyphs[d]; cur.pdf.useMask("G" + d, g.blob, g.w, g.h); cur.bytes += g.blob.length; }
          if (stat.word) { cur.pdf.useMask("W", stat.word.blob, stat.word.w, stat.word.h); cur.bytes += stat.word.blob.length; }
          stat.items.forEach((it, i) => { cur.pdf.useMask("T" + i, it.m.blob, it.m.w, it.m.h); cur.bytes += it.m.blob.length; });
        }
      }
      if (COMPACT) {
        if (T3.fast) cur.pdf.addTail(got.tail); else cur.pdf.addCompact(got.z, got.got);
        cur.bytes += T3.fast ? got.tail.length + 70 : got.z.length + got.got.reduce((s, t) => s + t.blob.length, 0);
      } else {
        if (T3.fast) cur.pdf.addTail(got.vec); else await cur.pdf.addPage(got, K, got.vec);
        cur.bytes += got.reduce((s, t) => s + t.blob.length, 0);
      }
      cur.last = q.n;
      cur.count = (cur.count || 0) + 1;
      done++;
      if (done % 20 === 0 || done === total) {
        hooks.progress(done, total);
        await tick();
      }
      if (cur.bytes >= MAX_FILE || cur.bytes - bgBytes >= pageRoom || cur.count >= p.per) { const c = cur; cur = null; await closeFile(c); }
    };

    for (let n = p.from; n <= p.to && !hooks.isStopped(); n++) {
      if (pending.length >= INFLIGHT) await take();

      /* fast path: only the serial number changes, so no canvas work is needed */
      if (T3.fast) {
        const tail = `(${pad(n, p.digits)}) Tj ET Q\n`;
        pending.push({ n, work: Promise.resolve(COMPACT ? { tail, got: [] } : Object.assign([], { vec: tail })) });
        if (n % 500 === 0) await tick();
        continue;
      }

      const boxes = {};
      render(S, ctx, n, p, S.rows[n - p.from], boxes);
      pending.push({ n, work: COMPACT ? compactPage(n, boxes) : patchesFor(boxes) });
    }
    if (!hooks.isStopped()) {
      while (pending.length) await take();
      if (cur) { const c = cur; cur = null; await closeFile(c); }
    }
    if (cur) { cur.pdf.abort(); cur = null; }
    if (ZIP) {
      if (zipCount) { const info = zipBundle.finish(); hooks.file(zipName, info.path, info.size); }
      else zipBundle.abort();
    }
  } catch (err) {
    if (cur) cur.pdf.abort();
    if (zipBundle) zipBundle.abort();
    throw err;
  }
  return { total, sheets: 0 };
}

/* ====================== entry ====================== */
async function run(job, hooks) {
  const meta = JSON.parse(fs.readFileSync(job.metaPath, "utf8"));
  const f = meta.f, kind = meta.kind, slot = meta.slot | 0;
  const S = { img: null, w: meta.w || 2480, h: meta.h || 1754, cols: meta.cols || [], texts: meta.texts || [], rows: meta.rows || [] };

  /* fonts: system fonts + server fonts folder + fonts uploaded from the browser */
  try { GlobalFonts.loadSystemFonts(); } catch { /* ignore */ }
  fontIndex.registerCustomDir(GlobalFonts);
  const cp = fontIndex.centuryPath();
  if (cp) { try { GlobalFonts.registerFromPath(cp, "Century"); } catch { /* ignore */ } }
  for (const fo of job.fonts || []) {
    try {
      const buf = fs.readFileSync(fo.path);
      FONT_BYTES.set(fo.name, buf);
      GlobalFonts.register(buf, fo.name);
    } catch { /* ignore */ }
  }
  OT_CACHE.clear();

  if (job.artPath) {
    const img = await loadImage(fs.readFileSync(job.artPath));
    S.img = img; S.w = img.width; S.h = img.height;
  }
  return f.mode === "simplex"
    ? generateSimplex(S, f, kind, slot, hooks, job.outDir)
    : generateNormal(S, f, kind, slot, hooks, job.outDir);
}

module.exports = { run };