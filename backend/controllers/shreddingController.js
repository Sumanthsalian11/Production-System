const Production = require("../models/Production");
const Shredding = require("../models/Shredding");

exports.getWasteByWO = async (req, res) => {
  try {
    const efiWoNumber = Number(req.params.wo);

    const reels = await Production.find({
      efiWoNumber,
    })
      .select(
        "reelNo productionDate mattWaste printWaste realEndWaste"
      )
      .sort({ productionDate: -1 });

    const data = reels.map((r) => ({
      productionId: r._id,
      reelNo: r.reelNo,
      productionDate: r.productionDate,
      mattWaste: r.mattWaste || 0,
      printWaste: r.printWaste || 0,
      realEndWaste: r.realEndWaste || 0,
      totalWaste:
        Number(r.mattWaste || 0) +
        Number(r.printWaste || 0) +
        Number(r.realEndWaste || 0),
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};
exports.saveShredding = async (req, res) => {
  try {
    const {
      efiWoNumber,
      reelNo,
      productionId,
      shreddingDate,
      mattWaste,
      printWaste,
      realEndWaste,
      totalWaste,
      planningUser,
    } = req.body;

    const shredding = await Shredding.create({
      efiWoNumber,
      reelNo,
      productionId,

      mattWaste,
      printWaste,
      realEndWaste,
      totalWaste,

      shreddingDate,

      planningUser,

      userLocations: req.user.locations || [],
    });

    res.status(201).json(shredding);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};
exports.getShreddingByWO = async (req, res) => {
  try {
    const data = await Shredding.find({
      efiWoNumber: req.params.wo,
    }).sort({ shreddingDate: -1 });

    res.json(data);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};