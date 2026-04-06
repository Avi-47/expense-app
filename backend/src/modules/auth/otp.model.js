const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false
  },
  otpHash: {
    type: String,
    required: true
  },
  contactMethod: {
    type: String,
    enum: ["email", "phone"],
    required: true
  },
  contactValue: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  attemptCount: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ userId: 1 });
otpSchema.index({ contactValue: 1 });

module.exports = mongoose.model("OTP", otpSchema);