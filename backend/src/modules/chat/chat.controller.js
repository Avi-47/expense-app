const Message = require("./message.model")
const Group = require("../group/group.model")

// Get message
exports.getMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group Not Found" });
    }

    if (!group.members || !Array.isArray(group.members)) {
      return res.status(500).json({ message: "Group members not initialized properly" });
    }

    const isMember = group.members.some(
      (memberId) => memberId.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const messages = await Message.find({ groupId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("sender", "name");

    res.json(messages.reverse());
    console.log("req.user.id:", req.user.id);
    console.log("group.members:", group.members);

  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Only allow deleting own messages
    if (String(message.sender) !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this message" });
    }

    await Message.findByIdAndDelete(messageId);
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ message: err.message });
  }
};
