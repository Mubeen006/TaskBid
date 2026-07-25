const User = require("../modules/users/users.model");
const { ValidationError } = require("../errors/domainErrors");
const { objectIdSchema } = require("../utils/objectIdSchema");

async function currentUser(req, res, next) {
  const rawId = req.headers["x-user-id"];

  if (!rawId) {
    return next(new ValidationError("X-User-Id header is required", []));
  }

  const { error } = objectIdSchema.validate(rawId);
  if (error) {
    return next(new ValidationError("X-User-Id must be a valid MongoDB ObjectId", []));
  }

  const user = await User.findById(rawId).lean();
  if (!user) {
    return next(new ValidationError("X-User-Id references a user that does not exist", []));
  }

  req.currentUser = user;
  return next();
}

module.exports = { currentUser };
