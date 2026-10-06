const mongoose = require("mongoose");

const IndentItemSchema = new mongoose.Schema({
  productCode:  { type: String, required: true },
  materialType: { type: String, default: "" },
  description:  { type: String, default: "" },
  customerName: { type: String, default: "" },
  colorFront:   { type: String, default: "" },
  colorBack:    { type: String, default: "" },
  wasteQty:     { type: String, default: "" },
  jobSize:      { type: String, default: "" },
  inkDetails:   { type: String, default: "" },
  quantity:     { type: Number, required: true },
  deliveryDate: { type: Date },
  unitRate:     { type: Number, default: 0 },
  remark:       { type: String, default: "" },

  // ===== NEW FIELDS =====
  lamination:          { type: String, default: "" },
  finish:              { type: String, default: "" },
  jobNo:               { type: String, default: "" },
  soNo:                { type: String, default: "" },
  soDate:               { type: Date },
  sampleType: {
    type: String,
    enum: ["", "Offset", "Digital"],
    default: ""
  },
  costingConfirmation: { type: String, default: "" },
  customerPoNo:        { type: String, default: "" },
  customerPoDate:       { type: Date },
  typeOfBilling: {
    type: String,
    enum: ["", "Billing", "Kit Billing"],
    default: ""
  },

  // ===== UPLOADED DOCUMENTS =====
  customerCopy: {
    fileName: { type: String, default: "" },
    filePath: { type: String, default: "" }
  },
  artwork: {
    fileName: { type: String, default: "" },
    filePath: { type: String, default: "" }
  },
  itemPdfPath: { type: String, default: "" },
});

const IndentRequestSchema = new mongoose.Schema(
  {
    indentNo:   { type: String, unique: true },
    items:      [IndentItemSchema],
    location:   { type: mongoose.Schema.Types.ObjectId, ref: "LocationMaster" },
    user:       { type: String },
    userEmail: { type: String, default: "" },

    status: {
      type: String,
      enum: ["PENDING_PO", "APPROVED", "REJECTED"],
      default: "PENDING_PO",
    },

    orderType:  { type: String, default: "" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IndentRequest", IndentRequestSchema);