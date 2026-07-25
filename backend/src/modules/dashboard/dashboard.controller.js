const { Router } = require("express");
const dashboardService = require("./dashboard.service");

const router = Router();

router.get("/stats", async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats();
    return res.status(200).json(stats);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
