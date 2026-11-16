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
const ChatGroup = require("../models/ChatGroup");
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

/* ---------- auto login (ERP session already proves identity) ---------- */
router.post("/auto-login", authMiddleware, async (req, res) => {
  try {
    if (!req.user._id) return res.status(400).json({ message: "The built-in admin account has no chat profile." });
    const user = await User.findOne({ _id: req.user._id, isInternal: true }).select("_id");
    if (!user) return res.status(403).json({ message: "Chat not available for this account" });

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
        { $match: { group: null, $or: [{ from: me }, { to: me }], deletedFor: { $ne: me } } },
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
  let count = await ChatMessage.countDocuments({ to: req.chatUserId, readAt: null, deletedFor: { $ne: req.chatUserId } });
  const gids = (await ChatGroup.find({ members: req.chatUserId }).select("_id").lean()).map((g) => g._id);
  count += await ChatMessage.countDocuments({
    group: { $in: gids },
    from: { $ne: req.chatUserId },
    readBy: { $ne: req.chatUserId },
    deletedFor: { $ne: req.chatUserId },
  });
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
        forwarded: !!m.forwarded,
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
    if (!(await canAccess(m, me))) return res.status(403).json({ message: "Not allowed" });

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
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid message" });
  const m = await ChatMessage.findById(req.params.id);
  if (!m || !(await canAccess(m, req.chatUserId))) return res.status(404).json({ message: "Message not found" });
  await ChatMessage.updateOne({ _id: m._id }, { $addToSet: { deletedFor: req.chatUserId } });
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

/* ---------- helper ---------- */
const canAccess = async (m, uid) => {
  uid = String(uid);
  if (m.group) return !!(await ChatGroup.findOne({ _id: m.group, members: uid }).select("_id"));
  return String(m.from) === uid || String(m.to) === uid;
};

/* ---------- groups ---------- */
router.post("/groups", chatAuth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 60);
    const ids = [...new Set((req.body.members || []).map(String))].filter(
      (i) => mongoose.isValidObjectId(i) && i !== String(req.chatUserId)
    );
    if (!name) return res.status(400).json({ message: "Group name required" });
    if (!ids.length) return res.status(400).json({ message: "Select at least one member" });
    const valid = await User.find({ _id: { $in: ids }, isInternal: true }).select("_id");
    const g = await ChatGroup.create({
      name,
      createdBy: req.chatUserId,
      members: [req.chatUserId, ...valid.map((u) => u._id)],
    });
    res.status(201).json({ id: g._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/groups", chatAuth, async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.chatUserId);
    const groups = await ChatGroup.find({ members: me }).populate("members", "name").lean();
    const gids = groups.map((g) => g._id);
    const convos = await ChatMessage.aggregate([
      { $match: { group: { $in: gids }, deletedFor: { $ne: me } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$group",
          last: { $first: "$$ROOT" },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$from", me] }, { $not: [{ $in: [me, { $ifNull: ["$readBy", []] }] }] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const cm = Object.fromEntries(convos.map((c) => [String(c._id), c]));
    res.json(
      groups.map((g) => {
        const c = cm[String(g._id)];
        return {
          id: g._id,
          isGroup: true,
          name: g.name,
          role: `${g.members.length} members`,
          about: g.members.map((m) => m.name).join(", "),
          unread: c?.unread || 0,
          lastAt: c?.last?.createdAt || g.createdAt,
          lastText: c
            ? c.last.deletedAll
              ? "🚫 This message was deleted"
              : c.last.text || (c.last.attachment?.name ? `📎 ${c.last.attachment.name}` : "")
            : "",
          lastMine: c ? String(c.last.from) === String(me) : false,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/group-messages/:groupId", chatAuth, async (req, res) => {
  try {
    const me = req.chatUserId;
    const gid = req.params.groupId;
    if (!mongoose.isValidObjectId(gid)) return res.status(400).json({ message: "Invalid group" });
    const g = await ChatGroup.findOne({ _id: gid, members: me }).lean();
    if (!g) return res.status(404).json({ message: "Group not found" });

    const msgs = await ChatMessage.find({ group: gid, deletedFor: { $ne: me } })
      .sort({ createdAt: -1 })
      .limit(300)
      .populate("from", "name")
      .lean();
    msgs.reverse();

    await ChatMessage.updateMany({ group: gid, from: { $ne: me }, readBy: { $ne: me } }, { $addToSet: { readBy: me } });

    const others = g.members.map(String).filter((id) => id !== String(me));
    res.json(
      msgs.map((m) => ({
        _id: m._id,
        mine: String(m.from?._id) === String(me),
        sender: m.from?.name || "Unknown",
        text: m.deletedAll ? "" : m.text,
        deletedAll: m.deletedAll,
        attachment: m.deletedAll || !m.attachment?.file ? null : { name: m.attachment.name, mime: m.attachment.mime, size: m.attachment.size },
        createdAt: m.createdAt,
        forwarded: !!m.forwarded,
        delivered: true,
        read: others.every((id) => (m.readBy || []).some((r) => String(r) === id)),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/group-send/:groupId", chatAuth, (req, res) => {
  upload.single("file")(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ message: uploadErr.message });
    try {
      const gid = req.params.groupId;
      if (!mongoose.isValidObjectId(gid)) return res.status(400).json({ message: "Invalid group" });
      const g = await ChatGroup.findOne({ _id: gid, members: req.chatUserId }).select("_id");
      if (!g) return res.status(404).json({ message: "Group not found" });

      const text = String(req.body.text || "").trim();
      if (!text && !req.file) return res.status(400).json({ message: "Nothing to send" });

      const msg = await ChatMessage.create({
        from: req.chatUserId,
        group: g._id,
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

/* ---------- forward ---------- */
router.post("/forward", chatAuth, async (req, res) => {
  try {
    const me = req.chatUserId;
    const { messageId, targets } = req.body; // targets: [{ id, isGroup }]
    if (!mongoose.isValidObjectId(messageId) || !Array.isArray(targets) || !targets.length)
      return res.status(400).json({ message: "Invalid request" });

    const src = await ChatMessage.findById(messageId);
    if (!src || src.deletedAll || !(await canAccess(src, me))) return res.status(404).json({ message: "Message not found" });

    for (const t of targets.slice(0, 20)) {
      if (!mongoose.isValidObjectId(t?.id)) continue;
      const doc = { from: me, text: src.text, forwarded: true };

      if (t.isGroup) {
        const g = await ChatGroup.findOne({ _id: t.id, members: me }).select("_id");
        if (!g) continue;
        doc.group = g._id;
      } else {
        const u = await User.findOne({ _id: t.id, isInternal: true }).select("_id");
        if (!u) continue;
        doc.to = u._id;
      }

      if (src.attachment?.file) {
        const srcPath = path.join(UPLOAD_DIR, path.basename(src.attachment.file));
        if (fs.existsSync(srcPath)) {
          const newName = crypto.randomBytes(16).toString("hex") + path.extname(srcPath);
          fs.copyFileSync(srcPath, path.join(UPLOAD_DIR, newName));
          doc.attachment = { file: newName, name: src.attachment.name, mime: src.attachment.mime, size: src.attachment.size };
        }
      }
      if (!doc.text && !doc.attachment) continue;
      await ChatMessage.create(doc);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- clear chat (for me only) ---------- */
router.put("/clear/:userId", chatAuth, async (req, res) => {
  const me = req.chatUserId;
  const other = req.params.userId;
  if (!mongoose.isValidObjectId(other)) return res.status(400).json({ message: "Invalid user" });
  await ChatMessage.updateMany(
    { group: null, $or: [{ from: me, to: other }, { from: other, to: me }] },
    { $addToSet: { deletedFor: me } }
  );
  res.json({ ok: true });
});

router.put("/clear-group/:groupId", chatAuth, async (req, res) => {
  const gid = req.params.groupId;
  if (!mongoose.isValidObjectId(gid)) return res.status(400).json({ message: "Invalid group" });
  const g = await ChatGroup.findOne({ _id: gid, members: req.chatUserId }).select("_id");
  if (!g) return res.status(404).json({ message: "Group not found" });
  await ChatMessage.updateMany({ group: gid }, { $addToSet: { deletedFor: req.chatUserId } });
  res.json({ ok: true });
});

module.exports = router;