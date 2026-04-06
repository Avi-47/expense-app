const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const { askAIStream } = require("./ai.controller");

router.post("/:groupId", authMiddleware, askAIStream);


module.exports = router;
