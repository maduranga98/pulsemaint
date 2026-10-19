/**
 * checkPmOverdue
 * Runs every 2 hours.
 *
 * For every open PM occurrence (pm_history in_progress / overdue):
 *  - past its overdue-escalation hours → status 'overdue' and the plant
 *    managers of the machine's plant are pushed an escalation (once);
 *  - past its auto-close days without completion → status 'missed', and the
 *    schedule's missed count / compliance rate are updated.
 *
 * Each occurrence lands in exactly one compliance bucket. Before, an overdue
 * PM was counted as missed right away and again as completed-late when it was
 * done, and every company's plant managers were escalated to.
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");
const {openOccurrenceStatus, complianceRate, toDate, DAY_MS} = require("./pmScheduling");
const {recordPmCompletion, DONE_STATUSES} = require("./pmCompliance");

const db = getFirestore("default");

/**
 * Push to the plant managers responsible for this PM's plant (and those with
 * no plant, who oversee every plant).
 * @param {object} history pm_history data
 * @param {string} title title
 * @param {string} body body
 * @param {object} data payload
 * @return {Promise<void>}
 */
async function pushPlantManagers(history, title, body, data) {
  const usersSnap = await db
      .collection("users")
      .where("companyId", "==", history.companyId)
      .where("role", "==", "plant_manager")
      .get();
  const plantId = history.machinePlantId || null;
  const tokens = usersSnap.docs
      .map((d) => d.data())
      .filter((u) => u.status !== "inactive")
      .filter((u) => !plantId || !u.plantId || u.plantId === plantId)
      .map((u) => u.fcmToken)
      .filter(Boolean);
  if (!tokens.length) return;
  await getMessaging().sendEachForMulticast({tokens, notification: {title, body}, data})
      .catch((err) => logger.error("FCM multicast failed for plant managers", err));
}

/**
 * Marks one occurrence missed and updates its schedule, atomically, so a
 * retried run can't count it twice.
 * @param {object} historyRef pm_history ref
 * @return {Promise<boolean>} whether it was marked now
 */
async function markMissed(historyRef) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(historyRef);
    const h = snap.data();
    if (!h || !["in_progress", "overdue"].includes(h.status)) return false;
    const scheduleRef = h.scheduleId ? db.collection("pm_schedules").doc(String(h.scheduleId)) : null;
    const scheduleSnap = scheduleRef ? await tx.get(scheduleRef) : null;
    const due = toDate(h.dueDate);
    tx.update(historyRef, {
      status: "missed",
      missedAt: FieldValue.serverTimestamp(),
      daysOverdue: due ? Math.floor((Date.now() - due.getTime()) / DAY_MS) : h.daysOverdue || 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (scheduleSnap && scheduleSnap.exists) {
      const s = scheduleSnap.data();
      const counters = {completedOnTime: s.completedOnTime || 0, completedLate: s.completedLate || 0, missed: (s.missed || 0) + 1};
      tx.update(scheduleRef, {missed: counters.missed, complianceRate: complianceRate(counters), updatedAt: FieldValue.serverTimestamp()});
    }
    return true;
  });
}

exports.checkPmOverdue = onSchedule(
    {schedule: "0 */2 * * *", timeZone: "Asia/Colombo", timeoutSeconds: 540},
    async () => {
      const now = new Date();
      let overdue = 0;
      let missed = 0;
      const historySnap = await db.collection("pm_history").where("status", "in", ["in_progress", "overdue"]).get();

      for (const docSnap of historySnap.docs) {
        const history = docSnap.data();
        try {
          // Its work order is already done (a completion the trigger missed):
          // record it as completed instead of escalating / marking missed.
          if (history.woId) {
            const woSnap = await db.collection("workOrders").doc(String(history.woId)).get();
            const wo = woSnap.exists ? woSnap.data() : null;
            if (wo && DONE_STATUSES.has(wo.status)) {
              await recordPmCompletion(woSnap.id, wo);
              continue;
            }
          }
          const target = openOccurrenceStatus(history, now);
          if (target === "missed") {
            if (await markMissed(docSnap.ref)) missed += 1;
          } else if (target === "overdue" && history.status === "in_progress") {
            const due = toDate(history.dueDate);
            const daysOverdue = due ? Math.floor((now.getTime() - due.getTime()) / DAY_MS) : 0;
            await docSnap.ref.update({status: "overdue", daysOverdue, updatedAt: FieldValue.serverTimestamp()});
            overdue += 1;
            await pushPlantManagers(
                history,
                "⚠️ PM Overdue Escalation",
                `${history.scheduleName || "PM"} on ${history.machineName || "a machine"} is overdue`,
                {scheduleId: String(history.scheduleId || ""), historyId: docSnap.id, screen: "PMScheduleDetail"},
            );
          }
        } catch (err) {
          logger.error(`checkPmOverdue: ${docSnap.id} failed`, err);
        }
      }
      logger.info(`checkPmOverdue: ${overdue} marked overdue, ${missed} marked missed`);
    },
);
