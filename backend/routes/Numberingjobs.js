const express = require("express");
const router = express.Router();
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { Worker } = require("worker_threads");
const NumberingJob = require("../models/NumberingJob");

const MAX_COUNT = 1000000;

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

/* ================= server-side generation ================= */
const JOBS_DIR = path.join(os.tmpdir(), "cert-jobs");
const UP_DIR = path.join(os.tmpdir(), "cert-uploads");
fs.mkdirSync(JOBS_DIR, { recursive: true });
fs.mkdirSync(UP_DIR, { recursive: true });
const WORKER_PATH = path.join(__dirname, "..", "workers", "certWorker.js");

const upload = multer({ dest: UP_DIR, limits: { fileSize: 300 * 1024 * 1024 } });
const jobs = new Map();

const rm = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ } };
const dropJob = (j) => {
  try { if (j.worker) j.worker.terminate(); } catch { /* ignore */ }
  j.tmp.forEach(rm);
  rm(j.outDir);
  jobs.delete(j.id);
};

/* POST /api/numbering-jobs/generate  (multipart: meta, art?, fonts*) -> { id } */
router.post(
  "/generate",
  upload.fields([{ name: "meta", maxCount: 1 }, { name: "art", maxCount: 1 }, { name: "fonts", maxCount: 20 }]),
  (req, res) => {
    const files = req.files || {};
    const tmp = Object.values(files).flat().map((x) => x.path);
    try {
      const metaFile = (files.meta || [])[0];
      if (!metaFile) { tmp.forEach(rm); return res.status(400).json({ message: "meta is required" }); }
      const art = (files.art || [])[0];
      const fonts = (files.fonts || []).map((x) => ({ name: decodeURIComponent(x.originalname), path: x.path }));

      const id = crypto.randomUUID();
      const outDir = path.join(JOBS_DIR, id);
      fs.mkdirSync(outDir, { recursive: true });

      const job = { id, state: "running", done: 0, total: 0, sheets: 0, files: [], error: null, worker: null, createdAt: Date.now(), tmp, outDir };
      const worker = new Worker(WORKER_PATH, {
        workerData: { metaPath: metaFile.path, artPath: art ? art.path : null, fonts, outDir },
        resourceLimits: { maxOldGenerationSizeMb: 4096 },
      });
      job.worker = worker;
      jobs.set(id, job);

      worker.on("message", (m) => {
        if (m.type === "progress") { job.done = m.done; job.total = m.total; }
        else if (m.type === "file") job.files.push({ index: job.files.length, name: m.name, path: m.path, size: m.size });
        else if (m.type === "done") { job.state = m.stopped ? "stopped" : "done"; job.done = m.stopped ? job.done : job.total || m.total; job.sheets = m.sheets || 0; }
        else if (m.type === "error") { job.state = "error"; job.error = m.message; }
      });
      worker.on("error", (e) => { job.state = "error"; job.error = e.message; });
      worker.on("exit", (code) => {
        if (job.state === "running") { job.state = code === 0 ? "done" : "error"; if (code !== 0 && !job.error) job.error = `Generator stopped unexpectedly (code ${code}).`; }
        job.tmp.forEach(rm);   // uploaded inputs are no longer needed
        job.worker = null;
      });

      res.status(201).json({ id });
    } catch (err) {
      tmp.forEach(rm);
      res.status(500).json({ message: err.message });
    }
  }
);

/* GET /api/numbering-jobs/generate/:id -> live status */
router.get("/generate/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ message: "Job not found (it may have expired)." });
  res.json({
    state: j.state, done: j.done, total: j.total, sheets: j.sheets, error: j.error,
    files: j.files.map(({ index, name, size }) => ({ index, name, size })),
  });
});

/* GET /api/numbering-jobs/generate/:id/file/:index -> download one finished file */
router.get("/generate/:id/file/:index", (req, res) => {
  const j = jobs.get(req.params.id);
  const fl = j && j.files[Number(req.params.index)];
  if (!fl || !fs.existsSync(fl.path)) return res.status(404).json({ message: "File not found." });
  res.download(fl.path, fl.name);
});

/* POST /api/numbering-jobs/generate/:id/stop */
router.post("/generate/:id/stop", (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ message: "Job not found." });
  if (j.worker) j.worker.postMessage({ type: "stop" });
  res.json({ ok: true });
});

/* DELETE /api/numbering-jobs/generate/:id -> remove temp files */
router.delete("/generate/:id", (req, res) => {
  const j = jobs.get(req.params.id);
  if (j) dropJob(j);
  res.json({ ok: true });
});

/* sweep abandoned jobs (older than 3 hours) */
setInterval(() => {
  const now = Date.now();
  for (const j of [...jobs.values()]) if (now - j.createdAt > 3 * 3600 * 1000) dropJob(j);
}, 10 * 60 * 1000).unref();

module.exports = router;