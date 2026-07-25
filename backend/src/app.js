const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const config = require("./config");
const { isDBConnected } = require("./db/connection");
const usersRouter = require("./modules/users/users.controller");
const tasksRouter = require("./modules/tasks/tasks.controller");
const bidsRouter = require("./modules/bids/bids.controller");
const assignmentRouter = require("./modules/assignment/assignment.controller");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use(mongoSanitize());

  app.get("/health", (req, res) => {
    if (isDBConnected()) {
      return res.status(200).json({ status: "ok" });
    }
    return res.status(503).json({ status: "unavailable" });
  });

  app.use("/api/users", usersRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/tasks/:id/bids", bidsRouter);
  app.use("/api/tasks", assignmentRouter);

  app.use((req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";
    const message = statusCode === 500 ? "Something went wrong" : err.message;

    if (statusCode === 500) {
      console.error(err);
    }

    res.status(statusCode).json({ error: { code, message, details: err.details } });
  });

  return app;
}

module.exports = createApp;
