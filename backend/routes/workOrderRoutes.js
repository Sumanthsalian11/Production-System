const express = require("express");
const router = express.Router();
const WorkOrder = require("../models/WorkOrder");
const CustomerOrder = require("../models/CustomerOrder");
const authMiddleware = require("../middleware/authMiddleware");

const { autoScheduleWorkOrder } = require("../controllers/scheduleController");

// ---------- helpers ----------
// prefix match on a numeric field using index-friendly ranges
// "123" -> 123, 1230-1239, 12300-12399 ...
const prefixRanges = (field, raw) => {
  const s = String(raw).trim();
  if (!/^\d{1,7}$/.test(s)) return null; // null => matches nothing
  const n = Number(s);
  const ranges = [];
  for (let extra = 0; extra <= 8; extra++) {
    const m = 10 ** extra;
    ranges.push({ [field]: { $gte: n * m, $lt: (n + 1) * m } });
  }
  return { $or: ranges };
};

const buildFilter = (q) => {
  const and = [];
  and.push({ status: q.status || "PLANNED" });

  if (q.customer) and.push({ customer: q.customer });
  if (q.location) and.push({ userLocations: q.location });

  if (q.machine && /^[a-f\d]{24}$/i.test(q.machine)) {
    and.push({ "machines.machineId": q.machine });
  }

   if (q.planningUser) {
    and.push({ planningUser: String(q.planningUser) });
  }

  if (q.woNo) {
    and.push(prefixRanges("efiWoNumber", q.woNo) || { _id: { $exists: false } });
  }
  if (q.productCode) {
    and.push(prefixRanges("productCode", q.productCode) || { _id: { $exists: false } });
  }

  if (q.from || q.to) {
    const r = {};
    if (q.from) r.$gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) r.$lte = new Date(`${q.to}T23:59:59.999Z`);
    and.push({ createdAt: r });
  }

  return and.length === 1 ? and[0] : { $and: and };
};

const countCache = new Map();
const cachedCount = async (filter) => {
  const key = JSON.stringify(filter);
  const hit = countCache.get(key);
  if (hit && Date.now() - hit.t < 60000) return hit.v;
  const v = await WorkOrder.countDocuments(filter);
  if (countCache.size > 200) countCache.clear();
  countCache.set(key, { v, t: Date.now() });
  return v;
};

const populateOpts = [
  { path: "machines.machineId", select: "machineName" },
  { path: "machines.activityId", select: "activityName" },
  { path: "activity2", select: "activityName" }
];

