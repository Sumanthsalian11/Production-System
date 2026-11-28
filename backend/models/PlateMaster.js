const mongoose = require("mongoose");

const plateMasterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlateMaster", plateMasterSchema);