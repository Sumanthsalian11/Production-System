const mongoose = require("mongoose");

// ---- Counter (for sequential ATW-1041 style ticket IDs) ----
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

async function nextTicketId() {
  const ticketCount = await mongoose.models.ArtworkTicket.countDocuments();
  if (ticketCount === 0) {
    await Counter.findByIdAndUpdate("artworkTicket", { $set: { seq: 0 } }, { upsert: true });
  }
  const counter = await Counter.findByIdAndUpdate(
    "artworkTicket",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `ATW-${counter.seq}`;
}

const ROLES = [
  "PURCHASE ORDER", "ADMIN", "INDENTER", "PLANNER", "SUPERVISOR",
  "PRODUCTION", "DISPATCH", "KAS", "SCANNER", "PREPRESS",
  "PRINTING", "WAREHOUSE", "QUALITY CONTROL",
];

// ---- Attachment sub-schema (reused by ticket AND messages) ----
const AttachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
  },
  { _id: false }
);

// ---- Message sub-schema ----
const MessageSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    type: { type: String, enum: ["note", "status"], default: "note" },
    text: { type: String, default: "" },
    attachments: [AttachmentSchema],
  },
  { timestamps: { createdAt: "time", updatedAt: false } }
);

// ---- Ticket schema ----
const ArtworkTicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true, index: true },
    materialCode: { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    variant: { type: String, trim: true, default: "" },
    remarks: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "changes_submitted", "closed"],
      default: "open",
    },
    createdBy: { type: String, required: true },
    createdByRole: { type: String, enum: ROLES, required: true },
    attachments: [AttachmentSchema],
    messages: [MessageSchema],
  },
  { timestamps: true }
);

ArtworkTicketSchema.pre("validate", async function () {
  if (!this.ticketId) {
    this.ticketId = await nextTicketId();
  }
});

module.exports = mongoose.models.ArtworkTicket || mongoose.model("ArtworkTicket", ArtworkTicketSchema);