const Joi = require("joi");
const { objectIdSchema } = require("../../utils/objectIdSchema");

const userIdParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

module.exports = { userIdParamSchema };
