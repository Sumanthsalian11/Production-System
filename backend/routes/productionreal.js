const express = require("express");
const router = express.Router();
const ProductionReal = require("../models/ProductionReal");
const User = require("../models/User"); 
const WorkOrder = require("../models/WorkOrder"); // add this import at top
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


router.post("/", authMiddleware, async (req, res) => {
  try {
   
    const userId = req.user.id;


    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

   
    const newEntry = new ProductionReal({
      ...req.body,
      enteredBy: user.name,
        enteredById: user._id,    
      userLocations: user.locations || [], // store locations from user
    });

    await newEntry.save();
    res.status(201).json({ message: "Production saved successfully" });
  } catch (error) {
    console.error("Error saving Production:", error);
    res.status(500).json({ message: "Error saving production", error });
  }
});

// GET ALL Production Real with populated references (date-bounded)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const q = req.query;
    const from = q.from || q.dateFrom;
    const to = q.to || q.dateTo;

    const query = {};
    if (from || to) {
      query.productionDate = {};
      if (from) query.productionDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) query.productionDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    // optional filters (used by the Production Entry page)
    if (q.month && /^\d{4}-\d{2}$/.test(q.month)) {
      const [y, m] = q.month.split("-").map(Number);
      query.$and = [
        { productionDate: { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) } },
      ];
    }
    if (q.workOrderExact) {
      query.workOrder = Number(q.workOrderExact);
    } else if (q.workOrder) {
      (query.$and = query.$and || []).push({
        $expr: { $regexMatch: { input: { $toString: "$workOrder" }, regex: escapeRegex(q.workOrder) } },
      });
    }
    if (q.machineStatus) query.machineStatus = q.machineStatus;
    if (q.shift) query.shift = q.shift;
    if (q.productType) query.productType = q.productType;
    if (q.customer) query.customerName = q.customer;
    if (q.location) query.userLocations = q.location;
    if (q.machine) {
      const ids = await mongoose.model("MachineMaster").find({ machineName: q.machine }).distinct("_id");
      query["machiness.machineId"] = { $in: ids };
    }
    if (q.machineId) query["machiness.machineId"] = q.machineId;

    // ⚡ limit (+ page) only when asked; no limit = old behaviour
    const limit = parseInt(q.limit, 10);
    const pageNo = Math.max(parseInt(q.page, 10) || 1, 1);
    let cursor = ProductionReal.find(query).select("-__v");
    if (limit > 0) {
      const size = Math.min(limit, 1000);
      const dateFiltered = Boolean(from || to || q.month);
      const sortSpec = dateFiltered ? { productionDate: -1, createdAt: -1 } : { createdAt: -1 };
      cursor = cursor.sort(sortSpec).skip((pageNo - 1) * size).limit(size);
    }

    // ⚡ populate ONLY the fields the UI reads (activityName / machineName;
    // _id always comes along) instead of whole master documents per row.
    // guard: a request with no page limit that would load too many rows is refused instead of crashing the server
    if (!(limit > 0)) {
      const MAX_ROWS = 100000;
      const matching = Object.keys(query).length
        ? await ProductionReal.countDocuments(query)
        : await ProductionReal.estimatedDocumentCount();
      if (matching > MAX_ROWS) {
        return res.status(413).json({ message: `Too many records (${matching.toLocaleString("en-IN")}). Narrow the date range.` });
      }
    }

    const data = await cursor.lean(); // lean so we can freely attach extra fields

    // activity / machine names from the (small) master tables instead of populate()
    // same response shape, far less memory and time on big result sets
    const [actDocs, macDocs] = await Promise.all([
      mongoose.model("ActivityMaster").find({}, "activityName").lean(),
      mongoose.model("MachineMaster").find({}, "machineName").lean(),
    ]);
    const actMap = new Map(actDocs.map((a) => [String(a._id), a]));
    const macMap = new Map(macDocs.map((m) => [String(m._id), m]));
    for (let i = 0; i < data.length; i++) {
      const pairs = data[i].machiness;
      if (!pairs) continue;
      for (let j = 0; j < pairs.length; j++) {
        pairs[j].activityId = actMap.get(String(pairs[j].activityId)) || pairs[j].activityId;
        pairs[j].machineId = macMap.get(String(pairs[j].machineId)) || pairs[j].machineId;
      }
    }

    // ✅ Pull current WorkOrder orderQty for every distinct workOrder number
    const woSet = new Set();
    for (let i = 0; i < data.length; i++) {
      if (data[i].workOrder) woSet.add(data[i].workOrder);
    }
    const woNumbers = [...woSet];

    // ⚡ query in chunks so a huge $in list never hits BSON / planner limits,
    // and run the chunks in parallel
    const CHUNK = 5000;
    const chunks = [];
    for (let i = 0; i < woNumbers.length; i += CHUNK) {
      chunks.push(woNumbers.slice(i, i + CHUNK));
    }

    const chunkResults = await Promise.all(
      chunks.map((ids) =>
        WorkOrder.find(
          { efiWoNumber: { $in: ids } },
          { efiWoNumber: 1, orderQty: 1, _id: 0 }
        ).lean()
      )
    );

    const woMap = {};
    chunkResults.forEach((list) =>
      list.forEach((wo) => {
        woMap[wo.efiWoNumber] = wo.orderQty;
      })
    );

    // ✅ Attach live orderQty alongside the stored snapshot (mutate in place —
    // no second copy of the whole array)
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      item.liveOrderQty = woMap[item.workOrder] ?? item.orderQty; // fallback to snapshot if WO deleted
    }

    // total record count (only when the page asks for it)
    if (q.withCount) {
      const total = Object.keys(query).length
        ? await ProductionReal.countDocuments(query)
        : await ProductionReal.estimatedDocumentCount();
      return res.json({ data, total });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching Production Real:", error);
    res.status(500).json({ message: "Error fetching data" });
  }
});

