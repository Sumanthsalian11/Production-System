const mongoose = require("mongoose");

const machineStatusSchema = new mongoose.Schema(
{
  statusName: {
    type: String,
    required: true,
  },
},
{ timestamps: true }
);

module.exports = mongoose.model("MachineStatus", machineStatusSchema);