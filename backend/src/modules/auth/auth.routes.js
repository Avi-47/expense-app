const express = require('express');
const router = express.Router();

const { register, login, searchUsers, verifyEmail, resendOTP } = require("./auth.controller");

router.post("/register", register);
router.post("/login", login);
router.post("/verify", verifyEmail);
router.post("/resend-otp", resendOTP);
router.get("/search", searchUsers);

module.exports = router;