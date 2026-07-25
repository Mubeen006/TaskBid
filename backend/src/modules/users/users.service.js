const usersRepository = require("./users.repository");
const { getRemainingCapacity } = require("../../utils/capacity");
const { NotFoundError } = require("../../errors/domainErrors");

async function listUsers() {
  return usersRepository.findAll();
}

async function getWorkload(userId) {
  const user = await usersRepository.findById(userId);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return {
    userId: user._id,
    currentWorkloadHours: user.currentWorkloadHours,
    maxCapacityHours: user.maxCapacityHours,
    remainingCapacityHours: getRemainingCapacity(user),
  };
}

module.exports = { listUsers, getWorkload };
