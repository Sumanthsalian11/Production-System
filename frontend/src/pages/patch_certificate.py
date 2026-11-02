#!/usr/bin/env python3
"""
Usage:  python patch_certificate.py path/to/CertificateNumbering.jsx

Adds: 3 artwork uploads, 3 previews, 3 separate PDF/ZIP downloads, bigger screen.
Makes a backup (<file>.bak). Writes nothing if any step fails to match.
"""
import re, sys, shutil

if len(sys.argv) != 2:
    sys.exit("Usage: python patch_certificate.py <your-component-file>")

path = sys.argv[1]
src = open(path, encoding="utf-8").read()
text = src
step = 0


def fail(msg):
    sys.exit(f"\n[STOP] step {step}: {msg}\nNothing was changed.")


def rep(old, new):
    global text, step
    step += 1
    n = text.count(old)
    if n != 1:
        fail(f"expected 1 match, found {n} for:\n  {old[:90]!r}")
    text = text.replace(old, new)
    print(f"  ok {step}")


def rep_re(pattern, new, flags=0):
    global text, step
    step += 1
    ms = list(re.finditer(pattern, text, flags))
    if len(ms) != 1:
        fail(f"expected 1 match, found {len(ms)} for regex:\n  {pattern[:90]!r}")
    m = ms[0]
    text = text[: m.start()] + new + text[m.end():]
    print(f"  ok {step}")


def rep_between(start, end, new):
    """replace from `start` (inclusive) up to `end` (exclusive)"""
    global text, step
    step += 1
    if text.count(start) != 1:
        fail(f"start marker found {text.count(start)}x:\n  {start[:90]!r}")
    s = text.index(start)
    if end not in text[s:]:
        fail(f"end marker not found after start:\n  {end[:90]!r}")
    e = text.index(end, s)
    text = text[:s] + new + text[e:]
    print(f"  ok {step}")


# ---------------------------------------------------------------- 1. blankSlot helper
rep('const pad = (n, d) => String(n).padStart(d, "0");',
    r'''const pad = (n, d) => String(n).padStart(d, "0");
const blankSlot = () => ({
  img: null, blob: null, prev: null, w: 2480, h: 1754,
  name: "None — blank A4 landscape", box: { num: null, bar: null, qr: null },
});''')

# ---------------------------------------------------------------- 2. state / refs
rep('const [dims, setDims] = useState({ w: 2480, h: 1754 });',
    'const [dims, setDims] = useState([{ w: 2480, h: 1754 }, { w: 2480, h: 1754 }, { w: 2480, h: 1754 }]);')

rep('const [artName, setArtName] = useState("None — blank A4 landscape");',
    r'''const [artNames, setArtNames] = useState(Array(3).fill("None — blank A4 landscape"));
  const [act, setAct] = useState(0);            // active artwork slot (0..2)
  const actRef = useRef(0);
  actRef.current = act;''')

rep('const cvRef = useRef(null);', 'const cvRefs = useRef([null, null, null]);')

rep('const S = useRef({ img: null, w: 2480, h: 1754, box: { num: null, bar: null, qr: null }, bc: new Map(), rows: [], cols: [], blob: null, prev: null, tplCols: new Map(), clearBusy: false }).current;',
    r'''const S = useRef({ img: null, w: 2480, h: 1754, box: { num: null, bar: null, qr: null }, bc: new Map(), rows: [], cols: [], blob: null, prev: null, tplCols: new Map(), clearBusy: false, slots: [blankSlot(), blankSlot(), blankSlot()] }).current;
  /* S.img / S.w / S.h / S.prev / S.blob / S.box always mirror one slot, so render() and generate() work unchanged */
  const bind = (i) => { const s = S.slots[i]; S.img = s.img; S.blob = s.blob; S.prev = s.prev; S.w = s.w; S.h = s.h; S.box = s.box; };''')

# ---------------------------------------------------------------- 3. setArtImage / clearArt
rep_between('const setArtImage = (img, blob, label) => {',
            '/* image (PNG/JPG/WebP) or PDF (first page)',
            r'''const setArtImage = (img, blob, label, i = 0) => {
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
    if (actRef.current === i) bind(i);
  };

  ''')

# ---------------------------------------------------------------- 4. onArt
rep('const onArt = async (e) => {', 'const onArt = async (e, i = 0) => {')
rep('setArtImage(img, blob, label);',
    r'''setArtImage(img, blob, label, i);
      /* auto-layout only for the first artwork; the others reuse the shared layout */
      const first = i === 0 || !S.slots.some((s, k) => k !== i && s.img);
      if (!first) { S.clearBusy = true; setF((o) => ({ ...o })); say(""); return; }''')

# ---------------------------------------------------------------- 5. templates (store artwork 1 only)
rep('setArtImage(await loadImg(blob), blob, t.artName || "Template artwork");',
    'setArtImage(await loadImg(blob), blob, t.artName || "Template artwork", 0);')
rep_re(r'else \{\s*clearArt\(\);\s*\}', 'else {\n        clearArt(0);\n      }')
rep_re(r'clearArt\(\);\s*// blank A4 landscape again',
       '[0, 1, 2].forEach(clearArt); setAct(0); actRef.current = 0; bind(0);')
rep_re(r'setTplBusy\(true\);\s*try \{\s*let art = S\.blob;',
       'setTplBusy(true);\n    bind(0);\n    try {\n      let art = S.blob;')
rep_re(r'\} finally \{\s*setTplBusy\(false\);\s*\}\s*\};\s*const deleteTemplate',
       '} finally {\n      bind(actRef.current);\n      setTplBusy(false);\n    }\n  };\n\n  const deleteTemplate')
