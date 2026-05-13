const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");

/* CUSTOMER */
router.post("/customer/register", authController.customerRegister);
router.post("/customer/login", authController.customerLogin);

/* INTERNAL */
router.post("/internal/register", authController.internalRegister);
router.post("/internal/login", authController.internalLogin);

/* GET LOGGED IN USER */
router.get("/internal/me", protect, authController.getMe);

/* 🔥 NEW ADMIN FEATURES */
router.get("/internal/users", protect, authController.getAllInternalUsers);
router.delete("/internal/user/:id", protect, authController.deleteInternalUser);
router.put("/internal/user/:id", protect, authController.updateInternalUser);
router.put("/change-password", protect, authController.changePassword);
module.exports = router;