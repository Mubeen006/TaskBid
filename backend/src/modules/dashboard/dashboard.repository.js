const Task = require("../tasks/tasks.model");
const Bid = require("../bids/bids.model");

async function getTasksByStatus() {
  const rows = await Task.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $project: { _id: 0, status: "$_id", count: 1 } },
    { $sort: { status: 1 } },
  ]);
  return rows;
}

async function getAvgBidByComplexity() {
  const rows = await Bid.aggregate([
    {
      $lookup: {
        from: "tasks",
        localField: "task",
        foreignField: "_id",
        as: "taskDoc",
      },
    },
    { $unwind: "$taskDoc" },
    {
      $group: {
        _id: "$taskDoc.complexity",
        averageHours: { $avg: "$hoursOffered" },
      },
    },
    {
      $project: {
        _id: 0,
        complexity: "$_id",
        averageHours: { $round: ["$averageHours", 2] },
      },
    },
    { $sort: { complexity: 1 } },
  ]);
  return rows;
}

async function getTopUsersByCompleted() {
  const rows = await Task.aggregate([
    { $match: { status: "done", assignedUser: { $ne: null } } },
    { $group: { _id: "$assignedUser", completedCount: { $sum: 1 } } },
    { $sort: { completedCount: -1 } },
    { $limit: 3 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userDoc",
      },
    },
    { $unwind: "$userDoc" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: "$userDoc.name",
        completedCount: 1,
      },
    },
  ]);
  return rows;
}

async function getZeroBidPastDeadline() {
  const now = new Date();
  const rows = await Task.aggregate([
    { $match: { deadline: { $lt: now } } },
    {
      $lookup: {
        from: "bids",
        localField: "_id",
        foreignField: "task",
        as: "bids",
      },
    },
    { $match: { bids: { $size: 0 } } },
    {
      $project: {
        _id: 0,
        taskId: "$_id",
        title: 1,
        deadline: 1,
      },
    },
    { $sort: { deadline: 1 } },
  ]);
  return rows;
}

module.exports = {
  getTasksByStatus,
  getAvgBidByComplexity,
  getTopUsersByCompleted,
  getZeroBidPastDeadline,
};
