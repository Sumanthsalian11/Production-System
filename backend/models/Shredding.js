// models/Shredding.js

const mongoose = require("mongoose");

const ShreddingSchema = new mongoose.Schema(
  {
    efiWoNumber: {
      type: Number,
      required: true,
    },

    reelNo: {
      type: String,
      required: true,
    },

    productionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Production",
    },

    mattWaste: {
      type: Number,
      default: 0,
    },

    printWaste: {
      type: Number,
      default: 0,
    },

    realEndWaste: {
      type: Number,
      default: 0,
    },

    totalWaste: {
      type: Number,
      default: 0,
    },

    shreddingDate: {
      type: Date,
      required: true,
    },

    planningUser: {
      type: String,
      required: true,
    },

    userLocations: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

ShreddingSchema.index({ efiWoNumber: 1, shreddingDate: -1 });
ShreddingSchema.index({ productionId: 1 });
ShreddingSchema.index({ shreddingDate: -1 });

module.exports = mongoose.model("Shredding", ShreddingSchema);
