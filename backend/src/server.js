const config = require("./config");
const { connectDB } = require("./db/connection");
const createApp = require("./app");

async function start() {
  try {
    await connectDB();
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
  }

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`TaskBid backend listening on port ${config.port}`);
  });
}

start();
