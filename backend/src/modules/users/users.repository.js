const User = require("./users.model");

async function findAll() {
  return User.find({}, { name: 1 }).sort({ name: 1 }).lean();
}

async function findById(id) {
  return User.findById(id).lean();
}

module.exports = { findAll, findById };
