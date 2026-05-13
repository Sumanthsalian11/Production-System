const express = require("express");
const router = express.Router();
const {
  autoSchedule,
  createSingle,
  updateScheduleTime,   // ✅ new
  deleteSchedule,
  blockMachine,
  getSchedules
} = require("../controllers/scheduleController");

router.get("/", getSchedules);
router.post("/create", createSingle);
router.post("/auto", autoSchedule);
router.post("/block", blockMachine);
router.put("/:id", updateScheduleTime);   // ✅ drag & drop update
router.delete("/:id", deleteSchedule);

module.exports = router;