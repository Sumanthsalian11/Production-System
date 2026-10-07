const mongoose = require("mongoose");

const rowSchema = new mongoose.Schema(
  {
    inputType: { type: String, trim: true, default: "" }, // paper size name (master) or "Total"
    start: { type: Number, default: 0 },
    end: { type: Number, default: 0 },
    wastage: { type: Number, default: 0 }, // deduction %
    impression: { type: Number, default: 0 }, // |start - end|
        rate: Number,
  },
  { _id: false }
);

// One document = one saved machine entry
const clickReportEntrySchema = new mongoose.Schema(
  {
    month: { type: String, required: true }, // "YYYY-MM"
    machine: { type: String, trim: true, required: true },
    printer: { type: String, trim: true, default: "" },
    rows: [rowSchema],
    a4Rate: { type: Number, default: 0 },
    a3Rate: { type: Number, default: 0 },
    a3Impression: { type: Number, default: 0 },
    a4Impression: { type: Number, default: 0 },
    a3Billable: { type: Number, default: 0 }, // after wastage
    a4Billable: { type: Number, default: 0 },
    totalClick: { type: Number, default: 0 },
    a3Amount: { type: Number, default: 0 },
    a4Amount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }, // %
    discountAmount: { type: Number, default: 0 },
    gst: { type: Number, default: 0 }, // combined GST %
    gstAmount: { type: Number, default: 0 },
    taxes: [
      new mongoose.Schema(
        {
          name: { type: String, trim: true }, // GST | SGST | CGST | IGST
          rate: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
        },
        { _id: false }
      ),
    ],
    totalWithGst: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* ---------- Indexes (list sort + filters) ---------- */
// No filter / month filter  -> sorted list
clickReportEntrySchema.index({ month: -1, createdAt: -1, _id: -1 });
// Machine filter (+ optional month) -> sorted list
clickReportEntrySchema.index({ machine: 1, month: -1, createdAt: -1, _id: -1 });

module.exports = mongoose.model("ClickReportEntry", clickReportEntrySchema);