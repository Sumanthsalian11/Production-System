const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const IndentRequest = require("../models/Indentrequest");
const CustomerOrder = require("../models/CustomerOrder");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

// =============================================
// MULTER CONFIG (Customer Copy / Artwork uploads)
// =============================================
const uploadDir = path.join(__dirname, "..", "uploads", "indents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

const indentUploadFields = upload.fields([
  { name: "customerCopy", maxCount: 1 },
  { name: "artwork", maxCount: 1 }
]);

// Serve uploaded indent files
router.use("/files", express.static(uploadDir));

// =============================================
// CREATE NEW INDENT (Saves to IndentRequest Model)
// =============================================
router.post("/", authMiddleware, indentUploadFields, async (req, res) => {
  try {
    const userId = req.user.id;
    const userData = await User.findById(userId);

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
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
      unitRate,
      remark,
      deliveryDate,
      // ===== NEW FIELDS =====
      lamination,
      finish,
      jobNo,
      soNo,
      soDate,
      sampleType,
      costingConfirmation,
      customerPoNo,
      customerPoDate,
      typeOfBilling,
      itemPdfPath
    } = req.body;

    if (!productCode || !quantity || !location) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Generate Indent Number (e.g., IND_001)
    const lastIndent = await IndentRequest.findOne().sort({ createdAt: -1 });
    let lastNumber = 0;
    if (lastIndent && lastIndent.indentNo) {
      const parts = lastIndent.indentNo.split("_");
      lastNumber = Number(parts[1]) || 0;
    }
    const indentNo = `IND_${String(lastNumber + 1).padStart(3, "0")}`;

    // ===== Uploaded files =====
    const customerCopyFile = req.files?.customerCopy?.[0];
    const artworkFile = req.files?.artwork?.[0];

    const customerCopy = customerCopyFile
      ? {
          fileName: customerCopyFile.originalname,
          filePath: `/api/newindent/files/${customerCopyFile.filename}`
        }
      : { fileName: "", filePath: "" };

    const artwork = artworkFile
      ? {
          fileName: artworkFile.originalname,
          filePath: `/api/newindent/files/${artworkFile.filename}`
        }
      : { fileName: "", filePath: "" };

    // Create indent item
    const indentItem = {
      productCode,
      materialType,
      description,
      customerName,
      colorFront,
      colorBack,
      wasteQty,
      jobSize,
      inkDetails,
      quantity: Number(quantity),
      unitRate: Number(unitRate) || 0,
      remark: remark || "",
      deliveryDate: deliveryDate || null,
      // ===== NEW FIELDS =====
      lamination: lamination || "",
      finish: finish || "",
      jobNo: jobNo || "",
      soNo: soNo || "",
      soDate: soDate || null,
      sampleType: sampleType || "",
      costingConfirmation: costingConfirmation || "",
      customerPoNo: customerPoNo || "",
      customerPoDate: customerPoDate || null,
      typeOfBilling: typeOfBilling || "",
      itemPdfPath: itemPdfPath || "",
      customerCopy,
      artwork
    };

    const newIndent = new IndentRequest({
      indentNo,
      items: [indentItem],
      location,
      user: userData.name,
      userEmail: userData.email,
      status: "PENDING_PO",
      orderType: ""
    });

    const savedIndent = await newIndent.save();
    res.status(201).json(savedIndent);

  } catch (err) {
    console.error("CREATE INDENT ERROR:", err);
    res.status(500).json({ message: "Error creating indent" });
  }
});

// =============================================
// GET ALL INDENTS (For New Indent Page)
// =============================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const indents = await IndentRequest.find()
      .populate("location", "locationName")
      .sort({ createdAt: -1 });
    res.status(200).json(indents);
  } catch (err) {
    console.error("FETCH INDENTS ERROR:", err);
    res.status(500).json({ message: "Error fetching indents" });
  }
});

// =============================================
// GET PENDING INDENTS (For Purchase Order Page)
// =============================================
router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const indents = await IndentRequest.find({ 
      status: "PENDING_PO"
    })
    .populate("location", "locationName")
    .sort({ createdAt: -1 });

    res.status(200).json(indents);
  } catch (err) {
    console.error("FETCH PENDING INDENTS ERROR:", err);
    res.status(500).json({ message: "Error fetching pending indents" });
  }
});

