const mongoose = require("mongoose");

const GstMachineTaxSchema = new mongoose.Schema(
  {
    machineId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    machineName: { type: String, required: true },
    taxes: [
      {
        name: { type: String, required: true }, // GST / SGST / CGST / IGST
        rate: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("GstMachineTax", GstMachineTaxSchema);