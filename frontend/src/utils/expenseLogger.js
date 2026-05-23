const toUserId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return String(value._id || value.id || "").trim();
  }

  return String(value).trim();
};

const toCents = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const raw = String(value).replace(/[₹,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    return Number(raw) * 100;
  }

  const isNegative = raw.startsWith("-");
  const unsigned = isNegative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return isNegative ? -cents : cents;
};

const fromCents = (cents) => Number(cents || 0) / 100;

const formatMoney = (value) => new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value || 0));

const projectedMatrixByGroup = new Map();
let lastBalanceMatrixSignature = "";

const getStorageKey = (groupId) => `expense-projected-matrix:${toUserId(groupId)}`;

const safeReadStoredMatrix = (groupId) => {
  const key = getStorageKey(groupId);

  try {
    if (typeof localStorage === "undefined") {
      return null;
    }

    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const safeWriteStoredMatrix = (groupId, matrix) => {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }

    localStorage.setItem(getStorageKey(groupId), JSON.stringify(matrix || {}));
  } catch {
    // Ignore storage failures.
  }
};

const hasAnyNonZeroValues = (matrix = {}) => Object.values(matrix || {}).some((row) =>
  Object.values(row || {}).some((value) => Number(value) !== 0)
);

const buildLabelMap = (members = []) => {
  const labels = new Map();

  for (const member of members || []) {
    const userId = toUserId(member);
    if (!userId) {
      continue;
    }

    const name = member && typeof member === "object" && typeof member.name === "string"
      ? member.name.trim()
      : "";

    labels.set(userId, name || userId);
  }

  return labels;
};

const getLabel = (labels, userId) => labels.get(toUserId(userId)) || toUserId(userId);

const buildNetByUser = (expense) => {
  const netByUser = new Map();

  for (const split of expense?.splits || []) {
    const userId = toUserId(split.user);
    if (!userId) {
      continue;
    }

    const shareCents = toCents(split.amount);
    const paidCents = toCents(split.paidAmount);
    netByUser.set(userId, (netByUser.get(userId) || 0) + (paidCents - shareCents));
  }

  return netByUser;
};

const buildSettlementsFromNet = (netByUser) => {
  const creditors = [];
  const debtors = [];

  for (const [userId, netCents] of netByUser.entries()) {
    if (netCents > 0) {
      creditors.push({ userId, amount: netCents });
    } else if (netCents < 0) {
      debtors.push({ userId, amount: -netCents });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));
  debtors.sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      fromUser: debtor.userId,
      toUser: creditor.userId,
      amountCents: settled
    });

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount === 0) i += 1;
    if (creditor.amount === 0) j += 1;
  }

  return settlements;
};

