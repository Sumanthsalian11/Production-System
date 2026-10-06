const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  description: { type: String },
  group: { type: String },
  mill: { type: String },
  gsm: { type: String },
  paperSize: { type: String, required: true },
  length: { type: String },   // ✅ new
  width: { type: String },    // ✅ new
}, { timestamps: true });

module.exports = mongoose.model("Material", materialSchema);