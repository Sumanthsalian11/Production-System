const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const ProductionLog = require("../models/ProductionLog");
const WorkOrder = require("../models/WorkOrder");

router.get("/", protect, async (req, res) => {
  try {
    const entries = await ProductionLog.find().sort({ date: -1, createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const entry = await ProductionLog.create({ ...req.body, loggedBy: req.user.name });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const entry = await ProductionLog.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    if (entry.loggedBy !== req.user.name) {
      return res.status(403).json({ message: "You can only edit your own entries" });
    }

    const { woNumber, customerName, jobName, machine, date, producedQty, wastageQty, reason, remark } = req.body;
    Object.assign(entry, { woNumber, customerName, jobName, machine, date, producedQty, wastageQty, reason, remark });
    await entry.save();

    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const entry = await ProductionLog.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    if (entry.loggedBy !== req.user.name) {
      return res.status(403).json({ message: "You can only delete your own entries" });
    }

    await entry.deleteOne();
    res.json({ message: "Entry deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/production-log/wo-lookup/:woNumber -> pull customer/job/machine from Planner data
router.get("/wo-lookup/:woNumber", protect, async (req, res) => {
  try {
    const wo = await WorkOrder.findOne({ efiWoNumber: req.params.woNumber })
      .populate("machines.machineId");

    if (!wo) return res.status(404).json({ message: "Work order not found" });

    res.json({
      customerName: wo.customer || "",
      jobName: wo.productName || "",
      machine: wo.machines?.map(m => m.machineId?.machineName).filter(Boolean) || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;