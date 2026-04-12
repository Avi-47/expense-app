const express = require('express');
const router = express.Router();

const { sendOtp, verifyOtp, completeRegister, login, searchUsers, forgotPassword, resetPassword } = require("./auth.controller");

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/complete-register", completeRegister);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/search", searchUsers);

module.exports = router;