const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

// Create Order
router.post("/create", authMiddleware, orderController.createOrder);

// Get Customer Orders
router.get("/my-orders", authMiddleware, orderController.getCustomerOrders);

module.exports = router;
