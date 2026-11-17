const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  name: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  revoked: { type: Boolean, default: false },
  revokedReason: { type: String, default: "" },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
});

// auto-delete old session records after 24 hours (the maximum life is 8 hours)
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model("Session", sessionSchema);