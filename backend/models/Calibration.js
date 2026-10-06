const mongoose = require("mongoose");

const calibrationSchema = new mongoose.Schema(
  {
    slNo: { type: Number },
    instrumentName: { type: String, required: true, trim: true },
    quantity: { type: String, trim: true },
    make: { type: String, trim: true },
    modelSerialNo: { type: String, trim: true },
    yearOfInstallation: { type: String, trim: true },
    internalExternal: {
      type: String,
      enum: ["Internal", "External"],
      required: true,
    },
    purpose: { type: String, trim: true },
    frequency: { type: String, trim: true },
    dateOfCalibration: { type: String, trim: true },
    nextDueDate: { type: String, trim: true },
    location: { type: String, trim: true },
    status: { type: String, trim: true, default: "Ok" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Calibration", calibrationSchema);