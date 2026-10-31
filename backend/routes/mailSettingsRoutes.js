const express = require("express");
const router = express.Router();
const MailSettings = require("../models/MailSettings");
const auth = require("../middleware/authMiddleware");

const DEFAULT_TIMES = {
  indentSummary: "15:00",
  persoProduction: "10:00",
  floorProduction: "10:00",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

router.get("/:key", auth, async (req, res) => {
  try {
    const key = req.params.key;
    const baseKey = String(key).split("::")[0];
    if (!DEFAULT_TIMES[baseKey]) return res.status(400).json({ message: "Unknown report" });

    const s = await MailSettings.findOne({ key }).lean();
    res.json({
      toEmails: s?.toEmails || [],
      ccEmails: s?.ccEmails || [],
      sendTime: s?.sendTime || DEFAULT_TIMES[baseKey],
      machineIds: s?.machineIds || [],
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load mail settings" });
  }
});

router.put("/:key", auth, async (req, res) => {
  try {
    const key = req.params.key;
    const baseKey = String(key).split("::")[0];
    if (!DEFAULT_TIMES[baseKey]) return res.status(400).json({ message: "Unknown report" });
    // location is only allowed for the floor report
    if (key.includes("::") && (baseKey !== "floorProduction" || !key.split("::")[1])) {
      return res.status(400).json({ message: "Unknown report" });
    }

    const { toEmails = [], ccEmails = [], sendTime, machineIds = [] } = req.body;

    if (!TIME_RE.test(String(sendTime || ""))) {
      return res.status(400).json({ message: "Invalid send time" });
    }
    const bad = [...toEmails, ...ccEmails].find((e) => !EMAIL_RE.test(String(e)));
    if (bad) return res.status(400).json({ message: `Invalid email: ${bad}` });

    const saved = await MailSettings.findOneAndUpdate(
      { key },
      { toEmails, ccEmails, sendTime, machineIds: Array.isArray(machineIds) ? machineIds.map(String) : [] },
      { upsert: true, new: true }
    );
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: "Failed to save mail settings" });
  }
});

// list all stored mail settings
router.get("/", auth, async (req, res) => {
  try {
    const list = await MailSettings.find({}).lean();
    res.json(
      list.map((s) => ({
        key: s.key,
        toEmails: s.toEmails || [],
        ccEmails: s.ccEmails || [],
        sendTime: s.sendTime,
        machineIds: s.machineIds || [],
      }))
    );
  } catch (err) {
    res.status(500).json({ message: "Failed to load mail settings" });
  }
});

// delete one stored setting (the mail then uses its default time and recipients)
router.delete("/:key", auth, async (req, res) => {
  try {
    if (!DEFAULT_TIMES[String(req.params.key).split("::")[0]]) return res.status(400).json({ message: "Unknown report" });
    await MailSettings.deleteOne({ key: req.params.key });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete mail settings" });
  }
});

module.exports = router;