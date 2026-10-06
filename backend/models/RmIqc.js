const mongoose = require("mongoose");

const parameterSchema = new mongoose.Schema(
  {
    qualityParameter: { type: String, required: true, trim: true },
    specification: { type: String, trim: true },
    uom: { type: String, trim: true },
    tolerance: { type: String, trim: true },
  },
  { _id: false }
);

const rmIqcSchema = new mongoose.Schema(
  {
    slNo: { type: Number, default: null },
    description: { type: String, required: true, trim: true },
    parameters: [parameterSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("RmIqc", rmIqcSchema);