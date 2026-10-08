const mongoose = require("mongoose");

const NumberingTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameKey: { type: String, required: true, unique: true, index: true }, // lower-case name, one template per name
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },          // all form fields except the number range
    cols: { type: [mongoose.Schema.Types.Mixed], default: [] },            // Excel field styling, matched by header
    artName: { type: String, default: "" },
    artW: { type: Number, default: 0 },
    artH: { type: Number, default: 0 },
    artType: { type: String, default: "" },
    art: { type: Buffer, select: false },                                  // artwork bytes (kept out of list / detail reads)
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NumberingTemplate", NumberingTemplateSchema);