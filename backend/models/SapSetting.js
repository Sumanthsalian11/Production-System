const mongoose = require("mongoose");

// key "meta"    -> { plantName, defaultSheet, maxWastePct, requireAckOnWarn }
// key "options" -> { flip, net, closeSt, skipDel, hideZero, baseDate, base }
const SapSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "sap_settings", minimize: false }
);

module.exports = mongoose.models.SapSetting || mongoose.model("SapSetting", SapSettingSchema);
