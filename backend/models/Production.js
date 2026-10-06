const mongoose = require("mongoose");

const productionSchema = new mongoose.Schema(
  {
    efiWoNumber: {
      type: Number,
      required: [true, "EFI WO Number is required"]
    },

    date: {
      type: Date,
      required: [true, "Work order date is required"]
    },

    productionDate: {
      type: Date,
      required:[true,"Production date is required"]
    },

    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true
    },

    jobDescription: {
      type: String,
      required: [true, "Job description is required"]
    },

    jobSize: {
      type: String,
      required: true
    },

  
   materials: [
  {
    materialCode: { type: String },
    materialDescription: { type: String,default: "" },
    materialGroupDescription: { type: String },
    mill: { type: String },
    gsm: { type: String },
     paperSize: { type: String, required: true },
  }
],
   ups: {
  type: [Number],
  default: []
},
    reelNo: {
      type: String,
      required: [true, "Reel number is required"]
    },

    grossWeight: {
      type: Number,
      min: 0
    },

    millNetWeight: {
      type: Number,
      min: 0
    },

    actualNetWeight: {
      type: Number,
      required: true,
      min: 0
    },

    actualGsm: {
      type: Number,
      required: true
    },

    productionOutput: {
      type: Number,
      required: true,
      min: 0
    },

    mattWaste: {
      type: Number,
      default: 0,
      min: 0
    },

    printWaste: {
      type: Number,
      default: 0,
      min: 0
    },

    realEndWaste: {
      type: Number,
      default: 0,
      min: 0
    },

    coreWeight: {
      type: Number,
      default: 0,
      min: 0
    },

    totalWaste: {
      type: Number,
      default: 0
    },

    balance: {
      type: Number,
      default: 0
    },
    
    mill: {
  type: String,
  required: [true, "Mill is required"]
},
productionType: {
  type: String,
  enum: ["Make Ready", "Production"],
  required: true
},
userLocations: [
  {
    type: String,
    trim: true
  }
],
productionUser: String,

    wastePercent: {
      type: Number,
      default: 0
    },
    remarks: {
  type: String,
  default: ""
},
  },
  
  { timestamps: true }
);

// ============================================================================
// INDEXES (speed for millions of records - no change to any data or behaviour)
// Mongoose creates them automatically when the backend starts.
// ============================================================================

// Summary + Wastage reports: newest first / latest 30 / paging
productionSchema.index({ productionDate: -1, createdAt: -1, _id: -1 });

// Report filters (equality filter + newest first)
productionSchema.index({ customerName: 1, productionDate: -1 });
productionSchema.index({ productionType: 1, productionDate: -1 });
productionSchema.index({ userLocations: 1, productionDate: -1 });
productionSchema.index({ mill: 1, productionDate: -1 });
productionSchema.index({ "materials.materialGroupDescription": 1 });
productionSchema.index({ "materials.gsm": 1 });

// Reel Register page: reels of a work order, and the last entry of a reel
productionSchema.index({ efiWoNumber: 1, createdAt: 1 });
productionSchema.index({ reelNo: 1, createdAt: -1 });

module.exports = mongoose.model("Production", productionSchema);