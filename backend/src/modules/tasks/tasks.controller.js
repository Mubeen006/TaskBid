const { Router } = require("express");
const tasksService = require("./tasks.service");
const { validate } = require("../../middleware/validate");
const { currentUser } = require("../../middleware/currentUser");
const {
  createTaskSchema,
  updateStatusSchema,
  taskIdParamSchema,
} = require("./tasks.schema");

const router = Router();

router.post(
  "/",
  currentUser,
  validate(createTaskSchema, "body"),
  async (req, res, next) => {
    try {
      const task = await tasksService.createTask(req.body, req.currentUser._id);
      return res.status(201).json(task);
    } catch (err) {
      return next(err);
    }
  }
);

router.patch(
  "/:id/status",
  currentUser,
  validate(taskIdParamSchema, "params"),
  validate(updateStatusSchema, "body"),
  async (req, res, next) => {
    try {
      const task = await tasksService.updateTaskStatus(
        req.params.id,
        req.body.targetStatus
      );
      return res.status(200).json(task);
    } catch (err) {
      return next(err);
    }
  }
);

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const tasks = await tasksService.listTasks(filter);
    return res.status(200).json(tasks);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
