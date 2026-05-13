const Production = require("../models/Production");

exports.getSummary = async (req, res) => {
  try {
    // CUSTOMER SUMMARY
    const customerSummary = await Production.aggregate([
      {
        $group: {
          _id: "$customerName",
          totalWeight: { $sum: "$actualNetWeight" },
          totalWaste: { $sum: "$totalWaste" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // MILL SUMMARY
    const millSummary = await Production.aggregate([
      {
        $group: {
          _id: "$millName",
          totalWeight: { $sum: "$actualNetWeight" },
          totalWaste: { $sum: "$totalWaste" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ customerSummary, millSummary });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
