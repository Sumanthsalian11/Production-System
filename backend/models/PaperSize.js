const mongoose = require("mongoose");

const PaperSizeSchema = new mongoose.Schema({
   name: { type: String, required: true, unique: true },
  wastage: { type: Number, default: 0 },
  rate: { type: Number, default: 0 }
});

module.exports = mongoose.model("PaperSize", PaperSizeSchema);