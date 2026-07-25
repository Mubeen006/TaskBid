const mongoose = require("mongoose");
const config = require("../config");

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return mongoose.connection;
  }

  await mongoose.connect(config.mongoUri);
  isConnected = true;

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
  });

  return mongoose.connection;
}

function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDBConnected };
