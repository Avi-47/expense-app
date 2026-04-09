const Balance = require("./balance.model");

const getBalanceKey = (groupId) => String(groupId);

exports.updateBalances = async (groupId, splits) => {
  try {
    console.log("=== UPDATE BALANCES (MongoDB) ===");
    console.log("Group ID:", groupId);
    
    const netChanges = {};
    
    for (const split of splits) {
      const userId = String(split.user);
      const paid = Number(split.paidAmount) || 0;
      const owed = Number(split.amount) || 0;
      const net = paid - owed;
      
      console.log(`User ${userId}: paid=${paid}, owed=${owed}, net=${net}`);
      netChanges[userId] = (netChanges[userId] || 0) + net;
    }

    console.log("Net changes:", netChanges);
    
    const creditors = [];
    const debtors = [];
    
    for (const userId in netChanges) {
      if (netChanges[userId] > 0.01) {
        creditors.push({ userId, amount: netChanges[userId] });
      } else if (netChanges[userId] < -0.01) {
        debtors.push({ userId, amount: -netChanges[userId] });
      }
    }
    
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);
    
    console.log("Creditors:", creditors);
    console.log("Debtors:", debtors);
    
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      
      const amount = Math.min(creditor.amount, debtor.amount);
      
      if (amount > 0) {
        const fromUserId = debtor.userId;
        const toUserId = creditor.userId;
        
        console.log(`Setting balance: ${fromUserId} owes ${toUserId} = ${amount}`);
        
        await Balance.findOneAndUpdate(
          { groupId, fromUser: fromUserId, toUser: toUserId },
          { amount },
          { upsert: true, new: true }
        );
      }
      
      creditor.amount -= amount;
      debtor.amount -= amount;
      
      if (creditor.amount < 0.01) i++;
      if (debtor.amount < 0.01) j++;
    }
    
    console.log("Balance update complete");
  } catch (error) {
    console.error("Error updating balances:", error);
  }
};

exports.removeExpenseBalances = async (groupId, splits) => {
  try {
    const netChanges = {};
    
    for (const split of splits) {
      const userId = String(split.user);
      const paid = Number(split.paidAmount) || 0;
      const owed = Number(split.amount) || 0;
      const net = paid - owed;
      
      netChanges[userId] = (netChanges[userId] || 0) + net;
    }

    const creditors = [];
    const debtors = [];
    
    for (const userId in netChanges) {
      if (netChanges[userId] > 0.01) {
        creditors.push({ userId, amount: netChanges[userId] });
      } else if (netChanges[userId] < -0.01) {
        debtors.push({ userId, amount: -netChanges[userId] });
      }
    }
    
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      
      const amount = Math.min(creditor.amount, debtor.amount);
      
      if (amount > 0) {
        await Balance.findOneAndDelete({
          groupId,
          fromUser: debtor.userId,
          toUser: creditor.userId
        });
      }
      
      creditor.amount -= amount;
      debtor.amount -= amount;
      
      if (creditor.amount < 0.01) i++;
      if (debtor.amount < 0.01) j++;
    }
  } catch (error) {
    console.error("Error removing balances:", error);
  }
};

exports.getBalances = async (groupId) => {
  const balances = await Balance.find({ groupId });
  const result = {};
  
  for (const bal of balances) {
    const key = `${bal.fromUser}:${bal.toUser}`;
    result[key] = bal.amount;
  }
  
  return result;
};
