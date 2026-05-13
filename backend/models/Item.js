const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  itemCode: { type: String, unique: true },
  customerName: String,
  description: String,
  materialType: String,

  colorFront: String,
  colorBack: String,
  wasteQty: Number,
  jobSize: String,
  inkDetails: String
});

module.exports = mongoose.model("Item", itemSchema);