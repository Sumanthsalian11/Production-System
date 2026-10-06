const express = require("express");
const router = express.Router();
const {
  autoSchedule,
  autoScheduleAllPending, // auto-schedules every currently pending row (old + new)
  dedupeSchedules,        // NEW — one-time cleanup for duplicates created by the rowIndex bug
  createSingle,
  updateScheduleTime,
  deleteSchedule,
  blockMachine,
  getSchedules
} = require("../controllers/scheduleController");

router.get("/", getSchedules);
router.post("/create", createSingle);
router.post("/auto", autoSchedule);
router.post("/auto-pending", autoScheduleAllPending);
router.post("/dedupe", dedupeSchedules); // NEW
router.post("/block", blockMachine);
router.put("/:id", updateScheduleTime);
router.delete("/:id", deleteSchedule);

module.exports = router;