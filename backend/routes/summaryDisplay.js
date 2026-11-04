const express = require("express");
const router = express.Router();
const SummaryDisplay = require("../models/SummaryDisplay");
const authMiddleware = require("../middleware/authMiddleware");

// GET /api/summary-display
router.get("/", authMiddleware, async (req, res) => {
  try {
    const doc = await SummaryDisplay.findOne({ key: "default" });
    res.json({ hidden: doc?.hidden || [] });
  } catch (err) {
    console.error("summary-display GET error:", err);
    res.status(500).json({ message: "Failed to fetch summary display" });
  }
});

// PUT /api/summary-display
router.put("/", authMiddleware, async (req, res) => {
  try {
    const hidden = Array.isArray(req.body.hidden) ? req.body.hidden.map(String) : [];
    const doc = await SummaryDisplay.findOneAndUpdate(
      { key: "default" },
      { hidden },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ hidden: doc.hidden });
  } catch (err) {
    console.error("summary-display PUT error:", err);
    res.status(500).json({ message: "Failed to save summary display" });
  }
});
// GET /api/summary-display/perso
router.get("/perso", authMiddleware, async (req, res) => {
  try {
    const doc = await SummaryDisplay.findOne({ key: "default" });
    res.json({ hidden: doc?.persoHidden || [] });
  } catch (err) {
    console.error("summary-display perso GET error:", err);
    res.status(500).json({ message: "Failed to fetch perso summary display" });
  }
});

// PUT /api/summary-display/perso
router.put("/perso", authMiddleware, async (req, res) => {
  try {
    const hidden = Array.isArray(req.body.hidden) ? req.body.hidden.map(String) : [];
    const doc = await SummaryDisplay.findOneAndUpdate(
      { key: "default" },
      { persoHidden: hidden },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ hidden: doc.persoHidden });
  } catch (err) {
    console.error("summary-display perso PUT error:", err);
    res.status(500).json({ message: "Failed to save perso summary display" });
  }
});

module.exports = router;