function getRemainingCapacity(user) {
  return user.maxCapacityHours - user.currentWorkloadHours;
}

function hasCapacityFor(user, hoursRequested) {
  return getRemainingCapacity(user) >= hoursRequested;
}

module.exports = { getRemainingCapacity, hasCapacityFor };
