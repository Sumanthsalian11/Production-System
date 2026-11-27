const mongoose = require("mongoose");

// Maps SAP "Card Description" values to the customer's stock variants. Rows keep their order.
const SapVariantMapSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    rows: {
      type: [
        {
          _id: false,
          cv: { type: String, default: "" },        // customer stock variant
          sap: { type: String, default: "" },       // SAP variant (Card Description)
          ct: { type: String, default: "Credit" },  // card type
        },
      ],
      default: [],
    },
  },
  { timestamps: true, collection: "sap_variant_maps" }
);

module.exports = mongoose.models.SapVariantMap || mongoose.model("SapVariantMap", SapVariantMapSchema);
