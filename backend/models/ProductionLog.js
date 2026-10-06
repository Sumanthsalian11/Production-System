const mongoose = require("mongoose");

const ProductionLogSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  woNumber: String,
  customerName: String,
  jobName: String,
  machine: [String],
  producedQty: { type: Number, default: 0 },
  wastageQty: { type: Number, default: 0 },
  reason: String,
  remark: String,
  loggedBy: String,
}, { timestamps: true });

module.exports = mongoose.model("ProductionLog", ProductionLogSchema);