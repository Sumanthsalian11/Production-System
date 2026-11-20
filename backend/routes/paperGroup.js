const express = require("express");
const router = express.Router();
const PaperGroup = require("../models/PaperGroup");
const authMiddleware = require("../middleware/authMiddleware");

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cleanGsms = (arr) =>
  [...new Set((Array.isArray(arr) ? arr : []).map((g) => String(g).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

router.get("/", authMiddleware, async (req, res) => {
  try {
    const list = await PaperGroup.find().lean();
    list.sort((a, b) => a.group.localeCompare(b.group, undefined, { numeric: true, sensitivity: "base" }));
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: "Error fetching paper groups" });
  }
});

// add (if the group already exists, the new GSMs are merged into it)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const group = String(req.body.group || "").trim();
    const gsms = cleanGsms(req.body.gsms);
    if (!group) return res.status(400).json({ message: "Group is required" });
    if (!gsms.length) return res.status(400).json({ message: "Enter at least one GSM" });

    const cur = await PaperGroup.findOne({ group: new RegExp("^" + escapeRx(group) + "$", "i") });
    if (cur) {
      cur.gsms = cleanGsms([...cur.gsms, ...gsms]);
      await cur.save();
      return res.status(200).json(cur);
    }
    const doc = await PaperGroup.create({ group, gsms });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: "Error saving paper group" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const group = String(req.body.group || "").trim();
    const gsms = cleanGsms(req.body.gsms);
    if (!group) return res.status(400).json({ message: "Group is required" });
    if (!gsms.length) return res.status(400).json({ message: "Enter at least one GSM" });

    const dup = await PaperGroup.findOne({
      _id: { $ne: req.params.id },
      group: new RegExp("^" + escapeRx(group) + "$", "i")
    });
    if (dup) return res.status(400).json({ message: "Group already exists" });

    const doc = await PaperGroup.findByIdAndUpdate(req.params.id, { group, gsms }, { new: true });
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.status(200).json(doc);
  } catch (err) {
    res.status(500).json({ message: "Error updating paper group" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await PaperGroup.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting paper group" });
  }
});

module.exports = router;