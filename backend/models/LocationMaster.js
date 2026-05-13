const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  locationName: { type: String, required: true },
  address: { type: String, required: true }   // 👈 ADD THIS
}, { timestamps: true });

module.exports = mongoose.model("LocationMaster", locationSchema);