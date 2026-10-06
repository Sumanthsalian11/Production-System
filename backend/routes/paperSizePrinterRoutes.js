const express = require("express");
const router = express.Router();
const PaperSize = require("../models/PaperSize");
const PrinterMaster = require("../models/PrinterMaster");
const authMiddleware = require("../middleware/authMiddleware");

// ── PAPER SIZE ──
router.get("/paper-sizes", authMiddleware, async (req, res) => {
  try {
    res.json(await PaperSize.find());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/paper-sizes", authMiddleware, async (req, res) => {
  try {
    const ps = await PaperSize.create({
      name: req.body.name,
      wastage: req.body.wastage || 0,
      rate: req.body.rate || 0,
    });
    res.status(201).json(ps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/paper-sizes/:id", authMiddleware, async (req, res) => {
  try {
    const update = { name: req.body.name };
    if (req.body.wastage !== undefined) update.wastage = req.body.wastage;
    if (req.body.rate !== undefined) update.rate = req.body.rate;
    const updated = await PaperSize.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/paper-sizes/:id", authMiddleware, async (req, res) => {
  try {
    await PaperSize.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PRINTER MASTER ──

// GET all printers
router.get("/printers", authMiddleware, async (req, res) => {
  try {
    const printers = await PrinterMaster.find();
    res.json(printers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADD printer name to a machine (creates machine entry if not exists)
router.post("/printers", authMiddleware, async (req, res) => {
  try {
    const { machineName, printerName } = req.body;

    if (!machineName || !printerName) {
      return res.status(400).json({ message: "machineName and printerName are required" });
    }

    let existing = await PrinterMaster.findOne({ machineName });

    if (existing) {
      if (existing.printerNames.includes(printerName)) {
        return res.status(400).json({ message: "Printer already exists for this machine" });
      }
      existing.printerNames.push(printerName);
      await existing.save();
      return res.json(existing);
    }

    const printer = await PrinterMaster.create({
      machineName,
      printerNames: [printerName]
    });
    res.status(201).json(printer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE a single printer name from a machine
router.delete("/printers/:machineName/:printerName", authMiddleware, async (req, res) => {
  try {
    const { machineName, printerName } = req.params;

    const record = await PrinterMaster.findOne({ machineName });
    if (!record) return res.status(404).json({ message: "Machine not found" });

    record.printerNames = record.printerNames.filter((p) => p !== printerName);

    // If no printers left, delete the whole machine entry
    if (record.printerNames.length === 0) {
      await PrinterMaster.findByIdAndDelete(record._id);
      return res.json({ message: "Machine entry deleted as no printers remain" });
    }

    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.put("/printers/:machineName/:oldName", authMiddleware, async (req, res) => {
  try {
    const { machineName, oldName } = req.params;
    const { newName } = req.body;
    const printer = await PrinterMaster.findOne({ machineName });
    if (!printer) return res.status(404).json({ message: "Machine not found" });
    const idx = printer.printerNames.indexOf(oldName);
    if (idx === -1) return res.status(404).json({ message: "Printer name not found" });
    printer.printerNames[idx] = newName;
    await printer.save();
    res.json(printer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;