const mongoose = require("mongoose");

const manualBoxSchema = new mongoose.Schema(
  {
    deliveryDate: String,
    deliveryAddress: String,
    gstinNo: String,
    ponumber: String,
    poDate: String,
    quantity: Number,
    articleNo: String,
    eanNo: String,
    materialDescription: String,
    eachBoxQty: Number,
    qty: Number,
    enteredBy: { type: String, default: "" },
    userLocations: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ManualBox", manualBoxSchema);