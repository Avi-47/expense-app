const engine = require("../expense/balance-engine.service");
const { getGroupMatrix } = require("../expense/balance.service");
const Group = require("../group/group.model");
const User = require("../auth/user.model");

const normalizeKey = (value) => String(value || "").trim();
const normalizeKeyLower = (value) => normalizeKey(value).toLowerCase();
const normalizeKeyStrict = (value) => normalizeKey(value)
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const fromCents = (cents) => Number(cents || 0) / 100;
const formatMoney = (cents) => fromCents(cents).toFixed(2);

const getUserAliases = (user = {}) => {
  const aliases = [
    normalizeKey(user?.id),
    normalizeKey(user?._id),
    normalizeKey(user?.userId),
    normalizeKey(user?.email),
    normalizeKey(user?.name)
  ].filter(Boolean);

  return [...new Set(aliases)];
};

const getCurrentUserAliases = async (user = {}) => {
  const aliases = getUserAliases(user);
  const userId = normalizeKey(user?.id || user?._id || user?.userId);

  if (userId) {
    const userDoc = await User.findById(userId).select("name email").lean().catch(() => null);
    if (userDoc) {
      aliases.push(normalizeKey(userDoc.name));
      aliases.push(normalizeKey(userDoc.email));
    }
  }

  return [...new Set(aliases.filter(Boolean))];
};

const getValueFromRowByAliases = (row = {}, aliases = []) => {
  const currentRow = row && typeof row === "object" ? row : {};
  const keys = Object.keys(currentRow);
  if (keys.length === 0 || aliases.length === 0) {
    return 0;
  }

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(currentRow, alias)) {
      return Number(currentRow[alias] || 0);
    }
  }

  const lowerKeyMap = new Map(keys.map((key) => [normalizeKeyLower(key), key]));
  const strictKeyMap = new Map(keys.map((key) => [normalizeKeyStrict(key), key]));

  for (const alias of aliases) {
    const direct = lowerKeyMap.get(normalizeKeyLower(alias));
    if (direct) {
      return Number(currentRow[direct] || 0);
    }

    const strict = strictKeyMap.get(normalizeKeyStrict(alias));
    if (strict) {
      return Number(currentRow[strict] || 0);
    }
  }

  return 0;
};

const buildPeerBalanceDetails = (balances = {}, currentUserBalances = {}, members = [], currentUserId = "") => {
  const currentRow = currentUserBalances && typeof currentUserBalances === "object" ? currentUserBalances : {};
  return (members || [])
    .filter((member) => String(member?._id || member?.id || "") !== String(currentUserId || ""))
    .map((member) => {
      const memberId = String(member?._id || member?.id || "");
      const aliases = [
        memberId,
        normalizeKey(member?.id),
        normalizeKey(member?.name),
        normalizeKey(member?.email)
      ].filter(Boolean);
      const netAmount = getValueFromRowByAliases(currentRow, aliases);
      const absText = `₹${formatMoney(Math.abs(netAmount))}`;

      if (netAmount > 0) {
        return {
          memberId,
          name: member?.name || member?.email || memberId,
          email: member?.email || "",
          balanceCents: netAmount,
          state: "positive",
          valueText: `+${absText}`
        };
      }

      if (netAmount < 0) {
        return {
          memberId,
          name: member?.name || member?.email || memberId,
          email: member?.email || "",
          balanceCents: netAmount,
          state: "negative",
          valueText: `-${absText}`
        };
      }

      return {
        memberId,
        name: member?.name || member?.email || memberId,
        email: member?.email || "",
        balanceCents: 0,
        state: "settled",
        valueText: "₹0.00"
      };
    });
};

