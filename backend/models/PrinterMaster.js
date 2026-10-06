const mongoose = require("mongoose");

const PrinterMasterSchema = new mongoose.Schema({
  machineName: { type: String, required: true, unique: true },
  printerNames: [{ type: String }]  // array of printer names
});

module.exports = mongoose.model("PrinterMaster", PrinterMasterSchema);