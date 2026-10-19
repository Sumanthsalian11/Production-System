const express = require("express");
const router = express.Router();

const ProductionMachineStatus = require("../models/ProductionMachineStatus");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// same filters the page used on the client, now applied in MongoDB
const buildQuery = async (q) => {
  const query = {};
  if (q.dateFrom || q.dateTo) {
    query.productionDate = {};
    if (q.dateFrom) query.productionDate.$gte = new Date(`${q.dateFrom}T00:00:00.000Z`);
    if (q.dateTo) query.productionDate.$lte = new Date(`${q.dateTo}T23:59:59.999Z`);
  }
  if (q.month && /^\d{4}-\d{2}$/.test(q.month)) {
    const [y, m] = q.month.split("-").map(Number);
    query.$and = [
      { productionDate: { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) } },
    ];
  }
  if (q.workOrder) query.woNumber = { $regex: escapeRegex(q.workOrder), $options: "i" };
  if (q.shift) query.shift = q.shift;
  if (q.machineStatus) query.machineStatus = q.machineStatus;
  if (q.printer) query.printerName = q.printer;
  if (q.location) query.userLocations = q.location;
  if (q.machineId) query.machineId = new mongoose.Types.ObjectId(String(q.machineId));
  if (q.machine) {
    const ids = await mongoose.model("MachineMaster").find({ machineName: q.machine }).distinct("_id");
    query.machineId = { $in: ids };
  }
  return query;
};


// ==========================================
// CREATE
// ==========================================
router.post("/", async (req, res) => {
  try {
    const newRecord = new ProductionMachineStatus({
      productionDate: req.body.productionDate,
      shift: req.body.shift,
      activityId: req.body.activityId,
      machineId: req.body.machineId,
      machineStatus: req.body.machineStatus,
      customerName: req.body.customerName,
      materialType: req.body.materialType,
      fromTime: req.body.fromTime,
      toTime: req.body.toTime,
      remarks: req.body.remarks,
      enteredBy: req.body.enteredBy,
woNumber: req.body.woNumber,
totalPages: req.body.totalPages,
wastageSheets: req.body.wastageSheets,
wastePercentage: req.body.wastePercentage,
reason: req.body.reason,
paperSize:   req.body.paperSize   || "",
printerName: req.body.printerName || "",
   userLocations: req.body.userLocations || [],
    });

    const saved = await newRecord.save();

    res.status(201).json(saved);
  } catch (err) {
    console.error("Create error:", err);

    res.status(500).json({
      message: "Error creating record",
      error: err.message,
    });
  }
});


// ==========================================
// GET ALL
// ==========================================
router.get("/", async (req, res) => {
  try {
    const q = req.query;
    const query = await buildQuery(q);
    const limit = parseInt(q.limit, 10);
    const pageNo = Math.max(parseInt(q.page, 10) || 1, 1);

    let cursor = ProductionMachineStatus.find(query)
      .populate("activityId", "activityName")
      .populate("machineId", "machineName")
      .sort({ createdAt: -1, _id: -1 });
    if (limit > 0) {
      const size = Math.min(limit, 1000);
      cursor = cursor.skip((pageNo - 1) * size).limit(size);
    }

    if (q.withCount) {
      const [data, total] = await Promise.all([
        cursor.lean(),
        Object.keys(query).length
          ? ProductionMachineStatus.countDocuments(query)
          : ProductionMachineStatus.estimatedDocumentCount(),
      ]);
      return res.json({ data, total });
    }

    res.json(await cursor.lean());
  } catch (err) {
    console.error("Fetch error:", err);

    res.status(500).json({
      message: "Error fetching records",
      error: err.message,
    });
  }
});

// dropdown options for the filter bar
router.get("/filter-options", async (req, res) => {
  try {
    const [locations, printers, machineIds] = await Promise.all([
      ProductionMachineStatus.distinct("userLocations"),
      ProductionMachineStatus.distinct("printerName"),
      ProductionMachineStatus.distinct("machineId"),
    ]);
    const macDocs = await mongoose
      .model("MachineMaster")
      .find({ _id: { $in: machineIds } })
      .select("machineName")
      .lean();
    res.json({
      locations: locations.filter(Boolean),
      printers: printers.filter(Boolean),
      machines: [...new Set(macDocs.map((m) => m.machineName).filter(Boolean))],
    });
  } catch (err) {
    console.error("Filter options error:", err);
    res.status(500).json({ message: "Error fetching options", error: err.message });
  }
});

