const auth = require("../middleware/authMiddleware"); // <- replace with the exact import used in masterRoutes.js
const express = require("express");
const router = express.Router();
const Role = require("../models/Role");

router.get("/", auth, async (req, res) => {
  res.json(await Role.find().sort("name"));
});

router.post("/", auth, async (req, res) => {
  try {
    const role = await Role.create({ name: req.body.name, modules: req.body.modules || [] });
    res.json(role);
  } catch (e) {
    res.status(400).json({ message: e.code === 11000 ? "Role already exists" : e.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  const role = await Role.findByIdAndUpdate(
    req.params.id,
    { modules: req.body.modules || [] },
    { new: true }
  );
  res.json(role);
});

router.delete("/:id", auth, async (req, res) => {
  await Role.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;