const Expense = require("./expense.model");
const Group = require("../group/group.model");
const engine = require("./balance-engine.service");
const Balance = require("./balance.model");
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
    await engine.ensureGroupBalanceDoc(groupId);

    const expense = await Expense.create({
      groupId,
      paidBy: req.user.id,
      amount,
      description,
      splits
    });

    // 5️⃣ Incremental ledger update for this expense
    const memberIds = group.members.map((member) => member._id.toString());
    const amountCents = Math.round(Number(amount) * 100);
    const netByUser = new Map();
    for (const s of splits) {
      const userId = String(s.user);
      const shareCents = Math.round(Number(s.amount) * 100);
      const paidCents = userId === String(req.user.id) ? amountCents : 0;
      netByUser.set(userId, (netByUser.get(userId) || 0) + (paidCents - shareCents));
    }

    const intermediate = await engine.buildIntermediateMatrix(netByUser, memberIds);
    await engine.mergeIntermediateIntoLedger(groupId, intermediate);
    try {
      console.log("[LEDGER AFTER CREATE]", await Balance.find({ groupId }));
    } catch (e) {
      console.error("Ledger debug failed:", e.message);
    }

    // 6️⃣ Emit socket event
    const io = getIO();
    io.to(groupId).emit("expense_added", expense);

    res.status(201).json(expense);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
