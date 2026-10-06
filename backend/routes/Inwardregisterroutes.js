const express = require("express");
const router = express.Router();
const InwardRegister = require("../models/InwardRegister");
const authMiddleware = require("../middleware/authMiddleware");

// =============================================
// GET ALL INWARD RECORDS (paginated + filtered)
// =============================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, woNumber, from, to } = req.query;

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 500); // hard cap to protect the server
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (woNumber) {
      query.efiWoNumber = { $regex: String(woNumber), $options: "i" };
    }
    if (from || to) {
      query.dateOfInward = {};
      if (from) query.dateOfInward.$gte = new Date(from);
      if (to) query.dateOfInward.$lte = new Date(to);
    }

    const [records, total] = await Promise.all([
      InwardRegister.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      InwardRegister.countDocuments(query),
    ]);

    res.json({
      records,
      total,
      totalPages: Math.max(Math.ceil(total / limitNum), 1),
      page: pageNum,
    });
  } catch (err) {
    console.error("GET inward error:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// CREATE INWARD RECORD
// =============================================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      workOrderId,
      efiWoNumber,
      customerName,
      itemDescription,
      materialCode,
      workOrderQty,
      workOrderDate,
      dateOfInward,
      printReceivedQty,
      pendingQty,
      chequeFromNo,
      chequeToNo,
      defectCount,
      materialDocumentNo,
      receiver,
      remarks,
    } = req.body;

    // Issuer is always set from the authenticated token — never from req.body
    const issuer = req.user.name;

    const record = new InwardRegister({
      workOrderId,
      efiWoNumber,
      customerName,
      itemDescription,
      materialCode,
      workOrderQty,
      workOrderDate,
      dateOfInward,
      printReceivedQty,
      pendingQty,
      chequeFromNo,
      chequeToNo,
      defectCount: defectCount || 0,
      materialDocumentNo,
      issuer,         // ✅ always from token
      receiver,
      remarks,
    });

    await record.save();
    res.status(201).json(record);
  } catch (err) {
    console.error("CREATE inward error:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// GET TOTAL PREVIOUSLY-RECEIVED QTY FOR A WO (aggregate, not full fetch)
// =============================================
router.get("/summary/:efi", authMiddleware, async (req, res) => {
  try {
    const efiWoNumber = Number(req.params.efi);
    const result = await InwardRegister.aggregate([
      { $match: { efiWoNumber } },
      { $group: { _id: null, totalReceived: { $sum: "$printReceivedQty" } } },
    ]);
    res.json({ totalReceived: result[0]?.totalReceived || 0 });
  } catch (err) {
    console.error("GET inward summary error:", err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// GET RECORDS BY WO NUMBER (optional helper)
// =============================================
router.get("/wo/:efi", authMiddleware, async (req, res) => {
  try {
    const records = await InwardRegister.find({
      efiWoNumber: Number(req.params.efi),
    }).sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =============================================
// DELETE INWARD RECORD (creator only)
// =============================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const record = await InwardRegister.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    if (record.issuer !== req.user.name) {
      return res.status(403).json({ message: "Not authorized to delete this record" });
    }

    await InwardRegister.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;