/**
 * recalculateMoeOnDataChange
 * Firestore triggers on breakdown/PM-history writes: if the record's date
 * falls within the last 7 days, drop a small idempotent marker into
 * `moeRecalcQueue` instead of recalculating synchronously (keeps the
 * triggering write fast and cheap).
 *
 * processMoeRecalcQueue drains that queue hourly and re-runs the daily calc
 * for each flagged machine/day pair.
 */

const {
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { calculateAndUpsertSnapshot } = require("./calculateDailyMoeSnapshots");

const db = getFirestore("default");
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isRecent(date) {
  if (!date) return false;
  return Date.now() - date.getTime() <= SEVEN_DAYS_MS;
}

async function enqueueRecalc(siteId, machineId, date) {
  if (!siteId || !machineId || !isRecent(date)) return;
  const dateKey = date.toISOString().slice(0, 10);
  const queueId = `${machineId}_${dateKey}`;
  await db.collection("moeRecalcQueue").doc(queueId).set({
    siteId,
    machineId,
    date: dateKey,
    queuedAt: Timestamp.now(),
    processed: false,
  }, {merge: true});
}

const recalculateMoeOnBreakdownChange = onDocumentWritten(
    "breakdown_tickets/{ticketId}",
    async (event) => {
      const data = event.data && event.data.after && event.data.after.data ?
        event.data.after.data() :
        null;
      if (!data) return;
      const reportedAt = data.reportedAt && data.reportedAt.toDate ? data.reportedAt.toDate() : null;
      await enqueueRecalc(data.siteId, data.machineId, reportedAt);
    },
);

const recalculateMoeOnPmHistoryChange = onDocumentWritten(
    "pm_history/{historyId}",
    async (event) => {
      const data = event.data && event.data.after && event.data.after.data ?
        event.data.after.data() :
        null;
      if (!data) return;
      const dueDate = data.dueDate && data.dueDate.toDate ? data.dueDate.toDate() : null;
      await enqueueRecalc(data.companyId, data.machineId, dueDate);
    },
);

const recalculateMoeOnWorkOrderChange = onDocumentWritten(
    "workOrders/{woId}",
    async (event) => {
      const data = event.data && event.data.after && event.data.after.data ?
        event.data.after.data() :
        null;
      if (!data) return;
      const UNPLANNED = new Set(["BREAKDOWN", "CORRECTIVE", "EMERGENCY"]);
      if (!UNPLANNED.has(String(data.woType || "").toUpperCase())) return;
      const end = data.actualEndTime && data.actualEndTime.toDate ? data.actualEndTime.toDate() : null;
      const created = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null;
      await enqueueRecalc(data.siteId, data.machineId, end || created);
    },
);

const processMoeRecalcQueue = onSchedule(
    {schedule: "0 * * * *", timeZone: "UTC"},
    async () => {
      const pendingSnap = await db.collection("moeRecalcQueue").where("processed", "==", false).limit(200).get();
      let processed = 0;
      for (const doc of pendingSnap.docs) {
        const item = doc.data();
        try {
          const machineDoc = await db.collection("machines").doc(item.machineId).get();
          if (machineDoc.exists) {
            const machine = {id: machineDoc.id, ...machineDoc.data()};
            const dayStart = new Date(`${item.date}T00:00:00.000Z`);
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
            await calculateAndUpsertSnapshot(machine, dayStart, dayEnd);
          }
          await doc.ref.update({processed: true, processedAt: Timestamp.now()});
          processed += 1;
        } catch (err) {
          logger.error(`processMoeRecalcQueue failed for ${doc.id}`, err);
        }
      }
      logger.info(`processMoeRecalcQueue: processed ${processed} queue items`);
    },
);

module.exports = {
  recalculateMoeOnBreakdownChange,
  recalculateMoeOnPmHistoryChange,
  recalculateMoeOnWorkOrderChange,
  processMoeRecalcQueue,
};
