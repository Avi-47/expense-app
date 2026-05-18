const mongoose = require("mongoose");

const balanceSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      unique: true,
      index: true
    },
    matrix: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroupBalance", balanceSchema);
