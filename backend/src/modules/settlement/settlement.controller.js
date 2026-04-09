const Expense = require("../expense/expense.model");
const mongoose = require("mongoose");
const { getBalances, getUserBalances } = require("../expense/balance.service");

exports.settlePayment = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { toUserId, amount } = req.body;

    const payerId = req.user.id;
    let remainingAmount = Number(amount);

    if (remainingAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // 1️⃣ Find unpaid splits where payer owes to toUserId
    const expenses = await Expense.find({
      groupId,
      paidBy: toUserId,
      "splits.user": payerId
    }).sort({ createdAt: 1 }); // oldest first

    for (const expense of expenses) {
      const split = expense.splits.find(
        s => s.user.toString() === payerId.toString()
      );

      if (!split) continue;

      const unpaid = split.amount - split.paidAmount;

      if (unpaid <= 0) continue;

      if (remainingAmount >= unpaid) {
        // Fully clear this split
        split.paidAmount += unpaid;
        split.status = "PAID";
        remainingAmount -= unpaid;
      } else {
        // Partial payment
        split.paidAmount += remainingAmount;
        split.status = "PARTIAL";
        remainingAmount = 0;
      }

      await expense.save();

      if (remainingAmount === 0) break;
    }

    return res.json({
      message: "Settlement processed",
      remainingUnappliedAmount: remainingAmount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


/* ===============================
   GET BALANCES
  ================================= */
exports.getBalances = async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = String(req.user.id);

    const allBalances = await getBalances(groupId);
    
    console.log("All balances from Redis:", allBalances);
    console.log("Current user ID:", currentUserId);
    
    const balances = {};
    
    for (const pair in allBalances) {
      const [creditor, debtor] = pair.split(":");
      const amount = parseFloat(allBalances[pair]);
      
      console.log(`Pair: ${pair}, creditor: ${creditor}, debtor: ${debtor}, amount: ${amount}`);
      
      if (creditor === currentUserId) {
        balances[debtor] = amount;
        console.log(`Setting ${debtor} = ${amount} (others owe me)`);
      } else if (debtor === currentUserId) {
        balances[creditor] = -amount;
        console.log(`Setting ${creditor} = ${-amount} (I owe ${creditor})`);
      }
    }

    console.log("Final balances:", balances);
    res.json({ balances });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   SIMPLIFY DEBTS
 ================================= */
exports.simplifyDebts = async (req, res) => {
  try {
    const { groupId } = req.params;

    const expenses = await Expense.find({ groupId });

    const net = {};

    for (const expense of expenses) {
      const payer = expense.paidBy.toString();

      if (!net[payer]) net[payer] = 0;

      for (const split of expense.splits) {
        const userId = split.user.toString();
        const remaining = split.amount - split.paidAmount;

        if (remaining <= 0) continue;

        if (userId !== payer) {
          if (!net[userId]) net[userId] = 0;

          net[userId] -= remaining;
          net[payer] += remaining;
        }
      }
    }

    const debtors = [];
    const creditors = [];

    for (const [user, amount] of Object.entries(net)) {
      if (amount < 0) debtors.push({ user, amount: -amount });
      if (amount > 0) creditors.push({ user, amount });
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const simplified = [];

    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const transfer = Math.min(debtors[i].amount, creditors[j].amount);

      simplified.push({
        from: debtors[i].user,
        to: creditors[j].user,
        amount: transfer
      });

      debtors[i].amount -= transfer;
      creditors[j].amount -= transfer;

      if (debtors[i].amount === 0) i++;
      if (creditors[j].amount === 0) j++;
    }

    res.json({ simplifiedTransactions: simplified });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
