const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema({
  machineName: { type: String, required: true },
   ups: { type: [Number], default: [] },
   fixed: { type: Boolean, default: false }}, { timestamps: true });

module.exports = mongoose.model("MachineMaster", machineSchema);