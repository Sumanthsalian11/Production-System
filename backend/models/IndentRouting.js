const mongoose = require("mongoose");

const indentRoutingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    userName: { type: String, default: "" },
    locations: [{ type: mongoose.Schema.Types.ObjectId, ref: "LocationMaster" }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("IndentRouting", indentRoutingSchema);