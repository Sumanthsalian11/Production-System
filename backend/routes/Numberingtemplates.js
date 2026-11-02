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
    const slot = Math.min(2, Math.max(0, parseInt(req.query.slot, 10) || 0));
    const t = await NumberingTemplate.findById(req.params.id).select("+art +arts.data");
    if (!t) return res.status(404).json({ message: "No artwork" });
    const a = (t.arts || []).find((x) => x.slot === slot && x.data && x.data.length);
    let bytes = a && a.data, type = a && a.mime;
    if (!bytes && slot === 0 && t.art) { bytes = t.art; type = t.artType; }   // templates saved before multi-artwork
    if (!bytes) return res.status(404).json({ message: "No artwork" });
    res.set("Content-Type", type || "image/png");
    res.set("Cache-Control", "no-store");
    res.send(bytes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* GET /api/numbering-templates/:id -> settings + cols (no bytes) */
router.get("/:id", async (req, res) => {
  try {
    const t = await NumberingTemplate.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ message: "Template not found" });
    res.json({ ...t, hasArt: !!t.artType || (t.arts || []).length > 0 });
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
      texts: Array.isArray(req.body.texts) ? req.body.texts : [],
      arts: (Array.isArray(req.body.arts) ? req.body.arts : [])
        .filter((a) => [0, 1, 2].includes(Number(a.slot)))
        .map((a) => ({ slot: Number(a.slot), name: String(a.name || ""), w: Number(a.w) || 0, h: Number(a.h) || 0 })),
      createdBy: String(req.body.createdBy || ""),
    };
    /* artwork bytes are re-uploaded per slot right after this call; drop the old single-artwork fields */
    const op = { $set: update, $unset: { art: 1 } };
    op.$set.artType = "";

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
    const slot = Math.min(2, Math.max(0, parseInt(req.query.slot, 10) || 0));
    const r = await NumberingTemplate.updateOne(
      { _id: req.params.id, "arts.slot": slot },
      { $set: { "arts.$.data": req.body, "arts.$.mime": type } }
    );
    if (!r.matchedCount) return res.status(404).json({ message: "Template or artwork slot not found" });
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