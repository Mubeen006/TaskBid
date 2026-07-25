const { Router } = require("express");
const assignmentService = require("./assignment.service");
const { validate } = require("../../middleware/validate");
const { currentUser } = require("../../middleware/currentUser");
const { taskIdParamSchema } = require("../tasks/tasks.schema");

const router = Router();

router.post(
  "/:id/assign",
  currentUser,
  validate(taskIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const result = await assignmentService.assignTask(
        req.params.id,
        req.currentUser._id
      );
      return res.status(200).json({
        assignedUserId: result.assignedUserId,
        assignedBidId: result.assignedBidId,
        task: result.task,
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
