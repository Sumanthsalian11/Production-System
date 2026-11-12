const mongoose = require("mongoose");
const dispatchSchema = new mongoose.Schema({

  efiWoNumber: {
    type: Number,
    required: function () { return !this.ticketNo; }
  },
  ticketNo: {
    type: String,
    trim: true,
    index: true
  },
    purchaseOrderNo: {        // ⭐ ADD THIS
    type: String
  },
splitLocation: { type: String, default: "" },
  poDate: {        // ⭐ ADD THIS
  type: String
},
  // 🔥 Snapshot Data
  customer: {
    type: String,
    required: true
  },

  productName: {
    type: String,
    required: true
  },

  totalQty: {
    type: Number,
    required: true
  },

  balanceQty: {
    type: Number,
    required: true
  },
  extraQty: {
  type: Number,
 required:true
},
  invoiceNo: {
  type: String
},

invoiceDate: {
  type: String
},

  // 🔹 NEW FIELD
  expectedDeliveryDate: {
    type: String
  },

  dispatchDate: {
    type: String,
    required: true
  },

  dispatchQty: {
    type: Number,
    required: true
  },

  // 🔹 NEW FIELD
delayDays: {
  type: Number
},

delayLabel: {
  type: String
},

  courier: String,
  trackingNumber: String,
  location: {
  type: String   // storing location ID
},
  deliveryAddress: String,
  remarks: String,

  enteredBy: {
    type: String,
    required: true
  },
  userLocations: [{ type: String }],
  productType: { type: String, default: "" },
  noOfPackets: { type: Number, default: 0 },
  noOfBoxes: { type: Number, default: 0 },
  attachment: { type: String, default: "" },
  attachmentName: { type: String, default: "" }

}, { timestamps: true });

module.exports = mongoose.model("Dispatch", dispatchSchema);