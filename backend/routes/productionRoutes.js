const express = require("express");
const router = express.Router();
const Production = require("../models/Production");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getWorkOrder,
  saveProduction,
  getLastReelData,
  getReelsByWorkOrder  // ✅ add this
} = require("../controllers/productionController");

router.get("/workorder/:efi",authMiddleware, getWorkOrder);
router.get("/reel/:reelNo", authMiddleware, getLastReelData);
router.post("/", authMiddleware, saveProduction);
router.get("/workorder/:wo/reels", authMiddleware, getReelsByWorkOrder);



// GET ALL RECORDS
router.get("/", authMiddleware,  async (req, res) => {
  const data = await Production.find().sort({ createdAt: -1 });
  res.json(data);
});


// UPDATE
router.put("/:id", authMiddleware, async (req, res) => {
  const updated = await Production.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
});

// DELETE
router.delete("/:id", authMiddleware, async (req, res) => {
  await Production.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

router.put("/:id", authMiddleware, async (req, res) => {
  const updated = await Production.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
});
module.exports = router;