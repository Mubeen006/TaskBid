const dashboardRepository = require("./dashboard.repository");

async function getDashboardStats() {
  const [
    tasksByStatus,
    avgBidByComplexity,
    topUsersByCompleted,
    zeroBidPastDeadline,
  ] = await Promise.all([
    dashboardRepository.getTasksByStatus(),
    dashboardRepository.getAvgBidByComplexity(),
    dashboardRepository.getTopUsersByCompleted(),
    dashboardRepository.getZeroBidPastDeadline(),
  ]);

  return { tasksByStatus, avgBidByComplexity, topUsersByCompleted, zeroBidPastDeadline };
}

module.exports = { getDashboardStats };
