const { getUserBalances, simplifyDebts } = require("../expense/balance.service");
const { callLLM } = require("./llm.service");
const Expense = require("../expense/expense.model");

exports.generateGroupSummary = async (groupId, userId) => {
  const balances = await getUserBalances(groupId, userId);
  const simplified = await simplifyDebts(groupId);

  const expenses = await Expense.find({ groupId })
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    balances,
    simplified,
    recentExpenses: expenses
  };
};

exports.explainGroup = async (groupId, userId, userQuery) => {
  const balances = await getUserBalances(groupId, userId);
  const simplified = await simplifyDebts(groupId);

  const prompt = `
This is a group expense app.

Users share expenses and balances exist ONLY between group members.

User Question:
"${userQuery}"

Current Member Balances (who owes whom):
${JSON.stringify(balances, null, 2)}

Optimized Settlements:
${JSON.stringify(simplified, null, 2)}

Explain clearly who owes whom.
If everything is zero, say no expenses recorded.
Do NOT invent accounts.
`;

  return await callLLM(prompt);
};
