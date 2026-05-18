const mongoose = require("mongoose");

const toCents = (value) => {
  if (value === null || value === undefined) {
    throw new Error("Amount is required");
  }

  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));

  if (!Number.isSafeInteger(cents)) {
    throw new Error("Amount is out of supported range");
  }

  return cents;
};

const fromCents = (cents) => cents / 100;

const payerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => Number(value) > 0,
        message: "Payer amount must be greater than 0"
      }
    }
  },
  { _id: false }
);

const splitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paidAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID"],
      default: "PENDING"
    }
  },
  { _id: false }
);

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
    payers: {
      type: [payerSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one payer is required"
      }
    },
    description: String,
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    splits: {
      type: [splitSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one split is required"
      }
    }
  },
  { timestamps: true }
);

expenseSchema.pre("validate", function validateLedger(next) {
  try {
    const totalCents = toCents(this.amount);

    let payerTotalCents = 0;
    for (const payer of this.payers || []) {
      payerTotalCents += toCents(payer.amount);
    }

    let splitTotalCents = 0;
    let splitPaidTotalCents = 0;
    let netTotalCents = 0;

    for (const split of this.splits || []) {
      const shareCents = toCents(split.amount);
      const paidCents = toCents(split.paidAmount);

      splitTotalCents += shareCents;
      splitPaidTotalCents += paidCents;
      netTotalCents += paidCents - shareCents;

      split.status = paidCents === 0 ? "PENDING" : paidCents < shareCents ? "PARTIAL" : "PAID";

      split.amount = fromCents(shareCents);
      split.paidAmount = fromCents(paidCents);
    }

    if (payerTotalCents !== totalCents) {
      throw new Error("sum(payers.amount) must equal total expense");
    }

    if (splitTotalCents !== totalCents) {
      throw new Error("sum(split.amount) must equal total expense");
    }

    if (splitPaidTotalCents !== totalCents) {
      throw new Error("sum(split.paidAmount) must equal total expense");
    }

    if (netTotalCents !== 0) {
      throw new Error("sum(paid - share) must equal 0");
    }

    this.amount = fromCents(totalCents);
    for (const payer of this.payers || []) {
      payer.amount = fromCents(toCents(payer.amount));
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

module.exports = mongoose.model("Expense", expenseSchema);