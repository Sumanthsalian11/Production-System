const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const Material = require("../models/Material");

const upload = multer({ storage: multer.memoryStorage() });

// GET all materials
router.get("/materials", async (req, res) => {
  try {
    const materials = await Material.find().sort({ createdAt: -1 });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET material by code — used by New Inspection page to auto-fill Supplier & Description
router.get("/materials/code/:code", async (req, res) => {
  try {
    const material = await Material.findOne({ code: req.params.code.trim() });
    if (!material) return res.status(404).json({ message: "Material not found" });
    res.json(material);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add new material
router.post("/materials", async (req, res) => {
  const { code, description, group, mill, gsm, paperSize, length, width } = req.body;
  if (!code) return res.status(400).json({ message: "Code is required" });

  try {
    const newMaterial = new Material({ code, description, group, mill, gsm, paperSize, length, width });
    const saved = await newMaterial.save();
    res.json(saved);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Material code already exists" });
    }
    res.status(500).json({ message: err.message });
  }
});

// POST bulk upload materials from Excel — skips duplicates by code
// POST bulk upload materials from Excel — inserts new, updates existing by code
router.post("/materials/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // Only falls back when the value is truly missing — 0 is a valid value, not "empty"
    const pick = (...values) => {
      for (const v of values) {
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return "";
    };

    const existingCodes = new Set(
      (await Material.find({}, "code")).map((m) => String(m.code).trim().toLowerCase())
    );

    const toInsert = [];
    const toUpdate = [];
    const errors = [];
    const seenInFile = new Set();

    rows.forEach((row, idx) => {
      const code = String(
        row.code || row.Code || row.CODE || row.Material || ""
      ).trim();
      if (!code) {
        errors.push(`Row ${idx + 2}: missing code`);
        return;
      }

      const key = code.toLowerCase();
      if (seenInFile.has(key)) {
        return;
      }
      seenInFile.add(key);

      const data = {
        code,
        description: pick(row.description, row.Description, row["Material Description"]),
        group: pick(row.group, row.Group, row["Material Group Desc."], row["Material type description"]),
        mill: pick(row.mill, row.Mill, row.MILL),
        gsm: pick(row.gsm, row.GSM),
        paperSize: pick(row.paperSize, row.PaperSize, row["Paper Size"]),
        length: pick(row.length, row.Length),
        width: pick(row.width, row.Width),
      };

      if (existingCodes.has(key)) {
        toUpdate.push(data);
      } else {
        toInsert.push(data);
      }
    });

    let inserted = 0;
    if (toInsert.length > 0) {
      const result = await Material.insertMany(toInsert, { ordered: false });
      inserted = result.length;
    }

    let updated = 0;
    for (const data of toUpdate) {
      await Material.updateOne({ code: data.code }, { $set: data });
      updated++;
    }

    res.json({ inserted, updated, skipped: 0, errors });
  } catch (err) {
    console.error("Material bulk upload error:", err);
    res.status(500).json({ message: err.message || "Bulk upload failed" });
  }
});

// UPDATE material
router.put("/materials/:id", async (req, res) => {
  try {
    const updated = await Material.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Material not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating material" });
  }
});

// DELETE material
router.delete("/materials/:id", async (req, res) => {
  try {
    await Material.findByIdAndDelete(req.params.id);
    res.json({ message: "Material deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting material" });
  }
});

module.exports = router;