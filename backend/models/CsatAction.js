const mongoose = require("mongoose");

// Action tracker (CAPA) of the Customer Satisfaction dashboard: one record per action raised from a red flag
const CsatActionSchema = new mongoose.Schema(
  {
    actionId: { type: String, required: true, unique: true }, // ACT-yyMMddHHmmss
    raised: { type: Date, default: Date.now },
    cust: { type: String, default: "" },
    issue: { type: String, default: "" },
    sourceId: { type: String, default: "" }, // _id of the survey response the flag came from
    owner: { type: String, default: "" },
    due: { type: String, default: "" }, // yyyy-mm-dd
    status: { type: String, enum: ["Open", "In progress", "Closed"], default: "Open" },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "csat_actions" }
);

module.exports = mongoose.models.CsatAction || mongoose.model("CsatAction", CsatActionSchema);