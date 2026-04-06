const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const {
  settlePayment,
  getBalances,
  simplifyDebts
} = require("./settlement.controller");

router.post("/:groupId", authMiddleware, settlePayment);

router.get("/:groupId/balances", authMiddleware, getBalances);

router.get("/:groupId/simplify", authMiddleware, simplifyDebts);

module.exports = router;
