const Expense = require("../expense/expense.model");
const { getBalances } = require("../expense/balance.service");

exports.settlePayment = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { toUserId, amount } = req.body;
    const payerId = req.user.id;
    
    res.json({ message: "Settlement feature coming soon" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBalances = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = String(req.user.id);

    const allBalances = await getBalances(groupId);
    
    console.log("=== GET BALANCES DEBUG ===");
    console.log("Group ID:", groupId);
    console.log("Current User ID:", currentUserId);
    console.log("All MongoDB Balances:", allBalances);
    
    const balances = {};
    
    for (const pair in allBalances) {
      const [fromUser, toUser] = pair.split(":");
      const amount = allBalances[pair];
      
      console.log(`Pair: ${pair}, from: ${fromUser}, to: ${toUser}, amount: ${amount}`);
      
      if (fromUser === currentUserId) {
        balances[toUser] = amount;
        console.log(`  -> ${toUser} owes you ${amount}`);
      } else if (toUser === currentUserId) {
        balances[fromUser] = -amount;
        console.log(`  -> you owe ${fromUser} ${amount}`);
      }
    }

    console.log("Final balances to send:", balances);
    console.log("=========================");
    
    res.json({ balances });

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
