const mongoose = require("mongoose");

const innerPackingSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true
  },

  leavesPerInner: {
    type: Number,
    default: 0
  },

  innerPack: {
    type: Number,
    default: 0
  },

  outerPack: {
    type: Number,
    default: 0
  },

  innerPerOuter: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

module.exports = mongoose.model("InnerPacking", innerPackingSchema);