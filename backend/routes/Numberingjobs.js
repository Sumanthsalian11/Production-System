const express = require("express");
const router = express.Router();
const NumberingJob = require("../models/NumberingJob");

const MAX_COUNT = 1000000;
const pad = (n, d) => String(n).padStart(d || 6, "0");

/* GET /api/numbering-jobs?series=XYZ  -> recent jobs + next free number */
router.get("/", async (req, res) => {
  try {
    const series = String(req.query.series || "").trim();
    if (!series) return res.status(400).json({ message: "series is required" });
    const jobs = await NumberingJob.find({ series }).sort({ createdAt: -1 }).limit(50).lean();
    const top = await NumberingJob.findOne({ series }).sort({ to: -1 }).lean();
    res.json({ jobs, next: top ? top.to + 1 : null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* POST /api/numbering-jobs/reserve
   - same range already reserved  -> 200 { reprint: true }
   - overlaps a different range   -> 409
   - free                         -> 201 */
router.post("/reserve", async (req, res) => {
  try {
    const series = String(req.body.series || "").trim();
    const from = Number(req.body.from);
    const to = Number(req.body.to);
    const digits = Number(req.body.digits) || 6;

    if (!series) return res.status(400).json({ message: "series is required" });
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from)
      return res.status(400).json({ message: "Invalid range" });
    if (to - from + 1 > MAX_COUNT)
      return res.status(400).json({ message: `Range too large (max ${MAX_COUNT})` });

    const same = await NumberingJob.findOne({ series, from, to });
    if (same) return res.json({ ok: true, reprint: true, job: same });

    const clash = await NumberingJob.findOne({ series, from: { $lte: to }, to: { $gte: from } }).lean();
    if (clash)
      return res.status(409).json({
        message: `Range overlaps ${pad(clash.from, clash.digits)}–${pad(clash.to, clash.digits)} already issued for "${series}".`,
        conflict: clash,
      });

    const job = await NumberingJob.create({
      series, from, to, digits,
      word: req.body.word || "",
      createdBy: req.body.createdBy || "",
    });
    res.status(201).json({ ok: true, reprint: false, job });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;