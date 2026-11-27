const mongoose = require("mongoose");

// One row per job (card job) of an uploaded sheet. `f` holds the configured fields (bank, qty, status ...).
const CardTrackerJobSchema = new mongoose.Schema(
  {
    dataset: { type: mongoose.Schema.Types.ObjectId, ref: "CardTrackerDataset", required: true },
    rowNo: { type: Number, default: 0 },
    recv: { type: String, default: "" }, // received date "YYYY-MM-DD"
    ts: { type: Number, default: 0 },    // processed timestamp (ms)
    f: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: "card_tracker_jobs", versionKey: false, minimize: false }
);

CardTrackerJobSchema.index({ dataset: 1, rowNo: 1 });

module.exports =
  mongoose.models.CardTrackerJob || mongoose.model("CardTrackerJob", CardTrackerJobSchema);
