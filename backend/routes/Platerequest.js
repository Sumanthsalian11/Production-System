const express = require("express");
const router = express.Router();
const PlateRequest = require("../models/Platerequest");
const WorkOrder = require("../models/WorkOrder");
const authMiddleware = require("../middleware/authMiddleware");

// =============================================
// FETCH A SINGLE WORK ORDER BY EFI NUMBER
// (for the plate request form's "Fetch" flow;
// blocks if a PENDING/APPROVED request already exists)
// =============================================
router.get("/fetch-workorder/:efi", authMiddleware, async (req, res) => {
  try {
    const efiNumber = Number(req.params.efi);

    const workOrder = await WorkOrder.findOne({ efiWoNumber: efiNumber })
      .populate({ path: "machines.activityId", select: "activityName" })
      .populate({ path: "machines.machineId", select: "machineName" });

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    // Raw activity -> machine pairs, as they actually exist on the work order,
    // so the form can cascade: pick an activity, only see machines under it.
    const machinePairs = (workOrder.machines || [])
      .map(m => ({
        activity: m.activityId?.activityName || "",
        machine: m.machineId?.machineName || ""
      }))
      .filter(p => p.activity && p.machine);

    const activities = [...new Set(machinePairs.map(p => p.activity))];
    const machineNames = [...new Set(machinePairs.map(p => p.machine))];

    res.json({
      _id: workOrder._id,
      efiWoNumber: workOrder.efiWoNumber,
      productCode: workOrder.productCode,
      customerName: workOrder.customer,
      jobDescription: workOrder.productName,
      productType: workOrder.productType || "",
      activities,
      machineNames,
      machinePairs
    });
  } catch (err) {
    console.error("FETCH WORKORDER FOR PLATE REQUEST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// GET ALL PENDING PLATE REQUESTS
// (Used by Prepress to review / approve / reject)
// =============================================
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const requests = await PlateRequest.find({ status: "PENDING" })
      .populate("workOrderId")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error("FETCH PENDING PLATE REQUESTS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// GET ALL PLATE REQUESTS (full history)
// =============================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const requests = await PlateRequest.find()
      .populate("workOrderId")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error("FETCH PLATE REQUESTS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// CREATE A PLATE REQUEST -> sent to Prepress
// =============================================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { workOrderId, remarks, activity, machine } = req.body;

    if (!workOrderId) {
      return res.status(400).json({ message: "workOrderId is required" });
    }
    if (!activity || !machine) {
      return res.status(400).json({ message: "Please select an activity and machine" });
    }

    const workOrder = await WorkOrder.findById(workOrderId);

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    const newRequest = new PlateRequest({
      workOrderId,
      efiWoNumber: workOrder.efiWoNumber,
      jobName: workOrder.productName,
      customerName: workOrder.customer || "",
      jobDescription: workOrder.productName,
      productType: workOrder.productType || "",
      activities: [activity],
      machineNames: [machine],
      userLocations: workOrder.userLocations || [],
      remarks: remarks || "",
      requestedBy: req.user.name
    });

    await newRequest.save();
    res.status(201).json(newRequest);
  } catch (err) {
    console.error("CREATE PLATE REQUEST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// APPROVE A PLATE REQUEST
// =============================================
router.post("/:id/approve", authMiddleware, async (req, res) => {
  try {
    const request = await PlateRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Plate request not found" });
    if (request.status !== "PENDING") {
      return res.status(400).json({ message: `Request already ${request.status.toLowerCase()}` });
    }

    request.status = "APPROVED";
    request.reviewedBy = req.user.name;
    request.reviewRemarks = req.body.reviewRemarks || "";
    request.reviewedAt = new Date();
    await request.save();

    res.json(request);
  } catch (err) {
    console.error("APPROVE PLATE REQUEST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// REJECT A PLATE REQUEST
// =============================================
router.post("/:id/reject", authMiddleware, async (req, res) => {
  try {
    const request = await PlateRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Plate request not found" });
    if (request.status !== "PENDING") {
      return res.status(400).json({ message: `Request already ${request.status.toLowerCase()}` });
    }

    request.status = "REJECTED";
    request.reviewedBy = req.user.name;
    request.reviewRemarks = req.body.reviewRemarks || "";
    request.reviewedAt = new Date();
    await request.save();

    res.json(request);
  } catch (err) {
    console.error("REJECT PLATE REQUEST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;