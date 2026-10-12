const mongoose = require("mongoose");

const mailSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // "indentSummary"
    toEmails: { type: [String], default: [] },
    ccEmails: { type: [String], default: [] },
    sendTime: { type: String, default: "15:00" }, // 24h "HH:MM"
  },
  { timestamps: true }
);

module.exports = mongoose.model("MailSettings", mailSettingsSchema);