const { Router } = require("express");
const usersService = require("./users.service");
const { validate } = require("../../middleware/validate");
const { userIdParamSchema } = require("./users.schema");

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const users = await usersService.listUsers();
    return res.status(200).json(users);
  } catch (err) {
    return next(err);
  }
});

router.get("/:id/workload", validate(userIdParamSchema, "params"), async (req, res, next) => {
  try {
    const data = await usersService.getWorkload(req.params.id);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
