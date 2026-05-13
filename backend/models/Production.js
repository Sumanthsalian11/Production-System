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
    materialDescription: { type: String },
    materialGroupDescription: { type: String },
    mill: { type: String },
    gsm: { type: String },
     paperSize: { type: String, required: true },
  }
],
    ups: {
      type: Number,
      required: true,
      min: 1
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


module.exports = mongoose.model("Production", productionSchema);