const express = require("express");
const router = express.Router();
const Preprocess = require("../models/Preprocess");
const WorkOrder = require("../models/WorkOrder");
const authMiddleware = require("../middleware/authMiddleware");

// =============================================
// GET WORK ORDERS PENDING PREPRESS ASSIGNMENT
// (Used to populate the Preprocess page table —
// same data + same populate as Planner's
// "Planned Work Orders" table: status PLANNED,
// with machines.activityId / machines.machineId
// populated, minus anything already assigned.)
// =============================================
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const assigned = await Preprocess.find().select("workOrderId");
    const assignedIds = assigned.map(a => String(a.workOrderId));

    const workOrders = await WorkOrder.find({ status: "PLANNED", sentToPrepress: true })
      .populate("customer")
      .populate({
        path: "machines.machineId",
        select: "machineName"
      })
      .populate({
        path: "machines.activityId",
        select: "activityName"
      })
      .sort({ createdAt: -1 });

    const pending = workOrders.filter(
      wo => !assignedIds.includes(String(wo._id))
    );

    res.json(pending);
  } catch (err) {
    console.error("FETCH PENDING PREPROCESS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// GET ALL PREPROCESS (ASSIGNED) RECORDS
// =============================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const records = await Preprocess.find()
      .populate("workOrderId")
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// MARK A WORK ORDER DONE -> SAVE TO PREPROCESS TABLE
// =============================================
router.post("/complete", authMiddleware, async (req, res) => {
  try {
    const { workOrderId } = req.body;

    if (!workOrderId) {
      return res.status(400).json({ message: "workOrderId is required" });
    }

    const workOrder = await WorkOrder.findById(workOrderId)
      .populate("customer")
      .populate({ path: "machines.machineId", select: "machineName" })
      .populate({ path: "machines.activityId", select: "activityName" });

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    const existing = await Preprocess.findOne({ workOrderId });
    if (existing) {
      return res.status(400).json({ message: "This work order is already assigned to Prepress" });
    }

    const newPreprocess = new Preprocess({
      workOrderId,
      slNo: workOrder.slNo,
      efiWoNumber: workOrder.efiWoNumber,
      productCode: workOrder.productCode,
      purchaseOrderNo: workOrder.purchaseOrderNo,
      priority: workOrder.priority,
      customer: workOrder.customer?.name || workOrder.customer,
      productType: workOrder.productType,
      productName: workOrder.productName,
      location: workOrder.location,

      machines: (workOrder.machines || []).map(m => ({
        activityId: m.activityId?._id || m.activityId,
        machineId: m.machineId?._id || m.machineId,
        activityName: m.activityId?.activityName || "",
        machineName: m.machineId?.machineName || "",
        inches: m.inches || "",
        slitNumber: m.slitNumber || ""
      })),

      materials: (workOrder.materials || []).map(mt => ({
        materialCode: mt.materialCode,
        materialDescription: mt.materialDescription,
        materialGroupDescription: mt.materialGroupDescription,
        mill: mt.mill,
        gsm: mt.gsm,
        paperSize: mt.paperSize,
        paperQty: mt.paperQty
      })),

      colorFront: workOrder.colorFront,
      colorBack: workOrder.colorBack,
      orderQty: workOrder.orderQty,
      wasteQty: workOrder.wasteQty,
      totalQty: workOrder.totalQty,
      jobSize: workOrder.jobSize,
      UPS: workOrder.UPS,
      impFront: workOrder.impFront,
      impBack: workOrder.impBack,
      totalImp: workOrder.totalImp,
      inkDetails: workOrder.inkDetails,
      remarks: workOrder.remarks,
      itemPdfPath: workOrder.itemPdfPath || "",
      planningUser: workOrder.planningUser,
      userLocations: workOrder.userLocations || [],

      assignedBy: req.user.name,
      status: "ASSIGNED"
    });

    await newPreprocess.save();
    res.status(201).json(newPreprocess);
  } catch (err) {
    console.error("COMPLETE PREPROCESS ERROR:", err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "This work order is already marked done" });
    }
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// DELETE / UNASSIGN A PREPROCESS RECORD
// (sends the work order back to the pending list)
// =============================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const record = await Preprocess.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Preprocess record not found" });
    }

    if (record.assignedBy !== req.user.name) {
      return res.status(403).json({ message: "Not authorized to unassign this record" });
    }

    await Preprocess.findByIdAndDelete(req.params.id);
    res.json({ message: "Unassigned successfully" });
  } catch (err) {
    console.error("DELETE PREPROCESS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;