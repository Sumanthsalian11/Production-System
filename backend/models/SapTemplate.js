const mongoose = require("mongoose");

// Bank / product report template + its own movement logic (rules).
// The SAP Upload page only lists these (to link the uploaded data to a bank/product logic);
// they are created and edited from the stock Reports / Admin screens.
const SapTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    acc: { type: String, default: "" },   // customer access label
    cust: { type: String, default: "" },  // raw customer name contains
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "SapVariantMap", default: null },
    internal: { type: Boolean, default: false },
    title: { type: String, default: "Stock Statement" },
    foot: { type: String, default: "" },
    rack: { type: Boolean, default: false },
    cols: { type: [{ _id: false, k: String, l: String, s: Boolean }], default: [] },
    order: { type: Number, default: 0 },
    ruleSet: { type: [mongoose.Schema.Types.Mixed], default: undefined }, // this bank's movement rules
  },
  { timestamps: true, collection: "sap_templates" }
);

module.exports = mongoose.models.SapTemplate || mongoose.model("SapTemplate", SapTemplateSchema);
