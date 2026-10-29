const mongoose = require("mongoose");

const signoffOrderSchema = new mongoose.Schema({
  key: { type: String, default: "signoff", unique: true },
  order: [String],
});

module.exports = mongoose.model("SignoffOrder", signoffOrderSchema);