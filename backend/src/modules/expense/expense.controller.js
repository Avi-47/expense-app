const Expense = require("./expense.model");
const Group = require("../group/group.model");
const { updateBalances } = require("./balance.service");
const { getIO } = require("../../socket/socket");

exports.confirmExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description, amount, involvedUsers, splitType } = req.body;

    // 1️⃣ Get group with members
    const group = await Group.findById(groupId).populate("members");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // 2️⃣ Validate participants
    const validParticipants = group.members
      .map(member => member._id.toString())
      .filter(memberId => involvedUsers.includes(memberId));

    if (validParticipants.length === 0) {
      return res.status(400).json({ message: "No valid participants" });
    }

    // 3️⃣ Deterministic equal split
    let splits = [];

    if (splitType === "equal") {
      const share = amount / validParticipants.length;

      splits = validParticipants.map(userId => ({
        user: userId,
        amount: share
      }));
    }

    // 4️⃣ Create expense
    const expense = await Expense.create({
      groupId,
      paidBy: req.user.id,
      amount,
      description,
      splits
    });

    // 5️⃣ Update balances (CRITICAL)
    await updateBalances(groupId, req.user.id, splits);

    // 6️⃣ Emit socket event
    const io = getIO();
    io.to(groupId).emit("expense_added", expense);

    res.status(201).json(expense);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
