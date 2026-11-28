const mongoose = require("mongoose");

const FormResponseSchema = new mongoose.Schema(
  {
    // main fields (Customer Satisfaction Survey).  name = Customer Name, email = SPOC Email, phone = SPOC Contact number
    name: { type: String, trim: true },
    spocName: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    feedbackDate: { type: Date },

    // every rating / choice answer, in form order: [{ q: "6. SALES & MARKETING [PRESENTATION]", a: "GOOD" }, ...]
    answers: { type: [{ _id: false, q: String, a: String }], default: [] },

    // fields of the old "Contact Information" form (kept so the old responses still show)
    address: { type: String, trim: true },
    comments: { type: String, trim: true },

    submittedAt: { type: Date, default: Date.now },
    source: { type: String, default: "Google Form" },
    sheetKey: { type: String, unique: true, sparse: true }
  },
  { timestamps: true, collection: "form_responses" }
);

module.exports = mongoose.model("FormResponse", FormResponseSchema);