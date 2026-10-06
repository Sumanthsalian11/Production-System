const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    user: { type: String, default: "User" },
    text: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const inventoryItemSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, index: true },
    desc: { type: String, default: "", index: true },
    plant: { type: String, default: "", index: true },
    requisitioner: { type: String, default: "", index: true },
    matType: { type: String, default: "", index: true },
    matGrp: { type: String, default: "", index: true },
    movementStatus: {
      type: String,
      enum: ["Regular Moving", "Slow Moving", "Non Moving"],
      default: "Regular Moving",
      index: true,
    },
    totalVal: { type: Number, default: 0, index: true },
    nonMovingDays: { type: Number, default: 0, index: true },
    regVal: { type: Number, default: 0 },
    slowVal: { type: Number, default: 0, index: true },
    nonVal: { type: Number, default: 0, index: true },
    val0_90: { type: Number, default: 0 },
    val90_180: { type: Number, default: 0 },
    val180_365: { type: Number, default: 0 },
    val365Plus: { type: Number, default: 0 },
    detailedComments: { type: String, default: "" },

    // Which upload ("batch") this row came from. code is intentionally NOT
    // unique across the collection anymore — the same material code will
    // have one document per batch it appeared in, each with its own
    // comment thread, so nothing needs to be merged or carried forward
    // on re-upload.
    batchId: { type: String, required: true, index: true },
    batchLabel: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now, index: true },

    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true }
);

// Speeds up the common query shape: one batch, filtered by status, sorted by value.
inventoryItemSchema.index({ batchId: 1, movementStatus: 1, totalVal: -1 });

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);