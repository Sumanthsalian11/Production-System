const mongoose = require("mongoose");

// Governance log of the stock reports (admin changes, uploads, report downloads). Read-only from the UI.
const SapAuditSchema = new mongoose.Schema(
  {
    ts: { type: Date, default: Date.now },
    username: { type: String, default: "" },
    role: { type: String, default: "" },
    action: { type: String, required: true },
    detail: { type: String, default: "" },
  },
  { collection: "sap_audit", versionKey: false }
);

SapAuditSchema.index({ ts: -1 });

module.exports = mongoose.models.SapAudit || mongoose.model("SapAudit", SapAuditSchema);
