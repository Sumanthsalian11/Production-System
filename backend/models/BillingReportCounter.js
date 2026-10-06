const mongoose = require("mongoose");

// Dedicated counter collection for BillingReport numbering only.
// Kept separate from any other generic "Counter" model already in the project.
const billingReportCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "billingReport-2026"
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("BillingReportCounter", billingReportCounterSchema);