const mongoose = require("mongoose");

const InwardRegisterSchema = new mongoose.Schema(
  {
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder" },
    efiWoNumber: { type: Number },
    customerName: { type: String },
    itemDescription: { type: String },
    materialCode: { type: String },
    workOrderQty: { type: Number },
    workOrderDate: { type: Date },

    // Entry fields
    dateOfInward: { type: Date, required: true },
    printReceivedQty: { type: Number, required: true },
    pendingQty: { type: Number, default: 0 },
    chequeFromNo: { type: String},
    chequeToNo: { type: String},
    defectCount: { type: Number, default: 0 },
    materialDocumentNo: { type: String },
    issuer: { type: String },   // login-based, set server-side
    receiver: { type: String},
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
  
);
InwardRegisterSchema.index({ efiWoNumber: 1 });
InwardRegisterSchema.index({ dateOfInward: 1 });
InwardRegisterSchema.index({ createdAt: -1 });

module.exports = mongoose.model("InwardRegister", InwardRegisterSchema);