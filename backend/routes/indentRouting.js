const express = require("express");
const router = express.Router();
const IndentRouting = require("../models/IndentRouting");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// TODO role check: allow only admins on these routes (same way your other admin routes do it)

// all rules
router.get("/", authMiddleware, async (req, res) => {
  try {
    const rules = await IndentRouting.find().sort({ userName: 1 }).lean();
    res.status(200).json(rules);
  } catch (err) {
    res.status(500).json({ message: "Error fetching indent routing" });
  }
});

// users for the dropdown
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("name email").sort({ name: 1 }).lean();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// create / update the rule of one user
router.put("/:userId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("name");
    if (!user) return res.status(404).json({ message: "User not found" });

    const locations = Array.isArray(req.body.locations) ? req.body.locations : [];
    const rule = await IndentRouting.findOneAndUpdate(
      { user: user._id },
      { user: user._id, userName: user.name, locations },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(rule);
  } catch (err) {
    console.error("INDENT ROUTING SAVE ERROR:", err);
    res.status(500).json({ message: "Error saving indent routing" });
  }
});

// remove the rule (user goes back to seeing all locations)
router.delete("/:userId", authMiddleware, async (req, res) => {
  try {
    await IndentRouting.deleteOne({ user: req.params.userId });
    res.status(200).json({ message: "Rule removed" });
  } catch (err) {
    res.status(500).json({ message: "Error removing rule" });
  }
});

module.exports = router;