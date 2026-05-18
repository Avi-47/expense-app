const Group = require("../group/group.model");
const Expense = require("./expense.model");
const Settlement = require("./settlement.model");
const GroupBalance = require("./balance.model");

const toCents = (value) => {
  if (value === null || value === undefined) throw new Error("Amount is required");
  const raw = String(value).trim();
  const [whole, fraction = ""] = raw.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
};

const fromCents = (cents) => cents / 100;

const cloneMatrix = (matrix = {}) => JSON.parse(JSON.stringify(matrix || {}));

const getGroupMemberIds = async (groupId) => {
  const group = await Group.findById(groupId).select("members");
  if (!group) {
    throw new Error("Group not found");
  }

  return [...new Set((group.members || []).map((member) => toUserId(member)).filter(Boolean))];
};

const createEmptyMatrix = (memberIds = []) => {
  const matrix = {};

  for (const userId of memberIds) {
    matrix[userId] = matrix[userId] || {};
    for (const otherUserId of memberIds) {
      if (userId === otherUserId) {
        continue;
      }

      matrix[userId][otherUserId] = 0;
    }
  }

  return matrix;
};

const normalizeMatrixShape = (matrix = {}, memberIds = []) => {
  const nextMatrix = cloneMatrix(matrix);
  const ids = [...new Set([
    ...memberIds.map(toUserId).filter(Boolean),
    ...Object.keys(nextMatrix),
    ...Object.values(nextMatrix).flatMap((row) => Object.keys(row || {}))
  ])];

  for (const userId of ids) {
    if (!nextMatrix[userId]) {
      nextMatrix[userId] = {};
    }
  }

  for (const userId of ids) {
    for (const otherUserId of ids) {
      if (userId === otherUserId) {
        continue;
      }

      const forward = Number(nextMatrix[userId][otherUserId] || 0);
      const reverse = Number(nextMatrix[otherUserId][userId] || 0);
      if (forward === 0 && reverse === 0) {
        nextMatrix[userId][otherUserId] = 0;
        nextMatrix[otherUserId][userId] = 0;
      } else {
        nextMatrix[userId][otherUserId] = forward;
        nextMatrix[otherUserId][userId] = -forward;
      }
    }
  }

  return nextMatrix;
};

const addDirectedDelta = (matrix, fromUser, toUser, deltaCents) => {
  const source = toUserId(fromUser);
  const target = toUserId(toUser);

  if (!source || !target || source === target || !deltaCents) {
    return;
  }

  if (!matrix[source]) {
    matrix[source] = {};
  }

  if (!matrix[target]) {
    matrix[target] = {};
  }

  matrix[source][target] = Number(matrix[source][target] || 0) + deltaCents;
  matrix[target][source] = Number(matrix[target][source] || 0) - deltaCents;
};

const getMatrixDoc = async (groupId) => {
  return await GroupBalance.findOne({ groupId });
};

