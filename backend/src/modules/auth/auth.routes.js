const express = require('express');
const router = express.Router();

const { register, login, searchUsers } = require("./auth.controller");

router.post("/register", register);
router.post("/login", login);
router.get("/search", searchUsers);

module.exports = router;