const express = require("express");
const router = express.Router();
const WorkOrder = require("../models/WorkOrder");
const CustomerOrder = require("../models/CustomerOrder");
const authMiddleware = require("../middleware/authMiddleware");

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
  customer,
  purchaseOrderNo,
  poDate,
  productName,
  location,
  qtyInLvs,
  machines,
  materials,   // ✅ ADD THIS
  colorFront,
  colorBack,
  orderQty,
  wasteQty,
  totalQty,
  jobSize,
  UPS,
  impFront,
  impBack,
  totalImp,
  inkDetails,
  remarks,
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
  printingId, // ✅ ADD HERE
    workorder2,
    productCode,
  priority,
  customer,
  purchaseOrderNo,
  poDate,
  productName,
  location,
  qtyInLvs,
  machines,
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

    res.status(201).json(newWorkOrder);
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
module.exports = router;