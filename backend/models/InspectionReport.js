const mongoose = require("mongoose");

const inspectionReportSchema = new mongoose.Schema({
  slNo: Number,
  itemCode: String,
  testedDate: String,
  rirNo: { type: String, required: true },
  supplierName: String,
  materialDesc: String,
  invoiceDetails: String,
  recDate: String,
  receivedQty: String,
  poNo: String,
  girNo: String,
  lotStatus: String,
  qcRemarks: String,
  materialType: String,
  location: { type: String,},
  itemPdfPath: String,
}, { timestamps: true });

module.exports = mongoose.model("InspectionReport", inspectionReportSchema);