// Distinct values for the Production Entry filter dropdowns
router.get("/filter-options", authMiddleware, async (req, res) => {
  try {
    const [productTypes, customerNames, locations, machineIds] = await Promise.all([
      ProductionReal.distinct("productType"),
      ProductionReal.distinct("customerName"),
      ProductionReal.distinct("userLocations"),
      ProductionReal.distinct("machiness.machineId"),
    ]);
    const machineDocs = await mongoose
      .model("MachineMaster")
      .find({ _id: { $in: machineIds } })
      .select("machineName")
      .lean();

    res.json({
      productTypes: productTypes.filter(Boolean),
      customerNames: customerNames.filter(Boolean),
      locations: locations.filter(Boolean),
      machineNames: [...new Set(machineDocs.map((m) => m.machineName).filter(Boolean))],
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    res.status(500).json({ message: "Error fetching options" });
  }
});

// LIGHTWEIGHT feed for the Production Report page (only the fields it reads)
router.get("/report", authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;

    const query = {};
    if (from || to) {
      query.productionDate = {};
      if (from) query.productionDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) query.productionDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const data = await ProductionReal.find(query)
      .select(
        "workOrder customerName orderQty productionDate productionFromTime productionToTime productionQty wastageQty wastePercent machineStatus userLocations createdAt productType machiness.machineId machiness.activityId"
      )
      .populate("machiness.machineId", "machineName")
      .lean();

    res.json(data);
  } catch (error) {
    console.error("Error fetching production report:", error);
    res.status(500).json({ message: "Error fetching data" });
  }
});

// UPDATE Production Real and keep user locations
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const updated = await ProductionReal.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        userLocations: user.locations || [],  
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Record not found" });

    res.json({ message: "Production updated successfully", updated });
  } catch (error) {
    console.error("Error updating Production:", error);
    res.status(500).json({ message: "Error updating production", error });
  }
});

// DELETE Production Real
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await ProductionReal.findByIdAndDelete(req.params.id);

    if (!deleted) return res.status(404).json({ message: "Record not found" });

    res.json({ message: "Production deleted successfully" });
  } catch (error) {
    console.error("Error deleting Production:", error);
    res.status(500).json({ message: "Error deleting production", error });
  }
});

module.exports = router;