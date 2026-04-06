// backend/src/modules/expense/confirm-expense.controller.js

const Group = require("../group/group.model");
const Expense = require("./expense.model");

exports.confirmExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description, amount, involvedUsers } = req.body;

    const group = await Group.findById(groupId).populate("members");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!amount || !involvedUsers || involvedUsers.length === 0) {
      return res.status(400).json({ message: "Invalid expense data" });
    }

    const validParticipants = group.members
      .map(m => m._id.toString())
      .filter(id => involvedUsers.includes(id));

    const baseShare = Math.floor(amount / validParticipants.length);
    const remainder = amount % validParticipants.length;

    const splits = validParticipants.map((userId, index) => {
      const share = baseShare + (index === 0 ? remainder : 0);
      const isPayer = userId === req.user.id;

      return {
        user: userId,
        amount: share,
        paidAmount: isPayer ? share : 0,
        status: isPayer ? "PAID" : "PENDING"
      };
    });

    const expense = await Expense.create({
      groupId,
      paidBy: req.user.id,
      amount,
      description,
      splits
    });

    res.status(201).json(expense);

  } catch (err) {
    console.error("Confirm Expense Error:", err);
    res.status(500).json({ message: err.message });
  }
};
