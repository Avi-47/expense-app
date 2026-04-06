const Expense = require("./expense.model");
const { updateBalances } = require("./balance.service");

exports.createExpenseFromAI = async (
  groupId,
  senderId,
  intent,
  groupMembersPopulated,
  io
) => {
  try {

    if (!intent.amount || intent.amount <= 0) {
      return;
    }

    if (!groupMembersPopulated || groupMembersPopulated.length === 0) {
      return;
    }

    // Resolve participants names to real IDs
    let participants = [];

    if (!intent.participants || intent.participants.length === 0) {
      participants = groupMembersPopulated.map(m => m._id.toString());
    } else {
      participants = groupMembersPopulated
        .filter(member =>
          intent.participants.some(p =>
            member.name.toLowerCase().includes(p.toLowerCase())
          )
        )
        .map(m => m._id.toString());
    }

    if (!participants.includes(senderId)) {
      participants.push(senderId);
    }

    // ❌ DO NOT CREATE EXPENSE HERE
    // ❌ DO NOT UPDATE BALANCES HERE

    // ✅ Emit proposal only
    io.to(groupId).emit("expense_proposal", {
      description: intent.description || "Expense",
      amount: intent.amount,
      involvedUsers: participants,
      splitType: intent.splitType || "equal"
    });

  } catch (err) {
    console.error("AI expense proposal error:", err.message);
  }
};