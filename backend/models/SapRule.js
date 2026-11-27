const mongoose = require("mongoose");

// Shared (default) movement classification rules. A bank/product template can have its own copy in SapTemplate.ruleSet.
const SapRuleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // rc, dg, wa, tr or a custom key
    name: { type: String, required: true },              // report category name
    mt: { type: String, default: "" },
    fr: { type: String, default: "" },
    to: { type: String, default: "" },
    st: { type: String, default: "" },
    rows: {
      type: [{ _id: false, mt: String, fr: String, to: String, st: String, pc: String }],
      default: [],
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "sap_rules" }
);

module.exports = mongoose.models.SapRule || mongoose.model("SapRule", SapRuleSchema);
