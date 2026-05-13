const Production = require("../models/Production");
const WorkOrder = require("../models/WorkOrder");


// 🔍 FETCH WORK ORDER BY EFI NUMBER
exports.getWorkOrder = async (req, res) => {
  try {
    const efi = Number(req.params.efi);

    const wo = await WorkOrder.findOne({ efiWoNumber: efi });

    if (!wo) return res.status(404).json({ message: "WO not found" });

    res.json({
      id: wo._id,
      date: wo.woDate,
      customerName: wo.customer,   // ✅ STRING directly
      jobDescription: wo.productName,
      jobSize: wo.jobSize,
      materials: wo.materials,
      ups: wo.UPS,
      qty: wo.qtyInLvs,
    });

  } catch (err) {
    console.log("GET WO ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


// 🔍 FETCH LAST REEL ENTRY
exports.getLastReelData = async (req, res) => {
  try {
    const reelNo = req.params.reelNo;

    const lastEntry = await Production.findOne({ reelNo })
      .sort({ createdAt: -1 });

    if (!lastEntry) {
      return res.json(null);
    }

    res.json({
      reelNo: lastEntry.reelNo,
      balance: lastEntry.balance
    });

  } catch (err) {
    console.log("LAST REEL ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


// 💾 SAVE PRODUCTION ENTRY
exports.saveProduction = async (req, res) => {
  try {
    const {
  efiWoNumber,
  productionDate,
  reelNo,
  grossWeight,
  millNetWeight,
  actualNetWeight,
  actualGsm,
  productionOutput,
  mattWaste,
  printWaste,
  realEndWaste,
  coreWeight,
  balance,
  mill,
  productionUser,
  productionType ,  // ✅ ADD THIS
  remarks
} = req.body;

    if (!mill) {
      return res.status(400).json({ message: "Mill is required" });
    }

    const wo = await WorkOrder.findOne({ efiWoNumber });

    if (!wo) return res.status(404).json({ message: "WO not found" });

    // 🔥 CHECK PREVIOUS ENTRY WITH SAME REEL NO
    const previous = await Production.findOne({ reelNo })
      .sort({ createdAt: -1 });

    let finalActualNetWeight = Number(actualNetWeight);

    // ✅ Auto-fill only if empty
    if (!actualNetWeight && previous) {
      finalActualNetWeight = previous.actualNetWeight;
    }

    const totalWaste =
      Number(mattWaste || 0) +
      Number(printWaste || 0) +
      Number(realEndWaste || 0) +
      Number(coreWeight || 0);

    const wastePercent =
      finalActualNetWeight > 0
        ? ((totalWaste / finalActualNetWeight) * 100).toFixed(2)
        : 0;

    const production = await Production.create({
    
      efiWoNumber,
      date: wo.woDate,
      productionDate: productionDate
        ? new Date(productionDate)
        : new Date(),

      // ✅ WORK ORDER DETAILS
      customerName: wo.customer,      // ✅ FIXED
      jobDescription: wo.productName,
      jobSize: wo.jobSize,
      materials: wo.materials,
      ups: wo.UPS,

      // ✅ PRODUCTION DETAILS
      reelNo,
      grossWeight: Number(grossWeight),
      millNetWeight: Number(millNetWeight),
      actualNetWeight: finalActualNetWeight,
      actualGsm: Number(actualGsm),
      productionOutput: Number(productionOutput),

      mattWaste: Number(mattWaste || 0),
      printWaste: Number(printWaste || 0),
      realEndWaste: Number(realEndWaste || 0),
      coreWeight: Number(coreWeight || 0),

      totalWaste,
      wastePercent,
      balance: Number(balance) || 0,
      mill,
      productionType,   
      productionUser,
     userLocations: req.user.locations || [],
      remarks: remarks || ""
    });

    res.status(201).json(production);

  } catch (err) {
    console.log("SAVE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


// 🔍 FETCH ALL REELS BY WORK ORDER
exports.getReelsByWorkOrder = async (req, res) => {
  try {
    const reels = await Production.find({
      efiWoNumber: req.params.wo
    }).sort({ createdAt: 1 });

    res.json(reels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching reels" });
  }
};