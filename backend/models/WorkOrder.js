const mongoose = require("mongoose");

const workOrderSchema = new mongoose.Schema(
  {
    slNo: { type: Number, required: true },
    efiWoNumber: { type: Number, required: true, unique: true },
    workorder2: { type: String },

    priority: { type: String, required: true },

    customer: { type: String, required: true },
    customerOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerOrder",
      default: null
    },
    purchaseOrderNo: { type: String },
    productCode: { type: Number },

    poDate: { type: Date },

    productName: { type: String, required: true },
    location: { type: String, required: true },

    woDate: { type: Date, required: true, default: Date.now },
    expectedDeliveryDate: { type: Date },

    qtyInLvs: { type: Number, required: true },

    machines: [
      {
        activityId: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityMaster", required: true },
        machineId: { type: mongoose.Schema.Types.ObjectId, ref: "MachineMaster", required: true },
        inches: { type: String },
        slitNumber: { type: String },
        UPS: { type: Number },
        isBooklet: { type: Boolean, default: false },
        isPerfecting: { type: Boolean, default: false },
        pages: { type: Number, default: 0 },
        component: { type: String, default: "" },
        impFront: { type: Number },
        impBack: { type: Number },
        totalImp: { type: Number }
      }
    ],

    activity2: [
      { type: mongoose.Schema.Types.ObjectId, ref: "ActivityMaster" }
    ],

    colorFront: { type: Number, required: true },
    colorBack: { type: Number, required: true },
    inkDetails: { type: String, required: true },

    materials: [
      {
        materialCode: { type: String },
        materialDescription: { type: String },
        materialGroupDescription: { type: String },
        mill: { type: String },
        gsm: { type: String },
        paperSize: { type: String, required: true },
        paperQty: { type: Number, required: true },
        rowIndex: { type: Number }
      }
    ],

    orderQty: { type: Number, required: true },
    wasteQty: { type: Number, required: true },
    totalQty: { type: Number, required: true },

    jobSize: { type: String, required: true },

    productType: { type: String },

    remarks: { type: String },

    planningUser: { type: String, required: true },
    dispatchLocation: { type: String },
    boxQty: { type: Number },

    userLocations: [{ type: String, trim: true }],
    schedulerHidden: { type: Boolean, default: false },
    printingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PrintingInstruction"
    },
    sentToPrepress: { type: Boolean, default: false },
    itemPdfPath: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Order Received", "PLANNED", "IN PRODUCTION", "COMPLETED"],
      required: true,
      default: "Order Received"
    }
  },
  { timestamps: true }
);

// ===== INDEXES (read/query speed only — no data change) =====
workOrderSchema.index({ status: 1, createdAt: -1 });
workOrderSchema.index({ status: 1, customer: 1, createdAt: -1 });
workOrderSchema.index({ status: 1, userLocations: 1, createdAt: -1 });
workOrderSchema.index({ status: 1, "machines.machineId": 1, createdAt: -1 });
workOrderSchema.index({ status: 1, productCode: 1 });
workOrderSchema.index({ createdAt: -1 });
workOrderSchema.index({ customerOrderId: 1 });
workOrderSchema.index({ printingId: 1 });
workOrderSchema.index({ slNo: -1 });

module.exports = mongoose.model("WorkOrder", workOrderSchema);