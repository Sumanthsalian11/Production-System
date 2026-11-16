const fs = require("fs");
const path = require("path");
const os = require("os");
const opentype = require("opentype.js");

const FONT_DIR = process.env.CERT_FONT_DIR || path.join(__dirname, "..", "fonts");
const SYSTEM_DIRS =
  process.platform === "win32" ? [path.join(process.env.WINDIR || "C:\\Windows", "Fonts")]
  : process.platform === "darwin" ? ["/System/Library/Fonts", "/Library/Fonts", path.join(os.homedir(), "Library/Fonts")]
  : ["/usr/share/fonts", "/usr/local/share/fonts", path.join(os.homedir(), ".fonts")];
const CACHE = path.join(os.tmpdir(), "cert-font-index.json");

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ttf|otf)$/i.test(e.name)) out.push(p);
  }
}

let INDEX = null;
/* [{ path, family, style }] — built once, cached on disk (the first job pays the scan) */
function getIndex() {
  if (INDEX) return INDEX;
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { cache = {}; }
  const files = [];
  [FONT_DIR, ...SYSTEM_DIRS].forEach((d) => walk(d, files));
  const next = {};
  let dirty = false;
  for (const f of files) {
    let st;
    try { st = fs.statSync(f); } catch { continue; }
    const c = cache[f];
    if (c && c.m === st.mtimeMs && c.s === st.size) { next[f] = c; continue; }
    const rec = { m: st.mtimeMs, s: st.size, family: null, style: "" };
    try {
      if (st.size < 40 * 1024 * 1024) {
        const b = fs.readFileSync(f);
        const font = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
        const n = font.names || {};
        const pick = (o) => (o ? o.en || Object.values(o)[0] || "" : "");
        rec.family = pick(n.fontFamily) || null;
        rec.style = pick(n.fontSubfamily) || "";
      }
    } catch { /* unreadable font -> skipped */ }
    next[f] = rec;
    dirty = true;
  }
  if (dirty || Object.keys(next).length !== Object.keys(cache).length) {
    try { fs.writeFileSync(CACHE, JSON.stringify(next)); } catch { /* ignore */ }
  }
  INDEX = Object.entries(next).filter(([, r]) => r.family).map(([p, r]) => ({ path: p, family: r.family, style: r.style }));
  return INDEX;
}

const findFonts = (family) => getIndex().filter((x) => x.family.toLowerCase() === String(family).toLowerCase());

function registerCustomDir(GlobalFonts) {
  for (const e of getIndex()) {
    if (e.path.startsWith(FONT_DIR)) { try { GlobalFonts.registerFromPath(e.path); } catch { /* ignore */ } }
  }
}

function centuryPath() {
  for (const n of ["CENTURY.TTF", "Century.ttf", "century.ttf"]) {
    const p = path.join(FONT_DIR, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = { findFonts, registerCustomDir, centuryPath, FONT_DIR };