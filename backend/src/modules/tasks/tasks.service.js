const mongoose = require("mongoose");
const tasksRepository = require("./tasks.repository");
const bidsRepository = require("../bids/bids.repository");
const { isLegalForwardTransition } = require("../../utils/statusSequence");
const { NotFoundError, ConflictError } = require("../../errors/domainErrors");
const { recordChange } = require("../audit/audit.service");

async function createTask(body, currentUserId) {
  const { title, description, complexity, deadline } = body;
  const task = await tasksRepository.create({
    title,
    description,
    complexity,
    deadline,
    createdBy: currentUserId,
    status: "draft",
  });

  await recordChange({
    entityType: "task",
    entityId: task._id,
    actorUserId: currentUserId,
    fieldChanged: null,
    oldValue: null,
    newValue: { title: task.title, status: task.status },
  });

  return task;
}

async function updateTaskStatus(taskId, targetStatus, currentUserId) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const task = await tasksRepository.findById(taskId, session);

    if (!task) {
      throw new NotFoundError("Task not found");
    }

    if (!isLegalForwardTransition(task.status, targetStatus)) {
      throw new ConflictError(
        `Cannot move task status from "${task.status}" to "${targetStatus}"`
      );
    }

    const previousStatus = task.status;
    task.setStatus(targetStatus);
    try {
      await task.save({ session });
    } catch (err) {
      if (err.isGuardViolation === true) {
        throw new ConflictError(
          `Cannot move task status from "${previousStatus}" to "${targetStatus}"`
        );
      }
      throw err;
    }

    await recordChange({
      entityType: "task",
      entityId: task._id,
      actorUserId: currentUserId,
      fieldChanged: "status",
      oldValue: previousStatus,
      newValue: targetStatus,
      session,
    });

    await session.commitTransaction();
    return task;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function listTasks(filter = {}) {
  const tasks = await tasksRepository.findAll(filter);
  const taskIds = tasks.map((task) => String(task._id));
  const summaryMap = await bidsRepository.getBidSummaryForTasks(taskIds);

  return tasks.map((task) => {
    const summary = summaryMap[String(task._id)] || { count: 0, lowestHours: null };
    return {
      ...task,
      bidCount: summary.count,
      lowestBidHours: summary.lowestHours,
    };
  });
}

module.exports = { createTask, updateTaskStatus, listTasks };
