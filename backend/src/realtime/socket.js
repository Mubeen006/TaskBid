const { Server } = require("socket.io");
const config = require("../config");
const { JOIN_TASK, LEAVE_TASK } = require("./events");

let io = null;

function initSocket(httpServer) {
  const corsOrigin = config.nodeEnv === "development" ? "*" : config.corsOrigin;

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on(JOIN_TASK, ({ taskId }) => {
      if (taskId) {
        socket.join(`task:${taskId}`);
      }
    });

    socket.on(LEAVE_TASK, ({ taskId }) => {
      if (taskId) {
        socket.leave(`task:${taskId}`);
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
