const mongoose = require("mongoose");

// ✅ Separate collection for Prepress assignments.
// Links back to the original Work Order via `workOrderId`, and
// snapshots the full display fields (matching WorkOrder's printing
// schema — materials, machines, colors, impressions, etc.) so the
// Preprocess table/records don't rely on WorkOrder still existing
// with the same shape later.
const PreprocessSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkOrder",
      required: true,
      unique: true // one preprocess assignment per work order
    },

    // ----- snapshot fields (mirrors WorkOrder) -----
    slNo: Number,
    efiWoNumber: Number,
    productCode: String,
    purchaseOrderNo: String,
    priority: String,
    customer: String,
    productType: String,
    productName: String,
    location: String,

    machines: [
      {
        activityId: mongoose.Schema.Types.ObjectId,
        machineId: mongoose.Schema.Types.ObjectId,
        activityName: String, // snapshot of the name at assign time
        machineName: String,
        inches: String,
        slitNumber: String
      }
    ],

    materials: [
      {
        materialCode: String,
        materialDescription: String,
        materialGroupDescription: String,
        mill: String,
        gsm: String,
        paperSize: String,
        paperQty: Number
      }
    ],

    colorFront: Number,
    colorBack: Number,
    orderQty: Number,
    wasteQty: Number,
    totalQty: Number,
    jobSize: String,
    UPS: Number,
    impFront: Number,
    impBack: Number,
    totalImp: Number,
    inkDetails: String,
    remarks: String,
    itemPdfPath: { type: String, default: "" },
    planningUser: String,
    userLocations: [String],

    // ----- move-file details -----
    destinationFolder: { type: String, default: "" },
    movedFiles: [{ type: String }],

    // ----- assignment fields -----
    assignedBy: { type: String, required: true }, // logged-in user who assigned it
    status: {
      type: String,
      enum: ["ASSIGNED", "IN_PROGRESS", "COMPLETED"],
      default: "ASSIGNED"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Preprocess", PreprocessSchema);