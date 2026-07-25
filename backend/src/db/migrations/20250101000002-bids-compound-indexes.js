module.exports = {
  async up(db) {
    await db
      .collection("bids")
      .createIndex({ task: 1, user: 1 }, { unique: true, name: "task_user_unique" });
    await db
      .collection("bids")
      .createIndex({ task: 1, hoursOffered: 1 }, { name: "task_hoursOffered" });
  },

  async down(db) {
    await db.collection("bids").dropIndex("task_user_unique");
    await db.collection("bids").dropIndex("task_hoursOffered");
  },
};
