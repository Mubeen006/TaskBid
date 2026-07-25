const mongoose = require("mongoose");
const { STATUS_SEQUENCE, isLegalForwardTransition } = require("../../utils/statusSequence");

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: null,
    },
    complexity: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    status: {
      type: String,
      enum: STATUS_SEQUENCE,
      default: "draft",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedBid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      default: null,
    },
    deadline: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

taskSchema.index({ status: 1 });
taskSchema.index({ deadline: 1 });

taskSchema.pre("save", function guardForwardOnlyStatus(next) {
  if (this.isNew || !this.isModified("status")) {
    return next();
  }

  const previousStatus = this._previousStatus;
  if (!previousStatus) {
    return next();
  }

  if (!isLegalForwardTransition(previousStatus, this.status)) {
    return next(
      new Error(`Application-layer guard: cannot move task status from "${previousStatus}" to "${this.status}"`)
    );
  }

  return next();
});

taskSchema.pre("findOneAndUpdate", async function guardForwardOnlyStatusQuery(next) {
  const update = this.getUpdate();
  const newStatus = update && (update.status || (update.$set && update.$set.status));

  if (!newStatus) {
    return next();
  }

  const current = await this.model.findOne(this.getQuery()).select("status").lean();
  if (!current) {
    return next();
  }

  if (!isLegalForwardTransition(current.status, newStatus)) {
    return next(
      new Error(`Application-layer guard: cannot move task status from "${current.status}" to "${newStatus}"`)
    );
  }

  return next();
});

taskSchema.methods.setStatus = function setStatus(newStatus) {
  this._previousStatus = this.status;
  this.status = newStatus;
};

module.exports = mongoose.model("Task", taskSchema);
