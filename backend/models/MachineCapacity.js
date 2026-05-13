const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MachineMaster",
    required: true
  },
  capacityPerHour: { type: Number, required: true },
  shiftStart: { type: Number, default: 8 },
  shiftEnd: { type: Number, default: 20 }
}, { timestamps: true });

module.exports = mongoose.model("MachineCapacity", schema);