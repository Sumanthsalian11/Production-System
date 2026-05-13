const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema({
  machineName: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("MachineMaster", machineSchema);
