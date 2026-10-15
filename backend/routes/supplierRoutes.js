const express = require("express");
const router = express.Router();
const Supplier = require("../models/Supplier");

// IMPORTANT: use the same auth middleware your other routes use.
// Open any existing route file (e.g. routes/masterRoutes.js) and copy its auth require line here.
const auth = require("../middleware/authMiddleware");

// GET all suppliers
router.get("/", auth, async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch suppliers" });
  }
});

// ADD supplier
router.post("/", auth, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Supplier name is required" });

    const exists = await Supplier.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
    if (exists) return res.status(400).json({ message: "Supplier already exists" });

    const supplier = await Supplier.create({ name });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ message: "Failed to save supplier" });
  }
});

// UPDATE supplier
router.put("/:id", auth, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Supplier name is required" });

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: "Failed to update supplier" });
  }
});

// DELETE supplier
router.delete("/:id", auth, async (req, res) => {
  try {
    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete supplier" });
  }
});

module.exports = router;