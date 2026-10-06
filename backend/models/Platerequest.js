const mongoose = require("mongoose");

const plateRequestSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkOrder",
      required: true
    },
    efiWoNumber: { type: String, required: true },
    jobName: { type: String, required: true },
    customerName: { type: String, default: "" },
    jobDescription: { type: String, default: "" },
    productType: { type: String, default: "" },
    activities: [{ type: String }],
    machineNames: [{ type: String }],
    remarks: { type: String, default: "" },

    requestedBy: { type: String, required: true },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING"
    },
    userLocations: [
      {
        type: String,
        trim: true
      }
    ],
    reviewedBy: { type: String, default: "" },
    reviewRemarks: { type: String, default: "" },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlateRequest", plateRequestSchema);