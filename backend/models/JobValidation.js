// backend/models/JobValidation.js
const mongoose = require("mongoose");

/**
 * Uploaded data is stored the same way the Google Sheet tabs were:
 *   JobValidationMeta : one active header + row count per kind (production / consumption / planning)
 *   JobValidationRow  : one document per uploaded row, values kept as an array in header order
 *                       (arrays, not objects, because SAP headers contain dots, e.g. "Material Doc.Item")
 * A new upload is written under a new batchId and only becomes active after the last chunk arrives,
 * so a failed upload never destroys the data that is already there (this replaces the hidden "_backup" tab).
 */
const metaSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["production", "consumption", "planning"], index: true },
    batchId: { type: String, index: true },
    header: [String],
    rowCount: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
    uploadedBy: String, fileName: { type: String, default: "" },
  },
  { timestamps: true }
);

const rowSchema = new mongoose.Schema({
  kind: { type: String, index: true },
  batchId: { type: String, index: true },
  v: [mongoose.Schema.Types.Mixed],
});
rowSchema.index({ kind: 1, batchId: 1 });

/** Settings, machine rates, product routes, material rates and job overrides (the old Setup sheet). */
const setupSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    settings: { type: [mongoose.Schema.Types.Mixed], default: [] },
    rates: { type: [mongoose.Schema.Types.Mixed], default: [] },
    routes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    mats: { type: [mongoose.Schema.Types.Mixed], default: [] },
    overrides: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, minimize: false }
);

module.exports = {
  JobValidationMeta: mongoose.models.JobValidationMeta || mongoose.model("JobValidationMeta", metaSchema),
  JobValidationRow: mongoose.models.JobValidationRow || mongoose.model("JobValidationRow", rowSchema),
  JobValidationSetup: mongoose.models.JobValidationSetup || mongoose.model("JobValidationSetup", setupSchema),
};