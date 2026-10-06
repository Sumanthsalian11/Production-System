const express = require("express");
const router = express.Router();
const ProductionReal = require("../models/ProductionReal");
const User = require("../models/User"); 
const WorkOrder = require("../models/WorkOrder"); // add this import at top
const authMiddleware = require("../middleware/authMiddleware");


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
    const { from, to } = req.query;

    const query = {};
    if (from || to) {
      query.productionDate = {};
      if (from) query.productionDate.$gte = new Date(from);
      if (to) query.productionDate.$lte = new Date(to);
    }

    // ⚡ populate ONLY the fields the UI reads (activityName / machineName;
    // _id always comes along) instead of whole master documents per row.
    // ⚡ allowDiskUse-free plain find + lean = no Mongoose document hydration.
    const data = await ProductionReal.find(query)
      .select("-__v")
      .populate("machiness.activityId", "activityName")
      .populate("machiness.machineId", "machineName")
      .lean(); // lean so we can freely attach extra fields

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

    res.json(data);
  } catch (error) {
    console.error("Error fetching Production Real:", error);
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