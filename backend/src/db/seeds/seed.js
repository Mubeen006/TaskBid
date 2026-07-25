require("dotenv").config();
const mongoose = require("mongoose");
const config = require("../../config");
const User = require("../../modules/users/users.model");
const Task = require("../../modules/tasks/tasks.model");
const Bid = require("../../modules/bids/bids.model");
const AuditLog = require("../../modules/audit/auditlog.model");

async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    Bid.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
}

async function createUsers() {
  return User.create([
    { name: "Ayesha Khan",  email: "ayesha@taskbid.dev", hourlyRate: 25, maxCapacityHours: 20, currentWorkloadHours: 0 },
    { name: "Bilal Ahmed",  email: "bilal@taskbid.dev",  hourlyRate: 30, maxCapacityHours: 15, currentWorkloadHours: 13 },
    { name: "Sara Malik",   email: "sara@taskbid.dev",   hourlyRate: 28, maxCapacityHours: 25, currentWorkloadHours: 5 },
    { name: "Usman Tariq",  email: "usman@taskbid.dev",  hourlyRate: 22, maxCapacityHours: 10, currentWorkloadHours: 8 },
    { name: "Hina Riaz",    email: "hina@taskbid.dev",   hourlyRate: 26, maxCapacityHours: 18, currentWorkloadHours: 0 },
  ]);
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function advanceStatus(task, targetStatus) {
  const { STATUS_SEQUENCE } = require("../../utils/statusSequence");
  const currentIdx = STATUS_SEQUENCE.indexOf(task.status);
  const targetIdx  = STATUS_SEQUENCE.indexOf(targetStatus);
  for (let i = currentIdx; i < targetIdx; i++) {
    task.setStatus(STATUS_SEQUENCE[i + 1]);
    await task.save();
  }
}

async function createTasks(users) {
  const [ayesha, bilal, sara, usman, hina] = users;

  const draftTask = await Task.create({
    title: "Set up CI pipeline",
    description: "Configure automated build and test pipeline",
    complexity: 3,
    status: "draft",
    createdBy: ayesha._id,
    deadline: daysFromNow(14),
  });

  const openNoBids = await Task.create({
    title: "Archive old customer records",
    description: "Move records older than 5 years to cold storage",
    complexity: 2,
    status: "open",
    createdBy: bilal._id,
    deadline: daysFromNow(-2),
  });

  const openWithBids = await Task.create({
    title: "Build reporting dashboard",
    description: "Create an internal dashboard for weekly reports",
    complexity: 4,
    status: "open",
    createdBy: bilal._id,
    deadline: daysFromNow(10),
  });
  await Bid.create([
    { task: openWithBids._id, user: sara._id,   hoursOffered: 6 },
    { task: openWithBids._id, user: usman._id,  hoursOffered: 4 },
    { task: openWithBids._id, user: hina._id,   hoursOffered: 8 },
  ]);

  const biddingClosedTask = await Task.create({
    title: "Migrate legacy auth module",
    description: "Replace session-based auth with token-based auth",
    complexity: 5,
    status: "open",
    createdBy: ayesha._id,
    deadline: daysFromNow(7),
  });
  const biddingClosedBid1 = await Bid.create({ task: biddingClosedTask._id, user: bilal._id,  hoursOffered: 2 });
  const biddingClosedBid2 = await Bid.create({ task: biddingClosedTask._id, user: usman._id,  hoursOffered: 3 });
  await Bid.create({ task: biddingClosedTask._id, user: hina._id, hoursOffered: 5 });
  await advanceStatus(biddingClosedTask, "bidding_closed");

  const assignedTask = await Task.create({
    title: "Design onboarding flow",
    description: "Design and prototype the new user onboarding experience",
    complexity: 2,
    status: "open",
    createdBy: sara._id,
    deadline: daysFromNow(5),
  });
  const assignedWinningBid = await Bid.create({ task: assignedTask._id, user: usman._id, hoursOffered: 5 });
  await Bid.create({ task: assignedTask._id, user: hina._id, hoursOffered: 7 });
  await advanceStatus(assignedTask, "bidding_closed");
  assignedTask.assignedUser = usman._id;
  assignedTask.assignedBid  = assignedWinningBid._id;
  await advanceStatus(assignedTask, "assigned");
  assignedWinningBid.status = "assigned";
  await assignedWinningBid.save();

  const inProgressTask = await Task.create({
    title: "Refactor notification service",
    description: "Split notification logic into its own service",
    complexity: 4,
    status: "open",
    createdBy: sara._id,
    deadline: daysFromNow(8),
  });
  const inProgressBid = await Bid.create({ task: inProgressTask._id, user: ayesha._id, hoursOffered: 6 });
  await Bid.create({ task: inProgressTask._id, user: hina._id, hoursOffered: 9 });
  await advanceStatus(inProgressTask, "bidding_closed");
  inProgressTask.assignedUser = ayesha._id;
  inProgressTask.assignedBid  = inProgressBid._id;
  await advanceStatus(inProgressTask, "assigned");
  inProgressBid.status = "assigned";
  await inProgressBid.save();
  await advanceStatus(inProgressTask, "in_progress");

  const reviewTask = await Task.create({
    title: "Write API documentation",
    description: "Document all REST endpoints with examples",
    complexity: 2,
    status: "open",
    createdBy: hina._id,
    deadline: daysFromNow(3),
  });
  const reviewBid = await Bid.create({ task: reviewTask._id, user: sara._id, hoursOffered: 4 });
  await Bid.create({ task: reviewTask._id, user: usman._id, hoursOffered: 6 });
  await advanceStatus(reviewTask, "bidding_closed");
  reviewTask.assignedUser = sara._id;
  reviewTask.assignedBid  = reviewBid._id;
  await advanceStatus(reviewTask, "assigned");
  reviewBid.status = "assigned";
  await reviewBid.save();
  await advanceStatus(reviewTask, "review");

  const doneTask1 = await Task.create({
    title: "Fix payment gateway bug",
    description: "Resolve intermittent failures in checkout flow",
    complexity: 3,
    status: "open",
    createdBy: bilal._id,
    deadline: daysFromNow(-3),
  });
  const doneBid1 = await Bid.create({ task: doneTask1._id, user: sara._id, hoursOffered: 4 });
  await advanceStatus(doneTask1, "bidding_closed");
  doneTask1.assignedUser = sara._id;
  doneTask1.assignedBid  = doneBid1._id;
  await advanceStatus(doneTask1, "assigned");
  doneBid1.status = "assigned";
  await doneBid1.save();
  await advanceStatus(doneTask1, "done");

  const doneTask2 = await Task.create({
    title: "Optimize database queries",
    description: "Add indexes and reduce slow query times",
    complexity: 4,
    status: "open",
    createdBy: ayesha._id,
    deadline: daysFromNow(-1),
  });
  const doneBid2 = await Bid.create({ task: doneTask2._id, user: sara._id, hoursOffered: 6 });
  await advanceStatus(doneTask2, "bidding_closed");
  doneTask2.assignedUser = sara._id;
  doneTask2.assignedBid  = doneBid2._id;
  await advanceStatus(doneTask2, "assigned");
  doneBid2.status = "assigned";
  await doneBid2.save();
  await advanceStatus(doneTask2, "done");

  const doneTask3 = await Task.create({
    title: "Update landing page copy",
    description: "Refresh marketing copy for the landing page",
    complexity: 1,
    status: "open",
    createdBy: hina._id,
    deadline: daysFromNow(-5),
  });
  const doneBid3 = await Bid.create({ task: doneTask3._id, user: usman._id, hoursOffered: 3 });
  await advanceStatus(doneTask3, "bidding_closed");
  doneTask3.assignedUser = usman._id;
  doneTask3.assignedBid  = doneBid3._id;
  await advanceStatus(doneTask3, "assigned");
  doneBid3.status = "assigned";
  await doneBid3.save();
  await advanceStatus(doneTask3, "done");

  return {
    draftTask,
    openNoBids,
    openWithBids,
    biddingClosedTask,
    assignedTask,
    inProgressTask,
    reviewTask,
    doneTask1,
    doneTask2,
    doneTask3,
  };
}

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB for seeding");

  await clearCollections();
  console.log("Cleared existing collections");

  const users = await createUsers();
  console.log(`Created ${users.length} users`);

  const tasks = await createTasks(users);
  console.log(`Created ${Object.keys(tasks).length} tasks with associated bids`);

  const bidCount = await Bid.countDocuments();
  console.log(`Total bids in DB: ${bidCount}`);

  console.log("Seed complete");
  console.log("  Race-condition test task : 'Migrate legacy auth module' (bidding_closed)");
  console.log("  Near-capacity users      : Bilal Ahmed (13/15h), Usman Tariq (8/10h)");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
