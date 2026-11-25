const express = require("express");
const router = express.Router();
const FormResponse = require("../models/FormResponse");
const protect = require("../middleware/authMiddleware");

// Admin only: list saved form responses (newest first)
router.get("/", protect, async (req, res) => {
  try {
    if (String(req.user?.role || "").toUpperCase() !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const rows = await FormResponse.find()
      .select("-sheetKey -__v")
      .sort({ submittedAt: -1 })
      .limit(5000)
      .lean();
    res.json(rows);
  } catch (err) {
    console.error("FORM LIST ERROR:", err);
    res.status(500).json({ message: "Could not load responses" });
  }
});

// Old Apps Script endpoint (only used if you still post from Apps Script)
router.post("/", async (req, res) => {
  try {
    if (!process.env.FORM_API_KEY || req.headers["x-api-key"] !== process.env.FORM_API_KEY) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { name, email, address, phone, comments, submittedAt } = req.body;
    const saved = await FormResponse.create({
      name,
      email,
      address,
      phone: phone ? String(phone) : "",
      comments,
      submittedAt: submittedAt ? new Date(submittedAt) : new Date()
    });
    res.status(201).json({ ok: true, id: saved._id });
  } catch (err) {
    console.error("FORM SAVE ERROR:", err);
    res.status(500).json({ message: "Error saving response" });
  }
});

module.exports = router;