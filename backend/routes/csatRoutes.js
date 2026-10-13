const express = require("express");
const router = express.Router();
const CsatResponse = require("../models/CsatResponse");

// Called by Power Automate
router.post("/webhook", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== process.env.CSAT_WEBHOOK_KEY) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { responseId, responder, submittedAt, answers } = req.body;

    const doc = await CsatResponse.findOneAndUpdate(
      { responseId },
      { responseId, responder, submittedAt: submittedAt || new Date(), answers },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Used by frontend table
router.get("/", async (req, res) => {
  try {
    const rows = await CsatResponse.find().sort({ submittedAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;