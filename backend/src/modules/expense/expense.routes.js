const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");

// Only import confirm from confirm-expense file
const { confirmExpense } = require("./confirm-expense.controller");

router.post("/:groupId/confirm", authMiddleware, confirmExpense);

module.exports = router;
