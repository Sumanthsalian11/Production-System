const mongoose = require("mongoose");

const csatResponseSchema = new mongoose.Schema(
  {
    responseId: { type: String, unique: true, sparse: true }, // prevents duplicates
    responder: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} }, // { "Question text": "Answer" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CsatResponse", csatResponseSchema);