const resolveCurrentUserBalancesRow = async (groupId, balances = {}, user = {}) => {
  const matrix = balances && typeof balances === "object" ? balances : {};
  const matrixKeys = Object.keys(matrix);
  if (matrixKeys.length === 0) {
    return { key: "", row: {} };
  }

  const directAliases = await getCurrentUserAliases(user);
  for (const alias of directAliases) {
    if (Object.prototype.hasOwnProperty.call(matrix, alias)) {
      return { key: alias, row: matrix[alias] || {} };
    }
  }

  const lowerKeyMap = new Map(matrixKeys.map((key) => [normalizeKeyLower(key), key]));
  const strictKeyMap = new Map(matrixKeys.map((key) => [normalizeKeyStrict(key), key]));
  for (const alias of directAliases) {
    const matchedKey = lowerKeyMap.get(normalizeKeyLower(alias));
    if (matchedKey) {
      return { key: matchedKey, row: matrix[matchedKey] || {} };
    }

    const strictMatchedKey = strictKeyMap.get(normalizeKeyStrict(alias));
    if (strictMatchedKey) {
      return { key: strictMatchedKey, row: matrix[strictMatchedKey] || {} };
    }
  }

  // Fallback: resolve the logged-in user to a concrete group member, then try that member's aliases.
  const group = await Group.findById(groupId).populate("members", "_id name email").lean();
  const members = Array.isArray(group?.members) ? group.members : [];

  const aliasSetLower = new Set(directAliases.map((alias) => normalizeKeyLower(alias)));
  const matchedMember = members.find((member) => {
    const memberAliases = [
      normalizeKey(member?._id),
      normalizeKey(member?.id),
      normalizeKey(member?.email),
      normalizeKey(member?.name)
    ].filter(Boolean);

    return memberAliases.some((alias) => aliasSetLower.has(normalizeKeyLower(alias)));
  });

  if (!matchedMember) {
    return { key: "", row: {} };
  }

  const memberAliases = [
    normalizeKey(matchedMember?._id),
    normalizeKey(matchedMember?.id),
    normalizeKey(matchedMember?.email),
    normalizeKey(matchedMember?.name)
  ].filter(Boolean);

  for (const alias of memberAliases) {
    if (Object.prototype.hasOwnProperty.call(matrix, alias)) {
      return { key: alias, row: matrix[alias] || {} };
    }
  }

  for (const alias of memberAliases) {
    const matchedKey = lowerKeyMap.get(normalizeKeyLower(alias));
    if (matchedKey) {
      return { key: matchedKey, row: matrix[matchedKey] || {} };
    }

    const strictMatchedKey = strictKeyMap.get(normalizeKeyStrict(alias));
    if (strictMatchedKey) {
      return { key: strictMatchedKey, row: matrix[strictMatchedKey] || {} };
    }
  }

  return { key: "", row: {} };
};

exports.settlePayment = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { toUserId, amount } = req.body;
    const payerId = req.user.id;

    await engine.applySettlement(groupId, String(payerId), String(toUserId), amount);

    try {
      console.log("[LEDGER AFTER SETTLEMENT]", JSON.stringify(await getGroupMatrix(groupId), null, 2));
    } catch (error) {
      console.error("Ledger debug failed:", error.message);
    }

    return res.json({ message: "Settlement applied" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBalances = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = String(req.user.id);

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    console.log(`\n[GET_BALANCES] Request received for group ${groupId} from user ${currentUserId}`);

    const group = await Group.findById(groupId).populate("members", "name email avatar").lean();
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Read the persisted global matrix directly; rebuild only if the stored matrix is missing/empty.
    const balances = await engine.getGroupMatrix(groupId);
    const resolvedCurrentUser = await resolveCurrentUserBalancesRow(groupId, balances, req.user);
    const currentUserBalances = resolvedCurrentUser.row;
    const currentUserMatrixKey = resolvedCurrentUser.key;
    const members = Array.isArray(group.members) ? group.members : [];
    const balanceDetails = buildPeerBalanceDetails(balances, currentUserBalances, members, currentUserId);

    res.json({
      groupId,
      currentUserId,
      currentUserMatrixKey,
      balances,
      currentUserBalances,
      balanceDetails,
      members,
      meta: {
        memberCount: members.length,
        matrixKeys: Object.keys(balances || {}),
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.simplifyDebts = async (req, res) => {
  try {
    res.json({ message: "Simplify debts feature coming soon" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.rebuildBalances = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = String(req.user.id);

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const balances = await engine.rebuildGroupMatrix(groupId);

    console.log(`[REBUILD] Group ${groupId} projected successfully for user ${currentUserId}`);
    res.json({
      message: "Balances recalculated successfully",
      balances
    });
  } catch (err) {
    console.error(`[REBUILD] Error rebuilding balances:`, err);
    res.status(500).json({ message: err.message });
  }
};