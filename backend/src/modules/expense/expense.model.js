const mongoose = require("mongoose");

const payerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  amount: {
    type: Number,
    required: true
  }
});

const splitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ["PENDING", "PARTIAL", "PAID"],
    default: "PENDING"
  }
});

const expenseSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    payers: [payerSchema],
    description: String,
    amount: Number,
    splits: [splitSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);