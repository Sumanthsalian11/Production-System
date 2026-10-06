const mongoose = require("mongoose");

const billingReportSchema = new mongoose.Schema(
  {
    // Human-readable unique id, e.g. "BR-2026-00001"
    reportNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    // Original file the user uploaded to generate this report (for reference)
    originalFileName: {
      type: String,
      default: "",
    },
    // Name of the generated .xlsx as stored on disk
    generatedFileName: {
      type: String,
      required: true,
    },
    // Path relative to project root, e.g. "uploads/billing-reports/BR-2026-00001.xlsx"
    filePath: {
      type: String,
      required: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Denormalized name for quick display without populate, and for
    // client-side "only the creator can delete" checks.
    generatedByName: {
      type: String,
      default: "",
    },
  },
  { timestamps: true } // createdAt / updatedAt
);

module.exports = mongoose.model("BillingReport", billingReportSchema);