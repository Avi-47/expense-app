const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group"
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    amount: Number,
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending"
    },
    gatewayOrderId: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
