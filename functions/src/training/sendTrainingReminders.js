const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

exports.sendTrainingReminders = onSchedule("every 24 hours", async () => {
  const snap = await db.collectionGroup("trainingAssignments").where("status", "in", ["assigned", "in_progress"]).get();
  await Promise.all(snap.docs.slice(0, 100).map((doc) => doc.ref.update({lastReminderCheckedAt: FieldValue.serverTimestamp()})));
  logger.info("Checked training reminders", {count: snap.size});
});
