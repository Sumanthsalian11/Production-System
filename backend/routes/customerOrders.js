const express = require("express");
const router = express.Router();
const CustomerOrder = require("../models/CustomerOrder");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// =============================================
// CREATE CUSTOMER ORDER (Direct from Purchase Order)
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
      itemPdfPath,
      user
    } = req.body;

    if (!productCode || !quantity || !location) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (purchaseOrderNo && (!poDate || !expectedDeliveryDate)) {
      return res.status(400).json({ message: "PO Date and Expected Date required" });
    }

 let ticketNo = "";
    const ticketPrefixMap = { Inhouse: "IH", "Out Source": "OS", PMS: "PMS" };
    const ticketPrefix = ticketPrefixMap[orderType];
    if (ticketPrefix) {
      const lastOrder = await CustomerOrder.find({
        orderType,
        ticketNo: { $ne: "" }
      }).sort({ createdAt: -1 }).limit(1);

      let lastNumber = 0;
      if (lastOrder.length > 0 && lastOrder[0].ticketNo) {
        const parts = lastOrder[0].ticketNo.split("_");
        lastNumber = Number(parts[parts.length - 1]) || 0;
      }
      ticketNo = `${ticketPrefix}_${String(lastNumber + 1).padStart(2, "0")}`;
    }

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
      attachment,
      itemPdfPath: itemPdfPath || "",
      remarks,
      remarks2,
      user: userData.name,
      userLocations: userData.locations || [],
      status: "ORDER_RECEIVED",
      source: "purchaseOrder"
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);

  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "PO Number already exists" });
    }
    res.status(500).json({ message: "Error creating order" });
  }
});

// =============================================
// GET CUSTOMER ORDERS (paged + filtered on server)
// =============================================
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Distinct customers for the dropdown
router.get("/customers", authMiddleware, async (req, res) => {
  try {
    const list = await CustomerOrder.distinct("customerName");
    res.status(200).json(list.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: "Error fetching customers" });
  }
});

// Which of the given order ids already have a work order
router.get("/converted", authMiddleware, async (req, res) => {
  try {
    const ids = String(req.query.ids || "").split(",").filter(Boolean);
    if (!ids.length) return res.status(200).json([]);
    const WorkOrder = require("../models/WorkOrder"); // <-- adjust to your model path/name
    const wos = await WorkOrder.find({ customerOrderId: { $in: ids } })
      .select("customerOrderId").lean();
    res.status(200).json(wos.map((w) => String(w.customerOrderId)));
  } catch (err) {
    res.status(200).json([]);
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { status, orderType, source, po, productCode, date, customer, all } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 30, 200);

    let filter = {};
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    if (source) filter.source = source;
    if (po) filter.purchaseOrderNo = { $regex: "^" + escapeRegex(po) };
    if (productCode && !isNaN(Number(productCode))) filter.productCode = Number(productCode);
    if (customer) filter.customerName = customer;
    if (date) {
      const start = new Date(date);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      filter.poDate = { $gte: start, $lt: end };
    }

    let q = CustomerOrder.find(filter)
      .populate("location", "locationName")
      .sort({ createdAt: -1 })
      .lean();

    // Excel export: all matching rows (capped)
    if (all === "1") {
      const rows = await q.limit(100000);
      return res.status(200).json(rows);
    }

    // Old callers (e.g. Planner page) send no "page": return the plain array as before
    if (!req.query.page) {
      const rows = await q;
      return res.status(200).json(rows);
    }

    const noFilter = Object.keys(filter).length === 0;
    const [data, total] = await Promise.all([
      q.skip((page - 1) * limit).limit(limit),
      noFilter
        ? CustomerOrder.estimatedDocumentCount()
        : CustomerOrder.countDocuments(filter)
    ]);

    // Converted check done here, saves one extra request from the browser
    let converted = [];
    try {
      const WorkOrder = require("../models/WorkOrder"); // adjust path if needed
      const wos = await WorkOrder.find({
        customerOrderId: { $in: data.map((d) => d._id) }
      }).select("customerOrderId").lean();
      converted = wos.map((w) => String(w.customerOrderId));
    } catch (e) {}

    res.status(200).json({ data, total, page, limit, converted });
  } catch (err) {
    console.error("FETCH CUSTOMER ORDERS ERROR:", err);
    res.status(500).json({ message: "Error fetching customer orders" });
  }
});

// =============================================
// UPDATE ORDER STATUS
// =============================================
router.patch("/:id", authMiddleware, async (req, res) => {
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
router.delete("/:id", authMiddleware, async (req, res) => {
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
router.put("/:id", authMiddleware, upload.single("attachment"), async (req, res) => {
  try {
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
      itemPdfPath,
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
        itemPdfPath: itemPdfPath !== undefined ? itemPdfPath : undefined,

        user,
        userLocations: userData?.locations || [],
        ...(attachment && { attachment })
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