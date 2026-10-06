const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WorkOrder"
  },
  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MachineMaster"
  },

  // NEW — needed to identify exactly which Activity/Machine row (out of
  // the Work Order's machines[] array) this schedule belongs to. Without
  // this, every schedule saved with rowIndex silently drops it (Mongoose
  // strict mode), so row-level pending/duplicate matching breaks.
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ActivityMaster"
  },
  rowIndex: {
    type: Number,
    default: null
  },
  inches: String,
  slitNumber: String,
  isBooklet: { type: Boolean, default: false },
  pages: Number,
  component: String,

  totalImpression: Number,
  machineCapacity: Number,

  startTime: Date,
  endTime: Date,
  scheduleDate: Date,
  customer: String,
  schedulerHidden: {
    type: Boolean,
    default: false
  },
  priority: String,
  location: String,

  isBlocked: { type: Boolean, default: false },
  blockReason: String,
  userLocations: [
    {
      type: String,
      trim: true
    }
  ],

  // ================= Full Work Order snapshot =================
  efiWoNumber: Number,
  slNo: Number,
  productCode: String,
  productName: String,
  productType: String,
  qtyInLvs: Number,

  colorFront: Number,
  colorBack: Number,

  orderQty: Number,
  wasteQty: Number,
  totalQty: Number,
  jobSize: String,
  UPS: Number,

  impFront: Number,
  impBack: Number,
  totalImp: Number,

  inkDetails: String,
  remarks: String,

  planningUser: String,

  materials: [
    {
      materialCode: String,
      materialDescription: String,
      materialGroupDescription: String,
      mill: String,
      gsm: String,
      paperSize: String,
      paperQty: Number
    }
  ],

  machinesDetail: [
    {
      activityId: { type: mongoose.Schema.Types.ObjectId, ref: "ActivityMaster" },
      machineId: { type: mongoose.Schema.Types.ObjectId, ref: "MachineMaster" },
      inches: String,
      slitNumber: String
    }
  ]
  // ===============================================================

}, { timestamps: true });
scheduleSchema.index({ machineId: 1, endTime: 1, startTime: 1 }); // next free slot + drag conflict check
scheduleSchema.index({ workOrderId: 1, rowIndex: 1 });            // per-Work-Order lookups
scheduleSchema.index({ isBlocked: 1, machineId: 1 });             // blocked-slot lookups
scheduleSchema.index({ startTime: 1 });

module.exports = mongoose.model("Schedule", scheduleSchema);