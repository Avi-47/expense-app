const engine = require("../expense/balance-engine.service");
const { getGroupMatrix } = require("../expense/balance.service");

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

    const balances = await getGroupMatrix(groupId);
    const currentUserBalances = balances[currentUserId] || {};

    console.log("=== GET BALANCES DEBUG ===");
    console.log("Group ID:", groupId);
    console.log("Current User ID:", currentUserId);
    console.log("Matrix:", JSON.stringify(balances));
    console.log("=========================");

    res.json({ balances, currentUserBalances });
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