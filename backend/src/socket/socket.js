const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

const Message = require("../modules/chat/message.model");
const Group = require("../modules/group/group.model");
const User = require("../modules/auth/user.model");

const { extractIntent } = require("../modules/ai/intent.service");
const { INTENT_TYPES } = require("../modules/ai/intent.types");
const { explainGroup } = require("../modules/ai/ai.service");
const { callLLMStream } = require("../modules/ai/llm.service");

const { getGroupState, setGroupState, clearPendingExpense } = require("../modules/conversation/groupState.service");

const Expense = require("../modules/expense/expense.model");
const { updateBalances } = require("../modules/expense/balance.service");

let io;
let AI_USER_ID = null;

// ===============================
// Ensure AI User Exists
// ===============================
const getAIUser = async () => {
  if (AI_USER_ID) return AI_USER_ID;

  let aiUser = await User.findOne({ email: "ai@system.com" });

  if (!aiUser) {
    aiUser = await User.create({
      name: "ExpenseAI",
      email: "ai@system.com",
      password: "dummy"
    });
  }

  AI_USER_ID = aiUser._id;
  return AI_USER_ID;
};

// ===============================
// INIT SOCKET
// ===============================
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // ===============================
  // AUTH MIDDLEWARE
  // ===============================
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error"));

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("Connected:", socket.id);
    socket.join(socket.user.id); // join personal room

    // ===============================
    // JOIN GROUP
    // ===============================
    socket.on("join_group", async (groupId) => {
      const group = await Group.findById(groupId);
      if (!group) return;

      const isMember = group.members.some(
        (id) => id.toString() === socket.user.id
      );

      if (!isMember) return;

      socket.join(groupId);
    });

    // ===============================
    // SEND MESSAGE
    // ===============================
    socket.on("send_message", async ({ groupId, receiverId, content }) => {

      try {

        // =====================================
        // 1️⃣ DIRECT MESSAGE (USER ↔ USER)
        // =====================================
        if (receiverId) {

          const message = await Message.create({
            sender: socket.user.id,
            receiver: receiverId,
            content,
            type: "text"
          });

          const populated = await message.populate("sender", "name");

          // send to receiver
          io.to(receiverId).emit("message_received", populated);

          // send to sender
          socket.emit("message_received", populated);

          return;
        }


        // =====================================
        // 2️⃣ GROUP MESSAGE
        // =====================================
        if (!groupId) return;

        const group = await Group.findById(groupId);
        if (!group) return;

        const isMember = group.members.some(
          (id) => id.toString() === socket.user.id
        );

        if (!isMember) return;

        const message = await Message.create({
          groupId,
          sender: socket.user.id,
          content,
          type: "text"
        });

        const populated = await message.populate("sender", "name");
        
        // Add groupId to the message for frontend identification
        populated.groupId = groupId;

        // Send to the group room (all members including sender)
        io.to(groupId).emit("message_received", populated);

        // Update group's last message for sorting
        await Group.findByIdAndUpdate(groupId, {
          lastMessage: content,
          lastMessageAt: new Date()
        });

        const intent = await extractIntent(content, socket.user.id);

        // =====================================================
        // 1️⃣ ADD EXPENSE (INCOMPLETE → WAIT FOR CLARIFICATION)
        // =====================================================
        console.log("Detected Intent:", intent);
        if (intent.type === INTENT_TYPES.ADD_EXPENSE) {
          console.log("Pending expense stored. Asking clarification.");

          const state = await getGroupState(groupId);

          state.pendingExpense = intent;

          await setGroupState(groupId, state);

          io.to(groupId).emit("expense_clarification_needed", {
            message: "Ye expense sab members ke liye tha?"
          });

          return;
        }

        // =====================================================
        // 2️⃣ HANDLE CLARIFICATION
        // =====================================================
        if (intent.type === INTENT_TYPES.DISCUSSION) {

          const state = await getGroupState(groupId);

          if (
            state.pendingExpense &&
            content.toLowerCase().includes("sab")
          ) {

            const groupWithMembers = await Group.findById(groupId).populate("members");

            const participants = groupWithMembers.members.map(m =>
              m._id.toString()
            );

            const baseShare = Math.floor(amount / participants.length);
            const remainder = amount % participants.length;

            const splits = participants.map((userId, index) => {
              const isPayer = userId.toString() === payerId.toString();

              const userShare = baseShare + (index === 0 ? remainder : 0);

              return {
                user: userId,
                amount: userShare,
                paidAmount: isPayer ? userShare : 0,
                status: isPayer ? "PAID" : "PENDING"
              };
            });


            const expense = await Expense.create({
              groupId,
              paidBy: state.pendingExpense.payer,
              amount: state.pendingExpense.amount,
              description: "Auto detected expense",
              splits
            });

            await updateBalances(
              groupId,
              state.pendingExpense.payer,
              splits
            );

            await clearPendingExpense(groupId);

            io.to(groupId).emit("expense_added", expense);

            return;
          }
        }

        // =====================================================
        // 3️⃣ AI BALANCE QUERY
        // =====================================================
        if (intent.type === INTENT_TYPES.QUERY_BALANCE) {

          const aiUserId = await getAIUser();

          const prompt = await explainGroup(
            groupId,
            socket.user.id,
            content
          );

          let finalMessage = "";

          await callLLMStream(prompt, (token) => {
            finalMessage += token;

            io.to(groupId).emit("ai_stream_chunk", {
              sender: "ExpenseAI",
              token
            });
          });

          const aiMessage = await Message.create({
            groupId,
            sender: aiUserId,
            content: finalMessage,
            type: "text"
          });

          const populatedAI = await aiMessage.populate("sender", "name");

          io.to(groupId).emit("ai_stream_end");
          io.to(groupId).emit("message_received", populatedAI);
        }

      } catch (err) {
        console.error("Socket error:", err.message);
      }
    });

    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};

module.exports = { initSocket, getIO };