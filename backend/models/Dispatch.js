const mongoose = require("mongoose");
const dispatchSchema = new mongoose.Schema({

  efiWoNumber: {
    type: Number,
    required: true
  },
    purchaseOrderNo: {        // ⭐ ADD THIS
    type: String
  },

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
  userLocations: [{ type: String }]

}, { timestamps: true });

module.exports = mongoose.model("Dispatch", dispatchSchema);