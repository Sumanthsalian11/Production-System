const express = require("express");
const router = express.Router();
const ScanLog = require("../models/ScanLog");
const authMiddleware =
  require("../middleware/authMiddleware");
// ========================================
// SAVE SCAN
// ========================================
router.post(
  "/save",
  authMiddleware,
  async (req, res) => {
  try {
  const userName =
  req.user.name;

const userLocations =
  req.user.locations || [];

const {
  poNumber,
  poDate,
  deliveryDate,
  deliveryAddress,
  currentBox,
  totalBoxes,
  remainingQty,
  barcodeNo,
} = req.body;

    if (!poNumber || !currentBox || !totalBoxes) {
      return res.status(400).json({
        success: false,
        message: "poNumber, currentBox, and totalBoxes are required",
      });
    }

    // Duplicate check
const existing = await ScanLog.findOne({
  poNumber,
  currentBox,
  totalBoxes,    // ✅
  remainingQty,  // ✅
});

    if (existing) {
      const all = await ScanLog.find({ poNumber });

      const done = all.length;
      const total = totalBoxes;
      const pending = Math.max(0, total - done);

      return res.status(200).json({
        success: true,
        message: `Carton ${currentBox} already scanned`,
        duplicate: true,
        progress: { total, done, pending },
      });
    }

    await ScanLog.create({
      poNumber,
      poDate,
      deliveryDate,
      deliveryAddress,
     username: userName,

      currentBox,
      totalBoxes,
      remainingQty,
      barcodeNo,
  userLocations,

      scannedAt: new Date(),
    });

    const all = await ScanLog.find({ poNumber });

    const done = all.length;
    const total = totalBoxes;
    const pending = Math.max(0, total - done);

    res.status(201).json({
      success: true,
      message: "Scan saved successfully",
      progress: { total, done, pending },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Save failed",
    });
  }
});

// ========================================
// GET SCAN LOG BY PO NUMBER
// ========================================
router.get("/by-po/:poNumber", async (req, res) => {
  try {
    const logs = await ScanLog.find({
      poNumber: req.params.poNumber,
    }).sort({ scannedAt: -1 });

    // ✅ Group progress by batch (totalBoxes + remainingQty)
    const batchMap = {};
    logs.forEach((log) => {
      const key = `${log.totalBoxes}_${log.remainingQty}`;
      if (!batchMap[key]) {
        batchMap[key] = {
          totalBoxes: log.totalBoxes,
          remainingQty: log.remainingQty,
          scanned: 0,
        };
      }
      batchMap[key].scanned += 1;
    });

    const batches = Object.values(batchMap);

    // Overall progress = sum of all batches
    const totalBoxesAll = batches.reduce((sum, b) => sum + b.totalBoxes, 0);
    const doneAll = batches.reduce((sum, b) => sum + b.scanned, 0);
    const pendingAll = batches.reduce(
      (sum, b) => sum + Math.max(0, b.totalBoxes - b.scanned),
      0
    );

    res.status(200).json({
      success: true,
      data: logs,
      progress: {
        total: totalBoxesAll,
        done: doneAll,
        pending: pendingAll,
      },
      batches: batches.map((b) => ({
        totalBoxes: b.totalBoxes,
        remainingQty: b.remainingQty,
        done: b.scanned,
        pending: Math.max(0, b.totalBoxes - b.scanned),
      })),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Fetch failed" });
  }
});

// ========================================
// GET ALL SCAN LOGS (dashboard overview)
// ========================================
router.get("/all", async (req, res) => {
  try {
    const logs = await ScanLog.find().sort({ scannedAt: -1 });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Fetch failed" });
  }
});

// ========================================
// DELETE SCAN LOG BY PO (reset scans)
// ========================================
router.delete("/reset/:poNumber", async (req, res) => {
  try {
    await ScanLog.deleteMany({ poNumber: req.params.poNumber });
    res.status(200).json({ success: true, message: "Scan logs cleared" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Reset failed" });
  }
});

module.exports = router;