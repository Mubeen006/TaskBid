const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    hourlyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    maxCapacityHours: {
      type: Number,
      required: true,
      min: 0,
    },
    currentWorkloadHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    capacityVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
