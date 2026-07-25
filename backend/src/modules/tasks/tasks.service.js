const tasksRepository = require("./tasks.repository");
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
  return tasksRepository.findAll(filter);
}

module.exports = { createTask, updateTaskStatus, listTasks };
