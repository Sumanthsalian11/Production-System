const mongoose = require("mongoose");

const SapOpeningStockSchema = new mongoose.Schema(
  {
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "SapVariantMap", required: true, index: true },
    sap: { type: String, required: true },      // normalised SAP variant (Card Description)
    variant: { type: String, default: "" },     // Customer Stock Variant as shown in the map
    qty: { type: Number, default: 0 },
  },
  { timestamps: true }
);
SapOpeningStockSchema.index({ mapId: 1, sap: 1 }, { unique: true });

module.exports = mongoose.model("SapOpeningStock", SapOpeningStockSchema);