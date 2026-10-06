const mongoose = require("mongoose");

const productionRealSchema = new mongoose.Schema({
  workOrder: {
    type: Number, // store efiWoNumber
    required: true
  },
  customerName: { type: String },
  jobDescription: { type: String},
  jobSize: { type: String },
   materials: [
    {
      materialCode: String,
      materialDescription: String,
      materialGroupDescription: String,
      mill: String,
      gsm: String,
      paperSize:{type:String}
    }
  ],
ups: {
  type: [Number],
  default: []
},
colorFront: {
  type: Number,
  default: 0
},

colorBack: {
  type: Number,
  default: 0
},
  orderQty: { type: Number, required: true },
  machiness: [
    {
      activityId: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityMaster", required: true },
      machineId: { type: mongoose.Schema.Types.ObjectId, ref: "MachineMaster", required: true }
    }
  ],
  productionDate: { type: Date, required: true },
  productionFromTime: { type: String, required: true },
  productionToTime: { type: String, required: true },
  shift: { type: String, required: true },
  productionQty: { type: Number, required: true },
  wastageQty: { type: Number, required: true },
  wastePercent: { type: Number,required: true },
      machineStatus: {
  type: String
},
  productType: { type: String },      // ⭐ ADD THIS

productionImpression: { type: Number },
wasteImpression: { type: Number },
productionUps: { type: Number },
  pages: { type: Number },   // ⭐ ADD THIS
  quantity2: { type: Number },
  remarks: { type: String },
  enteredBy: { type: String, required: true },
  enteredById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
   userLocations: [{ type: String }],
}, { timestamps: true });

productionRealSchema.index({ productionDate: 1 });
productionRealSchema.index({ workOrder: 1 });
// ⚡ extra indexes for the date-bounded list, the "latest first" view and
// the machine / work-order lookups the page does
productionRealSchema.index({ createdAt: -1 });
productionRealSchema.index({ workOrder: 1, productionDate: 1 });
productionRealSchema.index({ "machiness.machineId": 1, productionDate: 1 });

module.exports = mongoose.model("ProductionReal", productionRealSchema);