const mongoose = require("mongoose");

const customerOrderSchema = new mongoose.Schema(
  {
    purchaseOrderNo: {
      type: String,
      required: false
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
    itemPdfPath: {
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
    indentNo: {
      type: String,
      default: ""
    },

    source: {
      type: String,
      enum: ["newIndent", "purchaseOrder"],
      default: "purchaseOrder"
    },
    status: {
      type: String,
      enum: [
        "NEW_INDENT",
        "ORDER_RECEIVED",
        "PLANNED",
        "IN_PRODUCTION",
        "QUALITY_CHECK",
        "DISPATCHED",
        "DELIVERED"
      ],
      default: "NEW_INDENT"
    }
  },
  { timestamps: true }
);

customerOrderSchema.index({ createdAt: -1 });
customerOrderSchema.index({ orderType: 1, createdAt: -1 }); // ticket number generation
customerOrderSchema.index({ productCode: 1, createdAt: -1 });
customerOrderSchema.index({ customerName: 1, createdAt: -1 });
customerOrderSchema.index({ poDate: 1, createdAt: -1 });
customerOrderSchema.index({ location: 1 }); 
customerOrderSchema.index(
  { purchaseOrderNo: 1 },
  {
    unique: true,
    partialFilterExpression: {
      purchaseOrderNo: { $exists: true, $ne: null, $ne: "" }
    }
  }
);

module.exports = mongoose.model("CustomerOrder", customerOrderSchema);