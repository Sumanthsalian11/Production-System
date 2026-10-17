const express = require("express");
const router = express.Router();
const ItemStage = require("../models/ItemStage");

const normalize = (ids = []) =>
  ids.map((activityId, i) => ({ order: i + 1, activityId }));

router.get("/", async (req, res) => {
  try {
    const list = await ItemStage.find()
      .populate("stages.activityId", "activityName")
      .sort({ itemName: 1 })
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Error fetching item stages", error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { itemName, activityIds } = req.body;
    if (!itemName?.trim()) return res.status(400).json({ message: "Item name is required" });
    if (!Array.isArray(activityIds) || !activityIds.length)
      return res.status(400).json({ message: "Select at least one stage" });

    const saved = await ItemStage.create({ itemName, stages: normalize(activityIds) });
    res.status(201).json(saved);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Item already exists" });
    res.status(500).json({ message: "Error saving item stages", error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { activityIds } = req.body;
    if (!Array.isArray(activityIds) || !activityIds.length)
      return res.status(400).json({ message: "Select at least one stage" });

    const updated = await ItemStage.findByIdAndUpdate(
      req.params.id,
      { stages: normalize(activityIds) },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating item stages", error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await ItemStage.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting", error: err.message });
  }
});

module.exports = router;