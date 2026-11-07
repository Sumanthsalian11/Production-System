const express = require("express");
const router = express.Router();
const Item = require("../models/Item");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const upload = multer({ storage: multer.memoryStorage() });
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");

// writes a diagonal SPECIMEN watermark into every page of the saved PDF
async function stampPdf(filePath) {
  const pdf = await PDFDocument.load(fs.readFileSync(filePath), { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ANGLE = 35, TEXT = "SPECIMEN";
  const rad = (ANGLE * Math.PI) / 180;
  pdf.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) * 0.2;
    const w = font.widthOfTextAtSize(TEXT, size);
    const h = size * 0.7;
    page.drawText(TEXT, {
      x: width / 2 - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad),
      y: height / 2 - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad),
      size, font, color: rgb(0.84, 0.27, 0.27), opacity: 0.25, rotate: degrees(ANGLE),
    });
  });
  fs.writeFileSync(filePath, await pdf.save());
}

const pdfDir = path.join(__dirname, "..", "uploads", "pdfs");
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pdfDir),
  filename: (req, file, cb) => cb(null, `${req.params.itemCode}.pdf`),
});
const pdfUpload = multer({ storage: pdfStorage });

// artwork files saved against an item code
const artDir = path.join(__dirname, "..", "uploads", "artwork");
if (!fs.existsSync(artDir)) fs.mkdirSync(artDir, { recursive: true });
const artUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, artDir),
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});
router.use("/artwork-files", express.static(artDir));
// BULK UPLOAD ITEMS VIA EXCEL
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) return res.status(400).json({ message: "Excel file is empty" });

    const results = { inserted: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      const itemCode = row["itemCode"] || row["Item Code"] || row["SFG Code"];
      if (!itemCode) { results.skipped++; continue; }

      const pick = (...keys) => {
        for (const k of keys) if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
        return "";
      };
      const data = {
        uniqueCode:   pick("uniqueCode", "Unique Code"),
        customerName: pick("customerName", "Customer Name"),
        description:  pick("description", "Description"),
        materialType: pick("materialType", "Material Type"),
        colorFront:   pick("colorFront", "Color Front", "Front Colors"),
        colorBack:    pick("colorBack", "Color Back", "Back Colors"),
        wasteQty:     pick("wasteQty", "Waste Qty", "Waste Quantity"),
        jobSize:      pick("jobSize", "Job Size (MM)", "Job Size"),
        inkDetails:   pick("inkDetails", "Ink Details"),
      };
      if (data.wasteQty === "") delete data.wasteQty;

      const exists = await Item.findOne({ itemCode: String(itemCode).trim() });
      if (exists) {
        // fill / refresh only the fields present in the Excel
        const set = {};
        Object.entries(data).forEach(([k, v]) => {
          if (v !== "" && String(exists[k] ?? "") !== v) set[k] = v;
        });
        if (Object.keys(set).length) {
          await Item.updateOne({ _id: exists._id }, { $set: set });
          results.updated = (results.updated || 0) + 1;
        } else {
          results.skipped++;
        }
        continue;
      }

      try {
        await Item.create({ itemCode: String(itemCode).trim(), ...data });
        results.inserted++;
      } catch (e) {
        results.errors.push(`${itemCode}: ${e.message}`);
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===========================
   GET ALL ITEMS  (MUST BE FIRST)
=========================== */
router.get("/", async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===========================
   GET DISTINCT CUSTOMER NAMES (FROM ITEMS)
   Must stay BEFORE "/:code" or it will be swallowed by it
=========================== */
router.get("/meta/customers", async (req, res) => {
  try {
    const names = await Item.distinct("customerName");
    const cleaned = names.filter(Boolean).sort((a, b) => a.localeCompare(b));
    res.json(cleaned);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===========================
   GET ITEM BY CODE
=========================== */
router.get("/:code", async (req, res) => {
  try {
    const item = await Item.findOne({ itemCode: req.params.code });

    if (!item) return res.status(404).json({ message: "Not found" });

    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===========================
   CREATE ITEM
=========================== */
router.post("/", async (req, res) => {
  try {
    const exists = await Item.findOne({ itemCode: req.body.itemCode });
    if (exists) {
      return res.status(400).json({ message: "Item code already exists" });
    }

    const item = new Item(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ===========================
   UPLOAD PDF FOR ITEM
=========================== */
router.post("/:itemCode/pdf", pdfUpload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No PDF uploaded" });

    const item = await Item.findOneAndUpdate(
      { itemCode: req.params.itemCode },
      { pdfPath: `/uploads/pdfs/${req.params.itemCode}.pdf` },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===========================
   UPDATE ITEM
=========================== */
/* ===========================
   ARTWORK VERSIONS (saved against the item code)
=========================== */
router.post("/:itemCode/artwork", authMiddleware, artUpload.single("artwork"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No artwork file uploaded" });

    const item = await Item.findOne({ itemCode: req.params.itemCode }).select("artworkVersions").lean();
    if (!item) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "Item not found" });
    }

    if (path.extname(req.file.originalname).toLowerCase() === ".pdf") {
      try { await stampPdf(req.file.path); } catch (e) { console.error("WATERMARK ERROR:", e.message); }
    }

    const user = await User.findById(req.user.id);
    const list = item.artworkVersions || [];
    const next = list.length ? Math.max(...list.map((v) => v.version || 0)) + 1 : 1;

    const updated = await Item.findOneAndUpdate(
      { itemCode: req.params.itemCode },
      {
        $push: {
          artworkVersions: {
            version: next,
            fileName: req.file.originalname,
            filePath: "/api/master/items/artwork-files/" + req.file.filename,
            note: String(req.body.note || "").slice(0, 500),
            uploadedBy: user ? user.name : "",
            uploadedAt: new Date(),
          },
        },
      },
      { new: true }
    );
    res.status(201).json(updated);
  } catch (err) {
    console.error("ITEM ARTWORK ERROR:", err);
    res.status(500).json({ message: "Error saving artwork" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Item not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating item" });
  }
});

/* ===========================
   DELETE ITEM
=========================== */
router.delete("/:id", async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting item" });
  }
});

module.exports = router;