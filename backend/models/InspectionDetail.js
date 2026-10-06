const mongoose = require("mongoose");

const inspectionDetailSchema = new mongoose.Schema({
  slNo: Number,
  rirNo: String,
  testedDate: String,
  itemCode: String,
  materialName: String,
  supplierName: String,
  parameter: String,
  specification: String,
  tolLimit: String,
  uom: String,
  readings: String,
  remarks: String,
  acceptanceCriteria: String,
  defectCriteria: String,
  qcDoneBy: String,
  checkedBy: String,
}, { timestamps: true });

module.exports = mongoose.model("InspectionDetail", inspectionDetailSchema);