const express = require("express");
const router = express.Router();
const dispatchController = require("../controllers/dispatchController");

// 🔹 Fetch WO details by WO Number
router.get("/workorder/:woNumber", dispatchController.getWorkOrderByNumber);

// 🔹 Create dispatch
router.post("/create", dispatchController.createDispatch);

// 🔹 Fetch all dispatch records for table
router.get("/list", dispatchController.getAllDispatches);
router.put("/:id", dispatchController.updateDispatch);
// 🔹 Delete a dispatch by ID
router.delete("/:id", dispatchController.deleteDispatch);

module.exports = router;