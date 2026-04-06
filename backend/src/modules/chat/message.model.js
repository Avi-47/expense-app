const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
{
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  // for group chats
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group"
  },

  // for direct chats
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  content: String,

  type: {
    type: String,
    enum: ["text", "invite"],
    default: "text"
  },

  inviteGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group"
  }

},
{ timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);