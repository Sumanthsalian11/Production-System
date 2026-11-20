const mongoose = require("mongoose");

const PaperGroupSchema = new mongoose.Schema(
  {
    group: { type: String, required: true, trim: true, unique: true },
    gsms: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

module.exports = mongoose.models.PaperGroup || mongoose.model("PaperGroup", PaperGroupSchema);