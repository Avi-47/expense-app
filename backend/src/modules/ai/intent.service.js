const { INTENT_TYPES } = require("./intent.types");

async function extractIntent(content, senderId) {
  const lower = content.toLowerCase();

  // detect expense like: "maine 300 diye"
  const expenseRegex = /(\d+)\s*(rs|rupaye|rupee)?\s*(diya|diye)/i;
  const match = content.match(expenseRegex);

  if (match) {
    const parsedAmount = parseInt(match[1], 10);
    return {
      type: INTENT_TYPES.ADD_EXPENSE,
      payers: [
        { user: senderId, amount: parsedAmount }
      ],
      amount: parsedAmount,
      participants: null,
      status: "INCOMPLETE"
    };
  }

  if (lower.includes("hisab") || lower.includes("calculate")) {
    return {
      type: INTENT_TYPES.QUERY_BALANCE
    };
  }

  return { type: INTENT_TYPES.DISCUSSION };
}

module.exports = { extractIntent };