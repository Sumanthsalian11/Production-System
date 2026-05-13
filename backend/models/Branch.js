// ============================
// models/Branch.js
// ============================

const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    branchCode: {
      type: String,
      
    },

    dispatchAddress: {
      type: String,
    
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Branch", branchSchema);