const Schedule = require("../models/Schedule");
const Machine = require("../models/MachineMaster");
const MachineCapacity = require("../models/MachineCapacity");
const WorkOrder = require("../models/WorkOrder");

// 🧠 helper
const getCapacity = async (machineId) => {
  const cap = await MachineCapacity.findOne({ machineId });
  if (!cap) throw new Error("Machine capacity missing");
  return cap;
};

// 🚀 AUTO SCHEDULE ALL (by priority, machine-wise)
exports.autoSchedule = async (req, res) => {
  try {
    const { date } = req.body;

    // clear only non-block schedules
    await Schedule.deleteMany({ isBlocked: false });

    const workOrders = await WorkOrder.find({ status: "PLANNED" });
    const machines = await Machine.find();

    const priorityMap = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    workOrders.sort((a, b) =>
      (priorityMap[a.priority] || 5) - (priorityMap[b.priority] || 5)
    );

    // group by first machine
    const machineMap = {};
    workOrders.forEach(wo => {
      const machineId = wo.machines?.[0]?.machineId;
      if (!machineId) return;
      if (!machineMap[machineId]) machineMap[machineId] = [];
      machineMap[machineId].push(wo);
    });

    const schedules = [];

    for (let machineId in machineMap) {
      const machine = machines.find(m => String(m._id) === machineId);
      if (!machine) continue;

      const cap = await getCapacity(machineId);

      let currentTime = new Date(date);
      currentTime.setHours(cap.shiftStart, 0, 0, 0);

      const jobs = machineMap[machineId];

      for (let job of jobs) {
        const durationHrs = job.totalImp / cap.capacityPerHour;

        let startTime = new Date(currentTime);
        let endTime = new Date(startTime.getTime() + durationHrs * 3600000);

        // 🚧 handle blocks
        const blocks = await Schedule.find({ machineId, isBlocked: true });
        blocks.forEach(b => {
          if (startTime < b.endTime && endTime > b.startTime) {
            startTime = new Date(b.endTime);
            endTime = new Date(startTime.getTime() + durationHrs * 3600000);
          }
        });

        schedules.push({
          workOrderId: job._id,
          machineId,
          totalImpression: job.totalImp,
          machineCapacity: cap.capacityPerHour,
          startTime,
          endTime,
          scheduleDate: date,
          priority: job.priority,
          location: job.location
        });

        currentTime = endTime;
      }
    }

    await Schedule.insertMany(schedules);

    res.json({ message: "Auto scheduled 🚀", count: schedules.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Scheduling failed" });
  }
};

// ✅ CREATE SINGLE SCHEDULE
exports.createSingle = async (req, res) => {
  try {
    const { workOrderId, machineId, scheduleDate } = req.body;

    const wo = await WorkOrder.findById(workOrderId);

    if (!wo) {
      return res.status(404).json({ message: "WO not found" });
    }

    const capData = await MachineCapacity.findOne({ machineId });

    if (!capData) {
      return res.status(400).json({
        message: "Capacity not set for this machine"
      });
    }

    const capacity = capData.capacityPerHour;
    const durationHours = wo.totalImp / capacity;

    let startTime = new Date(scheduleDate);
    let endTime = new Date(
      startTime.getTime() + durationHours * 60 * 60 * 1000
    );

    // 🔥 CONFLICT CHECK
const conflicts = await Schedule.find({
  machineId,

  startTime: {
    $lt: endTime
  },

  endTime: {
    $gt: startTime
  }
});

    if (conflicts.length > 0) {
      return res.status(400).json({ message: "Time slot already occupied ❌" });
    }

    const schedule = await Schedule.create({
      workOrderId,
      machineId,
      totalImpression: wo.totalImp,
      machineCapacity: capacity,
      startTime,
      endTime,
      scheduleDate,
      priority: wo.priority,
      location: wo.location
    });

    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Schedule failed" });
  }
};

// ✅ UPDATE SCHEDULE TIME (drag & drop from Gantt)
exports.updateScheduleTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ message: "startTime and endTime are required" });
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    if (isNaN(newStart) || isNaN(newEnd)) {
      return res.status(400).json({ message: "Invalid date values" });
    }

    if (newEnd <= newStart) {
      return res.status(400).json({ message: "endTime must be after startTime" });
    }

    // Find the existing schedule to get machineId
    const existing = await Schedule.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // 🔥 CONFLICT CHECK — exclude self
    const conflicts = await Schedule.find({
      _id: { $ne: id },               // exclude self
      machineId: existing.machineId,  // same machine only
      isBlocked: { $ne: true },       // skip blocked slots (or include if you want)
      startTime: { $lt: newEnd },
      endTime: { $gt: newStart }
    });

    if (conflicts.length > 0) {
      return res.status(400).json({ message: "Time slot already occupied ❌" });
    }

    // ✅ UPDATE
    const updated = await Schedule.findByIdAndUpdate(
      id,
      {
        startTime: newStart,
        endTime: newEnd,
        scheduleDate: newStart  // keep scheduleDate in sync
      },
      { new: true }
    )
      .populate("machineId", "machineName")
      .populate("workOrderId", "efiWoNumber");

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
};

// ✅ DELETE SCHEDULE
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ message: "Not found" });
    }

    await Schedule.findByIdAndDelete(req.params.id);

    res.json({ message: "Deleted successfully ✅" });
  } catch (e) {
    res.status(500).json({ message: "Delete failed" });
  }
};

// 🚧 BLOCK MACHINE
// 🚧 BLOCK MACHINE
exports.blockMachine = async (req, res) => {
  try {

    const {
      machineId,
      startTime,
      endTime,
      reason
    } = req.body;

    // ✅ validation
    if (
      !machineId ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({
        message: "End time must be greater than start time"
      });
    }
    // ✅ create block
    const block = await Schedule.create({
      machineId,

      startTime: start,
      endTime: end,

      scheduleDate: start,

      isBlocked: true,

      blockReason:
        reason || "Machine Blocked"
    });

    res.json({
      message: "Machine blocked successfully 🚧",
      block
    });

  } catch (e) {

    console.log(e);

    res.status(500).json({
      message: "Block failed"
    });
  }
};
// 📊 GET SCHEDULES
exports.getSchedules = async (req, res) => {
  try {
    const data = await Schedule.find()
      .populate("machineId", "machineName")
      .populate("workOrderId", "efiWoNumber");

    res.json(data);
  } catch (e) {
    res.status(500).json({ message: "Fetch failed" });
  }
};