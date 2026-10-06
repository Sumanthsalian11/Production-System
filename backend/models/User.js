const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 12,
    },

    role: {
      type: String,
      enum: ["PURCHASE ORDER", "ADMIN","INDENTER", "PLANNER", "SUPERVISOR", "PRODUCTION","DISPATCH","KAS","SCANNER","PREPRESS","QUALITY CONTROL"],
    },

    // ✅ STORE AS STRING
    locations: [
      {
        type: String,
        trim: true
      }
    ],

    // ✅ Per-user module restriction (paths like "/planner", "/scheduler")
    modules: [
      {
        type: String,
        trim: true
      }
    ],

    isInternal: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 🔹 Hash password
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// 🔹 Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);