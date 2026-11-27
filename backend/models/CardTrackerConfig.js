const mongoose = require("mongoose");

// Optional admin-saved configuration (Excel column names, stages, priority bands ...).
// When no document exists the built-in default inside routes/cardTracker.js is used.
const CardTrackerConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "card_tracker_config", minimize: false }
);

module.exports =
  mongoose.models.CardTrackerConfig ||
  mongoose.model("CardTrackerConfig", CardTrackerConfigSchema);
