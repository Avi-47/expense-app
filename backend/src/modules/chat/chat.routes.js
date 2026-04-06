const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const {getMessages, deleteMessage} = require("./chat.controller")

router.get("/:groupId/messages",authMiddleware,getMessages);
router.delete("/:groupId/messages/:messageId",authMiddleware,deleteMessage);
module.exports = router;
