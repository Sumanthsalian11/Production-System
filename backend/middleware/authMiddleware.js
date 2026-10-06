const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      console.error("AUTH FAILED: no token |", req.method, req.originalUrl);
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 HANDLE ENV ADMIN (token without id)
    if (!decoded.id) {
      req.user = {
        role: decoded.role,
        name: decoded.name || "Admin"
      };
      return next();
    }

    // 🔥 EXISTING FLOW (UNCHANGED)
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // ✅ Attach full user object
    req.user = user;

    next();
  } catch (error) {
    console.error("AUTH FAILED:", req.method, req.originalUrl, "|", error.name, "-", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired, please log in again" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: `Token is not valid (${error.message})` });
    }
    res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = authMiddleware;