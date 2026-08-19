const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

// Mirrors src/lib/notifications/recipients.ts (OVERSIGHT_ROLES) — kept in
// sync by hand since Cloud Functions doesn't share code with the client.
const OVERSIGHT_ROLES = ["admin", "plant_manager"];

function toReminderAssignment(doc) {
  const data = doc.data();
  if (!data.companyId || !data.traineeId) return null;
  return {
    id: doc.id,
    companyId: String(data.companyId),
    traineeId: String(data.traineeId),
    traineeName: String(data.traineeName || "A trainee"),
    moduleName: String(data.moduleName || "a training module"),
  };
}

exports.sendTrainingReminders = onSchedule({schedule: "0 6 * * *", timeZone: "UTC"}, async () => {
  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  // Assignments use the real status values ('not_started'/'in_progress') and
  // a `dueDate`, not the collectionGroup-wide 'assigned' status this job
  // previously filtered on (which no assignment ever has) — that mismatch,
  // plus never writing an actual notification, meant this job silently
  // matched nothing and reminders never appeared for anyone.
  const upcomingSnap = await db.collection("trainingAssignments")
      .where("status", "in", ["not_started", "in_progress"])
      .where("dueDate", "<=", Timestamp.fromDate(threeDaysFromNow))
      .where("dueDate", ">=", Timestamp.fromDate(now))
      .get();

  const overdueSnap = await db.collection("trainingAssignments")
      .where("status", "in", ["not_started", "in_progress"])
      .where("dueDate", "<", Timestamp.fromDate(now))
      .get();

  logger.info(`Training reminders: ${upcomingSnap.size} upcoming, ${overdueSnap.size} overdue`);

  // In-app bell notification per trainee. Batched — a batch tops out at 500
  // writes, and this job can run over that many assignments.
  let batch = db.batch();
  let opsInBatch = 0;
  const commits = [];
  function queueWrite(data) {
    batch.set(db.collection("notifications").doc(), data);
    opsInBatch++;
    if (opsInBatch >= 450) {
      commits.push(batch.commit());
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  function notificationFor(a, severity, phrase) {
    return {
      companyId: a.companyId,
      type: "training",
      severity,
      message: `"${a.moduleName}" is ${phrase}`,
      oversightMessage: `has "${a.moduleName}" ${phrase}`,
      // This is a system-scheduled reminder, not a user action, so there's
      // no real "actor" — but notificationDisplayMessage's oversight
      // formatting (client-side) always expects one to prefix the
      // oversightMessage with ("{actor} (role) — {oversightMessage}"), and
      // silently falls back to the bare, subject-less oversightMessage when
      // actorName is missing. Without this, oversight readers (admin/plant
      // manager) saw a dangling `has "X" overdue` with no name attached.
      // The trainee is the closest thing to an actor here.
      actorName: a.traineeName,
      actorRole: "trainee",
      linkTo: `/app/training/my-modules/${a.id}`,
      timestamp: FieldValue.serverTimestamp(),
      read: false,
      readBy: [],
      recipientRoles: OVERSIGHT_ROLES,
      recipientUserIds: [a.traineeId],
      targetRoles: [],
      targetUserIds: [a.traineeId],
    };
  }

  for (const doc of upcomingSnap.docs) {
    const a = toReminderAssignment(doc);
    if (!a) continue;
    queueWrite(notificationFor(a, "medium", "due soon"));
  }

  for (const doc of overdueSnap.docs) {
    const a = toReminderAssignment(doc);
    if (!a) continue;
    queueWrite(notificationFor(a, "high", "overdue"));
  }

  if (opsInBatch > 0) commits.push(batch.commit());
  await Promise.all(commits);
});
