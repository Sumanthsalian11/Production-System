const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { PDFDocument, PDFName, PDFArray } = require("pdf-lib");

const ROOT = path.join(__dirname, "..");
const ORIGINALS_DIR = path.join(ROOT, "originals");
if (!fs.existsSync(ORIGINALS_DIR)) fs.mkdirSync(ORIGINALS_DIR, { recursive: true });

const UPLOAD_DIRS = ["uploads/indents", "uploads/artwork", "uploads", "uploads/newindent", "uploads/pdfs"];
const MARK_HEX = Buffer.from("SPECIMEN", "latin1").toString("hex").toUpperCase();

const cleanRef = (p) => {
  let s = String(p || "").split("?")[0];
  try { s = decodeURIComponent(s); } catch {}
  return s;
};

function findUploaded(ref) {
  if (!ref) return null;
  const clean = cleanRef(ref);
  const base = path.basename(clean);
  const candidates = [...UPLOAD_DIRS.map((d) => path.join(ROOT, d, base)), path.join(ROOT, clean)];
  return candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile()) || null;
}

function streamText(stream) {
  if (!stream || typeof stream.getContents !== "function") return "";
  let bytes = Buffer.from(stream.getContents());
  const filter = stream.dict && stream.dict.get(PDFName.of("Filter"));
  if (filter && String(filter).includes("FlateDecode")) {
    try { bytes = zlib.inflateSync(bytes); } catch { return ""; }
  }
  return bytes.toString("latin1");
}

const isSpecimenStream = (stream) => {
  const t = streamText(stream).toUpperCase();
  return t.includes(MARK_HEX) || t.includes("(SPECIMEN)");
};

async function stripSpecimen(srcFile, outFile) {
  const pdf = await PDFDocument.load(fs.readFileSync(srcFile), { ignoreEncryption: true, updateMetadata: false });
  let removed = 0;
  for (const page of pdf.getPages()) {
    const arr = pdf.context.lookup(page.node.get(PDFName.of("Contents")));
    if (!(arr instanceof PDFArray)) continue;
    const keep = [];
    for (let i = 0; i < arr.size(); i++) {
      const ref = arr.get(i);
      if (isSpecimenStream(pdf.context.lookup(ref))) { removed++; continue; }
      keep.push(ref);
    }
    if (keep.length !== arr.size()) page.node.set(PDFName.of("Contents"), pdf.context.obj(keep));
  }
  if (!removed) return false;
  fs.writeFileSync(outFile, await pdf.save());
  return true;
}

// clean file for mails: saved original -> stripped copy (cached) -> file as is
async function getCleanArtwork(ref) {
  if (!ref) return null;
  const saved = path.join(ORIGINALS_DIR, path.basename(cleanRef(ref)));
  if (fs.existsSync(saved)) return saved;

  const file = findUploaded(ref);
  if (!file) return null;
  if (path.extname(file).toLowerCase() !== ".pdf") return file;

  try {
    if (await stripSpecimen(file, saved)) return saved;
  } catch (e) {
    console.error("SPECIMEN STRIP ERROR:", file, e.message);
  }
  console.warn("Mail artwork may still carry SPECIMEN (no clean copy found):", file);
  return file;
}

module.exports = { ORIGINALS_DIR, findUploaded, getCleanArtwork };