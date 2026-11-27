const mongoose = require("mongoose");

// One row per uploaded Card Job Tracker sheet
const CardTrackerDatasetSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    sheetName: { type: String, default: "" },
    rowCount: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    minDate: { type: String, default: "" }, // "YYYY-MM-DD"
    maxDate: { type: String, default: "" },
    uploadedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "card_tracker_datasets" }
);

module.exports =
  mongoose.models.CardTrackerDataset ||
  mongoose.model("CardTrackerDataset", CardTrackerDatasetSchema);
