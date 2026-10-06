const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  locationName: { type: String, required: true },
  address: { type: String, required: true },
  machines: [{ type: mongoose.Schema.Types.ObjectId, ref: "MachineMaster" }], // use your Machine model's registered name
}, { timestamps: true });

module.exports = mongoose.model("LocationMaster", locationSchema);