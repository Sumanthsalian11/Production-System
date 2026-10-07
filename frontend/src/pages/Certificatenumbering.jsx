import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import JSZip from "jszip";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Montserrat:wght@400;700&family=Lato:wght@400;700&family=Poppins:wght@400;700&family=Source+Sans+3:wght@400;700&display=swap";

const BASE_FONTS = [
  "Arial", "Helvetica", "Verdana", "Tahoma", "Times New Roman", "Georgia", "Courier New",
  "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins", "Source Sans 3",
];

const DEFAULTS = {
  dpi: "300", series: "default",
  word: "S. No:", wc: "#222222", nc: "#f58220",
  from: "123456", to: "123555", digits: "6",
  font: "Arial", pt: "16", bold: true, nx: "196", ny: "12",
  bar: true, bw: "50", bh: "10", qz: true, bx: "196", by: "24",
  per: "500",
};

const pad = (n, d) => String(n).padStart(d, "0");
const num = (v, d = 0) => { const x = parseFloat(v); return isFinite(x) ? x : d; };

const P = (f) => ({
  word: f.word, wc: f.wc, nc: f.nc,
  from: parseInt(f.from, 10), to: parseInt(f.to, 10),
  digits: Math.max(1, parseInt(f.digits, 10) || 1),
  family: f.font, bold: f.bold, pt: num(f.pt) || 12,
  nx: num(f.nx), ny: num(f.ny),
  bar: f.bar, bw: Math.max(5, num(f.bw)), bh: Math.max(2, num(f.bh)), qz: f.qz,
  bx: num(f.bx), by: num(f.by),
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
  const key = [val, p.bw, p.bh, p.qz, p.dpi].join("|");
  if (S.bc.has(key)) return S.bc.get(key);
  if (S.bc.size > 40) S.bc.clear();
  const c = makeBarcode(val, p);
  S.bc.set(key, c);
  return c;
}

/* ---------- render one certificate ---------- */
function render(S, ctx, n, s, p, preview) {
  const u = p.dpi / 25.4, px = (p.pt * p.dpi) / 72, val = pad(n, p.digits);
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, S.w, S.h);
  if (S.img) ctx.drawImage(S.img, 0, 0, S.w, S.h);

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

  if (p.bar) {
    const c = preview ? getBarcode(S, val, p) : makeBarcode(val, p);
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(c, p.bx * u, p.by * u);
    if (preview) S.box.bar = { x: p.bx * u, y: p.by * u, w: c.width, h: c.height };
  } else if (preview) S.box.bar = null;
  ctx.restore();
}

const POS_KEYS = { num: ["nx", "ny"], bar: ["bx", "by"] };

