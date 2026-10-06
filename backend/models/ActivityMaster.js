// models/ActivityMaster.js
const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  activityName: { type: String, required: true },
  machines: [{ type: String, required: true }] // just store machine names
}, { timestamps: true });

module.exports = mongoose.model("ActivityMaster", activitySchema);