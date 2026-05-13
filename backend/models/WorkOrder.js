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
purchaseOrderNo: {
  type: String,
},

  poDate: {        // ⭐ ADD THIS
  type: Date
},

    productName: { type: String, required: true },
    productCode: {
  type: String,
  default: ""
},
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
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: "MachineMaster", required: true }
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
    

    UPS: { type: Number, required: true },
    impFront: { type: Number, required: true },
    impBack: { type: Number, required: true },
    totalImp: { type: Number, required: true },

    remarks: { type: String},

    planningUser: {
      type: String,
      required: true,
    },
userLocations: [
  {
    type: String,
    trim: true
  }
],
printingId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "PrintingInstruction"
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