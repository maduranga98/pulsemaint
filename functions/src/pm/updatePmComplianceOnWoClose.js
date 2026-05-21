/**
 * updatePmComplianceOnWoClose
 * Firestore trigger on workOrders collection when a PM-type WO is closed/completed/signed_off.
 *
 * 1. Finds linked pm_history record by woId
 * 2. Updates status: 'completed_on_time' or 'completed_late' based on due date vs completion date
 * 3. Recalculates complianceRate on parent pm_schedule document
 * 4. Updates machine profile: last PM date, next PM due, health score
 */

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore();

async function recalculateMachineHealth(machineId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const breakdownsSnap = await db
    .collection("workOrders")
    .where("machineId", "==", machineId)
    .where("woType", "==", "BREAKDOWN")
    .where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo))
    .get();
  const recentBreakdowns = breakdownsSnap.size;

  const overdueSnap = await db
    .collection("workOrders")
    .where("machineId", "==", machineId)
    .where("woType", "==", "PREVENTIVE")
    .where("slaBreached", "==", true)
    .where("status", "not-in", ["COMPLETED", "SIGNED_OFF", "CLOSED", "CANCELLED"])
    .get();
  const overduePMs = overdueSnap.size;

  const completedPMSnap = await db
    .collection("workOrders")
    .where("machineId", "==", machineId)
    .where("woType", "==", "PREVENTIVE")
    .where("status", "in", ["COMPLETED", "SIGNED_OFF", "CLOSED"])
    .where("createdAt", ">=", Timestamp.fromDate(ninetyDaysAgo))
    .get();
  const allPMSnap = await db
    .collection("workOrders")
    .where("machineId", "==", machineId)
    .where("woType", "==", "PREVENTIVE")
    .where("createdAt", ">=", Timestamp.fromDate(ninetyDaysAgo))
    .get();

  const pmComplianceRate = allPMSnap.size > 0 ? completedPMSnap.size / allPMSnap.size : 1;
  let score = 100 - recentBreakdowns * 10 - overduePMs * 5 + pmComplianceRate * 20;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return score;
}

exports.updatePmComplianceOnWoClose = onDocumentUpdated("workOrders/{woId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const woId = event.params.woId;

  // Only process PREVENTIVE WOs that transitioned to a terminal status
  const terminalStatuses = ["COMPLETED", "SIGNED_OFF", "CLOSED"];
  const wasTerminal = terminalStatuses.includes(before.status);
  const isTerminal = terminalStatuses.includes(after.status);

  if (after.woType !== "PREVENTIVE" || wasTerminal || !isTerminal) {
    return;
  }

  try {
    const completedDate = after.actualEndTime
      ? after.actualEndTime.toDate()
      : new Date();
    const dueDate = after.dueDate.toDate();

    const isOnTime = completedDate <= dueDate;
    const status = isOnTime ? "completed_on_time" : "completed_late";

    // Find linked pm_history record
    const historySnap = await db
      .collection("pm_history")
      .where("woId", "==", woId)
      .limit(1)
      .get();

    if (!historySnap.empty) {
      const historyDoc = historySnap.docs[0];
      const history = historyDoc.data();

      await historyDoc.ref.update({
        status,
        completedDate: Timestamp.fromDate(completedDate),
        daysOverdue: isOnTime ? 0 : Math.floor((completedDate - dueDate) / (1000 * 60 * 60 * 24)),
        duration: after.totalDurationMinutes,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Recalculate schedule compliance
      const scheduleRef = db.collection("pm_schedules").doc(history.scheduleId);
      const scheduleSnap = await scheduleRef.get();

      if (scheduleSnap.exists) {
        const schedule = scheduleSnap.data();
        const completedOnTime = (schedule.completedOnTime || 0) + (isOnTime ? 1 : 0);
        const completedLate = (schedule.completedLate || 0) + (isOnTime ? 0 : 1);
        const total = schedule.totalScheduled || 1;
        const complianceRate = total > 0
          ? Math.round((completedOnTime / total) * 100)
          : 100;

        await scheduleRef.update({
          completedOnTime,
          completedLate,
          complianceRate,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    // Update machine profile
    const machineRef = db.collection("machines").doc(after.machineId);
    const nextPmDue = after.dueDate; // Use existing due date or fetch from schedule

    await machineRef.update({
      lastServiceDate: Timestamp.fromDate(completedDate),
      lastServiceType: "PREVENTIVE",
      lastTechnicians: after.assignedTechnicianNames || [],
      nextPmDue,
      healthScore: await recalculateMachineHealth(after.machineId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`PM compliance updated for WO ${woId}: ${status}`);
  } catch (err) {
    logger.error(`updatePmComplianceOnWoClose failed for ${woId}`, err);
  }
});
