module.exports = {
  async up(db) {
    await db
      .collection("auditlogs")
      .createIndex({ entityType: 1, entityId: 1 }, { name: "entityType_entityId_idx" });
  },

  async down(db) {
    await db.collection("auditlogs").dropIndex("entityType_entityId_idx");
  },
};
