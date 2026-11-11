const express = require("express");
const router = express.Router();
const dispatchController = require("../controllers/dispatchController");
const upload = require("../middleware/upload");

// 🔹 Fetch WO details by WO Number
router.get("/workorder/:woNumber", dispatchController.getWorkOrderByNumber);

// 🔹 Create dispatch
router.post("/create", upload.single("attachment"), dispatchController.createDispatch);

// 🔹 Fetch all dispatch records for table
router.get("/list", dispatchController.getAllDispatches);

// 🔹 Update dispatch
router.put("/:id", upload.single("attachment"), dispatchController.updateDispatch);

// 🔹 Delete a dispatch by ID
router.delete("/:id", dispatchController.deleteDispatch);

router.get("/ticket/:ticketNo", dispatchController.getOrderByTicketNo);
router.post("/bulk-import", dispatchController.bulkImportDispatch);

module.exports = router;