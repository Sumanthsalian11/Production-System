const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  itemCode: { type: String, unique: true },
  uniqueCode: String,
  customerName: String,
  description: String,
  materialType: String,

  colorFront: String,
  colorBack: String,
  wasteQty: Number,
  jobSize: String,
  inkDetails: String,
  pdfPath: String,

  // saved from the indent form, auto-filled next time this code is used
  paperGroup: { type: String, default: "" },
  paperSize: { type: String, default: "" },
  gsm: { type: String, default: "" },
  lamination: { type: String, default: "" },
  finish: { type: String, default: "" },
  specification: { type: String, default: "" },

  artworkVersions: [
    {
      _id: false,
      version:    Number,
      fileName:   { type: String, default: "" },
      filePath:   { type: String, default: "" },
      note:       { type: String, default: "" },
      uploadedBy: { type: String, default: "" },
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model("Item", itemSchema);