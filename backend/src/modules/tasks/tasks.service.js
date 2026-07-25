const tasksRepository = require("./tasks.repository");
const bidsRepository = require("../bids/bids.repository");
const { isLegalForwardTransition } = require("../../utils/statusSequence");
const { NotFoundError, ConflictError } = require("../../errors/domainErrors");

async function createTask(body, currentUserId) {
  const { title, description, complexity, deadline } = body;
  return tasksRepository.create({
    title,
    description,
    complexity,
    deadline,
    createdBy: currentUserId,
    status: "draft",
  });
}

async function updateTaskStatus(taskId, targetStatus) {
  const task = await tasksRepository.findById(taskId);

  if (!task) {
    throw new NotFoundError("Task not found");
  }

  if (!isLegalForwardTransition(task.status, targetStatus)) {
    throw new ConflictError(
      `Cannot move task status from "${task.status}" to "${targetStatus}"`
    );
  }

  task.setStatus(targetStatus);
  await task.save();
  return task;
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
