const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const CustomerOnboarding = require("../models/Customeronboarding");

/* ---------- auth (swap for your existing auth middleware if you have one) ---------- */
const auth = (req, res, next) => {
  try {
    const t = (req.headers.authorization || "").replace("Bearer ", "");
    req.user = jwt.verify(t, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
};

/* ---------- upload ---------- */
const dir = path.join("uploads", "onboarding");
fs.mkdirSync(dir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// merge uploaded files into the items array (field name = file_<slNo>)
const buildItems = (req) => {
  const data = JSON.parse(req.body.data || "{}");
  const files = {};
  (req.files || []).forEach((f) => { files[f.fieldname] = f; });
  const items = (data.items || []).map((i) => {
    const f = files[`file_${i.slNo}`];
    return {
      slNo: i.slNo,
      label: i.label,
      status: i.status || "",
      pendingFrom: i.pendingFrom || "",
      keyIn: i.keyIn || "",
      attachment: f
        ? { name: f.originalname, url: `/uploads/onboarding/${f.filename}` }
        : i.attachment?.url ? i.attachment : undefined,
    };
  });
  return { customerName: (data.customerName || "").trim(), items };
};

/* ---------- routes ---------- */
router.get("/", auth, async (req, res) => {
  const rows = await CustomerOnboarding.find().sort({ updatedAt: -1 }).lean();
  res.json(rows);
});

router.post("/", auth, upload.any(), async (req, res) => {
  try {
    const { customerName, items } = buildItems(req);
    if (!customerName) return res.status(400).json({ message: "Customer Name is required" });
    const doc = await CustomerOnboarding.create({
      customerName, items, createdBy: req.user?.name || req.user?.username || "",
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/:id", auth, upload.any(), async (req, res) => {
  try {
    const { customerName, items } = buildItems(req);
    if (!customerName) return res.status(400).json({ message: "Customer Name is required" });
    const doc = await CustomerOnboarding.findByIdAndUpdate(
      req.params.id, { customerName, items }, { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  await CustomerOnboarding.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;