// Summary Report: grouped in MongoDB, only totals are sent
router.get("/summary", async (req, res) => {
  try {
    const query = await buildQuery(req.query);

    const part = (f, i) => ({
      $convert: {
        input: { $arrayElemAt: [{ $split: [{ $ifNull: [f, ""] }, ":"] }, i] },
        to: "int", onError: 0, onNull: 0,
      },
    });
    const toMin = (f) => ({ $add: [{ $multiply: [part(f, 0), 60] }, part(f, 1)] });
    const mins = {
      $cond: [
        { $or: [{ $eq: [{ $ifNull: ["$fromTime", ""] }, ""] }, { $eq: [{ $ifNull: ["$toTime", ""] }, ""] }] },
        0,
        {
          $let: {
            vars: { f: toMin("$fromTime"), t: toMin("$toTime") },
            in: {
              $cond: [
                { $lte: ["$$t", "$$f"] },
                { $subtract: [{ $add: ["$$t", 1440] }, "$$f"] },
                { $subtract: ["$$t", "$$f"] },
              ],
            },
          },
        },
      ],
    };

    const [rows, actDocs, macDocs] = await Promise.all([
      ProductionMachineStatus.aggregate([
        { $match: query },
        {
          $project: {
            a: "$activityId",
            m: "$machineId",
            p: { $ifNull: ["$printerName", ""] },
            s: { $ifNull: ["$shift", ""] },
            st: { $trim: { input: { $ifNull: ["$machineStatus", ""] } } },
            ps: { $trim: { input: { $ifNull: ["$paperSize", ""] } } },
            pages: { $ifNull: ["$totalPages", 0] },
            rm: { $trim: { input: { $ifNull: ["$remarks", ""] } } },
            mins,
          },
        },
        {
          $group: {
            _id: { a: "$a", m: "$m", p: "$p", s: "$s", st: { $toLower: "$st" }, ps: "$ps" },
            label: { $first: "$st" },
            pages: { $sum: "$pages" },
            mins: { $sum: "$mins" },
            n: { $sum: 1 },
            rm: { $addToSet: "$rm" },
          },
        },
      ]).allowDiskUse(true),
      mongoose.model("ActivityMaster").find({}, "activityName").lean(),
      mongoose.model("MachineMaster").find({}, "machineName").lean(),
    ]);

    const actMap = new Map(actDocs.map((a) => [String(a._id), a.activityName]));
    const macMap = new Map(macDocs.map((m) => [String(m._id), m.machineName]));
    const statuses = new Map();
    let total = 0;

    const out = rows.map((r) => {
      total += r.n;
      if (r._id.st && !statuses.has(r._id.st)) statuses.set(r._id.st, r.label || r._id.st);
      return {
        activityName: actMap.get(String(r._id.a)) || "-",
        machineName: macMap.get(String(r._id.m)) || "-",
        printerName: r._id.p,
        shift: r._id.s,
        machineStatus: r.label,
        paperSize: r._id.ps,
        totalPages: r.pages,
        mins: r.mins,
        remarks: (r.rm || []).filter(Boolean),
      };
    });

    res.json({
      rows: out,
      statuses: [...statuses].map(([key, label]) => ({ key, label })),
      total,
    });
  } catch (err) {
    console.error("Summary error:", err);
    res.status(500).json({ message: "Error building summary", error: err.message });
  }
});

// latest entry per activity + machine + printer (for the Last Used PDF / Excel)
router.get("/last-used", async (req, res) => {
  try {
    const match = {};
    if (req.query.location) match.userLocations = req.query.location;

    const rows = await ProductionMachineStatus.aggregate([
      { $match: match },
      { $sort: { productionDate: -1, createdAt: -1 } },
      {
        $group: {
          _id: { a: "$activityId", m: "$machineId", p: { $ifNull: ["$printerName", ""] } },
          productionDate: { $first: "$productionDate" },
          createdAt: { $first: "$createdAt" },
          woNumber: { $first: "$woNumber" },
          customerName: { $first: "$customerName" },
          shift: { $first: "$shift" },
          enteredBy: { $first: "$enteredBy" },
          userLocations: { $first: "$userLocations" },
        },
      },
      {
        $project: {
          _id: 0,
          activityId: "$_id.a",
          machineId: "$_id.m",
          printerName: "$_id.p",
          productionDate: 1, createdAt: 1, woNumber: 1, customerName: 1,
          shift: 1, enteredBy: 1, userLocations: 1,
        },
      },
    ]).allowDiskUse(true);

    res.json(rows);
  } catch (err) {
    console.error("Last used error:", err);
    res.status(500).json({ message: "Error fetching last used", error: err.message });
  }
});


