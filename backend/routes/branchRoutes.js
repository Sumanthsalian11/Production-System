// ============================
// routes/branchRoutes.js
// ============================

const express = require("express");
const router = express.Router();

const Branch = require("../models/Branch");

// ✅ CREATE
router.post("/branch", async (req, res) => {
  try {

    const data = await Branch.create(req.body);

    res.json(data);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }
});

// ✅ GET ALL
router.get("/branch", async (req, res) => {
  try {

    const data = await Branch.find()
      .sort({ createdAt: -1 });

    res.json(data);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }
});

// ✅ GET BY BRANCH CODE
router.get("/branch/:code", async (req, res) => {

  try {

    const data = await Branch.findOne({
      branchCode: req.params.code
    });

    if (!data) {
      return res.status(404).json({
        message: "Branch not found"
      });
    }

    res.json(data);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});

// ✅ UPDATE
router.put("/branch/:id", async (req, res) => {

  try {

    const updated = await Branch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updated);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});

// ✅ DELETE
router.delete("/branch/:id", async (req, res) => {

  try {

    await Branch.findByIdAndDelete(req.params.id);

    res.json({
      message: "Deleted"
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});

module.exports = router;