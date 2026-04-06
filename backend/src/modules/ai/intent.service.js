const { INTENT_TYPES } = require("./intent.types");

async function extractIntent(content, senderId) {
  const lower = content.toLowerCase();

  // detect expense like: "maine 300 diye"
  const expenseRegex = /(\d+)\s*(rs|rupaye|rupee)?\s*(diya|diye)/i;
  const match = content.match(expenseRegex);

  if (match) {
    return {
      type: INTENT_TYPES.ADD_EXPENSE,
      payer: senderId,
      amount: parseInt(match[1]),
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