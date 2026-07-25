const auditRepository = require("./audit.repository");

async function recordChange({ entityType, entityId, actorUserId, fieldChanged, oldValue, newValue, session }) {
  try {
    return await auditRepository.create(
      { entityType, entityId, actorUserId, fieldChanged, oldValue, newValue },
      session
    );
  } catch (err) {
    console.error("Audit write failed — primary operation will not be affected:", err);
  }
}

module.exports = { recordChange };
