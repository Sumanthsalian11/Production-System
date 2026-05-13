const mongoose = require("mongoose");

const printingInstructionSchema = new mongoose.Schema({
ticketId: {
  type: String,
  unique: true,
  sparse: true
},
  purchaseOrderNo: String,
  poDate: Date,
  expectedDeliveryDate: Date,
 productCode: {
      type: Number,
      required: true
    },
    workorder2: {
  type: String
},
branchCode: {
  type: String,
  default: ""
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

materialCode: {
  type: String
},

materialDescription: String,
materialGsm: String,
materialMill: String,
paperSize: String,
  quantity: {
    type: Number,
    required: true
  },

  location: {
    type: String   // ✅ since you said string, keeping same
  },

  prefix: String,

accountNumber: {
  type: String
},

innerPackingType: String,
  leavesPerInner: Number,
  innerPack: Number,
  outerPack: Number,
  innerPerOuter: Number,

nonMicrDigits: {
  type: String
},

  orderType: {
    type: String,
    required: true
  },
  deliveryDate: Date,

freightChargeType: String,
modeOfTransport: String,
freightType: String,

address: String,
specialInstruction: String,
planningInstruction: String,

quotationRefNo: String,

purchaseOrderNo: String,
poDate: Date,

ratePerUnit: Number,
totalBillableAmount: Number,
  remarks: {
    type: String,
    default: ""
  },
  accountCode: String,

sortCode: String,   // MICR / Sort Code

transactionCode: String,

billSend: String,

kam: String,

kamBranch: String,

paymentTerms: String,

advancePayment: {
  type: String,
  default: ""
},

taxType: {
  type: String,
  default: ""
},

billingType: {
  type: String,
  default: ""
},
chequeFrom: {
  type: String,
  default: ""
},

chequeTo: {
  type: String,
  default: ""
},

  user: String,
remainingQty: {
  type: Number,
  default: 0
},
numberingRemarks: String,
packingRemarks: String,
dispatchRemarks: String,
billingRemarks: String,
instructionRemarks: String,


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
    },

}, { timestamps: true });

module.exports = mongoose.model("PrintingInstruction", printingInstructionSchema);