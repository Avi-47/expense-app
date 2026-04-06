const { redisClient } = require("../../config/redis");

const getBalanceKey = (groupId) => `group:${groupId}:balances`;

// ===============================
// UPDATE BALANCES
// ===============================
exports.updateBalances = async (groupId, paidBy, splits) => {
  const key = getBalanceKey(groupId);

  for (const split of splits) {

    if (split.user.toString() === paidBy.toString()) continue;

    const pairKey = `${paidBy}:${split.user}`;
    const reverseKey = `${split.user}:${paidBy}`;

    const existing = await redisClient.hGet(key, pairKey);
    const reverseExisting = await redisClient.hGet(key, reverseKey);

    const amount = split.amount;

    if (reverseExisting) {

      const net = parseFloat(reverseExisting) - amount;

      if (net > 0) {
        await redisClient.hSet(key, reverseKey, net);
      } 
      else if (net < 0) {
        await redisClient.hDel(key, reverseKey);
        await redisClient.hSet(key, pairKey, Math.abs(net));
      } 
      else {
        await redisClient.hDel(key, reverseKey);
      }

    } else {

      const updated = existing ? parseFloat(existing) + amount : amount;
      await redisClient.hSet(key, pairKey, updated);

    }
  }
};

// ===============================
// GET ALL BALANCES
// ===============================
exports.getBalances = async (groupId) => {
  const key = getBalanceKey(groupId);
  return await redisClient.hGetAll(key);
};

// ===============================
// GET USER SPECIFIC BALANCES
// ===============================
exports.getUserBalances = async (groupId, userId) => {

  const key = getBalanceKey(groupId);
  const allBalances = await redisClient.hGetAll(key);

  const result = {};

  for (const pair in allBalances) {

    const [creditor, debtor] = pair.split(":");
    const amount = parseFloat(allBalances[pair]);

    if (creditor === userId) {
      result[debtor] = { type: "owes_you", amount };
    }

    if (debtor === userId) {
      result[creditor] = { type: "you_owe", amount };
    }
  }

  return result;
};

// ===============================
// SIMPLIFY DEBTS
// ===============================
exports.simplifyDebts = async (groupId) => {

  const key = getBalanceKey(groupId);
  const raw = await redisClient.hGetAll(key);

  const net = {};

  for (const pair in raw) {

    const [creditor, debtor] = pair.split(":");
    const amount = parseFloat(raw[pair]);

    if (!net[creditor]) net[creditor] = 0;
    if (!net[debtor]) net[debtor] = 0;

    net[creditor] += amount;
    net[debtor] -= amount;
  }

  const creditors = [];
  const debtors = [];

  for (const user in net) {
    if (net[user] > 0) {
      creditors.push({ user, amount: net[user] });
    } 
    else if (net[user] < 0) {
      debtors.push({ user, amount: -net[user] });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const simplified = [];

  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {

    const settleAmount = Math.min(
      creditors[i].amount,
      debtors[j].amount
    );

    simplified.push({
      from: debtors[j].user,
      to: creditors[i].user,
      amount: settleAmount
    });

    creditors[i].amount -= settleAmount;
    debtors[j].amount -= settleAmount;

    if (creditors[i].amount === 0) i++;
    if (debtors[j].amount === 0) j++;
  }

  return simplified;
};
