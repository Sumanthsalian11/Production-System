const mongoose = require("mongoose");

const activityValidationSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true },
    qtyActivities: [String], // activity ids validated by planner Total Qty
    qtyWastePercent: { type: Number, default: 0 }, // allowed waste % over planner Total Qty
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ActivityValidation ||
  mongoose.model("ActivityValidation", activityValidationSchema);