rep('artName.replace(', 'artNames[0].replace(')

# ---------------------------------------------------------------- 6. pointer handlers
rep_between('const toArt = (e) => {', 'const setPos = (k, xmm, ymm) => {',
            r'''const toArt = (e, i) => {
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
  ''')

rep_between('const onDown = (e) => {', 'const onKey = (e) => {',
            r'''const onDown = (i) => (e) => {
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
  ''')

# ---------------------------------------------------------------- 7. preview effect (3 canvases)
rep_between('/* preview */', '/* ---------- Simplex: UPS sheet preview ---------- */',
            r'''/* preview: one canvas per artwork slot */
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
        render(S, ctx, n, s, p, true, S.rows[idx]);
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
    })();
    return () => { dead = true; };
  }, [f, cols, sheet, pv, dims, artNames, sel, measure, fonts, texts, running, S]);

  ''')

# ---------------------------------------------------------------- 8. sheet (simplex) effect
rep('if (dead || !shRef.current) return;',
    'if (dead || !shRef.current) return;\n      bind(actRef.current);')
rep('}, [f, cols, sheet, pv, dims, texts, fonts, sheetView, S]);',
    '}, [f, cols, sheet, pv, dims, texts, fonts, sheetView, act, S]);')

# ---------------------------------------------------------------- 9. generation per slot
rep('async function generateSimplex(kind) {', 'async function generateSimplex(kind, slot) {')
rep_re(r'async function generate\(kind\) \{\s*if \(running\) return;\s*if \(f\.mode === "simplex"\) return generateSimplex\(kind\);',
       r'''async function generate(kind, slot = 0) {
    if (running) return;
    bind(slot);
    try { await generateInner(kind, slot); } finally { bind(actRef.current); }
  }

  async function generateInner(kind, slot) {
    if (f.mode === "simplex") return generateSimplex(kind, slot);''')
rep('sheets_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}.',
    'sheets_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}_art${slot + 1}.')
rep('certificates_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}.',
    'certificates_${pad(c.a, p.digits)}-${pad(c.last, p.digits)}_art${slot + 1}.')

# ---------------------------------------------------------------- 10. JSX: sidebar uploads
rep_re(r'<label className="cn-drop">\s*<input type="file" accept="image/\*,application/pdf,\.pdf" hidden onChange=\{onArt\} />.*?<div className="cn-file"><b>\{artName\}</b><span>DPI \{f\.dpi\}</span></div>',
       r'''{[0, 1, 2].map((i) => (
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
                ))}''', re.S)

# ---------------------------------------------------------------- 11. JSX: toolbar
rep('{dims.w}×{dims.h}px', '{dims[act].w}×{dims[act].h}px')
rep_re(r'<button className="cn-btn primary sm" type="button" disabled=\{running\} onClick=\{\(\) => generate\("pdf"\)\}>.*?</button>\s*<button className="cn-btn ghost sm" type="button" disabled=\{running\} onClick=\{\(\) => generate\("zip"\)\}>.*?</button>',
       '', re.S)

# ---------------------------------------------------------------- 12. JSX: 3 preview cards with own downloads
rep_between('<div className="cn-canvas-wrap" style={showSheet ? { display: "none" } : undefined}>',
            '<div className="cn-canvas-wrap" style={{ display: showSheet ? "flex" : "none" }}>',
            r'''<div className="cn-canvas-wrap" style={showSheet ? { display: "none" } : undefined}>
            <div className="cn-trio" style={zoom !== "fit" ? { width: `${zoom * 3}%` } : undefined}>
              {[0, 1, 2].map((i) => (
                <figure key={i} className={`cn-card${act === i ? " act" : ""}`}>
                  <figcaption>
                    <b>Artwork {i + 1}</b>
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

          ''')

# ---------------------------------------------------------------- 13. CSS: bigger screen + cards
rep('height:calc(100dvh - 16px)', 'height:100dvh')
rep('color:var(--ink);border:1px solid var(--line);border-radius:10px;overflow:hidden;',
    'color:var(--ink);border:none;border-radius:0;overflow:hidden;')
text = text.replace('220px minmax(0,1fr)', '190px minmax(0,1fr)')
text = text.replace('minmax(0,1fr) 180px', 'minmax(0,1fr) 170px')
rep('@media (prefers-reduced-motion:reduce){',
    r'''.cn-artslot{display:flex;flex-direction:column;gap:4px;padding-bottom:8px;border-bottom:1px dashed var(--line)}
.cn-trio{flex:none;align-self:flex-start;width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}
.cn-card{margin:0;min-width:0;background:var(--surface);border:2px solid var(--line);border-radius:8px;overflow:hidden}
.cn-card.act{border-color:var(--accent)}
.cn-card figcaption{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:5px 8px;border-bottom:1px solid var(--line);font-size:12px}
.cn-card-dl{margin-left:auto;display:flex;gap:5px}
.cn-card canvas{display:block;width:100%;height:auto;margin:0;box-shadow:none}
@media (max-width:880px){.cn-trio{grid-template-columns:1fr}}

@media (prefers-reduced-motion:reduce){''')

# ---------------------------------------------------------------- leftover check
left = [w for w in (r"\bcvRef\b", r"\bsetArtName\b", r"\bartName\b", r"dims\.w") if re.search(w, text)]
if left:
    print(f"\n[WARNING] leftover old names still found: {left} — search for them and fix by hand.")

shutil.copyfile(path, path + ".bak")
open(path, "w", encoding="utf-8").write(text)
print(f"\nDone. {step} edits applied. Backup saved as {path}.bak")
