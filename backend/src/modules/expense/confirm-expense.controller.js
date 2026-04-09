// backend/src/modules/expense/confirm-expense.controller.js

const Group = require("../group/group.model");
const Expense = require("./expense.model");
const { getIO } = require("../../socket/socket");
const { updateBalances, removeExpenseBalances } = require("./balance.service");

function calculateSplits(amount, involvedUsers, payers) {
  const sharePerPerson = Math.floor(amount / involvedUsers.length);
  const remainder = amount % involvedUsers.length;
  
  const splitMap = {};
  involvedUsers.forEach((userId, idx) => {
    splitMap[userId] = sharePerPerson + (idx === 0 ? remainder : 0);
  });

  const paidMap = {};
  payers.forEach(p => {
    paidMap[p.user] = (paidMap[p.user] || 0) + p.amount;
  });

  const settlements = [];
  const creditors = [];
  const debtors = [];

  Object.keys(splitMap).forEach(userId => {
    const due = splitMap[userId];
    const paid = paidMap[userId] || 0;
    const net = paid - due;
    
    if (net > 0) {
      creditors.push({ userId, amount: net });
    } else if (net < 0) {
      debtors.push({ userId, amount: -net });
    }
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const minAmount = Math.min(creditor.amount, debtor.amount);
    
    if (minAmount > 0) {
      settlements.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: minAmount
      });
    }
    
    creditor.amount -= minAmount;
    debtor.amount -= minAmount;
    
    if (creditor.amount === 0) i++;
    if (debtor.amount === 0) j++;
  }

  const splits = involvedUsers.map(userId => {
    const paid = paidMap[userId] || 0;
    const due = splitMap[userId];
    return {
      user: userId,
      amount: due,
      paidAmount: paid,
      status: paid >= due ? "PAID" : "PENDING"
    };
  });

  return { splits, settlements };
}

exports.confirmExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description, amount, involvedUsers, payers } = req.body;

    const group = await Group.findById(groupId).populate("members");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!amount || !involvedUsers || involvedUsers.length === 0) {
      return res.status(400).json({ message: "Invalid expense data" });
    }

    if (!payers || payers.length === 0) {
      return res.status(400).json({ message: "At least one payer is required" });
    }

    const totalPaid = payers.reduce((sum, p) => sum + Number(p.amount), 0);
    if (totalPaid !== Number(amount)) {
      return res.status(400).json({ 
        message: `Total paid (${totalPaid}) must equal expense amount (${amount})` 
      });
    }

    const validParticipants = group.members
      .map(m => m._id.toString())
      .filter(id => involvedUsers.includes(id));

    const validPayerIds = payers.map(p => p.user);
    const allPayersValid = validPayerIds.every(id => validParticipants.includes(id));
    if (!allPayersValid) {
      return res.status(400).json({ message: "All payers must be participants" });
    }

    const { splits, settlements } = calculateSplits(
      Number(amount),
      validParticipants,
      payers
    );

    const expense = await Expense.create({
      groupId,
      createdBy: req.user.id,
      payers: payers.map(p => ({ user: p.user, amount: Number(p.amount) })),
      amount: Number(amount),
      description,
      splits
    });

    const populatedExpense = await Expense.findById(expense._id)
      .populate("createdBy", "name email")
      .populate("payers.user", "name email")
      .populate("splits.user", "name email");

    populatedExpense.settlements = settlements;

    await updateBalances(groupId, splits);

    const io = getIO();
    io.to(groupId).emit("expense_added", populatedExpense);

    res.status(201).json(populatedExpense);

  } catch (err) {
    console.error("Confirm Expense Error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const userId = req.user.id;

    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (expense.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Only the creator can delete this expense" });
    }

    const groupId = expense.groupId.toString();
    
    await removeExpenseBalances(groupId, expense.splits);
    await Expense.findByIdAndDelete(expenseId);

    const io = getIO();
    io.to(groupId).emit("expense_deleted", { expenseId, groupId });

    res.status(200).json({ message: "Expense deleted" });

  } catch (err) {
    console.error("Delete Expense Error:", err);
    res.status(500).json({ message: err.message });
  }
};