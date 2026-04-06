const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");

const {
  createPaymentIntent,
  handleWebhook
} = require("./payment.controller");

router.post("/:groupId/create-intent", authMiddleware, createPaymentIntent);

router.post("/webhook", handleWebhook);

module.exports = router;
