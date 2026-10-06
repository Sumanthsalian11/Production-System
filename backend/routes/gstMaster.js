const express = require("express");
const router = express.Router();
const GstMachineTax = require("../models/GstMachineMap");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/machine-taxes", authMiddleware, async (req, res) => {
  try {
    res.json(await GstMachineTax.find().sort({ machineName: 1 }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/machine-taxes", authMiddleware, async (req, res) => {
  try {
    const { machineId, machineName, taxes } = req.body;
    if (!machineId || !machineName || !Array.isArray(taxes) || taxes.length === 0) {
      return res.status(400).json({ message: "Machine and at least one tax are required" });
    }
    const exists = await GstMachineTax.findOne({ machineId });
    if (exists) {
      return res.status(400).json({ message: "GST already set for this machine. Edit it instead." });
    }
    const doc = await GstMachineTax.create({ machineId, machineName, taxes });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/machine-taxes/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await GstMachineTax.findByIdAndUpdate(
      req.params.id,
      { taxes: req.body.taxes || [] },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/machine-taxes/:id", authMiddleware, async (req, res) => {
  try {
    await GstMachineTax.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;