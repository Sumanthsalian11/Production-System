const mongoose = require("mongoose");

const GstTaxSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // GST / SGST / CGST / IGST
    rate: { type: Number, required: true, default: 0 },
    machines: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("GstTax", GstTaxSchema);