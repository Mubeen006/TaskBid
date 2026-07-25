const Joi = require("joi");
const { objectIdSchema } = require("../../utils/objectIdSchema");

const STATUS_VALUES = ["draft", "open", "bidding_closed", "assigned", "in_progress", "review", "done"];

const createTaskSchema = Joi.object({
  title: Joi.string().max(200).required(),
  description: Joi.string().allow("", null).optional(),
  complexity: Joi.number().integer().min(1).max(5).required(),
  deadline: Joi.string().isoDate().required(),
});

const updateStatusSchema = Joi.object({
  targetStatus: Joi.string()
    .valid(...STATUS_VALUES)
    .required(),
});

const taskIdParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

module.exports = { createTaskSchema, updateStatusSchema, taskIdParamSchema };
