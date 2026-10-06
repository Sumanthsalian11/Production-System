const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ArtworkTicket = require("../models/Artworkticket");
const protect = require("../middleware/authMiddleware");

const TRANSITIONS = {
  start: { from: "open", to: "in_progress", note: "Started work on this ticket." },
  submit: { from: "in_progress", to: "changes_submitted", note: "Submitted revised artwork for review." },
  revise: { from: "changes_submitted", to: "in_progress", note: "Requested a revision." },
  close: { from: "changes_submitted", to: "closed", note: "Closed the ticket — approved." },
  reopen: { from: "closed", to: "in_progress", note: "Reopened the ticket." },
};

// ---------- Attachment upload setup ----------
const uploadDir = path.join(__dirname, "..", "uploads", "artwork");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "image/png",
  "image/jpeg",
];

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type — PDF, Excel, or image only"));
  },
});

function handleAttachments(req, res, next) {
  upload.array("attachments", 5)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}

function buildAttachments(files) {
  return (files || []).map((f) => ({
    originalName: f.originalname,
    fileName: f.filename,
    url: "/uploads/artwork/" + f.filename,
    mimeType: f.mimetype,
    size: f.size,
  }));
}

// GET /api/artwork/tickets?status=open
router.get("/tickets", protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    const tickets = await ArtworkTicket.find(filter).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/artwork/tickets/:ticketId
router.get("/tickets/:ticketId", protect, async (req, res) => {
  try {
    const ticket = await ArtworkTicket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/artwork/tickets  (any authenticated user can raise a ticket, with optional attachments)
router.post("/tickets", protect, handleAttachments, async (req, res) => {
  try {
    const { materialCode, customerName, variant, remarks } = req.body;
    if (!materialCode || !customerName || !remarks) {
      return res.status(400).json({ message: "materialCode, customerName and remarks are required" });
    }

    const attachments = buildAttachments(req.files);

    const ticket = await ArtworkTicket.create({
      materialCode,
      customerName,
      variant,
      remarks,
      status: "open",
      createdBy: req.user.name,
      createdByRole: req.user.role,
      attachments,
      messages: [{ sender: req.user.name, role: req.user.role, type: "note", text: remarks, attachments }],
    });
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/artwork/tickets/:ticketId/messages  (any authenticated role adds a chat note, with optional attachments)
router.post("/tickets/:ticketId/messages", protect, handleAttachments, async (req, res) => {
  try {
    const text = (req.body.text || "").trim();
    const attachments = buildAttachments(req.files);

    if (!text && attachments.length === 0) {
      return res.status(400).json({ message: "text or an attachment is required" });
    }

    const ticket = await ArtworkTicket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    if (ticket.status === "closed") return res.status(400).json({ message: "Ticket is closed" });

    ticket.messages.push({
      sender: req.user.name,
      role: req.user.role,
      type: "note",
      text,
      attachments,
    });
    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/artwork/tickets/:ticketId/status  { action: "start"|"submit"|"revise"|"close"|"reopen" }
router.patch("/tickets/:ticketId/status", protect, async (req, res) => {
  try {
    const { action } = req.body;
    const rule = TRANSITIONS[action];
    if (!rule) return res.status(400).json({ message: "Unknown action" });

    const ticket = await ArtworkTicket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (ticket.status !== rule.from) {
      return res.status(400).json({ message: "Ticket must be '" + rule.from + "' for this action" });
    }

    ticket.status = rule.to;
    ticket.messages.push({ sender: req.user.name, role: req.user.role, type: "status", text: rule.note });
    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;