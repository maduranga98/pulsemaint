const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

const ESCALATION_DAYS_OVERDUE = 7;

// Runs daily: any offboard assignment whose training end date has passed
// with no knowledge report submitted gets a reminder to the employee;
// once more than ESCALATION_DAYS_OVERDUE days overdue, escalate to the
// assigning supervisor too.
exports.checkOverdueOffboardReports = onSchedule("every 24 hours", async () => {
  const now = new Date();
  const snap = await db
    .collection("trainingAssignments")
    .where("category", "==", "offboard")
    .get();

  let remindersSent = 0;
  let escalationsSent = 0;

  await Promise.all(
    snap.docs.map(async (docSnap) => {
      const assignment = docSnap.data();
      if (assignment.offboardCompletion?.reportSubmittedAt) return;

      const endDate = assignment.offboardDetails?.endDate;
      if (!endDate || typeof endDate.toDate !== "function") return;
      const endMs = endDate.toDate().getTime();
      if (endMs >= now.getTime()) return;

      const daysOverdue = Math.floor((now.getTime() - endMs) / 86400000);
      const companyId = assignment.companyId || "";
      if (!companyId) return;

      const targetRoles = ["hr_officer"];
      const targetUserIds = [assignment.traineeId].filter(Boolean);
      let title = "Knowledge report overdue";

      if (daysOverdue >= ESCALATION_DAYS_OVERDUE) {
        targetRoles.push("supervisor");
        if (assignment.assignedBy) targetUserIds.push(assignment.assignedBy);
        title = "Knowledge report overdue — escalated";
        escalationsSent++;
      } else {
        remindersSent++;
      }

      await db.collection("companies").doc(companyId).collection("notificationLogs").add({
        type: "offboard_report_overdue",
        title,
        body: `${assignment.traineeName || "An employee"}'s knowledge report for "${assignment.moduleName || "an offboard training"}" is ${daysOverdue} day(s) overdue.`,
        assignmentId: docSnap.id,
        targetUserIds: [...new Set(targetUserIds)],
        targetRoles: [...new Set(targetRoles)],
        daysOverdue,
        createdAt: FieldValue.serverTimestamp(),
      });

      await docSnap.ref.update({
        lastOverdueReminderAt: Timestamp.now(),
      });
    })
  );

  logger.info("checkOverdueOffboardReports complete", {remindersSent, escalationsSent, checked: snap.size});
});
