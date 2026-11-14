const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, default: "" },
    attachment: {
      file: String, // stored file name on disk
      name: String, // original name
      mime: String,
      size: Number,
    },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId }],
    deletedAll: { type: Boolean, default: false },
  },
  { timestamps: true }
);
chatMessageSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);