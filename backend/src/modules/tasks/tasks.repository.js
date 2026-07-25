const Task = require("./tasks.model");

async function create(data) {
  return Task.create(data);
}

async function findById(id, session) {
  const options = session ? { session } : {};
  return Task.findById(id, null, options);
}

async function findAll(filter = {}) {
  return Task.find(filter).sort({ createdAt: -1 }).lean();
}

module.exports = { create, findById, findAll };
