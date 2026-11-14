const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");

const User = require("../models/User");
const ChatMessage = require("../models/ChatMessage");
const ChatProfile = require("../models/ChatProfile");
const authMiddleware = require("../middleware/authMiddleware"); // 👈 adjust path to your auth middleware file
const { verifyLDAPUser } = require("../utils/ldapAuth");

const UPLOAD_DIR = path.resolve("uploads", "chat");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const BLOCKED_EXT = [".exe", ".bat", ".cmd", ".sh", ".js", ".msi", ".com", ".scr", ".html", ".htm", ".svg", ".php", ".jar"];

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, crypto.randomBytes(16).toString("hex") + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXT.includes(ext)) return cb(new Error("This file type is not allowed"));
    cb(null, true);
  },
});

/* ---------- chat-only auth (separate chat token) ---------- */
const chatAuth = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "Chat login required" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.chat || !decoded.id) return res.status(401).json({ message: "Chat login required" });
    req.chatUserId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: "Chat session expired, please log in again" });
  }
};

/* ---------- chat login (must match the logged-in ERP user) ---------- */
router.post("/login", authMiddleware, async (req, res) => {
  try {
    if (!req.user._id) {
      return res.status(400).json({ message: "The built-in admin account has no chat profile. Log in with a registered user." });
    }
    const { identifier, password } = req.body;
    const id = String(identifier || "").toLowerCase().trim();
    if (!id || !password) return res.status(400).json({ message: "Enter username/email and password" });

    const re = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const user = await User.findOne({
      isInternal: true,
      $or: [{ email: id }, { name: re }, { ldapUsername: re }],
    });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    if (String(user._id) !== String(req.user._id)) {
      return res.status(403).json({ message: "These credentials do not belong to the logged-in account" });
    }

    let ok = false;
    if (user.authType === "ldap") {
      try {
        await verifyLDAPUser(user.ldapUsername || user.email, password);
        ok = true;
      } catch (e) {
        if (e.name !== "InvalidCredentialsError") {
          return res.status(503).json({ message: "Domain server is not reachable. Try again later." });
        }
      }
    } else {
      ok = await user.comparePassword(password);
    }
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    await ChatProfile.findOneAndUpdate({ user: user._id }, { $setOnInsert: { user: user._id } }, { upsert: true });

    const token = jwt.sign({ id: user._id, chat: true }, process.env.JWT_SECRET, { expiresIn: "12h" });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- my profile ---------- */
router.get("/profile", chatAuth, async (req, res) => {
  const user = await User.findById(req.chatUserId).select("name email role");
  const profile = await ChatProfile.findOne({ user: req.chatUserId });
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    about: profile?.about ?? "Hey there! I am using MPI Chat.",
  });
});

router.put("/profile", chatAuth, async (req, res) => {
  const about = String(req.body.about || "").slice(0, 140);
  await ChatProfile.findOneAndUpdate({ user: req.chatUserId }, { about }, { upsert: true });
  res.json({ about });
});

/* ---------- contact list with last message + unread ---------- */
router.get("/users", chatAuth, async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.chatUserId);
    await ChatMessage.updateMany({ to: me, deliveredAt: null }, { deliveredAt: new Date() });

    const [users, profiles, convos] = await Promise.all([
      User.find({ isInternal: true, _id: { $ne: me } }).select("name email role").lean(),
      ChatProfile.find().lean(),
      ChatMessage.aggregate([
        { $match: { $or: [{ from: me }, { to: me }], deletedFor: { $ne: me } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { $cond: [{ $eq: ["$from", me] }, "$to", "$from"] },
            last: { $first: "$$ROOT" },
            unread: {
              $sum: { $cond: [{ $and: [{ $eq: ["$to", me] }, { $eq: ["$readAt", null] }] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const aboutMap = Object.fromEntries(profiles.map((p) => [String(p.user), p.about]));
    const convoMap = Object.fromEntries(convos.map((c) => [String(c._id), c]));

    const list = users.map((u) => {
      const c = convoMap[String(u._id)];
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        about: aboutMap[String(u._id)] || "",
        unread: c?.unread || 0,
        lastAt: c?.last?.createdAt || null,
        lastText: c
          ? c.last.deletedAll
            ? "🚫 This message was deleted"
            : c.last.text || (c.last.attachment?.name ? `📎 ${c.last.attachment.name}` : "")
          : "",
        lastMine: c ? String(c.last.from) === String(me) : false,
      };
    });

    list.sort((a, b) => {
      if (a.lastAt && b.lastAt) return new Date(b.lastAt) - new Date(a.lastAt);
      if (a.lastAt) return -1;
      if (b.lastAt) return 1;
      return a.name.localeCompare(b.name);
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/unread", chatAuth, async (req, res) => {
  await ChatMessage.updateMany({ to: req.chatUserId, deliveredAt: null }, { deliveredAt: new Date() });
  const count = await ChatMessage.countDocuments({ to: req.chatUserId, readAt: null, deletedFor: { $ne: req.chatUserId } });
  res.json({ count });
});

/* ---------- conversation ---------- */
router.get("/messages/:userId", chatAuth, async (req, res) => {
  try {
    const me = req.chatUserId;
    const other = req.params.userId;
    if (!mongoose.isValidObjectId(other)) return res.status(400).json({ message: "Invalid user" });

    const msgs = await ChatMessage.find({
      $or: [{ from: me, to: other }, { from: other, to: me }],
      deletedFor: { $ne: me },
    })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    msgs.reverse();

    await ChatMessage.updateMany({ from: other, to: me, readAt: null }, { readAt: new Date() });

    res.json(
      msgs.map((m) => ({
        _id: m._id,
        mine: String(m.from) === String(me),
        text: m.deletedAll ? "" : m.text,
        deletedAll: m.deletedAll,
        attachment: m.deletedAll || !m.attachment?.file ? null : { name: m.attachment.name, mime: m.attachment.mime, size: m.attachment.size },
        createdAt: m.createdAt,
        read: !!m.readAt,
        delivered: !!m.deliveredAt || !!m.readAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- send (text and/or attachment) ---------- */
router.post("/send/:userId", chatAuth, (req, res) => {
  upload.single("file")(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ message: uploadErr.message });
    try {
      const other = req.params.userId;
      if (!mongoose.isValidObjectId(other)) return res.status(400).json({ message: "Invalid user" });
      const target = await User.findOne({ _id: other, isInternal: true }).select("_id");
      if (!target) return res.status(404).json({ message: "User not found" });

      const text = String(req.body.text || "").trim();
      if (!text && !req.file) return res.status(400).json({ message: "Nothing to send" });

      const msg = await ChatMessage.create({
        from: req.chatUserId,
        to: other,
        text,
        attachment: req.file
          ? { file: req.file.filename, name: req.file.originalname, mime: req.file.mimetype, size: req.file.size }
          : undefined,
      });
      res.status(201).json({ _id: msg._id });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
});

/* ---------- authenticated file download ---------- */
router.get("/file/:id", chatAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).end();
    const m = await ChatMessage.findById(req.params.id);
    const me = String(req.chatUserId);
    if (!m || m.deletedAll || !m.attachment?.file) return res.status(404).json({ message: "File not found" });
    if (String(m.from) !== me && String(m.to) !== me) return res.status(403).json({ message: "Not allowed" });

    const safeImg = /^image\/(png|jpe?g|gif|webp)$/.test(m.attachment.mime || "");
    res.sendFile(path.join(UPLOAD_DIR, path.basename(m.attachment.file)), {
      headers: {
        "Content-Type": safeImg ? m.attachment.mime : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- delete ---------- */
router.put("/message/:id/delete-for-me", chatAuth, async (req, res) => {
  await ChatMessage.updateOne(
    { _id: req.params.id, $or: [{ from: req.chatUserId }, { to: req.chatUserId }] },
    { $addToSet: { deletedFor: req.chatUserId } }
  );
  res.json({ ok: true });
});

router.put("/message/:id/delete-for-all", chatAuth, async (req, res) => {
  const m = await ChatMessage.findOne({ _id: req.params.id, from: req.chatUserId });
  if (!m) return res.status(404).json({ message: "Message not found" });
  if (m.attachment?.file) fs.unlink(path.join(UPLOAD_DIR, path.basename(m.attachment.file)), () => {});
  m.deletedAll = true;
  m.text = "";
  m.attachment = undefined;
  await m.save();
  res.json({ ok: true });
});

module.exports = router;