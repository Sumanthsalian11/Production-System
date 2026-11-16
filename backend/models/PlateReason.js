const mongoose = require("mongoose");

const plateReasonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlateReason", plateReasonSchema);