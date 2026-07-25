const STATUS_SEQUENCE = [
  "draft",
  "open",
  "bidding_closed",
  "assigned",
  "in_progress",
  "review",
  "done",
];

function isLegalForwardTransition(fromStatus, toStatus) {
  const fromIndex = STATUS_SEQUENCE.indexOf(fromStatus);
  const toIndex = STATUS_SEQUENCE.indexOf(toStatus);

  if (fromIndex === -1 || toIndex === -1) {
    return false;
  }

  return toIndex === fromIndex + 1;
}

module.exports = { STATUS_SEQUENCE, isLegalForwardTransition };
