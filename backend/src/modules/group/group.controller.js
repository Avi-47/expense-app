const Group = require("./group.model");
const User = require("../auth/user.model");
const Expense = require("../expense/expense.model");
const crypto = require("crypto");
const Invite = require("./invite.model");
const Message = require("../chat/message.model");

exports.sendInvite = async (req,res)=>{
  try{

    const {email} = req.body;
    const {groupId} = req.params;

    const user = await User.findOne({email});

    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    // store invite
    const invite = await Invite.create({
      groupId,
      fromUser:req.user.id,
      toUser:user._id
    });

    // send chat message
    await Message.create({
      sender:req.user.id,
      receiver:user._id,
      type:"invite",
      inviteGroupId:groupId,
      content:"Group invitation"
    });

    res.json({message:"Invite sent"});

  }catch(err){
    res.status(500).json({message:err.message});
  }
};

exports.respondInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { action } = req.body;

    const invite = await Invite.findById(inviteId);

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (action === "accept") {
      const group = await Group.findById(invite.groupId);

      group.members.push(invite.toUser);

      await group.save();

      invite.status = "accepted";
    } else {
      invite.status = "rejected";
    }

    await invite.save();

    res.json({ message: "Invite response recorded" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getMyInvites = async (req, res) => {
  try {
    const invites = await Invite.find({
      toUser: req.user.id,
      status: "pending"
    })
      .populate("groupId", "name")
      .populate("fromUser", "name email");

    res.json(invites);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = group.members.some(
      id => id.toString() === userId
    );

    if (!isMember) {
      return res.status(403).json({ message: "Not a group member" });
    }

    // ✅ Check unpaid splits properly
    const expenses = await Expense.find({
      groupId,
      "splits.user": userId
    });

    for (const expense of expenses) {
      const split = expense.splits.find(
        s => s.user.toString() === userId
      );

      if (!split) continue;

      const remaining = split.amount - split.paidAmount;

      if (remaining > 0) {
        return res.status(400).json({
          message: "Clear all dues before leaving group"
        });
      }
    }

    // ✅ Remove user from members
    group.members = group.members.filter(
      id => id.toString() !== userId
    );

    // ✅ If no members left → delete group
    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      await Expense.deleteMany({ groupId });

      return res.json({
        message: "Group deleted (last member left)"
      });
    }

    await group.save();

    res.json({ message: "Left group successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Only creator can delete group" });
    }

    await Group.findByIdAndDelete(groupId);
    await Expense.deleteMany({ groupId });

    res.json({ message: "Group deleted" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.name = name || group.name;

    await group.save();

    res.json(group);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId)
      .populate("members", "name email");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(group);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSidebarData = async (req, res) => {
  try {
    const userId = req.user.id;

    const groups = await Group.find({
      members: userId
    })
      .select("name lastMessageAt lastMessage createdAt inviteToken")
      .sort({ lastMessageAt: -1, createdAt: -1 });

    const invites = await Invite.find({
      toUser: userId,
      status: "pending"
    })
      .populate("groupId", "name")
      .populate("fromUser", "name");

    res.json({
      groups,
      invites
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSingleGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    console.log("Fetching group:", groupId);

    const group = await Group.findById(groupId)
      .populate("members", "name email");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(group);

  } catch (err) {
    console.error("getSingleGroup error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Create a new Group

exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name required" });
    }

    // ✅ Generate invite token
    const inviteToken = crypto.randomBytes(16).toString("hex");

    const group = await Group.create({
      name,
      createdBy: req.user.id,
      members: [req.user.id],
      inviteToken,
      lastMessageAt: new Date()
    });

    res.status(201).json({
      ...group.toObject(),
      inviteLink: `${req.protocol}://${req.get("host")}/api/groups/join/${inviteToken}`
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Join a group
exports.joinGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.members.includes(req.user.id)) {
      return res.status(400).json({ message: "Already a member" });
    }

    group.members.push(req.user.id);
    await group.save();

    res.json({ message: "Joined Group Successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all groups of logged-in user
exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({
      members: req.user.id
    }).select("_id name createdAt");

    res.json(groups);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        message: "Group not found"
      });
    }

    // Prevent duplicate
    if (group.members.includes(user._id)) {
      return res.status(400).json({
        message: "User already in group"
      });
    }

    group.members.push(user._id);
    await group.save();

    res.json({ message: "Member added" });

  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.joinGroupByInvite = async (req, res) => {
  try {
    const { token } = req.params;

    const group = await Group.findOne({ inviteToken: token });

    if (!group) {
      return res.status(404).json({ message: "Invalid invite link" });
    }

    const userId = req.user.id;

    // Prevent duplicate
    if (group.members.includes(userId)) {
      return res.json({ message: "Already a member" });
    }

    group.members.push(userId);
    await group.save();

    res.json({
      message: "Joined group successfully",
      groupId: group._id
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getInviteInfo = async (req, res) => {
  try {
    const { token } = req.params;

    const group = await Group.findOne({ inviteToken: token }).select("name");

    if (!group) {
      return res.status(404).json({ message: "Invalid invite link" });
    }

    res.json({ group });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};