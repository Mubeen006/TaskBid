const User = require("./users.model");

async function findById(id) {
  return User.findById(id).lean();
}

module.exports = { findById };
