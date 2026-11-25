const mongoose = require("mongoose");

const FormResponseSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    comments: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now },
    source: { type: String, default: "Google Form" },
    sheetKey: { type: String, unique: true, sparse: true }
  },
  { timestamps: true, collection: "form_responses" }
);

module.exports = mongoose.model("FormResponse", FormResponseSchema);