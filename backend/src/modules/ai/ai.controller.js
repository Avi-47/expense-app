const { callLLMStream } = require("./llm.service");
const { generateGroupSummary } = require("./ai.service");
const { getIO } = require("../../socket/socket");

exports.askAIStream = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { question } = req.body;

    const io = getIO();

    const data = await generateGroupSummary(groupId, req.user.id);

    const prompt = `
User question: "${question}"

Balances:
${JSON.stringify(data.balances)}

Simplified Transactions:
${JSON.stringify(data.simplified)}

Recent Expenses:
${JSON.stringify(data.recentExpenses)}

Explain clearly in same language.
Do not invent numbers.
`;

    const socketId = req.headers["x-socket-id"];

    await callLLMStream(prompt, (token) => {
      io.to(socketId).emit("ai_stream_chunk", token);
    });

    io.to(socketId).emit("ai_stream_end");

    const aiMessage = await Message.create({
      groupId,
      sender: AI_USER_ID,
      content: finalMessage,
      type: "text"
    });

    io.to(groupId).emit("message_received", aiMessage);

    res.json({ status: "streaming_started" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
