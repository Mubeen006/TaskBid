const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hoursOffered: {
      type: Number,
      required: true,
      min: 0.01,
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "not_selected"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bidSchema.index({ task: 1, user: 1 }, { unique: true });
bidSchema.index({ task: 1, hoursOffered: 1 });

async function runSelfBidAndOpenCheck(taskId, userId, TaskModel, session) {
  const options = session ? { session } : {};
  const task = await TaskModel.findById(taskId, null, options);

  if (!task) {
    throw new Error("Referenced task does not exist");
  }

  if (String(task.createdBy) === String(userId)) {
    throw new Error("You cannot bid on your own task");
  }

  if (task.status !== "open") {
    throw new Error("Bidding is closed for this task");
  }
}

bidSchema.pre("save", async function guardSelfBidAndBiddingOpen(next) {
  if (!this.isNew) {
    return next();
  }

  const Task = this.model("Task");
  const session = this.$session();

  try {
    await runSelfBidAndOpenCheck(this.task, this.user, Task, session);
    return next();
  } catch (err) {
    return next(err);
  }
});

bidSchema.pre("findOneAndUpdate", async function guardSelfBidAndBiddingOpenQuery(next) {
  const update = this.getUpdate();
  const taskId = update && (update.task || (update.$set && update.$set.task));
  const userId = update && (update.user || (update.$set && update.$set.user));

  if (!taskId || !userId) {
    return next();
  }

  const Task = mongoose.model("Task");

  try {
    await runSelfBidAndOpenCheck(taskId, userId, Task, null);
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.model("Bid", bidSchema);
