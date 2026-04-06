const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./modules/auth/auth.routes");
const groupRoutes = require("./modules/group/group.routes");
const chatRoutes = require("./modules/chat/chat.routes");
const expenseRoutes = require("./modules/expense/expense.routes");
const settlementRoutes = require("./modules/settlement/settlement.routes");
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
app.use("/api/settlement", settlementRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);

app.use(express.static(path.join(__dirname, "../frontend-dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../frontend-dist/index.html"));
});

app.get("/health", (req, res) => {
  res.status(200).json({ message: "API is healthy" });
});

module.exports = app;