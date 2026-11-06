const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    slNo: Number,
    label: String,
    status: { type: String, default: "" },
    pendingFrom: { type: String, default: "" },
    keyIn: { type: String, default: "" },
    attachment: { name: String, url: String },
  },
  { _id: false }
);

const onboardingSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    items: [itemSchema],
    createdBy: String,
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CustomerOnboarding ||
  mongoose.model("CustomerOnboarding", onboardingSchema);