function Field({ span, label, children }) {
  return (
    <label className={`cn-f cn-s${span}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function CertificateNumbering() {
  const [f, setF] = useState(DEFAULTS);
  const [fonts, setFonts] = useState(BASE_FONTS);
  const [dims, setDims] = useState({ w: 2480, h: 1754 });
  const [sel, setSel] = useState("num");
  const [artName, setArtName] = useState("None — blank A4 landscape");
  const [status, setStatus] = useState({ msg: "", cls: "" });
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [nextFree, setNextFree] = useState(null);

  const cvRef = useRef(null);
  const S = useRef({ img: null, w: 2480, h: 1754, box: { num: null, bar: null }, bc: new Map() }).current;
  const drag = useRef(null);
  const stopFlag = useRef(false);
  const fRef = useRef(f);
  fRef.current = f;

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setF((o) => ({ ...o, [k]: v }));
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
      render(S, ctx, isFinite(p.from) ? p.from : 1, s, p, true);
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
      ctx.restore();
    })();
    return () => { dead = true; };
  }, [f, dims, sel, fonts, S]);

  /* ---------- move variable matter ---------- */
  const toArt = (e) => {
    const r = cvRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * S.w) / r.width, y: ((e.clientY - r.top) * S.h) / r.height };
  };
  const hit = (pt) => {
    const m = S.w * 0.008;
    for (const k of ["bar", "num"]) {
      const b = S.box[k];
      if (b && pt.x >= b.x - m && pt.x <= b.x + b.w + m && pt.y >= b.y - m && pt.y <= b.y + b.h + m) return k;
    }
    return null;
  };
  const setPos = (k, xmm, ymm) => {
    const [kx, ky] = POS_KEYS[k];
    setF((o) => ({ ...o, [kx]: String(Math.round(xmm * 10) / 10), [ky]: String(Math.round(ymm * 10) / 10) }));
  };
  const onDown = (e) => {
    const pt = toArt(e), k = hit(pt);
    if (!k) return;
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
  const onKey = (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || !S.box[sel]) return;
    e.preventDefault();
    const step = e.shiftKey ? 5 : 0.5, [kx, ky] = POS_KEYS[sel];
    setPos(sel, num(fRef.current[kx]) + d[0] * step, num(fRef.current[ky]) + d[1] * step);
  };

  /* ---------- uploads ---------- */
  const onArt = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      S.img = img; S.w = img.naturalWidth; S.h = img.naturalHeight;
      setDims({ w: S.w, h: S.h });
      setArtName(`${file.name} · ${S.w}×${S.h}px`);
      const dpi = P(fRef.current).dpi;
      const wmm = (S.w * 25.4) / dpi, hmm = (S.h * 25.4) / dpi;
      const r1 = (v) => String(Math.round(v * 10) / 10);
      setF((o) => ({
        ...o,
        nx: r1(wmm * 0.6), ny: r1(hmm * 0.05),
        pt: String(Math.max(4, Math.round(hmm * 0.07 * 2.835))),
        bx: r1(wmm * 0.6), by: r1(hmm * 0.2),
        bw: r1(wmm * 0.3), bh: r1(hmm * 0.1),
      }));
      say("");
    };
    img.onerror = () => say("Could not read that image. Use PNG, JPG or WebP.", "err");
    img.src = url;
  };
  const onFont = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, "");
    try {
      const face = new FontFace(name, await file.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      setFonts((l) => (l.includes(name) ? l : [...l, name]));
      setF((o) => ({ ...o, font: name }));
    } catch { say("Could not load that font file.", "err"); }
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
          render(S, ctx, n, 1, p, false);
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
    ? `${(p.to - p.from + 1).toLocaleString()} certificates · ${pad(p.from, p.digits)} to ${pad(p.to, p.digits)} · ${dims.w}×${dims.h}px`
    : "Enter a valid From / To range";

  return (
    <div className="cn-root">
      <style>{CSS}</style>

      <section className="cn-glass cn-panel">
        <div className="cn-head">
          <div className="cn-logo" aria-hidden="true">No.</div>
          <div>
            <h1>Certificate numbering</h1>
            <p>Serial numbers and Code 128 on your artwork</p>
          </div>
        </div>

        <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div className="cn-cap">Artwork</div>
          <div className="cn-row">
            <label className="cn-f cn-s5">
              <span>Base artwork (PNG / JPG / WebP)</span>
              <span className="cn-pick">
                <input type="file" accept="image/*" hidden onChange={onArt} />
                <span className="cn-btn ghost">Choose image</span>
                <em>{artName}</em>
              </span>
            </label>
            <Field span={2} label="Artwork DPI"><input type="number" min="36" max="1200" value={f.dpi} onChange={set("dpi")} /></Field>
            <Field span={5} label="Series (numbers never repeat within it)"><input type="text" value={f.series} onChange={set("series")} /></Field>
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
            <Field span={8} label="Font name *">
              <select value={f.font} onChange={set("font")}>
                {fonts.map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
            <label className="cn-f cn-s4">
              <span>&nbsp;</span>
              <span className="cn-btn ghost" style={{ cursor: "pointer" }}>
                <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={onFont} />Add font file
              </span>
            </label>
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
            <Field span={6} label="Pages per output file"><input type="number" min="1" value={f.per} onChange={set("per")} /></Field>
          </div>

          <div className="cn-actions">
            <button className="cn-btn" type="button" disabled={running} onClick={() => generate("pdf")}>Download PDF</button>
            <button className="cn-btn ghost" type="button" disabled={running} onClick={() => generate("zip")}>Download images (ZIP)</button>
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
            {nextFree != null && ` · next free in "${f.series.trim()}": ${pad(nextFree, p.digits)}`}
          </span>
          <span>Drag the number or barcode to move · arrow keys nudge (Shift = 5 mm)</span>
        </div>
        <div className="cn-canvas-wrap">
          <canvas
            ref={cvRef}
            tabIndex={0}
            aria-label="Certificate preview. Drag to move the number or barcode."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
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
  --glass:rgba(255,255,255,.58);--glass-b:rgba(255,255,255,.9);
  --ink:#10343d;--muted:#4d7480;--line:rgba(16,52,61,.16);
  --field:rgba(255,255,255,.85);--accent:#0f7f96;--accent-ink:#fff;
  --head:rgba(255,255,255,.7);--ghost:rgba(15,127,150,.1);
  --err:#b3261e;--ok:#17715a;--canvas-bg:rgba(255,255,255,.35);
  display:grid;grid-template-columns:392px 1fr;gap:14px;align-items:start;color:var(--ink);
  font:13px/1.35 "Figtree",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
}
.cn-root *,.cn-root *::before,.cn-root *::after{box-sizing:border-box}
.cn-glass{background:var(--glass);border:1px solid var(--glass-b);border-radius:16px;
  -webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);
  box-shadow:0 6px 24px rgba(20,90,110,.10)}
.cn-panel{position:sticky;top:14px;overflow:hidden}
.cn-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--head);border-bottom:1px solid var(--glass-b)}
.cn-logo{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:700;font-size:12px;color:var(--accent);
  background:linear-gradient(145deg,rgba(255,255,255,.95),rgba(190,235,246,.7));border:1px solid var(--glass-b);box-shadow:0 2px 8px rgba(20,90,110,.14)}
.cn-head h1{margin:0;font-size:15px;font-weight:700}
.cn-head p{margin:0;font-size:11.5px;color:var(--muted)}
.cn-root form{padding:10px 14px 14px;display:flex;flex-direction:column;gap:9px}
.cn-cap{font-size:11.5px;font-weight:700;color:var(--muted);margin:2px 0 -2px;display:flex;align-items:center;gap:8px}
.cn-cap::after{content:"";flex:1;height:1px;background:var(--line)}
.cn-row{display:grid;grid-template-columns:repeat(12,1fr);gap:7px;align-items:end}
.cn-s2{grid-column:span 2}.cn-s3{grid-column:span 3}.cn-s4{grid-column:span 4}.cn-s5{grid-column:span 5}.cn-s6{grid-column:span 6}.cn-s8{grid-column:span 8}
.cn-f{display:flex;flex-direction:column;gap:3px;min-width:0}
.cn-f>span{font-size:11px;color:var(--muted)}
.cn-root input[type=text],.cn-root input[type=number],.cn-root select{
  width:100%;height:30px;padding:0 8px;font:inherit;color:var(--ink);background:var(--field);border:1px solid var(--line);border-radius:8px}
.cn-root input[type=color]{width:100%;height:30px;padding:2px;background:var(--field);border:1px solid var(--line);border-radius:8px;cursor:pointer}
.cn-root input:focus-visible,.cn-root select:focus-visible,.cn-root button:focus-visible,.cn-root canvas:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.cn-f.cn-chk{flex-direction:row;align-items:center;gap:6px;height:30px;cursor:pointer}
.cn-f.cn-chk span{font-size:12.5px;color:var(--ink)}
.cn-chk input{width:15px;height:15px;accent-color:var(--accent);margin:0}
.cn-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;border-radius:8px;
  font:600 12.5px/1 inherit;font-family:inherit;border:1px solid transparent;cursor:pointer;white-space:nowrap;background:var(--accent);color:var(--accent-ink)}
.cn-btn:disabled{opacity:.5;cursor:not-allowed}
.cn-btn.ghost{background:var(--ghost);color:var(--accent);border-color:var(--line)}
.cn-pick{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0}
.cn-pick em{font-style:normal;color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cn-actions{display:flex;gap:8px;align-items:center;margin-top:2px}
.cn-actions .cn-btn{flex:1;height:34px}
.cn-actions .stop{flex:0 0 auto}
.cn-bar{height:5px;border-radius:5px;background:var(--line);overflow:hidden}
.cn-bar i{display:block;height:100%;background:var(--accent);transition:width .15s}
.cn-status{font-size:12px;color:var(--muted);min-height:16px}
.cn-status.err{color:var(--err)}.cn-status.ok{color:var(--ok)}
.cn-stage{padding:12px;display:flex;flex-direction:column;gap:8px;min-height:calc(100vh - 120px)}
.cn-stage-top{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--muted)}
.cn-canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--canvas-bg);border:1px dashed var(--line);padding:12px;min-height:0;overflow:auto}
.cn-canvas-wrap canvas{display:block;max-width:100%;max-height:calc(100vh - 200px);height:auto;box-shadow:0 8px 30px rgba(10,70,90,.25);background:#fff;touch-action:none}
@media (max-width:900px){
  .cn-root{grid-template-columns:1fr}
  .cn-panel{position:static}
  .cn-stage{min-height:0}
  .cn-canvas-wrap canvas{max-height:none}
}
`;