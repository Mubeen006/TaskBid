const Joi = require("joi");
const { objectIdSchema } = require("../../utils/objectIdSchema");

const createBidSchema = Joi.object({
  hoursOffered: Joi.number().greater(0).required(),
});

const bidTaskIdParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

module.exports = { createBidSchema, bidTaskIdParamSchema };
