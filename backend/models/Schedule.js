const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WorkOrder"
  },
  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MachineMaster"
  },

  totalImpression: Number,
  machineCapacity: Number,

  startTime: Date,
  endTime: Date,
  scheduleDate: Date,

  priority: String,
  location: String,

  isBlocked: { type: Boolean, default: false },
  blockReason: String

}, { timestamps: true });

module.exports = mongoose.model("Schedule", scheduleSchema);