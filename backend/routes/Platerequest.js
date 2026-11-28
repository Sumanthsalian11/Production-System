const express = require("express");
const router = express.Router();
const PlateRequest = require("../models/Platerequest");
const WorkOrder = require("../models/WorkOrder");
const PlateReason = require("../models/PlateReason");
const PlateMaster = require("../models/PlateMaster");
const authMiddleware = require("../middleware/authMiddleware");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Distinct dropdown values (customer / product type) for the filters
router.get("/filter-options", authMiddleware, async (req, res) => {
  try {
    const locs = String(req.query.locations || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    const base = { userLocations: { $in: locs } };
    const [customers, productTypes] = await Promise.all([
      PlateRequest.distinct("customerName", base),
      PlateRequest.distinct("productType", base)
    ]);
    res.json({
      customers: customers.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
      productTypes: productTypes.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))
    });
  } catch (err) {
    console.error("PLATE REQUEST FILTER OPTIONS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

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
    // Old behaviour (no paging params) - unchanged
    if (!req.query.page && !req.query.all) {
      const requests = await PlateRequest.find()
        .populate("workOrderId")
        .sort({ createdAt: -1 });
      return res.json(requests);
    }

    // New: server-side filter + paging
    const locs = String(req.query.locations || "")
      .split(",").map(s => s.trim()).filter(Boolean);

    const q = { userLocations: { $in: locs } };
    if (req.query.customer) q.customerName = req.query.customer;
    if (req.query.productType) q.productType = req.query.productType;
    if (req.query.status) q.status = req.query.status;

    if (req.query.from || req.query.to) {
      q.createdAt = {};
      const from = req.query.from ? new Date(req.query.from) : null;
      const to = req.query.to ? new Date(req.query.to) : null;
      if (from && !isNaN(from)) q.createdAt.$gte = from;
      if (to && !isNaN(to)) q.createdAt.$lte = to;
      if (!Object.keys(q.createdAt).length) delete q.createdAt;
    }

    if (req.query.woNo && String(req.query.woNo).trim()) {
      q.$and = [{
        $expr: {
          $regexMatch: {
            input: { $toString: "$efiWoNumber" },
            regex: escapeRegex(String(req.query.woNo).trim()),
            options: "i"
          }
        }
      }];
    }

    // Excel export: every matching row (light objects, no populate)
    if (req.query.all) {
      const rows = await PlateRequest.find(q).sort({ createdAt: -1 }).lean();
      return res.json(rows);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const [rows, total] = await Promise.all([
      PlateRequest.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PlateRequest.countDocuments(q)
    ]);

    res.json({ rows, total, page, limit });
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
    const { workOrderId, remarks, activity, machine, impressions, reasons, plate, qty } = req.body;

    if (!impressions || !String(impressions).trim()) {
      return res.status(400).json({ message: "Please enter No. of Impressions" });
    }
    if (!Array.isArray(reasons) || reasons.length === 0) {
      return res.status(400).json({ message: "Please select a Reason" });
    }
    if (!plate || !String(plate).trim()) {
      return res.status(400).json({ message: "Please select a Plate" });
    }
    if (!qty || Number(qty) <= 0) {
      return res.status(400).json({ message: "Please enter a valid Qty" });
    }

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
      impressions: String(impressions).trim(),
      plate: String(plate).trim(),
      qty: Number(qty),
      reasons: reasons,
      reason: reasons.join(", "),
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

// =============================================
// PLATE REQUEST REASONS (maintained in Admin Dashboard)
// =============================================
router.get("/reasons", authMiddleware, async (req, res) => {
  try {
    const reasons = await PlateReason.find().sort({ name: 1 });
    res.json(reasons);
  } catch (err) {
    console.error("FETCH PLATE REASONS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/reasons", authMiddleware, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Reason is required" });

    const exists = await PlateReason.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
    });
    if (exists) return res.status(400).json({ message: "Reason already exists" });

    const reason = await PlateReason.create({ name });
    res.status(201).json(reason);
  } catch (err) {
    console.error("CREATE PLATE REASON ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.put("/reasons/:id", authMiddleware, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Reason is required" });

    const reason = await PlateReason.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );
    if (!reason) return res.status(404).json({ message: "Reason not found" });
    res.json(reason);
  } catch (err) {
    console.error("UPDATE PLATE REASON ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/reasons/:id", authMiddleware, async (req, res) => {
  try {
    await PlateReason.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE PLATE REASON ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// PLATE MASTER (maintained in Admin Dashboard)
// =============================================
router.get("/plates", authMiddleware, async (req, res) => {
  try {
    const plates = await PlateMaster.find().sort({ name: 1 });
    res.json(plates);
  } catch (err) {
    console.error("FETCH PLATE MASTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/plates", authMiddleware, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Plate is required" });

    const exists = await PlateMaster.findOne({
      name: new RegExp(`^${escapeRegex(name)}$`, "i")
    });
    if (exists) return res.status(400).json({ message: "Plate already exists" });

    const plate = await PlateMaster.create({ name });
    res.status(201).json(plate);
  } catch (err) {
    console.error("CREATE PLATE MASTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.put("/plates/:id", authMiddleware, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Plate is required" });

    const plate = await PlateMaster.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );
    if (!plate) return res.status(404).json({ message: "Plate not found" });
    res.json(plate);
  } catch (err) {
    console.error("UPDATE PLATE MASTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/plates/:id", authMiddleware, async (req, res) => {
  try {
    await PlateMaster.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE PLATE MASTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;