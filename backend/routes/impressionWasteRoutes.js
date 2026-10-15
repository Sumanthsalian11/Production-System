const express = require("express");
const router = express.Router();
const ImpressionWaste = require("../models/ImpressionWaste");
const authMiddleware = require("../middleware/authMiddleware");

// anyone logged in can read it (Production Entry needs it)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const doc = await ImpressionWaste.findOne();
    res.json({ percent: doc ? doc.percent : 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// admin only: set the value
router.put("/", authMiddleware, async (req, res) => {
  try {
    if (String(req.user.role || "").toUpperCase() !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const percent = Number(req.body.percent);
    if (isNaN(percent) || percent < 0) {
      return res.status(400).json({ message: "Enter a valid percentage" });
    }
    const doc = await ImpressionWaste.findOneAndUpdate(
      {},
      { percent },
      { new: true, upsert: true }
    );
    res.json({ percent: doc.percent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;