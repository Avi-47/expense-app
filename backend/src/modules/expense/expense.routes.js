const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");

const { confirmExpense, deleteExpense } = require("./confirm-expense.controller");

router.post("/:groupId/confirm", authMiddleware, confirmExpense);
router.delete("/:expenseId", authMiddleware, deleteExpense);

module.exports = router;