const applyDirectedDelta = (matrix, fromUser, toUser, deltaCents) => {
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

const buildProjectedMatrixRows = (matrix = {}, members = []) => {
  const labels = buildLabelMap(members);
  const memberIds = (members || [])
    .map((member) => toUserId(member))
    .filter(Boolean);
  const ids = [...new Set([
    ...memberIds,
    ...Object.keys(matrix || {}),
    ...Object.values(matrix || {}).flatMap((row) => Object.keys(row || {}))
  ])];
  const rows = [];

  for (const fromUser of ids) {
    for (const toUser of ids) {
      if (fromUser === toUser) {
        continue;
      }

      const cents = Number(matrix?.[fromUser]?.[toUser] || 0);
      if (cents === 0) {
        continue;
      }

      rows.push({
        from: getLabel(labels, fromUser),
        to: getLabel(labels, toUser),
        amount: `₹${formatMoney(fromCents(Math.abs(cents)))}`,
        rawCents: -cents
      });
    }
  }

  return rows;
};

const mergeExpenseIntoProjectedMatrix = (expense) => {
  const groupId = toUserId(expense?.groupId);
  if (!groupId) {
    return null;
  }

  const currentMatrix = JSON.parse(JSON.stringify(
    projectedMatrixByGroup.get(groupId) || safeReadStoredMatrix(groupId) || {}
  ));
  const settlements = Array.isArray(expense?.settlements) && expense.settlements.length > 0
    ? expense.settlements.map((settlement) => ({
      fromUser: toUserId(settlement.fromUser || settlement.from || settlement.payer),
      toUser: toUserId(settlement.toUser || settlement.to || settlement.payee),
      amountCents: toCents(settlement.amountCents ?? settlement.amount)
    }))
    : buildSettlementsFromNet(buildNetByUser(expense));

  for (const settlement of settlements) {
    applyDirectedDelta(currentMatrix, settlement.toUser, settlement.fromUser, settlement.amountCents);
  }

  projectedMatrixByGroup.set(groupId, currentMatrix);
  safeWriteStoredMatrix(groupId, currentMatrix);
  return currentMatrix;
};

export const logExpenseSplitDetails = (expense, members = []) => {
  const labels = buildLabelMap(members);
  const title = typeof expense?.description === "string" && expense.description.trim()
    ? expense.description.trim()
    : "Expense";
  const amountCents = toCents(expense?.amount);
  const netByUser = buildNetByUser(expense);
  const settlements = Array.isArray(expense?.settlements) && expense.settlements.length > 0
    ? expense.settlements.map((settlement) => ({
      fromUser: toUserId(settlement.fromUser || settlement.from || settlement.payer),
      toUser: toUserId(settlement.toUser || settlement.to || settlement.payee),
      amountCents: toCents(settlement.amountCents ?? settlement.amount)
    }))
    : buildSettlementsFromNet(netByUser);

  console.group(`[EXPENSE SPLIT] ${title} | amount=₹${formatMoney(fromCents(amountCents))}`);

  console.log("Split summary:");
  console.table((expense?.splits || []).map((split) => {
    const shareCents = toCents(split.amount);
    const paidCents = toCents(split.paidAmount);
    const netCents = paidCents - shareCents;

    return {
      user: getLabel(labels, split.user),
      equalShare: `₹${formatMoney(fromCents(shareCents))}`,
      paid: `₹${formatMoney(fromCents(paidCents))}`,
      net: `₹${formatMoney(fromCents(netCents))}`,
      status: split.status
    };
  }));

  console.log("Intermediate transfers for this expense:");
  if (settlements.length === 0) {
    console.log("No transfers needed. Everyone is settled.");
  } else {
    for (const settlement of settlements) {
      const amountLabel = `₹${formatMoney(fromCents(settlement.amountCents))}`;
      console.log(`${getLabel(labels, settlement.fromUser)} has to pay ${getLabel(labels, settlement.toUser)} ${amountLabel}`);
      console.log(`${getLabel(labels, settlement.toUser)} will get ${amountLabel} from ${getLabel(labels, settlement.fromUser)}`);
    }
  }

  const projectedMatrix = mergeExpenseIntoProjectedMatrix(expense);

  console.log("Projected cumulative balance matrix:");
  console.table(buildProjectedMatrixRows(projectedMatrix || {}, members));

  console.log("Expense net summary:");
  console.table([...netByUser.entries()].map(([userId, netCents]) => ({
    user: getLabel(labels, userId),
    net: `₹${formatMoney(fromCents(netCents))}`,
    rawNetCents: netCents
  })));

  console.groupEnd();

  return { netByUser, settlements };
};

export const logBalanceMatrix = (balances = {}, members = [], groupId = "") => {
  const labels = buildLabelMap(members);
  const memberIds = (members || [])
    .map((member) => toUserId(member))
    .filter(Boolean);
  const storedProjectedMatrix = groupId ? (projectedMatrixByGroup.get(groupId) || safeReadStoredMatrix(groupId) || {}) : {};
  const sourceMatrix = hasAnyNonZeroValues(balances) ? balances : storedProjectedMatrix;
  const ids = [...new Set([
    ...memberIds,
    ...Object.keys(sourceMatrix || {}),
    ...Object.values(sourceMatrix || {}).flatMap((row) => Object.keys(row || {}))
  ])];
  const rows = [];

  for (const fromUser of ids) {
    for (const toUser of ids) {
      if (fromUser === toUser) {
        continue;
      }

      const value = sourceMatrix?.[fromUser]?.[toUser] ?? 0;
      const cents = Number(value || 0);
      rows.push({
        from: getLabel(labels, fromUser),
        to: getLabel(labels, toUser),
        amount: `₹${formatMoney(fromCents(Math.abs(cents)))}`,
        rawCents: -cents
      });
    }
  }

  const signature = JSON.stringify(rows);
  if (signature === lastBalanceMatrixSignature) {
    return;
  }

  lastBalanceMatrixSignature = signature;

  console.group("[GLOBAL BALANCE MATRIX]");
  if (rows.length === 0) {
    console.log("No balance rows available.");
  } else {
    console.table(rows);
  }
  console.groupEnd();
};