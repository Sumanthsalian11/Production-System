const mongoose = require("mongoose");

const chatProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    about: { type: String, default: "Hey there! I am using MPI Chat.", maxlength: 140 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatProfile", chatProfileSchema);