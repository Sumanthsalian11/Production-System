// server/routes/material.js
const express = require("express");
const router = express.Router();
const Material = require("../models/Material");

// GET all materials
router.get("/materials", async (req, res) => {
  try {
    const materials = await Material.find(); // ✅ fetch all existing records
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add new material
router.post("/materials", async (req, res) => {
  const { code, description, group, mill, gsm ,paperSize} = req.body;
  if (!code) return res.status(400).json({ message: "Code is required" });

  try {
    const newMaterial = new Material({ code, description, group, mill, gsm,paperSize });
    const saved = await newMaterial.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
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

// DELETE material (optional)
router.delete("/materials/:id", async (req, res) => {
  try {
    await Material.findByIdAndDelete(req.params.id);
    res.json({ message: "Material deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting material" });
  }
});

module.exports = router;