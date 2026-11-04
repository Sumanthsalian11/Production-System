const mongoose = require("mongoose");

const summaryDisplaySchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    hidden: { type: [String], default: [] }, // "activityId__machineId"
    persoHidden: { type: [String], default: [] }, // "machineName__printerName"
  },
  { timestamps: true }
);

module.exports = mongoose.model("SummaryDisplay", summaryDisplaySchema);