/**
 * checkPmOverdue
 * Runs every 2 hours via Cloud Scheduler.
 *
 * 1. Queries all pm_history records with status = 'in_progress' and dueDate past overdue threshold
 * 2. Updates status to 'overdue'
 * 3. Sends escalation push + SMS to Plant Manager
 * 4. Updates schedule missed counter and complianceRate
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

async function sendPushToRoleInCompany(companyId, role, title, body, data = {}) {
  const usersSnap = await db
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", role)
      .get();

  const tokens = [];
  for (const doc of usersSnap.docs) {
    const token = doc.data().fcmToken;
    if (token) tokens.push(token);
  }

  if (!tokens.length) return;

  try {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: {title, body},
      data,
    });
  } catch (err) {
    logger.error(`FCM multicast failed for role=${role}`, err);
  }
}

exports.checkPmOverdue = onSchedule({schedule: "0 */2 * * *", timeZone: "Asia/Colombo"}, async () => {
  const now = new Date();

  try {
    // Find all in_progress PM history records
    const historySnap = await db
        .collection("pm_history")
        .where("status", "==", "in_progress")
        .get();

    let overdueCount = 0;

    for (const docSnap of historySnap.docs) {
      const history = docSnap.data();
      const dueDate = history.dueDate.toDate();
      const escalationHours = history.overdueEscalationHours || 24;
      const overdueThreshold = new Date(dueDate.getTime() + escalationHours * 60 * 60 * 1000);

      if (now > overdueThreshold) {
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

        // Update history to overdue
        await docSnap.ref.update({
          status: "overdue",
          daysOverdue,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update parent schedule
        const scheduleRef = db.collection("pm_schedules").doc(history.scheduleId);
        const scheduleSnap = await scheduleRef.get();
        if (scheduleSnap.exists) {
          const schedule = scheduleSnap.data();
          const missed = (schedule.missed || 0) + 1;
          const total = (schedule.totalScheduled || 0);
          const completedOnTime = schedule.completedOnTime || 0;
          const complianceRate = total > 0 ? Math.round((completedOnTime / total) * 100) : 100;

          await scheduleRef.update({
            missed,
            complianceRate,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // Notify plant manager
        await sendPushToRoleInCompany(
            history.companyId,
            "plant_manager",
            "⚠️ PM Overdue Escalation",
            `${history.scheduleName} on ${history.machineName} is ${daysOverdue}d overdue`,
            {scheduleId: history.scheduleId, historyId: docSnap.id, screen: "PMScheduleDetail"},
        );

        overdueCount++;
      }
    }

    logger.info(`checkPmOverdue: ${overdueCount} records marked overdue`);
  } catch (err) {
    logger.error("checkPmOverdue failed", err);
  }
});
