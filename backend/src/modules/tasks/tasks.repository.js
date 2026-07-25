const Task = require("./tasks.model");

async function create(data) {
  return Task.create(data);
}

async function findById(id) {
  return Task.findById(id);
}

async function findAll(filter = {}) {
  return Task.find(filter).sort({ createdAt: -1 }).lean();
}

module.exports = { create, findById, findAll };
