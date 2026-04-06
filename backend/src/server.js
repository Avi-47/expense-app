const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { initSocket } = require("./socket/socket");
const { PORT } = require("./config/env");

const Expense = require("./modules/expense/expense.model");

app.get("/debug/expenses", async (req, res) => {
  try {
    const expenses = await Expense.find();
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const startServer = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();
    
    try {
      await connectRedis();
      console.log("Redis connected");
    } catch (err) {
      console.log("Redis not available, continuing without it");
    }

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });

  } catch (err) {
    console.error("Server startup failed:", err.message);
    process.exit(1);
  }
};

startServer();