// ==========================================
// UPDATE
// ==========================================
router.put("/:id", async (req, res) => {
  try {
    const updated = await ProductionMachineStatus.findByIdAndUpdate(
      req.params.id,
      {
        productionDate: req.body.productionDate,
        shift: req.body.shift,
        activityId: req.body.activityId,
        machineId: req.body.machineId,
        machineStatus: req.body.machineStatus,
        customerName: req.body.customerName,
        materialType: req.body.materialType,
        fromTime: req.body.fromTime,
        toTime: req.body.toTime,
        remarks: req.body.remarks,
        woNumber: req.body.woNumber,
totalPages: req.body.totalPages,
wastageSheets: req.body.wastageSheets,
wastePercentage: req.body.wastePercentage,
reason: req.body.reason,
paperSize:   req.body.paperSize   || "",
printerName: req.body.printerName || "",
        enteredBy: req.body.enteredBy,
userLocations: req.body.userLocations || [],
       
      },
      {
        new: true,
      }
    );

    res.json(updated);
  } catch (err) {
    console.error("Update error:", err);

    res.status(500).json({
      message: "Error updating record",
      error: err.message,
    });
  }
});


// ==========================================
// DELETE
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    await ProductionMachineStatus.findByIdAndDelete(req.params.id);

    res.json({
      message: "Deleted successfully",
    });
  } catch (err) {
    console.error("Delete error:", err);

    res.status(500).json({
      message: "Error deleting record",
      error: err.message,
    });
  }
});

// ==========================================
// EXCEL EXPORT (streamed, handles lakhs of rows)
// ==========================================
router.get("/export", async (req, res) => {
  try {
    const query = await buildQuery(req.query);

    const [actDocs, macDocs] = await Promise.all([
      mongoose.model("ActivityMaster").find({}, "activityName").lean(),
      mongoose.model("MachineMaster").find({}, "machineName").lean(),
    ]);
    const actMap = new Map(actDocs.map((a) => [String(a._id), a.activityName]));
    const macMap = new Map(macDocs.map((m) => [String(m._id), m.machineName]));

    const fmtDate = (d) =>
      d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "UTC" }) : "";
    const fmtTime = (t) => {
      if (!t) return "";
      const [h, m] = String(t).split(":");
      let hr = Number(h);
      const ap = hr >= 12 ? "PM" : "AM";
      hr = hr % 12 || 12;
      return `${hr}:${m} ${ap}`;
    };
    const totalTime = (from, to) => {
      if (!from || !to) return "";
      const [fh, fm] = from.split(":").map(Number);
      const [th, tm] = to.split(":").map(Number);
      let mins = th * 60 + tm - (fh * 60 + fm);
      if (mins <= 0) mins += 24 * 60;
      return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
    };

    const stamp = new Date().toISOString().split("T")[0];
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Production_Records_${stamp}.xlsx"`
    );

    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const ws = wb.addWorksheet("Production Records");
    ws.columns = [
      { header: "Sl No", key: "sl", width: 8 },
      { header: "Date", key: "date", width: 12 },
      { header: "WO Number", key: "wo", width: 14 },
      { header: "Shift", key: "shift", width: 8 },
      { header: "Printer", key: "printer", width: 14 },
      { header: "Activity", key: "activity", width: 18 },
      { header: "Machine", key: "machine", width: 20 },
      { header: "Status", key: "status", width: 14 },
      { header: "Customer", key: "customer", width: 26 },
      { header: "Item", key: "item", width: 20 },
      { header: "From Time", key: "from", width: 11 },
      { header: "To Time", key: "to", width: 11 },
      { header: "Total Time", key: "total", width: 11 },
      { header: "Total Pages", key: "pages", width: 12 },
      { header: "Wastage Sheets", key: "waste", width: 14 },
      { header: "Waste %", key: "wp", width: 9 },
      { header: "Reason", key: "reason", width: 22 },
      { header: "Paper Size", key: "size", width: 11 },
      { header: "User", key: "user", width: 18 },
      { header: "Remarks", key: "remarks", width: 24 },
    ];

    const cursor = ProductionMachineStatus.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .lean()
      .cursor({ batchSize: 2000 });

    let i = 0;
    for await (const item of cursor) {
      i++;
      ws.addRow({
        sl: i,
        date: fmtDate(item.productionDate),
        wo: item.woNumber || "",
        shift: item.shift || "",
        printer: item.printerName || "",
        activity: actMap.get(String(item.activityId)) || "",
        machine: macMap.get(String(item.machineId)) || "",
        status: item.machineStatus || "",
        customer: item.customerName || "",
        item: item.materialType || "",
        from: fmtTime(item.fromTime),
        to: fmtTime(item.toTime),
        total: totalTime(item.fromTime, item.toTime),
        pages: item.totalPages || "",
        waste: item.wastageSheets || "",
        wp: item.wastePercentage || "",
        reason: item.reason || "",
        size: item.paperSize || "",
        user: item.enteredBy || "",
        remarks: item.remarks || "",
      }).commit();
    }

    ws.commit();
    await wb.commit();
  } catch (err) {
    console.error("Export error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error exporting records", error: err.message });
    } else {
      res.destroy(err);
    }
  }
});

module.exports = router;