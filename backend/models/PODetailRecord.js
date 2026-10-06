const mongoose = require("mongoose");

const PODetailRecordSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ManualBox",
    },
    ponumber: {
      type: String,
      required: true,
      index: true,
    },
    eachBoxQty: {
      type: Number,
      default: 0,
    },
    qty: {
      type: Number,
      default: 0,
    },
    totalQty: {
      type: Number,
      default: 0,
    },
    remainingQty: {
      type: Number,
      default: 0,
    },
      enteredBy:    { type: String, default: "" },      // ✅
    userLocations: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PODetailRecord", PODetailRecordSchema);