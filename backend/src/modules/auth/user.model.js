const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      unique: true,
      sparse: true
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    password: {
      type: String,
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationMethod: {
      type: String,
      enum: ["email", "phone", null],
      default: null
    },
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
