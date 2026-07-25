module.exports = {
  async up(db) {
    await db.collection("tasks").createIndex({ status: 1 }, { name: "status_idx" });
    await db.collection("tasks").createIndex({ deadline: 1 }, { name: "deadline_idx" });
  },

  async down(db) {
    await db.collection("tasks").dropIndex("status_idx");
    await db.collection("tasks").dropIndex("deadline_idx");
  },
};
