const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, uppercase: true, trim: true },
  modules: [String],
});

module.exports = mongoose.model("Role", roleSchema);