const mongoose = require("mongoose");

const freightChargeTypeSchema = new mongoose.Schema({
  name: String,
});

module.exports = mongoose.model("FreightChargeType", freightChargeTypeSchema);