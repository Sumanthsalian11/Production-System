const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const shreddingController = require(
  "../controllers/shreddingController"
);

router.get(
  "/wo/:wo",
  authMiddleware,
  shreddingController.getWasteByWO
);

router.post(
  "/",
  authMiddleware,
  shreddingController.saveShredding
);

router.get(
  "/history/:wo",
  authMiddleware,
  shreddingController.getShreddingByWO
);

module.exports = router;