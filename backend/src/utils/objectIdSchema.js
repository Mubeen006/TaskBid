const Joi = require("joi");

const objectIdSchema = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message("must be a valid MongoDB ObjectId");

module.exports = { objectIdSchema };
