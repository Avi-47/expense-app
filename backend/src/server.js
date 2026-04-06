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
    console.log("[1] Connecting to MongoDB...");
    await connectDB();
    console.log("[2] MongoDB connected");
    
    console.log("[3] Attempting Redis connection...");
    try {
      await connectRedis();
      console.log("[4] Redis connected");
    } catch (err) {
      console.log("[4] Redis not available, continuing without it");
    }

    console.log("[5] Creating HTTP server...");
    const server = http.createServer(app);
    console.log("[6] HTTP server created, initializing socket...");
    
    initSocket(server);
    console.log("[7] Socket initialized");

    console.log(`[8] About to listen on port ${PORT}...`);
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[9] Server is running on port ${PORT}`);
    }).on('error', (err) => {
      console.error('[10] Server listen error:', err.message);
      process.exit(1);
    });

    console.log("[11] Listen called, waiting for port...");
  } catch (err) {
    console.error("Server startup failed:", err.message);
    process.exit(1);
  }
};

startServer();