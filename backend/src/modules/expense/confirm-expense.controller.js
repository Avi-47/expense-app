// backend/src/modules/expense/confirm-expense.controller.js

const Group = require("../group/group.model");
const Expense = require("./expense.model");
const { getIO } = require("../../socket/socket");
const engine = require("./balance-engine.service");
const Balance = require("./balance.model");

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

const negateMatrix = (matrix) => {
  const result = {};

  for (const fromUser of Object.keys(matrix || {})) {
    result[fromUser] = result[fromUser] || {};

    for (const toUser of Object.keys(matrix[fromUser] || {})) {
      result[fromUser][toUser] = -(Number(matrix[fromUser][toUser] || 0));
    }
  }

  return result;
};

const normalizeParticipants = (participants) => {
  const unique = [...new Set((participants || []).map(toUserId).filter(Boolean))];
  return unique.sort((a, b) => a.localeCompare(b));
};

const normalizePayers = (payers) => {
  const map = new Map();

  for (const payer of payers || []) {
    const user = toUserId(payer && payer.user);
    if (!user) {
      continue;
    }

    const amountCents = toCents(payer.amount);
    map.set(user, (map.get(user) || 0) + amountCents);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([user, amountCents]) => ({ user, amountCents }));
};

const buildSettlementsFromNet = (netByUser) => {
  const creditors = [];
  const debtors = [];

  for (const [user, net] of netByUser.entries()) {
    if (net > 0) {
      creditors.push({ user, amount: net });
    } else if (net < 0) {
      debtors.push({ user, amount: -net });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount || a.user.localeCompare(b.user));
  debtors.sort((a, b) => b.amount - a.amount || a.user.localeCompare(b.user));

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debit = debtors[i];
    const credit = creditors[j];
    const transfer = Math.min(debit.amount, credit.amount);

    settlements.push({
      fromUser: debit.user,
      toUser: credit.user,
      amount: fromCents(transfer)
    });

    debit.amount -= transfer;
    credit.amount -= transfer;

    if (debit.amount === 0) {
      i += 1;
    }

    if (credit.amount === 0) {
      j += 1;
    }
  }

  return settlements;
};

// Build intermediate matrix synchronously (same greedy algorithm used by engine)
const buildIntermediateFromNet = (netByUser) => {
  const creditors = [];
  const debtors = [];

  for (const [userId, net] of netByUser.entries()) {
    if (net > 0) creditors.push({ userId, amount: net });
    else if (net < 0) debtors.push({ userId, amount: -net });
  }

  creditors.sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));
  debtors.sort((a, b) => a.amount - b.amount || a.userId.localeCompare(b.userId));

  const matrix = {};
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);

    matrix[debtor.userId] = matrix[debtor.userId] || {};
    matrix[debtor.userId][creditor.userId] = (matrix[debtor.userId][creditor.userId] || 0) + settled;

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }

  return matrix;
};

