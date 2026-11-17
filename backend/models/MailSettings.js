const mongoose = require("mongoose");

const mailSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // "indentSummary"
    toEmails: { type: [String], default: [] },
    ccEmails: { type: [String], default: [] },
    sendTime: { type: String, default: "15:00" }, // 24h "HH:MM"
    machineIds: { type: [String], default: [] }, // machines to include in the mail (empty = all machines)
        // inhouseOrder only: product types per recipient (empty = that user gets all types)
    userTypes: {
      type: [{ _id: false, email: String, productTypes: [String] }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MailSettings", mailSettingsSchema);