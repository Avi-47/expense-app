const express = require("express");
const cors = require("cors");

const authRoutes = require("./modules/auth/auth.routes");
const groupRoutes = require("./modules/group/group.routes");
const chatRoutes = require("./modules/chat/chat.routes");
const expenseRoutes = require("./modules/expense/expense.routes");
const settlementRoutes = require("./modules/settlement/settlement.routes"); // <-- here
const aiRoutes = require("./modules/ai/ai.routes");
const paymentRoutes = require("./modules/payment/payment.routes");
const userRoutes = require("./modules/user/user.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/settlement", settlementRoutes); // <-- here
app.use("/api/ai", aiRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ message: "API is healthy" });
});

module.exports = app;