const express = require("express");
const router = express.Router();
const Calibration = require("../models/Calibration");

// NOTE: If your other master routes use an auth middleware (e.g. verifyToken),
// require it here and add it to each route the same way, e.g.:
// const verifyToken = require("../middleware/authMiddleware");
// router.get("/", verifyToken, async (req, res) => { ... });

// GET all calibration entries, sorted by Sl. No
router.get("/", async (req, res) => {
  try {
    const entries = await Calibration.find().sort({ slNo: 1, createdAt: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create a new calibration entry
router.post("/", async (req, res) => {
  try {
    const entry = new Calibration(req.body);
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update an existing calibration entry
router.put("/:id", async (req, res) => {
  try {
    const updated = await Calibration.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: "Entry not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a calibration entry
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Calibration.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Entry not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;