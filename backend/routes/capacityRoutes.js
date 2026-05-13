const express = require("express");
const router = express.Router();
const MachineCapacity = require("../models/MachineCapacity");

// ➕ CREATE / UPDATE
router.post("/", async (req, res) => {
  const { machineId, capacityPerHour } = req.body;

  const data = await MachineCapacity.findOneAndUpdate(
    { machineId },
    { capacityPerHour },
    { new: true, upsert: true }
  );

  res.json(data);
});

// 🔍 GET
router.get("/:machineId", async (req, res) => {
  const data = await MachineCapacity.findOne({
    machineId: req.params.machineId
  });

  if (!data) {
    return res.status(404).json({ message: "Capacity not found" });
  }

  res.json(data);
});
// 🔍 GET ALL
router.get("/", async (req, res) => {
  try {
    const data = await MachineCapacity.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;