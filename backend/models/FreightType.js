const mongoose = require("mongoose");

const freightTypeSchema = new mongoose.Schema({
  name: String,
  
});

module.exports = mongoose.model("FreightType", freightTypeSchema);