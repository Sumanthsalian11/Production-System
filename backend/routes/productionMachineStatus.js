const express = require("express");
const router = express.Router();

const ProductionMachineStatus = require("../models/ProductionMachineStatus");


// ==========================================
// CREATE
// ==========================================
router.post("/", async (req, res) => {
  try {
    const newRecord = new ProductionMachineStatus({
      productionDate: req.body.productionDate,
      shift: req.body.shift,
      activityId: req.body.activityId,
      machineId: req.body.machineId,
      machineStatus: req.body.machineStatus,
      customerName: req.body.customerName,
      materialType: req.body.materialType,
      fromTime: req.body.fromTime,
      toTime: req.body.toTime,
      remarks: req.body.remarks,
      enteredBy: req.body.enteredBy,
woNumber: req.body.woNumber,
totalPages: req.body.totalPages,
wastageSheets: req.body.wastageSheets,
wastePercentage: req.body.wastePercentage,
reason: req.body.reason,
paperSize:   req.body.paperSize   || "",
printerName: req.body.printerName || "",
   userLocations: req.body.userLocations || [],
    });

    const saved = await newRecord.save();

    res.status(201).json(saved);
  } catch (err) {
    console.error("Create error:", err);

    res.status(500).json({
      message: "Error creating record",
      error: err.message,
    });
  }
});


// ==========================================
// GET ALL
// ==========================================
router.get("/", async (req, res) => {
  try {
    const records = await ProductionMachineStatus.find()
      .populate("activityId", "activityName")
      .populate("machineId", "machineName")
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (err) {
    console.error("Fetch error:", err);

    res.status(500).json({
      message: "Error fetching records",
      error: err.message,
    });
  }
});


// ==========================================
// UPDATE
// ==========================================
router.put("/:id", async (req, res) => {
  try {
    const updated = await ProductionMachineStatus.findByIdAndUpdate(
      req.params.id,
      {
        productionDate: req.body.productionDate,
        shift: req.body.shift,
        activityId: req.body.activityId,
        machineId: req.body.machineId,
        machineStatus: req.body.machineStatus,
        customerName: req.body.customerName,
        materialType: req.body.materialType,
        fromTime: req.body.fromTime,
        toTime: req.body.toTime,
        remarks: req.body.remarks,
        woNumber: req.body.woNumber,
totalPages: req.body.totalPages,
wastageSheets: req.body.wastageSheets,
wastePercentage: req.body.wastePercentage,
reason: req.body.reason,
paperSize:   req.body.paperSize   || "",
printerName: req.body.printerName || "",
        enteredBy: req.body.enteredBy,
userLocations: req.body.userLocations || [],
       
      },
      {
        new: true,
      }
    );

    res.json(updated);
  } catch (err) {
    console.error("Update error:", err);

    res.status(500).json({
      message: "Error updating record",
      error: err.message,
    });
  }
});


// ==========================================
// DELETE
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    await ProductionMachineStatus.findByIdAndDelete(req.params.id);

    res.json({
      message: "Deleted successfully",
    });
  } catch (err) {
    console.error("Delete error:", err);

    res.status(500).json({
      message: "Error deleting record",
      error: err.message,
    });
  }
});

module.exports = router;