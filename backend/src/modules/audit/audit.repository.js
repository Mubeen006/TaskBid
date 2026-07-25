const AuditLog = require("./auditlog.model");

async function create(payload, session) {
  const options = session ? { session } : {};
  const [doc] = await AuditLog.create([payload], options);
  return doc;
}

module.exports = { create };
