const mongoose = require("mongoose");

// One row per uploaded SAP movement export
const SapDatasetSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    sheetName: { type: String, default: "" },
    rowCount: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    minDate: { type: String, default: "" }, // posting date range "YYYY-MM-DD"
    maxDate: { type: String, default: "" },
    logicTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "SapTemplate", default: null }, // bank / product logic chosen at upload
    uploadedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "sap_datasets" }
);

module.exports = mongoose.models.SapDataset || mongoose.model("SapDataset", SapDatasetSchema);
