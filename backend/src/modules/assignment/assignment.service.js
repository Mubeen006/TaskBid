const mongoose = require("mongoose");
const Task = require("../tasks/tasks.model");
const Bid = require("../bids/bids.model");
const bidsRepository = require("../bids/bids.repository");
const assignmentRepository = require("./assignment.repository");
const { hasCapacityFor } = require("../../utils/capacity");
const { recordChange } = require("../audit/audit.service");
const { getIO } = require("../../realtime/socket");
const { TASK_ASSIGNED } = require("../../realtime/events");
const {
  NotFoundError,
  ConflictError,
  UnprocessableError,
} = require("../../errors/domainErrors");

const MAX_RETRIES = 3;

function isRetryableError(err) {
  if (
    typeof err.hasErrorLabel === "function" &&
    (err.hasErrorLabel("TransientTransactionError") ||
      err.hasErrorLabel("UnknownTransactionCommitResult"))
  ) {
    return true;
  }
  return false;
}

async function attemptAssignment(taskId, actorUserId, session) {
  const task = await Task.findById(taskId).session(session);

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  if (task.status !== "bidding_closed") {
    throw new ConflictError(
      `Task is not in bidding_closed status (current: "${task.status}")`
    );
  }

  const bids = await bidsRepository.findByTaskId(taskId, session);

  if (bids.length === 0) {
    throw new UnprocessableError("No bids exist for this task");
  }

  for (const bid of bids) {
    const candidate = await assignmentRepository.findUserById(bid.user, session);

    if (!hasCapacityFor(candidate, bid.hoursOffered)) {
      continue;
    }

    const updatedUser = await assignmentRepository.incrementWorkloadIfVersionMatches(
      candidate._id,
      candidate.capacityVersion,
      bid.hoursOffered,
      session
    );

    if (updatedUser === null) {
      console.log(
        `[assign] Version conflict on user ${candidate._id} — aborting and retrying whole attempt`
      );
      return { versionConflict: true };
    }

    task.setStatus("assigned");
    task.assignedUser = bid.user;
    task.assignedBid = bid._id;
    await task.save({ session });

    const winningBidDoc = await Bid.findById(bid._id).session(session);
    winningBidDoc.status = "assigned";
    await winningBidDoc.save({ session });

    await Bid.updateMany(
      { task: taskId, _id: { $ne: bid._id } },
      { status: "not_selected" },
      { session }
    );

    await recordChange({
      entityType: "task",
      entityId: task._id,
      actorUserId,
      fieldChanged: "status",
      oldValue: "bidding_closed",
      newValue: "assigned",
      session,
    });

    await recordChange({
      entityType: "bid",
      entityId: bid._id,
      actorUserId,
      fieldChanged: "status",
      oldValue: "pending",
      newValue: "assigned",
      session,
    });

    return {
      versionConflict: false,
      assignedUserId: bid.user,
      assignedBidId: bid._id,
      task,
    };
  }

  throw new UnprocessableError("No eligible bidder has sufficient capacity");
}

async function assignTask(taskId, actorUserId) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });

      const result = await attemptAssignment(taskId, actorUserId, session);

      if (result.versionConflict) {
        await session.abortTransaction();
        console.log(`[assign] Retry ${attempt}/${MAX_RETRIES} after version conflict`);
        continue;
      }

      await session.commitTransaction();

      const io = getIO();
      if (io) {
        io.to(`task:${taskId}`).emit(TASK_ASSIGNED, {
          taskId,
          assignedUserId: result.assignedUserId,
          assignedBidId: result.assignedBidId,
          status: "assigned",
        });
      }

      return result;
    } catch (err) {
      await session.abortTransaction();

      if (isRetryableError(err)) {
        console.log(
          `[assign] Retry ${attempt}/${MAX_RETRIES} after transient transaction error: ${err.message}`
        );
        continue;
      }

      throw err;
    } finally {
      session.endSession();
    }
  }

  const retryExhaustedErr = new Error(
    "Assignment retry budget exhausted due to high contention — please retry"
  );
  retryExhaustedErr.statusCode = 503;
  retryExhaustedErr.code = "RETRY_EXHAUSTED";
  throw retryExhaustedErr;
}

module.exports = { assignTask };
