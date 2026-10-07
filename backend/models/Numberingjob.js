const mongoose = require("mongoose");

const numberingJobSchema = new mongoose.Schema(
  {
    series: { type: String, required: true, trim: true },
    from: { type: Number, required: true },
    to: { type: Number, required: true },
    digits: { type: Number, default: 6 },
    word: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

numberingJobSchema.index({ series: 1, from: 1, to: 1 });

module.exports = mongoose.model("NumberingJob", numberingJobSchema);