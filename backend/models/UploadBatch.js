const mongoose = require("mongoose");

const uploadBatchSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    recordCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UploadBatch", uploadBatchSchema);