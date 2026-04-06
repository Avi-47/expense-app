const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const { getBalances, settle, simplify } = require("./settlement.controller");

router.get("/:groupId/balances", authMiddleware, getBalances);
router.post("/:groupId/settle", authMiddleware, settle);
router.get("/:groupId/simplify", authMiddleware, simplify);

module.exports = router;