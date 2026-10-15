/**
 * PM compliance bookkeeping for a completed PM work order — the single place
 * a PM occurrence is recorded as completed on time / late and its schedule's
 * counters and compliance rate are updated (used by updatePmComplianceOnWoClose
 * and checkPmOverdue). The browser no longer writes these figures, so they
 * aren't counted twice.
 */

const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {complianceRate, toDate, DAY_MS} = require("./pmScheduling");

const db = getFirestore("default");

const DONE_STATUSES = new Set(["COMPLETED", "SIGNED_OFF", "CLOSED"]);

/**
 * End of the due day (UTC) — a PM finished any time on its due date is on time.
 * @param {Date} due due date
 * @return {Date} end of that day
 */
function endOfDueDay(due) {
  return new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) + DAY_MS - 1);
}

/**
 * Finds the pm_history record of a PM work order.
 * @param {string} woId work order id
 * @param {object} wo work order data
 * @return {Promise<object|null>} history doc ref
 */
async function findHistoryRef(woId, wo) {
  if (wo.pmHistoryId) {
    const ref = db.collection("pm_history").doc(String(wo.pmHistoryId));
    const snap = await ref.get();
    if (snap.exists) return ref;
  }
  const q = await db.collection("pm_history").where("woId", "==", woId).limit(1).get();
  return q.empty ? null : q.docs[0].ref;
}

/**
 * Records a completed PM work order on its pm_history record and schedule.
 * Idempotent: an occurrence already recorded as completed is left alone; one
 * that had been marked missed moves to completed-late.
 * @param {string} woId work order id
 * @param {object} wo work order data
 * @return {Promise<string|null>} the status recorded, or null
 */
async function recordPmCompletion(woId, wo) {
  if (wo.woType !== "PREVENTIVE" || !DONE_STATUSES.has(wo.status)) return null;
  const historyRef = await findHistoryRef(woId, wo);
  const completedDate = toDate(wo.actualEndTime) || new Date();

  return db.runTransaction(async (tx) => {
    const historySnap = historyRef ? await tx.get(historyRef) : null;
    const history = historySnap && historySnap.exists ? historySnap.data() : null;
    if (history && String(history.status).startsWith("completed")) return null;

    const scheduleId = (history && history.scheduleId) || wo.pmScheduleId || null;
    const scheduleRef = scheduleId ? db.collection("pm_schedules").doc(String(scheduleId)) : null;
    const scheduleSnap = scheduleRef ? await tx.get(scheduleRef) : null;

    const due = toDate((history && history.dueDate) || wo.dueDate);
    const onTime = !due || completedDate.getTime() <= endOfDueDay(due).getTime();
    const status = onTime ? "completed_on_time" : "completed_late";
    const wasMissed = !!history && history.status === "missed";

    if (historyRef && history) {
      tx.update(historyRef, {
        status,
        completedDate: Timestamp.fromDate(completedDate),
        daysOverdue: onTime || !due ? 0 : Math.max(0, Math.ceil((completedDate.getTime() - endOfDueDay(due).getTime()) / DAY_MS)),
        duration: wo.totalDurationMinutes ?? null,
        woNumber: wo.woNumber || history.woNumber || "",
        technicianIds: wo.assignedTechnicianIds || history.technicianIds || [],
        technicianNames: wo.assignedTechnicianNames || history.technicianNames || [],
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (scheduleSnap && scheduleSnap.exists) {
      const s = scheduleSnap.data();
      const counters = {
        completedOnTime: (s.completedOnTime || 0) + (onTime ? 1 : 0),
        completedLate: (s.completedLate || 0) + (onTime ? 0 : 1),
        missed: Math.max(0, (s.missed || 0) - (wasMissed ? 1 : 0)),
      };
      const update = {
        ...counters,
        complianceRate: complianceRate(counters),
        lastCompletedDate: Timestamp.fromDate(completedDate),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (s.activeWoId === woId || !s.activeWoId) {
        update.activeWoId = woId;
        update.activeWoStatus = wo.status;
      }
      // A one-off PM (raised together with its work order) is done.
      if (s.recurrenceType === "one_time") update.status = "completed";
      tx.update(scheduleRef, update);
    }
    return status;
  });
}

module.exports = {recordPmCompletion, endOfDueDay, DONE_STATUSES};

/**
 * Keeps a PM schedule's "linked work order" status (activeWoStatus, shown on
 * PM Schedules / Calendar / schedule detail) in step with its work order —
 * started, on hold, completed, signed off, cancelled. Done server-side so it
 * also works when a technician moves the work order (they can't write PM
 * schedules), replacing the browser-side utils/pmScheduleSync.
 */
module.exports.syncPmScheduleWoStatus = onDocumentUpdated(
    {database: "default", document: "workOrders/{woId}"},
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      const woId = event.params.woId;
      if (after.woType !== "PREVENTIVE" || !after.pmScheduleId || before.status === after.status) return;
      try {
        const ref = db.collection("pm_schedules").doc(String(after.pmScheduleId));
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const s = snap.data();
          // A newer occurrence's work order owns the field.
          if (s.activeWoId && s.activeWoId !== woId) return;
          tx.update(ref, {activeWoId: woId, activeWoStatus: after.status, updatedAt: FieldValue.serverTimestamp()});
        });
      } catch (err) {
        logger.error("syncPmScheduleWoStatus failed", {woId, err});
      }
    },
);
