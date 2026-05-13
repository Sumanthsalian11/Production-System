const express = require("express");
const router = express.Router();
const CustomerOrder = require("../models/CustomerOrder");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User"); // ✅ ADD THIS
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);   // ✅ original filename
  }
});

const upload = multer({ storage });
// =============================================
// CREATE CUSTOMER ORDER
// =============================================
router.post("/", authMiddleware, upload.single("attachment"), async (req, res) => {
  try {
    const userId = req.user.id;
const userData = await User.findById(userId);

if (!userData) {
  return res.status(404).json({ message: "User not found" });
}
 const {
  purchaseOrderNo,
  poDate,
  expectedDeliveryDate,
  productCode,
  materialType,
  description,
  customerName,

  colorFront,
  colorBack,
  wasteQty,
  jobSize,
  inkDetails,

  quantity,
  location,
  orderType,
  remarks,
   remarks2, 
  user
} = req.body;



   if (!productCode || !quantity || !location) {
  return res.status(400).json({ message: "Required fields missing" });
}

if (purchaseOrderNo && (!poDate || !expectedDeliveryDate)) {
  return res.status(400).json({ message: "PO Date and Expected Date required" });
}
// Auto-generate Ticket No
// =====================================
// GENERATE TICKET ONLY FOR STATIONARY
// =====================================

let ticketNo = "";

if (purchaseOrderNo) {   // Only Stationary orders have PO

  let ticketPrefix = "";

  if (orderType === "Inhouse") ticketPrefix = "IH";
  else if (orderType === "Out Source") ticketPrefix = "OS";
  else if (orderType === "PMS") ticketPrefix = "PMS";

  let lastOrder = await CustomerOrder.find({
    orderType,
    ticketNo: { $ne: "" }
  })
    .sort({ createdAt: -1 })
    .limit(1);

  let lastNumber = 0;

  if (lastOrder.length > 0 && lastOrder[0].ticketNo) {
    const parts = lastOrder[0].ticketNo.split("_");
    lastNumber = Number(parts[1]) || 0;
  }

  ticketNo = `${ticketPrefix}_${String(lastNumber + 1).padStart(2, "0")}`;
}
// GET FILE NAME
const attachment = req.file ? req.file.filename : "";
const newOrder = new CustomerOrder({

  ...(purchaseOrderNo && { purchaseOrderNo }),
  ...(poDate && { poDate }),
  ...(expectedDeliveryDate && { expectedDeliveryDate }),

  productCode,
  materialType,
  description,
  customerName,

  colorFront,
  colorBack,
  wasteQty,
  jobSize,
  inkDetails,

  quantity,
  location,
  orderType,
  ticketNo,

  attachment,   // 👈 ADD THIS

  remarks,
   remarks2, 
 user: userData.name,
userLocations: userData.locations || [],
  status: "ORDER_RECEIVED"
});
    const savedOrder = await newOrder.save();

    res.status(201).json(savedOrder);

  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);

    // ✅ Duplicate PO protection
    if (err.code === 11000) {
      return res.status(400).json({ message: "PO Number already exists" });
    }

    res.status(500).json({ message: "Error creating order" });
  }
});


// =============================================
// GET CUSTOMER ORDERS
// =============================================
router.get("/",authMiddleware, async (req, res) => {
  try {
    const { status, orderType } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;

    const orders = await CustomerOrder.find(filter)

      .populate("location", "locationName") // ✅ IMPORTANT
      .sort({ createdAt: -1 });

    res.status(200).json(orders);

  } catch (err) {
    console.error("FETCH CUSTOMER ORDERS ERROR:", err);
    res.status(500).json({ message: "Error fetching customer orders" });
  }
});


// =============================================
// UPDATE ORDER STATUS
// =============================================
router.patch("/:id",authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    const order = await CustomerOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(order);

  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ message: "Error updating order status" });
  }
});

// =============================================
// DELETE CUSTOMER ORDER
// =============================================
router.delete("/:id",authMiddleware, async (req, res) => {
  try {

    const order = await CustomerOrder.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ message: "Order deleted successfully" });

  } catch (err) {
    console.error("DELETE ORDER ERROR:", err);
    res.status(500).json({ message: "Error deleting order" });
  }
});
// =============================================
// UPDATE CUSTOMER ORDER
// =============================================
router.put("/:id",authMiddleware, upload.single("attachment"), async (req, res) => {
  try {

  const {
  purchaseOrderNo,
  poDate,
  expectedDeliveryDate ,
  productCode,
  materialType,
  description,
  customerName,

  colorFront,
  colorBack,
  wasteQty,
  jobSize,
  inkDetails,

  quantity,
  location,
  orderType,
  remarks,
  remarks2,
  user
} = req.body;
const userId = req.user.id;
const userData = await User.findById(userId);
const attachment = req.file ? req.file.filename : undefined;
  const order = await CustomerOrder.findByIdAndUpdate(
req.params.id,
{
purchaseOrderNo,
poDate,
expectedDeliveryDate,
productCode,
materialType,
description,
customerName,

colorFront,
colorBack,
wasteQty,
jobSize,
inkDetails,

quantity,
location,
orderType,
remarks,
remarks2,
user,
userLocations: userData.locations || [],

...(attachment && { attachment })   // ✅ ADD THIS
},
{ new: true }
);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(order);

  } catch (err) {
    console.error("UPDATE ORDER ERROR:", err);

    if (err.code === 11000) {
      return res.status(400).json({ message: "PO Number already exists" });
    }

    res.status(500).json({ message: "Error updating order" });
  }
});

module.exports = router;