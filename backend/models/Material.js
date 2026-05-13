// server/models/Material.js
const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // ✅ unique
  description: { type: String },
  group: { type: String },
  mill: { type: String },
  gsm: { type: String },
  paperSize: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Material", materialSchema);