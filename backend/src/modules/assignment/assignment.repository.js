const User = require("../users/users.model");

async function findUserById(userId, session) {
  return User.findById(userId).session(session);
}

async function incrementWorkloadIfVersionMatches(userId, capacityVersion, hoursToAdd, session) {
  return User.findOneAndUpdate(
    { _id: userId, capacityVersion },
    { $inc: { currentWorkloadHours: hoursToAdd, capacityVersion: 1 } },
    { session, new: true }
  );
}

module.exports = { findUserById, incrementWorkloadIfVersionMatches };
