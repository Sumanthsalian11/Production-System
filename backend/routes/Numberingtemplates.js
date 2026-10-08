const express = require("express");
const router = express.Router();
const NumberingTemplate = require("../models/Numberingtemplate");

const MAX_ART = 15 * 1024 * 1024; // MongoDB documents are limited to 16 MB

/* GET /api/numbering-templates -> [{ _id, name }] */
router.get("/", async (req, res) => {
  try {
    const list = await NumberingTemplate.find().select("name").sort({ name: 1 }).collation({ locale: "en" }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* GET /api/numbering-templates/:id/art -> the artwork bytes */
router.get("/:id/art", async (req, res) => {
  try {
    const t = await NumberingTemplate.findById(req.params.id).select("+art artType");
    if (!t || !t.art) return res.status(404).json({ message: "No artwork" });
    res.set("Content-Type", t.artType || "image/png");
    res.set("Cache-Control", "no-store");
    res.send(t.art);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* GET /api/numbering-templates/:id -> settings + cols (no bytes) */
router.get("/:id", async (req, res) => {
  try {
    const t = await NumberingTemplate.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ message: "Template not found" });
    res.json({ ...t, hasArt: !!t.artType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* POST /api/numbering-templates -> create, or replace the template with the same name */
router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Template name is required" });
    if (name.length > 80) return res.status(400).json({ message: "Template name is too long (max 80)" });

    const update = {
      name,
      settings: req.body.settings && typeof req.body.settings === "object" ? req.body.settings : {},
      cols: Array.isArray(req.body.cols) ? req.body.cols : [],
      artName: String(req.body.artName || ""),
      artW: Number(req.body.artW) || 0,
      artH: Number(req.body.artH) || 0,
      createdBy: String(req.body.createdBy || ""),
    };
    const op = { $set: update };
    if (req.body.clearArt) { op.$set.artType = ""; op.$unset = { art: 1 }; }

    const t = await NumberingTemplate.findOneAndUpdate({ nameKey: name.toLowerCase() }, op, {
      new: true, upsert: true, setDefaultsOnInsert: true,
    }).select("name");
    res.status(201).json({ _id: t._id, name: t.name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* PUT /api/numbering-templates/:id/art  (body = the raw image bytes) */
router.put("/:id/art", express.raw({ type: () => true, limit: MAX_ART }), async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: "No artwork received" });
    const type = String(req.headers["content-type"] || "").split(";")[0].trim();
    if (!/^image\/(png|jpeg|webp)$/.test(type)) return res.status(400).json({ message: "Artwork must be PNG, JPG or WebP" });
    const t = await NumberingTemplate.findByIdAndUpdate(req.params.id, { art: req.body, artType: type }, { new: true }).select("name");
    if (!t) return res.status(404).json({ message: "Template not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/* DELETE /api/numbering-templates/:id */
router.delete("/:id", async (req, res) => {
  try {
    await NumberingTemplate.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;