const saveMatrixDoc = async (groupId, matrix) => {
  const normalized = normalizeMatrixShape(matrix);
  return await GroupBalance.findOneAndUpdate(
    { groupId },
    { $set: { groupId, matrix: normalized } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const buildMatrixFromExpenses = async (groupId) => {
  const memberIds = await getGroupMemberIds(groupId);
  const expenses = await Expense.find({ groupId }).select("splits");
  const settlements = await Settlement.find({ groupId }).select("from to amount");
  const matrix = createEmptyMatrix(memberIds);

  for (const expense of expenses) {
    const netByUser = new Map();

    for (const split of expense.splits || []) {
      const userId = toUserId(split.user);
      const shareCents = toCents(split.amount);
      const paidCents = toCents(split.paidAmount);
      const netCents = paidCents - shareCents;
      netByUser.set(userId, (netByUser.get(userId) || 0) + netCents);
    }

    const intermediate = await buildIntermediateMatrix(netByUser, memberIds);
    mergeMatrixIntoTarget(matrix, intermediate);
  }

  for (const settlement of settlements) {
    const fromUser = toUserId(settlement.from);
    const toUser = toUserId(settlement.to);
    const amountCents = toCents(settlement.amount);
    addDirectedDelta(matrix, toUser, fromUser, amountCents);
  }

  return normalizeMatrixShape(matrix, memberIds);
};

const mergeMatrixIntoTarget = (targetMatrix, deltaMatrix) => {
  for (const fromUser of Object.keys(deltaMatrix || {})) {
    for (const toUser of Object.keys(deltaMatrix[fromUser] || {})) {
      const deltaCents = Number(deltaMatrix[fromUser][toUser] || 0);

      if (!targetMatrix[fromUser]) {
        targetMatrix[fromUser] = {};
      }

      if (!targetMatrix[toUser]) {
        targetMatrix[toUser] = {};
      }

      targetMatrix[fromUser][toUser] = Number(targetMatrix[fromUser][toUser] || 0) + deltaCents;
    }
  }
};

const ensureGroupBalanceDoc = async (groupId) => {
  const existing = await getMatrixDoc(groupId);
  if (existing && existing.matrix) {
    const memberIds = await getGroupMemberIds(groupId);
    const normalized = normalizeMatrixShape(existing.matrix, memberIds);
    if (JSON.stringify(normalized) !== JSON.stringify(existing.matrix || {})) {
      existing.matrix = normalized;
      await existing.save();
    }
    return existing;
  }

  const matrix = await buildMatrixFromExpenses(groupId);
  return await saveMatrixDoc(groupId, matrix);
};

/**
 * Build an intermediate per-expense matrix from netByUser (Map(userId -> netCents)).
 * Positive net => user should receive money (creditor).
 * Negative net => user owes money (debtor).
 * Returns a full directed matrix using the sign convention:
 * matrix[A][B] > 0 => B owes A
 * matrix[A][B] < 0 => A owes B
 */
async function buildIntermediateMatrix(netByUser, memberIds = []) {
  const matrix = createEmptyMatrix(memberIds);
  const creditors = [];
  const debtors = [];

  for (const [userId, netCents] of netByUser.entries()) {
    if (netCents > 0) creditors.push({ userId, amount: netCents });
    else if (netCents < 0) debtors.push({ userId, amount: -netCents });
  }

  creditors.sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));
  // sort debtors ascending so small debtors pay first for deterministic nicer splits
  debtors.sort((a, b) => a.amount - b.amount || a.userId.localeCompare(b.userId));

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);

    addDirectedDelta(matrix, creditor.userId, debtor.userId, settled);

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }

  return matrix;
}

/**
 * Merge an intermediate matrix into the persistent ledger by element-wise addition.
 */
async function mergeIntermediateIntoLedger(groupId, matrix) {
  const doc = await ensureGroupBalanceDoc(groupId);
  const currentMatrix = normalizeMatrixShape(doc.matrix || {});

  mergeMatrixIntoTarget(currentMatrix, matrix || {});

  doc.matrix = normalizeMatrixShape(currentMatrix);
  await doc.save();

  return doc.matrix;
}

/** applySettlement: payer (fromUser) pays creditor (toUser) an amount (dollars). */
async function applySettlement(groupId, fromUser, toUser, amount) {
  const amountCents = Math.round(Number(amount) * 100);
  if (!amountCents || amountCents <= 0) return;

  const doc = await ensureGroupBalanceDoc(groupId);
  const memberIds = await getGroupMemberIds(groupId);
  const matrix = normalizeMatrixShape(doc.matrix || {}, memberIds);

  if (!matrix[fromUser]) {
    matrix[fromUser] = {};
  }

  if (!matrix[toUser]) {
    matrix[toUser] = {};
  }

  matrix[fromUser][toUser] = Number(matrix[fromUser][toUser] || 0) + amountCents;
  matrix[toUser][fromUser] = Number(matrix[toUser][fromUser] || 0) - amountCents;

  doc.matrix = normalizeMatrixShape(matrix, memberIds);
  await doc.save();
}

/**
 * getUserBalances: read the current user's row directly from the group matrix.
 */
async function getUserBalances(groupId, currentUserId) {
  const doc = await ensureGroupBalanceDoc(groupId);
  const matrix = normalizeMatrixShape(doc.matrix || {});
  return matrix[String(currentUserId)] || {};
}

async function getGroupMatrix(groupId) {
  const doc = await ensureGroupBalanceDoc(groupId);
  return normalizeMatrixShape(doc.matrix || {});
}

async function rebuildGroupMatrix(groupId) {
  const memberIds = await getGroupMemberIds(groupId);
  const matrix = await buildMatrixFromExpenses(groupId);
  const doc = await saveMatrixDoc(groupId, matrix);
  doc.matrix = normalizeMatrixShape(doc.matrix || {}, memberIds);
  await doc.save();
  return doc.matrix;
}

module.exports = {
  buildIntermediateMatrix,
  mergeIntermediateIntoLedger,
  applySettlement,
  getUserBalances,
  getGroupMatrix,
  rebuildGroupMatrix,
  ensureGroupBalanceDoc,
  buildMatrixFromExpenses
};