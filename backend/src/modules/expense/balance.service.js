const Expense = require("./expense.model");
const engine = require("./balance-engine.service");

const toUserId = (value) => String(value || "").trim();
const toCents = (value) => {
  if (value === null || value === undefined) {
    throw new Error("Amount is required");
  }

  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));

  if (!Number.isSafeInteger(cents)) {
    throw new Error("Amount is out of supported range");
  }

  return cents;
};

const fromCents = (cents) => cents / 100;

const rebuildGroupBalances = async (groupId) => {
  return await engine.rebuildGroupMatrix(groupId);
};

exports.updateBalances = async (groupId) => {
  return await rebuildGroupBalances(groupId);
};

exports.removeExpenseBalances = async (groupId) => {
  return await rebuildGroupBalances(groupId);
};

exports.getBalances = async (groupId) => {
  return await engine.getGroupMatrix(groupId);
};

exports.getUserBalances = async (groupId, currentUserId) => {
  return await engine.getUserBalances(groupId, String(currentUserId));
};

exports.getGroupMatrix = async (groupId) => {
  return await engine.getGroupMatrix(groupId);
};

exports.rebuildGroupBalances = rebuildGroupBalances;

exports.simplifyDebts = async (groupId) => {
  return await engine.getGroupMatrix(groupId);
};

exports.calculateGroupNet = async (groupId) => {
  const expenses = await Expense.find({ groupId }).select("amount payers splits");
  const net = new Map();

  for (const expense of expenses) {
    let splitNetTotalCents = 0;

    for (const split of expense.splits || []) {
      const userId = toUserId(split.user);
      const shareCents = toCents(split.amount);
      const paidCents = toCents(split.paidAmount);
      const netCents = paidCents - shareCents;
      splitNetTotalCents += netCents;
      net.set(userId, (net.get(userId) || 0) + netCents);
    }

    if (splitNetTotalCents !== 0) {
      throw new Error(`Expense ${expense._id} net sum mismatch`);
    }
  }

  const result = {};
  for (const [userId, cents] of net.entries()) {
    result[userId] = fromCents(cents);
  }

  return result;
};