// =============================================
// GET ALL WORK ORDERS (legacy — other pages still use this)
// =============================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const workOrders = await WorkOrder.find({ status: req.query.status || "PLANNED" })
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(req.query.limit, 10) || 200, 1000))
      .populate("customer")
      .populate({ path: "machines.machineId", select: "machineName" })
      .populate({ path: "machines.activityId", select: "activityName" })
      .populate({ path: "activity2", select: "activityName" })
      .lean();
    res.json(workOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// PAGED + FILTERED LIST (used by Planner page)
// =============================================
router.get("/paged", authMiddleware, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 1000);
    const filter = buildFilter(req.query);

    const [items, total] = await Promise.all([
      WorkOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(populateOpts)
        .lean(),
      cachedCount(filter)
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error("PAGED LIST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// META: planned count + filter dropdown options
// =============================================
let metaCache = { t: 0, v: null };
const warmMeta = async () => {
  try {
    const [planned, customers, locations, planners] = await Promise.all([
      WorkOrder.countDocuments({ status: "PLANNED" }),
      WorkOrder.distinct("customer", { status: "PLANNED" }),
      WorkOrder.distinct("userLocations", { status: "PLANNED" }),
      WorkOrder.distinct("planningUser", { status: "PLANNED" })
    ]);
    metaCache = {
      t: Date.now(),
      v: {
        planned,
        customers: customers.filter(Boolean).sort(),
        locations: locations.filter(Boolean).sort(),
        planners: planners.filter(Boolean).sort()
      }
    };
  } catch (e) {
    console.error("META WARM ERROR:", e.message);
  }
};
setTimeout(warmMeta, 3000);
setInterval(warmMeta, 2 * 60 * 1000);
router.get("/meta", authMiddleware, async (req, res) => {
  try {
    if (metaCache.v && Date.now() - metaCache.t < 300000) return res.json(metaCache.v);
    const [planned, customers, locations, planners] = await Promise.all([
      WorkOrder.countDocuments({ status: "PLANNED" }),
      WorkOrder.distinct("customer", { status: "PLANNED" }),
      WorkOrder.distinct("userLocations", { status: "PLANNED" }),
      WorkOrder.distinct("planningUser", { status: "PLANNED" })
    ]);
    metaCache = {
      t: Date.now(),
      v: {
        planned,
        customers: customers.filter(Boolean).sort(),
        locations: locations.filter(Boolean).sort(),
        planners: planners.filter(Boolean).sort()
      }
    };
    return res.json(metaCache.v);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/meta", authMiddleware, async (req, res) => {
  try {
    const [planned, customers, locations] = await Promise.all([
      WorkOrder.countDocuments({ status: "PLANNED" }),
      WorkOrder.distinct("customer", { status: "PLANNED" }),
      WorkOrder.distinct("userLocations", { status: "PLANNED" })
    ]);
    res.json({
      planned,
      customers: customers.filter(Boolean).sort(),
      locations: locations.filter(Boolean).sort()
    });
  } catch (err) {
    console.error("META ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// WHICH CUSTOMER ORDERS ALREADY HAVE A WORK ORDER
// =============================================
router.post("/existing-order-ids", authMiddleware, async (req, res) => {
  try {
    const ids = (req.body.ids || []).filter((i) => /^[a-f\d]{24}$/i.test(String(i)));
    if (!ids.length) return res.json([]);
    const found = await WorkOrder.distinct("customerOrderId", {
      customerOrderId: { $in: ids }
    });
    res.json(found.map(String));
  } catch (err) {
    console.error("EXISTING IDS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ACTIVITIES SIGN-OFF ORDER (admin sets, everyone reads)
// =============================================
const SignoffOrder = require("../models/SignoffOrder");

router.get("/signoff-order", authMiddleware, async (req, res) => {
  try {
    const doc = await SignoffOrder.findOne({ key: "signoff" }).lean();
    res.json({ order: doc?.order || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/signoff-order", authMiddleware, async (req, res) => {
  try {
    if (String(req.user.role || "").toUpperCase() !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const order = (req.body.order || []).map(String);
    const doc = await SignoffOrder.findOneAndUpdate(
      { key: "signoff" },
      { order },
      { upsert: true, new: true }
    );
    res.json({ order: doc.order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// CREATE WORK ORDER
// =============================================
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const {
      customerOrderId,
      printingId,
      workorder2,
      productCode,
      priority,
      inches,
      slitNumber,
      customer,
      purchaseOrderNo,
      poDate,
      dispatchLocation,
      boxQty,
      productName,
      location,
      qtyInLvs,
      machines,
      activity2,
      materials,
      colorFront,
      colorBack,
      orderQty,
      wasteQty,
      totalQty,
      jobSize,
      UPS,
      impFront,
      productType,
      impBack,
      totalImp,
      inkDetails,
      remarks,
      itemPdfPath
    } = req.body;

    let expectedDate = null;
    if (customerOrderId) {
      const customerOrder = await CustomerOrder.findById(customerOrderId);
      if (customerOrder) expectedDate = customerOrder.expectedDeliveryDate;
    }

    if (customerOrderId) {
      const already = await WorkOrder.findOne({ customerOrderId }).select("_id").lean();
      if (already) {
        return res.status(409).json({ message: "Work Order already exists for this order" });
      }
    }
    if (printingId) {
      const already = await WorkOrder.findOne({ printingId }).select("_id").lean();
      if (already) {
        return res.status(409).json({ message: "Work Order already exists for this printing order" });
      }
    }

    const lastWorkOrder = await WorkOrder.findOne().sort({ slNo: -1 }).select("slNo").lean();
    const nextSlNo = lastWorkOrder ? lastWorkOrder.slNo + 1 : 1;

    const lastEfi = await WorkOrder.findOne().sort({ efiWoNumber: -1 }).select("efiWoNumber").lean();
    const nextEfiNumber = lastEfi ? lastEfi.efiWoNumber + 1 : 1000;

    const totalImpression =
      totalImp !== undefined ? totalImp : (Number(impFront) || 0) + (Number(impBack) || 0);

    const plannerName = req.user.name;
    const plannerLocations = req.user.locations || [];

    const newWorkOrder = new WorkOrder({
      slNo: nextSlNo,
      efiWoNumber: nextEfiNumber,
      customerOrderId,
      printingId,
      workorder2,
      productCode,
      priority,
      customer,
      productType,
      inches,
      slitNumber,
      purchaseOrderNo,
      poDate,
      productName,
      location,
      qtyInLvs,
      dispatchLocation,
      boxQty,
      machines,
      activity2,
      materials,
      colorFront,
      colorBack,
      orderQty,
      wasteQty,
      totalQty,
      jobSize,
      UPS,
      impFront,
      impBack,
      totalImp: totalImpression,
      inkDetails,
      remarks,
      itemPdfPath: itemPdfPath || "",
      planningUser: plannerName,
      userLocations: plannerLocations,
      status: "PLANNED",
      expectedDeliveryDate: expectedDate
    });

    await newWorkOrder.save();

    if (customerOrderId) {
      await CustomerOrder.findByIdAndUpdate(customerOrderId, { status: "PLANNED" });
    }

    if (printingId) {
      const PrintingInstruction = require("../models/Print");
      await PrintingInstruction.findByIdAndUpdate(printingId, { status: "PLANNED" });
    }

    let autoScheduleResult = null;
    try {
      autoScheduleResult = await autoScheduleWorkOrder(newWorkOrder._id);
    } catch (schedErr) {
      console.error("AUTO-SCHEDULE ON CREATE ERROR:", schedErr.message);
    }

    res.status(201).json({
      ...newWorkOrder.toObject(),
      autoSchedule: autoScheduleResult
    });
  } catch (err) {
    console.error("CREATE WORK ORDER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// UPDATE WORK ORDER
// =============================================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    if (!workOrder) return res.status(404).json({ message: "Work Order not found" });

    if (workOrder.planningUser !== req.user.name) {
      return res.status(403).json({ message: "Not authorized to edit this work order" });
    }

    Object.assign(workOrder, req.body);
    await workOrder.save();
    res.json(workOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// UPDATE OUTER LABEL INFO
// =============================================
router.patch("/:id/outer-label", authMiddleware, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    if (!workOrder) return res.status(404).json({ message: "Work Order not found" });

    const { boxQty, dispatchLocation, boxQtyEntered, boxUnitType } = req.body;

    if (boxQty !== undefined) workOrder.boxQty = boxQty;
    if (dispatchLocation !== undefined) workOrder.dispatchLocation = dispatchLocation;
    if (boxQtyEntered !== undefined) workOrder.boxQtyEntered = boxQtyEntered;
    if (boxUnitType !== undefined) workOrder.boxUnitType = boxUnitType;

    await workOrder.save();
    res.json(workOrder);
  } catch (err) {
    console.error("OUTER LABEL UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// SEND WORK ORDER TO PREPRESS
// =============================================
router.patch("/:id/send-to-prepress", authMiddleware, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findByIdAndUpdate(
      req.params.id,
      { sentToPrepress: true },
      { new: true }
    );
    if (!workOrder) return res.status(404).json({ message: "Work Order not found" });
    res.json(workOrder);
  } catch (err) {
    console.error("SEND TO PREPRESS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// DELETE WORK ORDER
// =============================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);
    if (!workOrder) return res.status(404).json({ message: "Work Order not found" });

    if (workOrder.planningUser !== req.user.name) {
      return res.status(403).json({ message: "Not authorized to delete this work order" });
    }

    await WorkOrder.findByIdAndDelete(req.params.id);
    res.json({ message: "Work Order deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// ADMIN: EDIT ORDER QTY
// =============================================
router.patch("/:id/order-qty", authMiddleware, async (req, res) => {
  try {
    if (String(req.user.role || "").toUpperCase() !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const workOrder = await WorkOrder.findById(req.params.id);
    if (!workOrder) return res.status(404).json({ message: "Work Order not found" });

    const myLocs = req.user.locations || [];
    const woLocs = workOrder.userLocations || [];
    if (!woLocs.some((l) => myLocs.includes(l))) {
      return res.status(403).json({ message: "Not allowed for this location" });
    }

    const { orderQty, totalQty, impFront, impBack, totalImp, machinesImp = [] } = req.body;

    if (!(Number(orderQty) > 0)) {
      return res.status(400).json({ message: "Invalid quantity" });
    }
    if (Number(workOrder.boxQty) > Number(orderQty)) {
      return res.status(400).json({ message: "Quantity in Box cannot exceed Order Qty" });
    }

    workOrder.orderQty = Number(orderQty);
    workOrder.totalQty = Number(totalQty) || 0;
    workOrder.impFront = Number(impFront) || 0;
    workOrder.impBack = Number(impBack) || 0;
    workOrder.totalImp = Number(totalImp) || 0;

    (workOrder.machines || []).forEach((m, i) => {
      if (machinesImp[i]) {
        m.impFront = machinesImp[i].impFront;
        m.impBack = machinesImp[i].impBack;
        m.totalImp = machinesImp[i].totalImp;
      }
    });
    workOrder.markModified("machines");

    await workOrder.save();
    res.json(workOrder);
  } catch (err) {
    console.error("ORDER QTY UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET WORK ORDER BY EFI NUMBER
router.get("/efi/:efi", authMiddleware, async (req, res) => {
  try {
    const efiNumber = Number(req.params.efi);
    if (!Number.isFinite(efiNumber)) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    const wo = await WorkOrder.findOne({ efiWoNumber: efiNumber })
      .populate({ path: "machines.activityId", select: "activityName" })
      .populate({ path: "machines.machineId", select: "machineName" })
      .lean();

    if (!wo) return res.status(404).json({ message: "Work Order not found" });
    res.json(wo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/scheduler-hide", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const workOrder = await WorkOrder.findByIdAndUpdate(
      req.params.id,
      { schedulerHidden: true },
      { new: true }
    );

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    res.json({ message: "Removed from scheduler", workOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to remove Work Order" });
  }
});

module.exports = router;