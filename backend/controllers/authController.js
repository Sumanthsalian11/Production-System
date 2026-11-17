const User = require("../models/User");
const CustomerOrder = require("../models/CustomerOrder");
const WorkOrder = require("../models/WorkOrder");
const PrintingInstruction = require("../models/Print");
const jwt = require("jsonwebtoken");
const Session = require("../models/Session");
const { TOKEN_TTL } = require("../utils/sessionConfig");
const Announcement = require("../models/Announcement");
const { verifyLDAPUser } = require("../utils/ldapAuth");

// Helper: generate JWT token
const generateToken = async (user, req) => {
  const session = await Session.create({
    userId: user._id,
    name: user.name,
    ip: req?.ip || "",
    userAgent: req?.headers?.["user-agent"] || ""
  });
  return jwt.sign(
    { 
      id: user._id, 
      role: user.role,
      name: user.name,
      locations: user.locations,
      modules: user.modules,
      location: user.loginLocation,
      sid: String(session._id)
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
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

    const token = await generateToken(user, req);
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
    const { name, email, password, role, locations, modules, authType, ldapUsername } = req.body; // <-- include modules

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser)
      return res.status(400).json({ message: "Internal User already exists" });

    const isLdap = authType === "ldap";

    const user = await User.create({
      name,
      email: normalizedEmail,
      ...(isLdap ? {} : { password }),
      authType: isLdap ? "ldap" : "local",
      ldapUsername: isLdap ? String(ldapUsername || "").trim() : "",
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

    // ENV admin login (email only)
    if (
      identifier === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const adminSession = await Session.create({
        userId: null,
        name: "Admin",
        ip: req.ip || "",
        userAgent: req.headers["user-agent"] || ""
      });
      const token = jwt.sign(
        {
          role: process.env.ADMIN_ROLE,
          name: "Admin",
          locations: [],
          modules: [],
          sid: String(adminSession._id),
        },
        process.env.JWT_SECRET,
        { expiresIn: TOKEN_TTL }
      );

      return res.json({
        token,
        role: process.env.ADMIN_ROLE,
      });
    }

    // Login with email or name
    const user = await User.findOne({
      isInternal: true,
      $or: [
        { email: identifier },
        { name: { $regex: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
        {
          ldapUsername: {
            $regex: new RegExp(
              `^${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
              "i"
            ),
          },
        },
      ],
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials", debug: `No user found for "${identifier}"` });
    }

    // ---- Lockout check (non-admin only) ----
    if (user.role !== "ADMIN" && user.lockUntil && user.lockUntil > new Date()) {
      return res.status(423).json({
        message: "Account locked due to too many failed attempts. Contact an administrator to unlock sooner.",
        remainingSeconds: Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000),
      });
    }

    let isMatch = false;
    let debug = "";

    if (user.authType === "ldap") {
      try {
        await verifyLDAPUser(user.ldapUsername || user.email, password);
        isMatch = true;
      } catch (ldapErr) {
        debug = `LDAP bind as "${user.ldapUsername || user.email}" → ${ldapErr.name}: ${ldapErr.message}`;
        if (ldapErr.name !== "InvalidCredentialsError") {
          console.error("LDAP authentication error:", ldapErr.message);
          return res.status(503).json({
            message:
              "Domain server is not reachable. Please try again or contact your administrator.",
            debug,
          });
        }
      }
    } else {
      isMatch = await user.comparePassword(password); // Local users: unchanged
    }

    if (!isMatch) {
      if (user.role !== "ADMIN") {
        const MAX_ATTEMPTS = 5;
        const attempts = (user.failedLoginAttempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await User.updateOne(
            { _id: user._id },
            { $set: { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + 30 * 60 * 1000) } }
          );
          return res.status(423).json({
            message: "Too many failed attempts. Account locked. Contact an administrator to unlock sooner.",
            remainingSeconds: 30 * 60,
          });
        }
        await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: attempts } });
        return res.status(400).json({
          message: `Invalid credentials. ${MAX_ATTEMPTS - attempts} attempt(s) left before the account is locked.`,
          debug: debug || `Local password mismatch (authType: ${user.authType})`,
        });
      }
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (role && user.role !== role) {
      return res.status(400).json({ message: "Invalid role for this user" });
    }

    // Validate location
    if (location && !user.locations.includes(location)) {
      return res.status(400).json({ message: "Invalid user location" });
    }

    // Store login location, or use the user's first location
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.loginLocation = location || user.locations?.[0] || "";
    await user.save();

    const token = await generateToken(user, req);
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
    await Session.updateMany(
      { userId, revoked: false },
      { revoked: true, revokedReason: "user-deleted" }
    );

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

    if (user.authType === "ldap") {
      return res.status(400).json({ message: "Domain users must change their password in Windows/domain, not here" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });

    if (newPassword.length < 12) {
      return res.status(400).json({ message: "New password must be at least 12 characters" });
    }

    user.password = newPassword;
    await user.save();
    await Session.updateMany(
      { userId: user._id, revoked: false, _id: { $ne: req.sid } },
      { revoked: true, revokedReason: "password-changed" }
    );

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
    const { name, role, password, locations, modules, authType, ldapUsername } = req.body; // ✅ include modules

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

    // 🔹 Login type (local / ldap)
    if (authType === "ldap" || authType === "local") user.authType = authType;
    if (typeof ldapUsername === "string") user.ldapUsername = ldapUsername.trim();

    // 🔹 Password reset (local users only)
    if (user.authType !== "ldap" && password && password.trim() !== "") {
      user.password = password;
    }

    if (user.authType !== "ldap" && !user.password) {
      return res.status(400).json({ message: "Set a password to switch this user to local login" });
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

    await Session.updateMany(
      { userId: user._id, revoked: false, _id: { $ne: req.sid } },
      { revoked: true, revokedReason: "user-updated" }
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

exports.logout = async (req, res) => {
  try {
    if (req.sid) {
      await Session.updateOne({ _id: req.sid }, { revoked: true, revokedReason: "logout" });
    }
    res.json({ message: "Logged out" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: force-logout every active session of one user
exports.revokeUserSessions = async (req, res) => {
  try {
    if (String(req.user.role || "").toUpperCase() !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const r = await Session.updateMany(
      { userId: req.params.id, revoked: false },
      { revoked: true, revokedReason: "admin-revoked" }
    );
    res.json({ message: "Sessions revoked", count: r.modifiedCount });
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
// Admin: unlock a locked user account
exports.unlockUser = async (req, res) => {
  try {
    if (String(req.user.role || "").toUpperCase() !== "ADMIN") {
      return res.status(403).json({ message: "Admin access required" });
    }
    await User.updateOne(
      { _id: req.params.id },
      { $set: { failedLoginAttempts: 0, lockUntil: null } }
    );
    res.json({ message: "User unlocked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};