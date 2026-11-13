// backend/routes/jobValidation.js
const express = require("express");
const router = express.Router();
const { JobValidationMeta, JobValidationRow, JobValidationSetup } = require("../models/JobValidation");
const { buildReport, defaultSetup, UPLOAD_SPEC } = require("../utils/jobValidationEngine");

// TODO: protect with your existing auth middleware, e.g.
// const auth = require("../middleware/auth");  router.use(auth);

const KINDS = Object.keys(UPLOAD_SPEC);
const SETUP_KEYS = ["settings", "rates", "routes", "mats", "overrides"];

/* ---------------- setup (old Setup sheet) ---------------- */
async function getSetup() {
  let doc = await JobValidationSetup.findOne({ key: "main" }).lean();
  if (!doc) {
    const d = defaultSetup();
    doc = (await JobValidationSetup.create({ key: "main", ...d })).toObject();
  }
  const out = {};
  SETUP_KEYS.forEach((k) => (out[k] = doc[k] || []));
  return out;
}
function settingValue(setup, key) {
  const r = setup.settings.find((s) => String(s.key).trim() === key);
  return r ? r.value : "";
}

router.get("/setup", async (req, res) => {
  try { res.json(await getSetup()); } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put("/setup", async (req, res) => {
  try {
    const body = req.body || {};
    const cur = await getSetup();
    const next = {};
    SETUP_KEYS.forEach((k) => {
      let list = Array.isArray(body[k]) ? body[k] : cur[k];
      // rows with an empty first column are notes / blanks, same rule as readSetup_()
      const firstKey = { settings: "key", rates: "machine", routes: "product type", mats: "item", overrides: "wo no" }[k];
      next[k] = list.filter((r) => r && String(r[firstKey] === undefined ? "" : r[firstKey]).trim() !== "");
    });
    await JobValidationSetup.findOneAndUpdate({ key: "main" }, { $set: next }, { upsert: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* ---------------- data access ---------------- */
async function loadKind(kind) {
  const meta = await JobValidationMeta.findOne({ kind, active: true }).lean();
  if (!meta) return { rows: [], meta: null };
  const header = meta.header.map((h) => String(h).trim().toLowerCase());
  const docs = await JobValidationRow.find({ kind, batchId: meta.batchId }).sort({ _id: 1 }).lean();
  const rows = docs.map((d) => {
    const o = {};
    for (let j = 0; j < header.length; j++) if (header[j] !== "") o[header[j]] = d.v[j] === undefined || d.v[j] === null ? "" : d.v[j];
    return o;
  });
  return { rows, meta };
}

async function loadData() {
  const [setup, prod, cons, plan] = await Promise.all([getSetup(), loadKind("production"), loadKind("consumption"), loadKind("planning")]);
  return { setup, prod, cons, plan };
}

async function dataStamp() {
  const metas = await JobValidationMeta.find({ active: true }).lean();
  const setup = await JobValidationSetup.findOne({ key: "main" }).select("updatedAt").lean();
  return metas.map((m) => `${m.kind}:${m.batchId}:${m.rowCount}`).sort().join("|") + "|" + (setup ? new Date(setup.updatedAt).getTime() : 0);
}

/* ---------------- report ---------------- */
router.get("/report", async (req, res) => {
  try {
    const D = await loadData();
    const out = buildReport(D, String(req.query.month || ""));
    out.stamp = await dataStamp();
    out.generatedAt = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
    res.json(out);
  } catch (e) {
    console.error("job-validation report:", e);
    res.status(500).json({ message: e.message });
  }
});

router.get("/stamp", async (req, res) => {
  try { res.json({ stamp: await dataStamp() }); } catch (e) { res.status(500).json({ message: e.message }); }
});

/* ---------------- upload ---------------- */
router.get("/upload-info", async (req, res) => {
  try {
    const setup = await getSetup();
    const out = { needPasscode: String(settingValue(setup, "UPLOAD_PASSCODE") || "").trim() !== "", kinds: {} };
    for (const k of KINDS) {
      const m = await JobValidationMeta.findOne({ kind: k, active: true }).lean();
      out.kinds[k] = { label: UPLOAD_SPEC[k].label, need: UPLOAD_SPEC[k].need, rows: m ? m.rowCount : 0, external: false };
    }
    res.json(out);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * Receives one part of an uploaded file (same idea as uploadChunk in Code.gs).
 * body: { rows:[[...]], startRow, batchId, final, passcode }
 * startRow 0 -> rows[0] is the header row. The batch becomes active only when final === true.
 */
router.post("/upload/:kind", async (req, res) => {
  try {
    const kind = req.params.kind;
    if (!UPLOAD_SPEC[kind]) return res.status(400).json({ message: "Unknown data type: " + kind });
    const { rows, startRow, batchId, final, passcode, fileName } = req.body || {};
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ message: "Nothing to upload." });
    if (!batchId) return res.status(400).json({ message: "Missing batch id." });

    const setup = await getSetup();
    const pass = String(settingValue(setup, "UPLOAD_PASSCODE") || "").trim();
    if (pass && String(passcode || "").trim() !== pass) return res.status(403).json({ message: "Wrong upload passcode." });

    let dataRows = rows;
    if (+startRow === 0) {
      const have = {};
      rows[0].forEach((h) => { have[String(h).trim().toLowerCase()] = 1; });
      const missing = UPLOAD_SPEC[kind].need.filter((grp) => !grp.some((n) => have[n])).map((grp) => grp[0]);
      if (missing.length) return res.status(400).json({ message: "Missing columns: " + missing.join(", ") });
      await JobValidationMeta.deleteMany({ kind, active: false }); // clear any half-finished earlier upload
      await JobValidationRow.deleteMany({ kind, batchId: { $nin: await activeBatches(kind) } });
      await JobValidationMeta.create({ kind, batchId, header: rows[0].map((h) => String(h).trim()), rowCount: 0, active: false, fileName: String(fileName || "").slice(0, 255), uploadedBy: req.user && (req.user.name || req.user.username) });
      dataRows = rows.slice(1);
    } else {
      const m = await JobValidationMeta.findOne({ kind, batchId, active: false });
      if (!m) return res.status(400).json({ message: "Upload was interrupted. Start the upload again." });
    }

    if (dataRows.length) {
      await JobValidationRow.insertMany(dataRows.map((v) => ({ kind, batchId, v })), { ordered: true });
      await JobValidationMeta.updateOne({ kind, batchId }, { $inc: { rowCount: dataRows.length } });
    }

    if (final) {
      // switch to the new batch, then drop the old one
      await JobValidationMeta.updateMany({ kind, batchId: { $ne: batchId } }, { $set: { active: false } });
      await JobValidationMeta.updateOne({ kind, batchId }, { $set: { active: true } });
      const old = await JobValidationMeta.find({ kind, batchId: { $ne: batchId } }).lean();
      for (const o of old) await JobValidationRow.deleteMany({ kind, batchId: o.batchId });
      await JobValidationMeta.deleteMany({ kind, batchId: { $ne: batchId } });
    }
    const m = await JobValidationMeta.findOne({ kind, batchId }).lean();
    res.json({ sheet: kind, rows: m ? m.rowCount : 0 });
  } catch (e) {
    console.error("job-validation upload:", e);
    res.status(500).json({ message: e.message });
  }
});

async function activeBatches(kind) {
  const a = await JobValidationMeta.find({ kind, active: true }).lean();
  return a.map((x) => x.batchId);
}
/* ---------------- uploaded files: list + delete ---------------- */
router.get("/files", async (req, res) => {
  try {
    const setup = await getSetup();
    const order = { production: 1, consumption: 2, planning: 3 };
    const metas = await JobValidationMeta.find({ active: true }).lean();
    const files = metas
      .sort((a, b) => (order[a.kind] || 9) - (order[b.kind] || 9))
      .map((m) => ({
        kind: m.kind,
        fileName: m.fileName || "",
        rowCount: m.rowCount,
        uploadedAt: m.updatedAt,
        uploadedBy: m.uploadedBy || "",
      }));
    res.json({
      files,
      needPasscode: String(settingValue(setup, "UPLOAD_PASSCODE") || "").trim() !== "",
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/files/:kind", async (req, res) => {
  try {
    const kind = req.params.kind;
    if (!UPLOAD_SPEC[kind]) return res.status(400).json({ message: "Unknown data type: " + kind });
    const setup = await getSetup();
    const pass = String(settingValue(setup, "UPLOAD_PASSCODE") || "").trim();
    if (pass && String((req.body && req.body.passcode) || "").trim() !== pass) {
      return res.status(403).json({ message: "Wrong upload passcode." });
    }
    const del = await JobValidationRow.deleteMany({ kind });
    await JobValidationMeta.deleteMany({ kind });
    res.json({ ok: true, deletedRows: del.deletedCount });
  } catch (e) {
    console.error("job-validation delete file:", e);
    res.status(500).json({ message: e.message });
  }
});
module.exports = router;