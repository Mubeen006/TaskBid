const http = require("http");
const config = require("./config");
const { connectDB } = require("./db/connection");
const createApp = require("./app");
const { initSocket } = require("./realtime/socket");

async function start() {
  try {
    await connectDB();
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
  }

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`TaskBid backend listening on port ${config.port}`);
  });
}

start();
