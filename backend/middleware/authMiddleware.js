const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");
const { TOKEN_TTL, IDLE_TIMEOUT_MS, MAX_SESSION_MS } = require("../utils/sessionConfig");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      console.error("AUTH FAILED: no token |", req.method, req.originalUrl);
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ===== SESSION CHECK: revocation, 15-min idle, 8-hour maximum =====
    if (!decoded.sid || !/^[a-f\d]{24}$/i.test(String(decoded.sid))) {
      return res.status(401).json({ message: "Session invalid, please log in again" });
    }

    const session = await Session.findById(decoded.sid);
    const now = Date.now();

    if (!session || session.revoked) {
      return res.status(401).json({ message: "Session ended, please log in again" });
    }
    if (now - session.createdAt.getTime() > MAX_SESSION_MS) {
      await Session.updateOne({ _id: session._id }, { revoked: true, revokedReason: "max-age" });
      return res.status(401).json({ message: "Session expired (8 hour limit), please log in again" });
    }
    if (now - session.lastActivity.getTime() > IDLE_TIMEOUT_MS) {
      await Session.updateOne({ _id: session._id }, { revoked: true, revokedReason: "idle" });
      return res.status(401).json({ message: "Logged out due to inactivity" });
    }

    req.sid = String(session._id);

    // background polling must not keep the session alive
    if (req.header("X-Background") !== "1") {
      if (now - session.lastActivity.getTime() > 30000) {
        await Session.updateOne({ _id: session._id }, { lastActivity: new Date(now) });
      }

      // sliding refresh: new 30-minute token when under 10 minutes remain
      const secondsLeft = (decoded.exp || 0) - Math.floor(now / 1000);
      if (secondsLeft < 600) {
        const { iat, exp, ...payload } = decoded;
        const fresh = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
        res.set("X-Refreshed-Token", fresh);
        res.set("Access-Control-Expose-Headers", "X-Refreshed-Token");
      }
    }

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