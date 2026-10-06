const User = require("../models/User");
const CustomerOrder = require("../models/CustomerOrder");
const WorkOrder = require("../models/WorkOrder");
const PrintingInstruction = require("../models/Print");
const jwt = require("jsonwebtoken");
const Announcement = require("../models/Announcement");

// Helper: generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      role: user.role,
      name: user.name,
      locations: user.locations,
      modules: user.modules,        // ✅ ADD THIS
      location: user.loginLocation
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

/* ===========================
   CUSTOMER REGISTER & LOGIN
=========================== */
exports.customerRegister = async (req, res) => {
  try {
    const { name, email, password, role, locations } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser)
      return res.status(400).json({ message: "Customer already exists" });

   const user = await User.create({
  name,
  email: normalizedEmail,
  password,
  role,
  locations, // ✅ ADD THIS
  isInternal: true
});

    res.status(201).json({ message: "Customer Registered" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.customerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail, role: "CUSTOMER" });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user);
    res.json({ token, role: user.role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   INTERNAL REGISTER & LOGIN
=========================== */
exports.internalRegister = async (req, res) => {
  try {
    const { name, email, password, role, locations, modules } = req.body; // <-- include modules

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser)
      return res.status(400).json({ message: "Internal User already exists" });

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
      isInternal: true,
      locations: locations || [],
      modules: role === "ADMIN" ? [] : (modules || []) // Admin always full access
    });

    res.status(201).json({ message: "Internal User Registered" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.internalLogin = async (req, res) => {
  try {
   const { email, password, role, location } = req.body;

    const identifier = email.toLowerCase().trim();

    // 🔥 ENV ADMIN LOGIN (only email)
    if (
      identifier === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
     const token = jwt.sign(
  {
    role: process.env.ADMIN_ROLE,
    name: "Admin",
    locations: [],
    modules: []   // env admin always sees everything (frontend bypasses filter for admin)
  },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);

      return res.json({
        token,
        role: process.env.ADMIN_ROLE
      });
    }

    // 🔥 LOGIN WITH EMAIL OR NAME
    const user = await User.findOne({
      isInternal: true,
      $or: [
        { email: identifier },
        { name: { $regex: new RegExp(`^${identifier}$`, "i") } }
      ]
    });

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    // ✅ validate location
if (location && !user.locations.includes(location)) {
  return res.status(400).json({ message: "Invalid user location" });
}

// ✅ store login location
// ✅ AUTO ASSIGN LOGIN LOCATION
user.loginLocation =
  location || user.locations?.[0] || "";

await user.save();

    if (role && user.role !== role) {
      return res.status(400).json({ message: "Invalid role for this user" });
    }

    const token = generateToken(user);
    res.json({ token, role: user.role });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   GET LOGGED-IN INTERNAL USER
=========================== */
exports.getMe = async (req, res) => {
  try {
    if (!req.user.id) {
      return res.json({
        name: req.user.name,
        role: req.user.role
      });
    }

    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   GET ALL INTERNAL USERS
=========================== */
exports.getAllInternalUsers = async (req, res) => {
  try {
  const users = await User.find({ isInternal: true })
  .select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   DELETE USER
=========================== */
exports.deleteInternalUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // ❌ Prevent deleting ENV ADMIN
    if (!userId) {
      return res.status(400).json({ message: "Invalid user" });
    }

    await User.findByIdAndDelete(userId);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!req.user.id && !req.user._id) {
      return res.status(400).json({ message: "Admin password cannot be changed here" });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });

    if (newPassword.length < 12) {
      return res.status(400).json({ message: "New password must be at least 12 characters" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   UPDATE USER (ROLE + PASSWORD)
=========================== */
exports.updateInternalUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, role, password, locations, modules } = req.body; // ✅ include modules

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (role) user.role = role;

    // 🔹 Update locations if provided
    if (locations && Array.isArray(locations)) {
      user.locations = locations;
    }

    // 🔹 Update modules if provided (empty array = full role access)
    // Admin is always full access — force-clear any restriction attempt
    if (user.role === "ADMIN") {
      user.modules = [];
    } else if (modules && Array.isArray(modules)) {
      user.modules = modules;
    }

    // 🔹 Password reset
    if (password && password.trim() !== "") {
      user.password = password;
    }

   await user.save();

// 🔥 ADD THIS HERE (VERY IMPORTANT)
await CustomerOrder.updateMany(
  { user: user.name },
  { userLocations: user.locations }
);

await WorkOrder.updateMany(
  { planningUser: user.name },
  { userLocations: user.locations }
);
await PrintingInstruction.updateMany(
  { user: user.name },
  { userLocations: user.locations }
);

    res.json({ message: "User updated successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   DASHBOARD COMMENT (ANNOUNCEMENT)
=========================== */
exports.setAnnouncement = async (req, res) => {
  try {
    const { text } = req.body;
    await Announcement.deleteMany({});
    if (!text || !text.trim()) return res.json({ message: "Announcement cleared" });
    const announcement = await Announcement.create({ text: text.trim() });
    res.json(announcement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findOne().sort({ createdAt: -1 });
    res.json(announcement || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    await Announcement.deleteMany({});
    res.json({ message: "Announcement deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};