const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  { text: { type: String, required: true, trim: true } },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", announcementSchema);