// =============================================
// PROCESS INDENT -> CONVERT TO CUSTOMER ORDER
// =============================================
router.put("/process/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { orderType, remarks, purchaseOrderNo, poDate, expectedDeliveryDate } = req.body;
    
    const userId = req.user.id;
    const userData = await User.findById(userId);

    // 1. Find the indent request
    const indent = await IndentRequest.findById(id).populate("location");
    
    if (!indent) {
      return res.status(404).json({ message: "Indent not found" });
    }

    if (indent.status !== "PENDING_PO") {
      return res.status(400).json({ message: "Indent already processed" });
    }

    // 2. Validate based on order type
    if (!orderType) {
      return res.status(400).json({ message: "Order type is required" });
    }

    // 3. Process each item in the indent
    const createdOrders = [];
    
    for (const item of indent.items) {
      const orderData = {
        productCode: item.productCode,
        materialType: item.materialType,
        description: item.description,
        customerName: item.customerName,
        colorFront: item.colorFront,
        colorBack: item.colorBack,
        wasteQty: item.wasteQty,
        jobSize: item.jobSize,
        inkDetails: item.inkDetails,
        quantity: item.quantity,
        location: indent.location?._id || indent.location,
        orderType: orderType,
        remarks: remarks || "",
        remarks2: item.remark || "",
        user: userData?.name || "System",
        userLocations: userData?.locations || [],
        status: "ORDER_RECEIVED",
        source: "purchaseOrder",
        // Link back to indent
        indentNo: indent.indentNo,
        // ===== NEW FIELDS PASSED THROUGH =====
        lamination: item.lamination || "",
        finish: item.finish || "",
        jobNo: item.jobNo || "",
        soNo: item.soNo || "",
        soDate: item.soDate || null,
        sampleType: item.sampleType || "",
        costingConfirmation: item.costingConfirmation || "",
        customerPoNo: item.customerPoNo || "",
        customerPoDate: item.customerPoDate || null,
        typeOfBilling: item.typeOfBilling || "",
        itemPdfPath: item.itemPdfPath || ""
      };

      // Add PO fields for Inhouse/Stationary
     if (purchaseOrderNo) {
        orderData.purchaseOrderNo = purchaseOrderNo;
        orderData.poDate = poDate;
      }
      if (expectedDeliveryDate) {
        orderData.expectedDeliveryDate = expectedDeliveryDate;
      }

      // Generate ticket number for Inhouse orders
      const ticketPrefixMap = { Inhouse: "IH", "Out Source": "OS", PMS: "PMS" };
      const ticketPrefix = ticketPrefixMap[orderType];
      if (ticketPrefix) {
        const lastOrder = await CustomerOrder.find({
          orderType,
          ticketNo: { $exists: true, $ne: "" }
        }).sort({ createdAt: -1 }).limit(1);

        let lastNumber = 0;
        if (lastOrder.length > 0 && lastOrder[0].ticketNo) {
          const parts = lastOrder[0].ticketNo.split("_");
          lastNumber = Number(parts[parts.length - 1]) || 0;
        }
        orderData.ticketNo = `${ticketPrefix}_${String(lastNumber + 1).padStart(2, "0")}`;
      }
      const newOrder = new CustomerOrder(orderData);
      const savedOrder = await newOrder.save();
      createdOrders.push(savedOrder);
    }

    // 4. Update indent status
    indent.status = "APPROVED";
    indent.orderType = orderType;
    indent.approvedAt = new Date();
    await indent.save();

    res.status(200).json({
      message: "Indent processed successfully",
      indentNo: indent.indentNo,
      ordersCreated: createdOrders.length,
      orders: createdOrders
    });

  } catch (err) {
    console.error("PROCESS INDENT ERROR:", err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "PO Number already exists" });
    }
    res.status(500).json({ message: "Error processing indent" });
  }
});

// =============================================
// REJECT INDENT (Optional)
// =============================================
router.put("/reject/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const indent = await IndentRequest.findByIdAndUpdate(
      id,
      { 
        status: "REJECTED",
        remark: reason || "Rejected"
      },
      { new: true }
    );

    if (!indent) {
      return res.status(404).json({ message: "Indent not found" });
    }

    res.status(200).json({ message: "Indent rejected", indent });

  } catch (err) {
    console.error("REJECT INDENT ERROR:", err);
    res.status(500).json({ message: "Error rejecting indent" });
  }
});

router.put("/:id", authMiddleware, indentUploadFields, async (req, res) => {
  try {
    const {
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
      unitRate,
      remark,
      deliveryDate,
      // ===== NEW FIELDS =====
      lamination,
      finish,
      jobNo,
      soNo,
      soDate,
      sampleType,
      costingConfirmation,
      customerPoNo,
      customerPoDate,
      typeOfBilling,
      itemPdfPath
    } = req.body;

    const indent = await IndentRequest.findById(req.params.id);

    if (!indent) {
      return res.status(404).json({
        message: "Indent not found"
      });
    }

    indent.location = location;

    const existingItem = indent.items?.[0] || {};

    const customerCopyFile = req.files?.customerCopy?.[0];
    const artworkFile = req.files?.artwork?.[0];

    const customerCopy = customerCopyFile
      ? {
          fileName: customerCopyFile.originalname,
          filePath: `/api/newindent/files/${customerCopyFile.filename}`
        }
      : existingItem.customerCopy || { fileName: "", filePath: "" };

    const artwork = artworkFile
      ? {
          fileName: artworkFile.originalname,
          filePath: `/api/newindent/files/${artworkFile.filename}`
        }
      : existingItem.artwork || { fileName: "", filePath: "" };

    indent.items = [
      {
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
        unitRate,
        remark,
        deliveryDate,
        // ===== NEW FIELDS =====
        lamination,
        finish,
        jobNo,
        soNo,
        soDate,
        sampleType,
        costingConfirmation,
        customerPoNo,
        customerPoDate,
        typeOfBilling,
        itemPdfPath: itemPdfPath || existingItem.itemPdfPath || "",
        customerCopy,
        artwork
      }
    ];

    await indent.save();

    res.status(200).json({
      message: "Indent updated successfully",
      indent
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error updating indent"
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const indent = await IndentRequest.findById(req.params.id);

    if (!indent) {
      return res.status(404).json({
        message: "Indent not found"
      });
    }

    await IndentRequest.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Indent deleted successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error deleting indent"
    });
  }
});

module.exports = router;