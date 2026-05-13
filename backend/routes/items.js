const express = require("express");
const router = express.Router();
const Item = require("../models/Item");

/* ===========================
   GET ALL ITEMS  (MUST BE FIRST)
=========================== */
router.get("/", async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===========================
   GET ITEM BY CODE
=========================== */
router.get("/:code", async (req, res) => {
  try {
    const item = await Item.findOne({ itemCode: req.params.code });

    if (!item) return res.status(404).json({ message: "Not found" });

    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ===========================
   CREATE ITEM
=========================== */
router.post("/", async (req, res) => {
  try {
    const exists = await Item.findOne({ itemCode: req.body.itemCode });
    if (exists) {
      return res.status(400).json({ message: "Item code already exists" });
    }

    const item = new Item(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
/* ===========================
   UPDATE ITEM
=========================== */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Item not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating item" });
  }
});

/* ===========================
   DELETE ITEM
=========================== */
router.delete("/:id", async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting item" });
  }
});

module.exports = router;