const mongoose = require("mongoose");

const ScanLogSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      index: true,
    },

    poDate: {
      type: String,
      default: "",
    },

    deliveryDate: {
      type: String,
      default: "",
    },

    deliveryAddress: {
      type: String,
      default: "",
    },

    username: {
      type: String,
      default: "",
    },
    userLocations: [
  {
    type: String,
    trim: true,
  },
],

    barcodeNo: {
      type: String,
      default: "",
    },

    currentBox: {
      type: Number,
      required: true,
    },

    totalBoxes: {
      type: Number,
      required: true,
    },

    remainingQty: {
      type: Number,
      default: 0,
    },

    scannedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Prevent duplicate carton scan
ScanLogSchema.index(
  { poNumber: 1, currentBox: 1, totalBoxes: 1, remainingQty: 1 }, // ✅
  { unique: true }
);

module.exports = mongoose.model("ScanLog", ScanLogSchema);