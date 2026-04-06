const Payment = require("./payment.model");
const { settleBalance } = require("../expense/balance.service");
const { getIO } = require("../../socket/socket");
const { storeMemory } = require("../ai/vector.service");
const { createOrder } = require("./razorpay.service");

exports.handleWebhook = async (req, res) => {
  try {
    const { orderId } = req.body;

    const payment = await Payment.findOne({
      gatewayOrderId: orderId
    });

    if (!payment) return res.status(404).send();

    payment.status = "completed";
    await payment.save();

    // Settle balance in Redis
    await settleBalance(
      payment.groupId,
      payment.from,
      payment.to,
      payment.amount
    );

    // Store settlement memory
    await storeMemory(
      payment.groupId,
      `Settlement via payment: ${payment.from} paid ₹${payment.amount} to ${payment.to}`,
      { type: "settlement" }
    );

    const io = getIO();
    io.to(payment.groupId.toString()).emit("payment_completed", payment);

    res.status(200).send();

  } catch (err) {
    res.status(500).send();
  }
};


exports.createPaymentIntent = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { to, amount } = req.body;

    const order = await createOrder(amount);

    const payment = await Payment.create({
      groupId,
      from: req.user.id,
      to,
      amount,
      gatewayOrderId: order.id,
      status: "pending"
    });

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      paymentId: payment._id
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const crypto = require("crypto");

exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const payment = await Payment.findOne({
      gatewayOrderId: razorpay_order_id
    });

    payment.status = "completed";
    await payment.save();

    await settleBalance(
      payment.groupId,
      payment.from,
      payment.to,
      payment.amount
    );

    const io = getIO();
    io.to(payment.groupId.toString()).emit("payment_completed", payment);

    res.json({ message: "Payment verified and settled" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
