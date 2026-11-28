const express = require("express");
const router = express.Router();
const Preprocess = require("../models/Preprocess");
const WorkOrder = require("../models/WorkOrder");
const authMiddleware = require("../middleware/authMiddleware");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Distinct customers of completed records (for the filter dropdowns)
router.get("/customers", authMiddleware, async (req, res) => {
  try {
    const customers = await Preprocess.distinct("customer");
    res.json(
      customers.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
    // Old behaviour (no params) - unchanged
    if (!req.query.limit && !req.query.all) {
      const records = await Preprocess.find()
        .populate("workOrderId")
        .sort({ createdAt: -1 });
      return res.json(records);
    }

    // New: server-side filter (+ limit)
    const and = [];
    const woClause = (v) => ({
      $expr: {
        $regexMatch: {
          input: { $toString: "$efiWoNumber" },
          regex: escapeRegex(String(v).trim()),
          options: "i"
        }
      }
    });
    if (req.query.woNo && String(req.query.woNo).trim()) and.push(woClause(req.query.woNo));
    if (req.query.woNo2 && String(req.query.woNo2).trim()) and.push(woClause(req.query.woNo2));
    if (req.query.customer) and.push({ customer: req.query.customer });
    if (req.query.customer2) and.push({ customer: req.query.customer2 });
    if (req.query.productCode && String(req.query.productCode).trim()) {
      and.push({ productCode: new RegExp(escapeRegex(String(req.query.productCode).trim()), "i") });
    }

    const range = {};
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if (from && !isNaN(from)) range.$gte = from;
    if (to && !isNaN(to)) range.$lte = to;
    if (Object.keys(range).length) and.push({ createdAt: range });

    const q = and.length ? { $and: and } : {};
    const fields =
      "slNo efiWoNumber productCode customer orderQty itemPdfPath planningUser assignedBy createdAt";

    if (req.query.all) {
      const rows = await Preprocess.find(q).select(fields).sort({ createdAt: -1 }).lean();
      return res.json(rows);
    }

    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    // Paged mode (used by the dashboard so old records are reachable)
    if (req.query.page) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const [rows, total] = await Promise.all([
        Preprocess.find(q)
          .select(fields)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Preprocess.countDocuments(q)
      ]);
      return res.json({ rows, total, page, limit });
    }

    const rows = await Preprocess.find(q).select(fields).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(rows);
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

// =============================================
// REJECT A WORK ORDER (goes back to the planner with a reason)
// =============================================
router.post("/reject", authMiddleware, async (req, res) => {
  try {
    const { workOrderId, reason } = req.body;

    if (!workOrderId) {
      return res.status(400).json({ message: "workOrderId is required" });
    }
    const why = String(reason || "").trim();
    if (!why) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const done = await Preprocess.findOne({ workOrderId });
    if (done) {
      return res.status(400).json({ message: "This work order is already marked done" });
    }

    // only a work order that is waiting in Prepress can be rejected
    const wo = await WorkOrder.findOneAndUpdate(
      { _id: workOrderId, status: "PLANNED", sentToPrepress: true },
      {
        $set: {
          sentToPrepress: false,
          prepressRejected: true,
          prepressRejectReason: why.slice(0, 500),
          prepressRejectedBy: req.user.name,
          prepressRejectedAt: new Date(),
          rejectUnseenByPlanner: true,
          replyUnseenByPrepress: false
        },
        $push: {
          prepressChat: { from: "PREPRESS", name: req.user.name, text: why.slice(0, 500), at: new Date() }
        }
      },
      { new: true }
    );
    if (!wo) {
      return res.status(404).json({ message: "This work order is not pending in Prepress" });
    }

    res.json({ ok: true, efiWoNumber: wo.efiWoNumber });
  } catch (err) {
    console.error("REJECT PREPROCESS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// PREPRESS HAS READ THE PLANNER'S REPLY
// =============================================
router.post("/seen", authMiddleware, async (req, res) => {
  try {
    const { workOrderId } = req.body;
    if (!workOrderId) {
      return res.status(400).json({ message: "workOrderId is required" });
    }
    await WorkOrder.updateOne(
      { _id: workOrderId, replyUnseenByPrepress: true },
      { $set: { replyUnseenByPrepress: false } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("PREPRESS SEEN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;