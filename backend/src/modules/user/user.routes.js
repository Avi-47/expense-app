const express = require("express");
const router = express.Router();

const User = require("../auth/user.model"); // adjust if needed
const Message = require("../chat/message.model");
const authMiddleware = require("../../middlewares/auth.middleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Search users by email
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) {
      return res.json([]);
    }

    const users = await User.find({
      email: { $regex: q, $options: "i" }
    }).select("name email");

    res.json(users);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all personal chat conversations for the logged-in user
router.get("/conversations", async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId)
      .populate("conversations.participantId", "name email");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Filter out any null participants and sort by last message time
    const conversations = user.conversations
      .filter(conv => conv.participantId)
      .sort((a, b) => {
        // Sort by lastMessageAt, fallback to updatedAt or createdAt
        const dateA = a.lastMessageAt || a.updatedAt || new Date(0);
        const dateB = b.lastMessageAt || b.updatedAt || new Date(0);
        return new Date(dateB) - new Date(dateA);
      });
    
    res.json(conversations);

  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add or update a personal chat conversation
router.post("/conversations", async (req, res) => {
  try {
    const userId = req.user.id;
    const { participantId } = req.body;
    
    if (!participantId) {
      return res.status(400).json({ message: "participantId is required" });
    }
    
    const user = await User.findById(userId);
    const participant = await User.findById(participantId);
    
    if (!user || !participant) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if conversation already exists
    const existingConv = user.conversations.find(
      conv => conv.participantId.toString() === participantId
    );
    
    if (existingConv) {
      // Update timestamp
      existingConv.updatedAt = new Date();
      await user.save();
    } else {
      // Add new conversation
      user.conversations.push({
        participantId,
        lastMessage: "",
        lastMessageAt: new Date(),
        updatedAt: new Date()
      });
      await user.save();
    }
    
    // Also add to the other user's conversations if not already there
    const otherUser = await User.findById(participantId);
    const otherHasConv = otherUser.conversations.find(
      conv => conv.participantId.toString() === userId
    );
    
    if (!otherHasConv) {
      otherUser.conversations.push({
        participantId: userId,
        lastMessage: "",
        lastMessageAt: new Date(),
        updatedAt: new Date()
      });
      await otherUser.save();
    }
    
    res.json({ message: "Conversation added/updated" });

  } catch (err) {
    console.error("Error adding conversation:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update conversation with last message (called when sending/receiving messages)
router.put("/conversations/:participantId", async (req, res) => {
  try {
    const userId = req.user.id;
    const { participantId } = req.params;
    const { lastMessage } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const conv = user.conversations.find(
      c => c.participantId.toString() === participantId
    );
    
    if (conv) {
      conv.lastMessage = lastMessage || conv.lastMessage;
      conv.lastMessageAt = new Date();
      conv.updatedAt = new Date();
      await user.save();
    }
    
    // Also update the other user's conversation
    const otherUser = await User.findById(participantId);
    if (otherUser) {
      const otherConv = otherUser.conversations.find(
        c => c.participantId.toString() === userId
      );
      if (otherConv) {
        otherConv.lastMessage = lastMessage || otherConv.lastMessage;
        otherConv.lastMessageAt = new Date();
        otherConv.updatedAt = new Date();
        await otherUser.save();
      }
    }
    
    res.json({ message: "Conversation updated" });

  } catch (err) {
    console.error("Error updating conversation:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get messages between logged-in user and another user
router.get("/messages/:participantId", async (req, res) => {
  try {
    const userId = req.user.id;
    const { participantId } = req.params;
    
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: participantId },
        { sender: participantId, receiver: userId }
      ]
    })
      .sort({ createdAt: 1 })
      .populate("sender", "name email");
    
    res.json(messages);

  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;