const calculateSplits = (amount, participants, payers) => {
  const amountCents = toCents(amount);
  if (amountCents <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const normalizedParticipants = normalizeParticipants(participants);
  if (normalizedParticipants.length === 0) {
    throw new Error("At least one participant is required");
  }

  const normalizedPayers = normalizePayers(payers);
  if (normalizedPayers.length === 0) {
    throw new Error("At least one payer is required");
  }

  const paidMap = new Map();
  for (const userId of normalizedParticipants) {
    paidMap.set(userId, 0);
  }

  let payerTotalCents = 0;
  for (const payer of normalizedPayers) {
    if (!paidMap.has(payer.user)) {
      throw new Error(`Payer ${payer.user} must be included in involvedUsers`);
    }

    payerTotalCents += payer.amountCents;
    paidMap.set(payer.user, paidMap.get(payer.user) + payer.amountCents);
  }

  if (payerTotalCents !== amountCents) {
    throw new Error("Sum of payers.amount must equal total expense amount");
  }

  const count = normalizedParticipants.length;
  const baseShare = Math.floor(amountCents / count);
  const remainder = amountCents % count;

  let splitTotalCents = 0;
  let paidTotalCents = 0;
  const netByUser = new Map();

  const splits = normalizedParticipants.map((userId, index) => {
    const shareCents = baseShare + (index < remainder ? 1 : 0);
    const paidCents = paidMap.get(userId) || 0;
    const netCents = paidCents - shareCents;

    splitTotalCents += shareCents;
    paidTotalCents += paidCents;
    netByUser.set(userId, netCents);

    return {
      user: userId,
      amount: fromCents(shareCents),
      paidAmount: fromCents(paidCents),
      status: paidCents === 0 ? "PENDING" : paidCents < shareCents ? "PARTIAL" : "PAID"
    };
  });

  if (splitTotalCents !== amountCents) {
    throw new Error("Sum of split.amount must equal total expense");
  }

  if (paidTotalCents !== amountCents) {
    throw new Error("Sum of split.paidAmount must equal total expense");
  }

  let netTotal = 0;
  for (const netValue of netByUser.values()) {
    netTotal += netValue;
  }

  if (netTotal !== 0) {
    throw new Error("Sum of net values must be 0");
  }

  // Use the same intermediate matching algorithm as the ledger engine
  const intermediateMatrix = buildIntermediateFromNet(netByUser);
  const settlements = [];
  for (const debtor of Object.keys(intermediateMatrix)) {
    for (const creditor of Object.keys(intermediateMatrix[debtor])) {
      settlements.push({
        fromUser: debtor,
        toUser: creditor,
        amount: fromCents(intermediateMatrix[debtor][creditor])
      });
    }
  }
  const payersForStorage = normalizedPayers.map((payer) => ({
    user: payer.user,
    amount: fromCents(payer.amountCents)
  }));

  return {
    amount: fromCents(amountCents),
    splits,
    settlements,
    payers: payersForStorage
  };
};

const getValidatedGroupParticipants = async (groupId, involvedUsers) => {
  const group = await Group.findById(groupId).select("members");
  if (!group) {
    return { error: "Group not found", status: 404, participants: [] };
  }

  const memberSet = new Set((group.members || []).map((member) => toUserId(member)));
  const requested = normalizeParticipants(involvedUsers);
  const validParticipants = requested.filter((userId) => memberSet.has(userId));

  if (validParticipants.length === 0) {
    return { error: "No valid participants in group", status: 400, participants: [] };
  }

  return { group, participants: validParticipants };
};

exports.confirmExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description, amount, involvedUsers, payers } = req.body || {};

    const { error, status, participants } = await getValidatedGroupParticipants(groupId, involvedUsers);
    if (error) {
      return res.status(status || 400).json({ message: error });
    }

    const splitResult = calculateSplits(amount, participants, payers);
    const memberIds = (group.members || []).map((member) => toUserId(member._id || member.id));

    await engine.ensureGroupBalanceDoc(groupId);

    const expense = await Expense.create({
      groupId,
      createdBy: req.user.id,
      description: typeof description === "string" ? description.trim() : "",
      amount: splitResult.amount,
      payers: splitResult.payers,
      splits: splitResult.splits
    });

    // Build netByUser (cents) for this expense and merge incrementally into ledger
    const netByUser = new Map();
    for (const s of splitResult.splits) {
      const userId = toUserId(s.user);
      const shareCents = toCents(s.amount);
      const paidCents = toCents(s.paidAmount);
      netByUser.set(userId, (netByUser.get(userId) || 0) + (paidCents - shareCents));
    }

    const intermediate = await engine.buildIntermediateMatrix(netByUser, memberIds);
    await engine.mergeIntermediateIntoLedger(groupId, intermediate);

    // Debug: log canonical ledger edges after merge
    try {
      console.log("[LEDGER AFTER CREATE]", await Balance.find({ groupId }));
    } catch (e) {
      console.error("Ledger debug failed:", e.message);
    }

    const io = getIO();
    io.to(groupId).emit("expense_added", expense);
    io.to(groupId).emit("balances_updated", { groupId });

    return res.status(201).json({
      expense,
      settlements: splitResult.settlements
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const groupId = toUserId(expense.groupId);
    await Expense.deleteOne({ _id: expenseId });
    // Remove expense effect incrementally: compute net for deleted expense and merge reversed deltas
    const netByUser = new Map();
    for (const split of expense.splits || []) {
      const userId = toUserId(split.user);
      const shareCents = toCents(split.amount);
      const paidCents = toCents(split.paidAmount);
      netByUser.set(userId, (netByUser.get(userId) || 0) + (paidCents - shareCents));
    }
    const memberIds = await engine.getGroupMatrix(groupId).then((matrix) => Object.keys(matrix || {}));
    const intermediate = await engine.buildIntermediateMatrix(netByUser, memberIds);
    await engine.mergeIntermediateIntoLedger(groupId, negateMatrix(intermediate));
    try {
      console.log("[LEDGER AFTER DELETE]", await Balance.find({ groupId }));
    } catch (e) {
      console.error("Ledger debug failed:", e.message);
    }

    const io = getIO();
    io.to(groupId).emit("expense_deleted", { expenseId });
    io.to(groupId).emit("balances_updated", { groupId });

    return res.status(200).json({ message: "Expense deleted" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.editExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { description, amount, involvedUsers, payers } = req.body || {};

    const existingExpense = await Expense.findById(expenseId);
    if (!existingExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const groupId = toUserId(existingExpense.groupId);
    const { error, status, participants } = await getValidatedGroupParticipants(groupId, involvedUsers);
    if (error) {
      return res.status(status || 400).json({ message: error });
    }

    const splitResult = calculateSplits(amount, participants, payers);
    const memberIds = (group.members || []).map((member) => toUserId(member._id || member.id));

    await engine.ensureGroupBalanceDoc(groupId);

    // Compute old intermediate using the existing expense state BEFORE we overwrite
    const oldNet = new Map();
    for (const split of existingExpense.splits || []) {
      const userId = toUserId(split.user);
      const shareCents = toCents(split.amount);
      const paidCents = toCents(split.paidAmount);
      oldNet.set(userId, (oldNet.get(userId) || 0) + (paidCents - shareCents));
    }

    const oldIntermediate = await engine.buildIntermediateMatrix(oldNet, memberIds);

    // Overwrite expense with new values
    existingExpense.description = typeof description === "string" ? description.trim() : "";
    existingExpense.amount = splitResult.amount;
    existingExpense.payers = splitResult.payers;
    existingExpense.splits = splitResult.splits;

    // Save new expense
    const savedExpense = await existingExpense.save();

    // AFTER saving: compute new intermediate and apply delta (reverse old, then add new)
    const newNet = new Map();
    for (const split of splitResult.splits || []) {
      const userId = toUserId(split.user);
      const shareCents = toCents(split.amount);
      const paidCents = toCents(split.paidAmount);
      newNet.set(userId, (newNet.get(userId) || 0) + (paidCents - shareCents));
    }

    const newIntermediate = await engine.buildIntermediateMatrix(newNet, memberIds);

    await engine.mergeIntermediateIntoLedger(groupId, negateMatrix(oldIntermediate));
    await engine.mergeIntermediateIntoLedger(groupId, newIntermediate);

    try {
      console.log("[LEDGER AFTER EDIT]", await Balance.find({ groupId }));
    } catch (e) {
      console.error("Ledger debug failed:", e.message);
    }

    const io = getIO();
    io.to(groupId).emit("expense_updated", savedExpense);
    io.to(groupId).emit("balances_updated", { groupId });

    return res.status(200).json({
      expense: savedExpense,
      settlements: splitResult.settlements
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.calculateSplits = calculateSplits;
