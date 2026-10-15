const mongoose = require("mongoose");

const impressionWasteSchema = new mongoose.Schema(
  { percent: { type: Number, default: 0, min: 0 } },
  { timestamps: true }
);

module.exports = mongoose.model("ImpressionWaste", impressionWasteSchema);