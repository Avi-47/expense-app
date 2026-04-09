const { redisClient } = require("../../config/redis");

const getBalanceKey = (groupId) => `group:${String(groupId)}:balances`;

// ===============================
// UPDATE BALANCES (supports multi-payer)
// ===============================
exports.updateBalances = async (groupId, splits) => {
  const key = getBalanceKey(groupId);
  
  const netChanges = {};
  
  for (const split of splits) {
    const userId = split.user.toString();
    const paid = split.paidAmount || 0;
    const owed = split.amount || 0;
    const net = paid - owed;
    
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
  
  console.log("Creditors:", creditors, "Debtors:", debtors);
  
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const amount = Math.min(creditor.amount, debtor.amount);
    
    if (amount > 0) {
      const pairKey = `${debtor.userId}:${creditor.userId}`;
      const reverseKey = `${creditor.userId}:${debtor.userId}`;
      
      const existing = await redisClient.hGet(key, pairKey);
      const reverseExisting = await redisClient.hGet(key, reverseKey);
      
      console.log(`Settling: ${debtor.userId} owes ${creditor.userId} ₹${amount}, existing: ${existing}, reverse: ${reverseExisting}`);
      
      if (reverseExisting) {
        const net = parseFloat(reverseExisting) - amount;
        
        if (net > 0.01) {
          await redisClient.hSet(key, reverseKey, net);
        } else if (net < -0.01) {
          await redisClient.hDel(key, reverseKey);
          await redisClient.hSet(key, pairKey, Math.abs(net));
        } else {
          await redisClient.hDel(key, reverseKey);
        }
      } else {
        const updated = existing ? parseFloat(existing) + amount : amount;
        await redisClient.hSet(key, pairKey, updated);
      }
    }
    
    creditor.amount -= amount;
    debtor.amount -= amount;
    
    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }
};

// ===============================
// REMOVE EXPENSE FROM BALANCES
// ===============================
exports.removeExpenseBalances = async (groupId, splits) => {
  const key = getBalanceKey(groupId);

  const netChanges = {};
  
  for (const split of splits) {
    const userId = split.user.toString();
    const paid = split.paidAmount || 0;
    const owed = split.amount || 0;
    const net = paid - owed;
    
    if (!netChanges[userId]) {
      netChanges[userId] = 0;
    }
    netChanges[userId] += net;
  }

  for (const userId in netChanges) {
    if (netChanges[userId] === 0) continue;
    
    for (const otherId in netChanges) {
      if (userId === otherId) continue;
      
      const userNet = netChanges[userId];
      const otherNet = netChanges[otherId];
      
      if (userNet < 0 && otherNet > 0) {
        const amount = Math.min(-userNet, otherNet);
        
        const pairKey = `${userId}:${otherId}`;
        const reverseKey = `${otherId}:${userId}`;
        
        const existing = await redisClient.hGet(key, pairKey);
        const reverseExisting = await redisClient.hGet(key, reverseKey);
        
        if (reverseExisting) {
          const net = parseFloat(reverseExisting) - amount;
          
          if (net > 0) {
            await redisClient.hSet(key, reverseKey, net);
          } else if (net < 0) {
            await redisClient.hDel(key, reverseKey);
            await redisClient.hSet(key, pairKey, Math.abs(net));
          } else {
            await redisClient.hDel(key, reverseKey);
          }
        } else {
          const updated = existing ? parseFloat(existing) + amount : amount;
          await redisClient.hSet(key, pairKey, updated);
        }
        
        netChanges[userId] += amount;
        netChanges[otherId] -= amount;
      }
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
