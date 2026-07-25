const { Router } = require("express");
const bidsService = require("./bids.service");
const { validate } = require("../../middleware/validate");
const { currentUser } = require("../../middleware/currentUser");
const { createBidSchema, bidTaskIdParamSchema } = require("./bids.schema");

const router = Router({ mergeParams: true });

router.post(
  "/",
  currentUser,
  validate(bidTaskIdParamSchema, "params"),
  validate(createBidSchema, "body"),
  async (req, res, next) => {
    try {
      const bid = await bidsService.placeBid(
        req.params.id,
        req.body.hoursOffered,
        req.currentUser
      );
      return res.status(201).json(bid);
    } catch (err) {
      return next(err);
    }
  }
);

router.get("/", validate(bidTaskIdParamSchema, "params"), async (req, res, next) => {
  try {
    const bids = await bidsService.listBidsForTask(req.params.id);
    return res.status(200).json(bids);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
