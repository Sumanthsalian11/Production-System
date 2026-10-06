const express = require("express");
const router = express.Router();
const InnerPacking = require("../models/Packing");

// 🔥 CREATE
router.post("/inner-packing", async (req, res) => {
  try {
    const data = await InnerPacking.create(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 GET ALL
router.get("/inner-packing", async (req, res) => {
  try {
    const data = await InnerPacking.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 GET BY TYPE (IMPORTANT FOR DROPDOWN)
router.get("/inner-packing/:type", async (req, res) => {
  try {
    const data = await InnerPacking.findOne({
      type: req.params.type
    });

    if (!data) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 UPDATE
router.put("/inner-packing/:id", async (req, res) => {
  try {
    const updated = await InnerPacking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔥 DELETE
router.delete("/inner-packing/:id", async (req, res) => {
  try {
    await InnerPacking.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;