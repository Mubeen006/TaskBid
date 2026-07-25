const mongoose = require("mongoose");
const Bid = require("./bids.model");
const tasksRepository = require("../tasks/tasks.repository");
const bidsRepository = require("./bids.repository");
const { hasCapacityFor } = require("../../utils/capacity");
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnprocessableError,
} = require("../../errors/domainErrors");
const { recordChange } = require("../audit/audit.service");

function translateBidCreateError(err) {
  if (err.code === 11000) {
    throw new ConflictError("You have already placed a bid on this task");
  }

  const message = err.message || "";
  if (message.includes("You cannot bid on your own task")) {
    throw new ForbiddenError("You cannot bid on your own task");
  }
  if (message.includes("Bidding is closed for this task")) {
    throw new ConflictError("Bidding is closed for this task");
  }

  throw err;
}

async function placeBid(taskId, hoursOffered, currentUser) {
  const task = await tasksRepository.findById(taskId);

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  if (!hasCapacityFor(currentUser, hoursOffered)) {
    throw new UnprocessableError("This exceeds your remaining capacity");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    let bid;
    try {
      [bid] = await Bid.create(
        [{ task: taskId, user: currentUser._id, hoursOffered }],
        { session }
      );
    } catch (err) {
      translateBidCreateError(err);
    }

    await recordChange({
      entityType: "bid",
      entityId: bid._id,
      actorUserId: currentUser._id,
      fieldChanged: null,
      oldValue: null,
      newValue: { hoursOffered: bid.hoursOffered, status: bid.status },
      session,
    });

    await session.commitTransaction();
    return bid;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function listBidsForTask(taskId) {
  const task = await tasksRepository.findById(taskId);

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  return bidsRepository.findByTaskId(taskId);
}

module.exports = { placeBid, listBidsForTask };
