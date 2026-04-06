const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    // Store personal chat contacts (conversations with other users)
    conversations: [
      {
        participantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        lastMessage: {
          type: String,
          default: ""
        },
        lastMessageAt: {
          type: Date,
          default: Date.now
        },
        updatedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
