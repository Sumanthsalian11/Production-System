const express = require("express");
const router = express.Router();
const WorkOrder = require("../models/WorkOrder");
const CustomerOrder = require("../models/CustomerOrder");
const authMiddleware = require("../middleware/authMiddleware");

// NEW — auto-schedules every Activity/Machine row of a just-created Work
// Order onto the Gantt (see controllers/scheduleController.js). Only used
// right after a Work Order is saved below; nothing else in this file
// changes.
const { autoScheduleWorkOrder } = require("../controllers/scheduleController");

// =============================================
// GET ALL WORK ORDERS
// =============================================
router.get("/", authMiddleware, async (req, res) => {
  try {
  const workOrders = await WorkOrder.find()
  .populate("customer")
  .populate({
    path: "machines.machineId",
    select: "machineName"
    
  })
  .populate({
    path: "machines.activityId",
    select: "activityName"
  })
  .populate({
    path: "activity2",
    select: "activityName"
  });
    res.json(workOrders);
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
    printingId, // ✅ ADD
  workorder2,
productCode,
  priority,
  inches,        // ⭐ ADD
  slitNumber,    // ⭐ ADD
  customer,
  purchaseOrderNo,
  poDate,
   dispatchLocation,   // ⭐ ADD
  boxQty,              // ⭐ ADD
  productName,
  location,
  qtyInLvs,
  machines,   // ⭐ isBooklet / pages / component now travel per-row inside this array
  activity2,   // ⭐ ADD — additional activities (checkbox multi-select)
  materials,   // ✅ ADD THIS
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
  itemPdfPath,
} = req.body;
// 🔹 Get Expected Delivery Date from Customer Order
let expectedDate = null;

if (customerOrderId) {
  const customerOrder = await CustomerOrder.findById(customerOrderId);

  if (customerOrder) {
    expectedDate = customerOrder.expectedDeliveryDate;
  }
}


    // 🔢 Auto increment SL No
    const lastWorkOrder = await WorkOrder.findOne().sort({ slNo: -1 });
    const nextSlNo = lastWorkOrder ? lastWorkOrder.slNo + 1 : 1;

    // 🔢 Auto increment EFI WO Number
    const lastEfi = await WorkOrder.findOne().sort({ efiWoNumber: -1 });
    const nextEfiNumber = lastEfi ? lastEfi.efiWoNumber + 1 : 1000;

    // 🧮 Auto calculate total IMP  
    const totalImpression =
      totalImp !== undefined
        ? totalImp
        : (Number(impFront) || 0) + (Number(impBack) || 0);

    // 🔥 AUTO GET LOGGED-IN USER NAME
   const plannerName = req.user.name;
const plannerLocations = req.user.locations || [];

 const newWorkOrder = new WorkOrder({
  slNo: nextSlNo,
  efiWoNumber: nextEfiNumber,
  customerOrderId, // ⭐ THE ACTUAL FIX — this was destructured and used for the expectedDate lookup but never saved
  printingId, // ✅ ADD HERE
    workorder2,
    productCode,
  priority,
  customer,
   productType,  
   inches,        // ⭐ ADD
   slitNumber,    // ⭐ ADD  
  purchaseOrderNo,
  poDate,
  productName,
  location,
  qtyInLvs,
   dispatchLocation,   // ⭐ ADD
  boxQty,              // ⭐ ADD
  machines,
  activity2,   // ⭐ ADD
  materials,   // ✅ THIS FIXES EVERYTHING
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
 
    // 🔄 Update Customer Order Status
  // 🔄 Update Customer Order Status
if (customerOrderId) {
  await CustomerOrder.findByIdAndUpdate(customerOrderId, {
    status: "PLANNED",
  });
}

// 🔄 ✅ ADD THIS BLOCK
if (printingId) {
  const PrintingInstruction = require("../models/Print");

  await PrintingInstruction.findByIdAndUpdate(printingId, {
    status: "PLANNED"
  });
}

    // NEW — immediately auto-schedule every Activity/Machine row of this
    // Work Order onto the Gantt, starting from the next free slot on
    // each row's machine ("right now" or later if that machine is busy).
    // Wrapped so that if scheduling has a problem (e.g. a machine with
    // no capacity set), Work Order creation still succeeds — that row
    // just falls back to being scheduled manually from the Scheduler's
    // "Pending Work Orders" list, exactly as before this feature existed.
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

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    // 🔐 Only allow creator to edit
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
// UPDATE OUTER LABEL INFO (no ownership/JWT role restriction)
// =============================================
router.patch("/:id/outer-label", authMiddleware, async (req, res) => {
  try {
    const workOrder = await WorkOrder.findById(req.params.id);

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    // ✅ No planningUser / role check here — any authenticated user
    // can update outer label details for any work order.
    const {
      boxQty,
      dispatchLocation,
      boxQtyEntered,
      boxUnitType,
    } = req.body;

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

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

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

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    // 🔐 Only creator can delete
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

// GET WORK ORDER BY EFI NUMBER
router.get("/efi/:efi", authMiddleware, async (req, res) => {
  try {
    const efiNumber = Number(req.params.efi);

    const wo = await WorkOrder.findOne({ efiWoNumber: efiNumber })
      .populate({
        path: "machines.activityId",
        select: "activityName"
      })
      .populate({
        path: "machines.machineId",
        select: "machineName"
      });

    if (!wo) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    res.json(wo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch(
  "/:id/scheduler-hide",
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== "ADMIN") {
        return res.status(403).json({
          message: "Admin access required"
        });
      }

      const workOrder =
        await WorkOrder.findByIdAndUpdate(
          req.params.id,
          {
            schedulerHidden: true
          },
          {
            new: true
          }
        );

      if (!workOrder) {
        return res.status(404).json({
          message: "Work Order not found"
        });
      }

      res.json({
        message: "Removed from scheduler",
        workOrder
      });

    } catch (err) {
      console.error(err);

      res.status(500).json({
        message: "Failed to remove Work Order"
      });
    }
  }
);
module.exports = router;