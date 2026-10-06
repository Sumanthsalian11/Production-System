const Production = require("../models/Production");
const WorkOrder = require("../models/WorkOrder");

// ✅ Return only the material rows that match the selected description.
// (no description given → keep all rows, same as the old behaviour)
const pickSelectedMaterials = (wo, materialDescription) => {
  const all = wo.materials || [];
  if (!materialDescription) return all;

  const matched = all.filter(
    (m) => m.materialDescription === materialDescription
  );

  return matched.length > 0 ? matched : all;
};

// 🔍 FETCH WORK ORDER BY EFI NUMBER
exports.getWorkOrder = async (req, res) => {
  try {
    const efi = Number(req.params.efi);

    // lean() returns the raw stored document, so old fields that are no
    // longer in the schema (like a top-level UPS) are not dropped
    const wo = await WorkOrder.findOne({ efiWoNumber: efi }).lean();

    if (!wo) return res.status(404).json({ message: "WO not found" });

    // accept both UPS and ups, at WO level and on each machine row
    const upsOf = (o) => o?.UPS ?? o?.ups;

    const upsList = [upsOf(wo), ...(wo.machines || []).map(upsOf)].filter(
      (v) => v !== undefined && v !== null && v !== "" && v !== 0
    );

    res.json({
      id: wo._id,
      date: wo.woDate,
      customerName: wo.customer,
      jobDescription: wo.productName,
      productType: wo.productType,

      colorFront: wo.colorFront,
      colorBack: wo.colorBack,

      jobSize: wo.jobSize,
      materials: wo.materials,
      machines: wo.machines || [],

      UPS: upsOf(wo) ?? null, // top-level UPS, used by old work orders
      ups: upsList,

      qty: wo.qtyInLvs,
      orderQty: wo.orderQty,
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
      productType,
      coreWeight,
      balance,
      mill,
      productionUser,
      productionType,
      materialDescription,   // ✅ NEW – selected material
      remarks
    } = req.body;

    if (!mill) {
      return res.status(400).json({ message: "Mill is required" });
    }

    const wo = await WorkOrder.findOne({ efiWoNumber });

    if (!wo) return res.status(404).json({ message: "WO not found" });

    // ✅ If the WO has several materials, one must be selected
    const distinctDescriptions = [
      ...new Set(
        (wo.materials || []).map((m) => m.materialDescription).filter(Boolean)
      )
    ];

    if (distinctDescriptions.length > 1 && !materialDescription) {
      return res
        .status(400)
        .json({ message: "Material Description is required" });
    }

    // ✅ Keep ONLY the selected material (not every material of the WO)
    const selectedMaterials = pickSelectedMaterials(wo, materialDescription);

    // 🔥 GET UPS FROM WORK ORDER + MACHINE ROWS
    const upsValues = [
      wo.UPS,
      ...(wo.machines || []).map(m => m.UPS)
    ].filter(
      v => v !== undefined &&
           v !== null &&
           v !== "" &&
           v !== 0
    );

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
      customerName: wo.customer,
      jobDescription: wo.productName,
      jobSize: wo.jobSize,
      materials: selectedMaterials,                        // ✅ only selected material
      materialDescription: materialDescription
        || selectedMaterials[0]?.materialDescription
        || "",                                             // ✅ NEW
      ups: upsValues,
      productType,
      colorFront: Number(wo.colorFront) || 0,
      colorBack: Number(wo.colorBack) || 0,

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

// ✏️ UPDATE PRODUCTION ENTRY
exports.updateProduction = async (req, res) => {
  try {
    const {
      mattWaste,
      printWaste,
      realEndWaste,
      coreWeight,
      actualNetWeight,
      materialDescription   // ✅ NEW
    } = req.body;

    const totalWaste =
      Number(mattWaste || 0) +
      Number(printWaste || 0) +
      Number(realEndWaste || 0) +
      Number(coreWeight || 0);

    const wastePercent =
      Number(actualNetWeight) > 0
        ? ((totalWaste / Number(actualNetWeight)) * 100).toFixed(2)
        : 0;

    const updateData = {
      ...req.body,
      totalWaste,
      wastePercent
    };

    // ✅ Keep the stored materials in sync with the selected description
    if (materialDescription) {
      const existing = await Production.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({ message: "Reel not found" });
      }

      const wo = await WorkOrder.findOne({
        efiWoNumber: existing.efiWoNumber
      });

      if (wo) {
        updateData.materials = pickSelectedMaterials(wo, materialDescription);
      }
    }

    const updated = await Production.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Reel not found" });
    }

    res.json(updated);

  } catch (err) {
    console.log("UPDATE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


// 🗑️ DELETE PRODUCTION ENTRY
exports.deleteProduction = async (req, res) => {
  try {
    const deleted = await Production.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Reel not found" });
    }

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.log("DELETE ERROR:", err);
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