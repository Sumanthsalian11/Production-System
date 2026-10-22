const mongoose = require("mongoose");

const ProductionMachineStatusSchema = new mongoose.Schema(
  {
    productionDate: {
      type: Date,
    },

    shift: {
      type: String,
      trim: true,
    },

    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActivityMaster",
    },

    machineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MachineMaster",
    },

    machineStatus: {
      type: String,
      trim: true,
    },

    customerName: {
      type: String,
      trim: true,
    },

    materialType: {
      type: String,
      trim: true,
      default: "",
    },

    fromTime: {
      type: String,
    },

    toTime: {
      type: String,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },
woNumber: {
  type: String,
  default: "",
},

totalPages: {
  type: Number,
  default: 0,
},

wastageSheets: {
  type: Number,
  default: 0,
},

wastePercentage: {
  type: Number,
  default: 0,
},

reason: {
  type: String,
  default: "",
},
paperSize:   { type: String, default: "" },
printerName: { type: String, default: "" },
    enteredBy: {
      type: String,
      default: "",
    },

    userLocations: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

ProductionMachineStatusSchema.index({ createdAt: -1, _id: -1 });
ProductionMachineStatusSchema.index({ productionDate: -1, createdAt: -1 });
ProductionMachineStatusSchema.index({ machineId: 1, productionDate: 1 });
ProductionMachineStatusSchema.index({ productionDate: -1, machineStatus: 1 });
ProductionMachineStatusSchema.index({ productionDate: -1, machineId: 1, printerName: 1 });
ProductionMachineStatusSchema.index({ woNumber: 1 });
ProductionMachineStatusSchema.index({ userLocations: 1 });
ProductionMachineStatusSchema.index({ customerName: 1 });
ProductionMachineStatusSchema.index({ machineStatus: 1 });
ProductionMachineStatusSchema.index({ printerName: 1 });
ProductionMachineStatusSchema.index(
  { productionDate: -1, machineStatus: 1, machineId: 1, printerName: 1, woNumber: 1, totalPages: 1, wastageSheets: 1 },
  { name: "report_cover" }
);

module.exports = mongoose.model(
  "ProductionMachineStatus",
  ProductionMachineStatusSchema
);