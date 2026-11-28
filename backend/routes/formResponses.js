const express = require("express");
const router = express.Router();
const FormResponse = require("../models/FormResponse");
const CsatAction = require("../models/CsatAction");
const protect = require("../middleware/authMiddleware");

// Admin only: list saved form responses (newest first)
router.get("/", protect, async (req, res) => {
  try {
    if (String(req.user?.role || "").toUpperCase() !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const rows = await FormResponse.find()
      .select("-sheetKey -__v")
      .sort({ submittedAt: -1 })
      .limit(5000)
      .lean();
    res.json(rows);
  } catch (err) {
    console.error("FORM LIST ERROR:", err);
    res.status(500).json({ message: "Could not load responses" });
  }
});

// Old Apps Script endpoint (only used if you still post from Apps Script)
router.post("/", async (req, res) => {
  try {
    if (!process.env.FORM_API_KEY || req.headers["x-api-key"] !== process.env.FORM_API_KEY) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { name, email, address, phone, comments, submittedAt } = req.body;
    const saved = await FormResponse.create({
      name,
      email,
      address,
      phone: phone ? String(phone) : "",
      comments,
      submittedAt: submittedAt ? new Date(submittedAt) : new Date()
    });
    res.status(201).json({ ok: true, id: saved._id });
  } catch (err) {
    console.error("FORM SAVE ERROR:", err);
    res.status(500).json({ message: "Error saving response" });
  }
});

// ---------- Customer Satisfaction dashboard: action tracker (admin only) ----------
const isAdminUser = (req) => String(req.user?.role || "").toUpperCase() === "ADMIN";
const p2 = (n) => String(n).padStart(2, "0");

router.get("/actions", protect, async (req, res) => {
  try {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const rows = await CsatAction.find().sort({ raised: 1 }).limit(2000).lean();
    res.json(rows.map((a) => ({ ...a, _id: undefined, __v: undefined })));
  } catch (err) {
    console.error("CSAT ACTION LIST ERROR:", err);
    res.status(500).json({ message: "Could not load actions" });
  }
});

router.post("/actions", protect, async (req, res) => {
  try {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const { cust, issue, sourceId } = req.body || {};
    if (!String(issue || "").trim()) return res.status(400).json({ message: "Issue is required" });
    if (await CsatAction.findOne({ sourceId: String(sourceId || ""), issue: String(issue) })) {
      return res.json({ result: "exists" });
    }
    const n = new Date();
    const actionId = `ACT-${String(n.getFullYear()).slice(2)}${p2(n.getMonth() + 1)}${p2(n.getDate())}${p2(n.getHours())}${p2(n.getMinutes())}${p2(n.getSeconds())}${Math.floor(Math.random() * 90 + 10)}`;
    await CsatAction.create({ actionId, cust: String(cust || ""), issue: String(issue), sourceId: String(sourceId || "") });
    res.status(201).json({ result: "ok", actionId });
  } catch (err) {
    console.error("CSAT ACTION SAVE ERROR:", err);
    res.status(500).json({ message: "Could not save the action" });
  }
});

router.put("/actions/:actionId", protect, async (req, res) => {
  try {
    if (!isAdminUser(req)) return res.status(403).json({ message: "Admin access required" });
    const { owner, due, status, remarks } = req.body || {};
    const upd = {
      owner: String(owner || "").slice(0, 200),
      due: /^\d{4}-\d{2}-\d{2}$/.test(String(due || "")) ? String(due) : "",
      remarks: String(remarks || "").slice(0, 2000),
    };
    if (["Open", "In progress", "Closed"].includes(status)) upd.status = status;
    const a = await CsatAction.findOneAndUpdate({ actionId: req.params.actionId }, { $set: upd }, { new: true });
    if (!a) return res.status(404).json({ message: "Action not found" });
    res.json({ result: "ok" });
  } catch (err) {
    console.error("CSAT ACTION UPDATE ERROR:", err);
    res.status(500).json({ message: "Could not update the action" });
  }
});

module.exports = router;