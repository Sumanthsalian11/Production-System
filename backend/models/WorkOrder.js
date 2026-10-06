const mongoose = require("mongoose");

const workOrderSchema = new mongoose.Schema(
  {
    slNo: { type: Number, required: true },
    efiWoNumber: { type: Number, required: true, unique :true},
    workorder2: {
  type: String
},

    priority: {
      type: String,
      required: true,
    },

    customer: {
      type: String,
      required: true,
    },
customerOrderId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "CustomerOrder",
  default: null
},
purchaseOrderNo: {
  type: String,
},
 productCode: {
      type: Number},

  poDate: {        // ⭐ ADD THIS
  type: Date
},

    productName: { type: String, required: true },
  location: { type: String, required: true },


    woDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expectedDeliveryDate: {
  type: Date
},

    qtyInLvs: { type: Number, required: true },

   // activities: [
 // {
  //  activityId: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityMaster" },

 // }
//],

machines: [
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityMaster", required: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: "MachineMaster", required: true },
    inches: { type: String },
    slitNumber: { type: String },
    UPS: { type: Number },
    // ⭐ Booklet now applies per Activity/Machine row instead of the whole Work Order
    isBooklet: { type: Boolean, default: false },
    isPerfecting: { type: Boolean, default: false },
    pages: { type: Number, default: 0 },
    component: { type: String, default: "" },
    impFront: { type: Number },
    impBack: { type: Number },
    totalImp: { type: Number }
  }
],

// ⭐ NEW — Activity 2 (additional activities, multi-select checkboxes)
activity2: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ActivityMaster"
  }
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
    paperQty:{type:Number, required:true},
  }
],
      
    orderQty: { type: Number, required: true },
    wasteQty: { type: Number, required: true },
    totalQty: { type: Number, required: true },

    jobSize: { type: String, required: true },
    
    productType: {           // ⭐ ADD THIS
      type: String
    },
    // inches: { type: String },       // ⭐ ADD - for Offset
    // slitNumber: { type: String },   // ⭐ ADD - for Sheetfed

    remarks: { type: String},

    planningUser: {
      type: String,
      required: true,
    },
    dispatchLocation: { type: String },
boxQty: { type: Number },


// component: { type: String, default: "" },
userLocations: [
  {
    type: String,
    trim: true
  }
],
schedulerHidden: {
  type: Boolean,
  default: false
},
printingId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "PrintingInstruction"
},
sentToPrepress: {
  type: Boolean,
  default: false
},
itemPdfPath: {
  type: String,
  default: ""
},
    status: {
      type: String,
      enum: ["Order Received", "PLANNED", "IN PRODUCTION", "COMPLETED"],
      required: true,
      default: "Order Received",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkOrder", workOrderSchema);