const express = require("express");
const router = express.Router();
const ActivityMaster = require("../models/ActivityMaster");
const authMiddleware = require("../middleware/authMiddleware");

// GET all activities
router.get("/", authMiddleware, async (req, res) => {
  try {
    const activities = await ActivityMaster.find().populate("machines");
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE a new activity
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { activityName, machines } = req.body;
    if (!activityName || !machines || machines.length === 0) {
      return res.status(400).json({ message: "Activity name and machines are required" });
    }

    const newActivity = new ActivityMaster({ activityName, machines });
    await newActivity.save();
    res.status(201).json(newActivity);
  } catch (err) {
    console.error("Activity creation error:", err);
    res.status(500).json({ message: err.message });
  }
});
// UPDATE an activity
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { activityName, machines } = req.body;
    if (!activityName || !machines || machines.length === 0) {
      return res
        .status(400)
        .json({ message: "Activity name and machines are required" });
    }

    const updated = await ActivityMaster.findByIdAndUpdate(
      req.params.id,
      { activityName, machines },
      { new: true }
    ).populate("machines");

    res.json(updated);
  } catch (err) {
    console.error("Activity update error:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE an activity
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await ActivityMaster.findByIdAndDelete(req.params.id);
    res.json({ message: "Activity deleted successfully" });
  } catch (err) {
    console.error("Activity delete error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;