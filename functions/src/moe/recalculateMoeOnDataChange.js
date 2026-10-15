/**
 * MOE recalculation on data changes.
 *
 * Firestore triggers on breakdown / PM-history / work-order writes drop a
 * small idempotent marker into `moeRecalcQueue` for each recent (last 7
 * days) company-local day the change affects — a breakdown that spans
 * several days marks each of them. processMoeRecalcQueue drains the queue
 * hourly and recomputes those days per company.
 *
 * The previous triggers were declared without `database: "default"`, so they
 * listened on a database the app doesn't use and never fired. They are
 * replaced by the ones below (new names, so the deploy swaps them cleanly).
 */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {computeCompanyDay} = require("./calculateDailyMoeSnapshots");
const {toDateValue} = require("../lib/machineDowntime");
const {localDateKey, safeZone} = require("../lib/zonedTime");

const db = getFirestore("default");
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 7;

/** @return {Promise<string>} the company's IANA timezone (UTC when unset) */
async function companyZone(companyId) {
  const snap = await db.collection("companies").doc(String(companyId)).get();
  return safeZone(snap.exists ? snap.data().timezone : null);
}

/**
 * Queues every recent local day in [from, to] for one machine.
 * @param {string} siteId company / site id
 * @param {string} machineId machine id
 * @param {Date|null} from first affected instant
 * @param {Date|null} to last affected instant (defaults to now)
 * @return {Promise<void>}
 */
async function enqueueRange(siteId, machineId, from, to) {
  if (!siteId || !machineId || !from) return;
  const now = Date.now();
  const end = Math.min(now, (to || new Date()).getTime());
  const start = Math.max(from.getTime(), now - RECENT_DAYS * DAY_MS);
  if (end < start) return;
  const zone = await companyZone(siteId);
  const keys = new Set();
  for (let t = start; t <= end; t += DAY_MS) keys.add(localDateKey(new Date(t), zone));
  keys.add(localDateKey(new Date(end), zone));
  const batch = db.batch();
  keys.forEach((dateKey) => {
    batch.set(db.collection("moeRecalcQueue").doc(`${machineId}_${dateKey}`), {
      siteId,
      machineId,
      date: dateKey,
      queuedAt: Timestamp.now(),
      processed: false,
    }, {merge: true});
  });
  await batch.commit();
}

const moeOnBreakdownWrite = onDocumentWritten(
    {database: "default", document: "breakdown_tickets/{ticketId}"},
    async (event) => {
      const data = (event.data.after.exists ? event.data.after : event.data.before).data();
      if (!data) return;
      const reported = toDateValue(data.reportedAt);
      const done = toDateValue(data.closedAt) || toDateValue(data.resolvedAt);
      await enqueueRange(data.siteId || data.companyId, data.machineId, reported, done).catch((err) =>
        logger.error("moeOnBreakdownWrite failed", err));
    },
);

const moeOnPmHistoryWrite = onDocumentWritten(
    {database: "default", document: "pm_history/{historyId}"},
    async (event) => {
      const data = (event.data.after.exists ? event.data.after : event.data.before).data();
      if (!data) return;
      const due = toDateValue(data.dueDate);
      await enqueueRange(data.companyId, data.machineId, due, due).catch((err) =>
        logger.error("moeOnPmHistoryWrite failed", err));
    },
);

// A work order's sign-off ends its linked breakdown's downtime, so the days
// from the breakdown's start to the sign-off are recomputed.
const moeOnWorkOrderWrite = onDocumentWritten(
    {database: "default", document: "workOrders/{woId}"},
    async (event) => {
      const data = event.data.after.exists ? event.data.after.data() : null;
      if (!data || !data.machineId) return;
      const before = event.data.before.exists ? event.data.before.data() : {};
      // Downtime only moves when the work order starts, is signed off, etc.
      if (before.status === data.status) return;
      const start = toDateValue(data.actualStartTime) || toDateValue(data.createdAt);
      const end = toDateValue(data.supervisorSignOffAt) || toDateValue(data.closedAt) || new Date();
      await enqueueRange(data.companyId || data.siteId, data.machineId, start, end).catch((err) =>
        logger.error("moeOnWorkOrderWrite failed", err));
    },
);

const processMoeRecalcQueue = onSchedule(
    {schedule: "0 * * * *", timeZone: "UTC", timeoutSeconds: 540, memory: "1GiB"},
    async () => {
      const pendingSnap = await db.collection("moeRecalcQueue").where("processed", "==", false).limit(500).get();
      // One recomputation per company/day for all of its queued machines.
      const groups = new Map();
      pendingSnap.docs.forEach((doc) => {
        const item = doc.data();
        const key = `${item.siteId}|${item.date}`;
        if (!groups.has(key)) groups.set(key, {siteId: item.siteId, date: item.date, machineIds: new Set(), docs: []});
        groups.get(key).machineIds.add(item.machineId);
        groups.get(key).docs.push(doc);
      });
      let processed = 0;
      for (const group of groups.values()) {
        try {
          const timeZone = await companyZone(group.siteId);
          await computeCompanyDay(group.siteId, group.date, {timeZone, machineIds: group.machineIds});
          const batch = db.batch();
          group.docs.forEach((d) => batch.update(d.ref, {processed: true, processedAt: Timestamp.now()}));
          await batch.commit();
          processed += group.docs.length;
        } catch (err) {
          logger.error(`processMoeRecalcQueue failed for ${group.siteId} ${group.date}`, err);
        }
      }
      logger.info(`processMoeRecalcQueue: processed ${processed} queue items`);
    },
);

module.exports = {
  moeOnBreakdownWrite,
  moeOnPmHistoryWrite,
  moeOnWorkOrderWrite,
  processMoeRecalcQueue,
};
