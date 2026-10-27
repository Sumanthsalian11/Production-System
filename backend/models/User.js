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
      required: function () {
        return this.authType !== "ldap"; // domain users have no local password
      },
      minlength: 12,
    },

    role: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
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

    // "local" = password stored here (existing behaviour), "ldap" = verified against domain
    authType: {
      type: String,
      enum: ["local", "ldap"],
      default: "local",
    },

    // optional domain username; if empty the user's email is used for the bind
    ldapUsername: {
      type: String,
      trim: true,
      default: "",
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
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);