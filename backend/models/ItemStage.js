const mongoose = require("mongoose");

const ItemStageSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true, uppercase: true, unique: true },
    stages: [
      {
        order: { type: Number, required: true },
        activityId: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityMaster", required: true },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ItemStage", ItemStageSchema);