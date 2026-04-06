const Group = require("../group/group.model");
const Settlement = require("./settlement.model");
const { settleBalance, getUserBalances, simplifyDebts } = require("./balance.service");
const { getIo } = require("../../socket/socket");
const { storeMemory } = require("../ai/vector.service");

exports.getBalances = async (req,res)=>{
    try{
        const {groupId} = req.params;
        const balances = await getUserBalances(groupId,req.user.id);
        res.json(balances);
    }catch(err){
        res.status(500).json({message:err.message});
    }
};

exports.settle = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { to, amount } = req.body;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // 1️⃣ Update Redis balance
        await settleBalance(groupId, req.user.id, to, amount);

        // 2️⃣ Save settlement in Mongo
        const settlement = await Settlement.create({
            groupId,
            from: req.user.id,
            to,
            amount
        });

        // 3️⃣ Store semantic memory (Vector DB)
        await storeMemory(
            groupId,
            `Settlement: ${req.user.id} paid ₹${amount} to ${to}`,
            {
                groupId,
                type: "settlement",
                from: req.user.id,
                to,
                amount
            }
        );

        // 4️⃣ Emit socket update
        const io = getIo();
        io.to(groupId).emit("settlement_done", settlement);

        res.json({ message: "Settlement Successful" });

    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.simplify = async(req,res)=>{
    try{
        const {groupId} = req.params;
        const result = await simplifyDebts(groupId);
        res.json({
            simplifiedTransactions:result
        });
    }catch (err){
        res.status(500).json({message:err.message});
    }
}