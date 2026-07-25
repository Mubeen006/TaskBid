const mongoose = require("mongoose");
const Bid = require("./bids.model");

async function create(data) {
  return Bid.create(data);
}

async function findByTaskId(taskId) {
  return Bid.find({ task: taskId }).sort({ hoursOffered: 1 }).lean();
}

async function getBidSummaryForTasks(taskIds) {
  if (taskIds.length === 0) {
    return {};
  }

  const objectIds = taskIds.map((id) => new mongoose.Types.ObjectId(id));
  const results = await Bid.aggregate([
    { $match: { task: { $in: objectIds } } },
    {
      $group: {
        _id: "$task",
        count: { $sum: 1 },
        lowestHours: { $min: "$hoursOffered" },
      },
    },
  ]);

  const summaryMap = {};
  for (const row of results) {
    summaryMap[row._id.toString()] = {
      count: row.count,
      lowestHours: row.lowestHours,
    };
  }
  return summaryMap;
}

module.exports = { create, findByTaskId, getBidSummaryForTasks };
