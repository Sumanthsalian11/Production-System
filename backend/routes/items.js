const express = require("express");
const router = express.Router();
const Item = require("../models/Item");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const upload = multer({ storage: multer.memoryStorage() });

const pdfDir = path.join(__dirname, "..", "uploads", "pdfs");
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pdfDir),
  filename: (req, file, cb) => cb(null, `${req.params.itemCode}.pdf`),
});
const pdfUpload = multer({ storage: pdfStorage });
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

      const exists = await Item.findOne({ itemCode: String(itemCode).trim() });
      if (exists) { results.skipped++; continue; }

      try {
        await Item.create({
          itemCode:     String(itemCode).trim(),
          customerName: String(row["customerName"] || row["Customer Name"] || "").trim(),
          description:  String(row["description"]  || row["Description"]  || "").trim(),
          materialType: String(row["materialType"] || row["Material Type"] || "").trim(),
          colorFront:   String(row["colorFront"]   || row["Color Front"]   || "").trim(),
         colorBack: String(
  row["Color Back"] ?? ""
).trim(),
          wasteQty:     String(row["wasteQty"]     || row["Waste Qty"]     || "").trim(),
         jobSize: String(
  row["jobSize"] ??
  row["Job Size (MM)"] ??
  ""
).trim(),
          inkDetails:   String(row["inkDetails"]   || row["Ink Details"]   || "").trim(),
        });
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