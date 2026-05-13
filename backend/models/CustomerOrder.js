const mongoose = require("mongoose");

const customerOrderSchema = new mongoose.Schema(
  {
   purchaseOrderNo: {
  type: Number,
  required: false,
  sparse: true
},

poDate: {
  type: Date,
  required: false
},

expectedDeliveryDate: {
  type: Date,
  required: false
},
    productCode: {
      type: Number,
      required: true
    },

    materialType: String,
    description: String,
    customerName: String,

    // ✅ NEW FIELDS FROM ITEM MASTER
    colorFront: {
      type: String,
      default: ""
    },

    colorBack: {
      type: String,
      default: ""
    },

    wasteQty: {
      type: Number,
      default: 0
    },

    jobSize: {
      type: String,
      default: ""
    },

    inkDetails: {
      type: String,
      default: ""
    },

    quantity: {
      type: Number,
      required: true
    },

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LocationMaster",
      required: true
    },

    orderType: {
      type: String,
      enum: ["Inhouse", "Out Source", "PMS"]
    },

    remarks: {
      type: String,
      default: ""
    },
    remarks2: {
  type: String,
  default: ""
},
ticketNo: {
  type: String,
  default: ""
},
attachment: {
  type: String,
  default: ""
},
    user: {
      type: String,
      default: ""
    },

    userLocations: [
  {
    type: String,
    trim: true
  }
],

    status: {
      type: String,
      enum: [
        "ORDER_RECEIVED",
        "PLANNED",
        "IN_PRODUCTION",
        "QUALITY_CHECK",
        "DISPATCHED",
        "DELIVERED"
      ],
      default: "ORDER_RECEIVED"
    }
  },

  { timestamps: true }
);

module.exports = mongoose.model("CustomerOrder", customerOrderSchema);