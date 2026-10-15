/**
 * schedulePmCheck
 * Runs daily at 6:00 AM (Asia/Colombo).
 *
 * For every active recurring calendar PM schedule whose next occurrence is
 * due (or within its lead time), raises one PM work order through
 * generatePmWorkOrder — work order, pm_history record and the schedule's
 * next due date in one transaction — and completes schedules past their end
 * date. Usage-based schedules are raised by onPmMeterUpdated when their meter
 * reading crosses the threshold, and re-checked here once a day.
 *
 * (Before: every run failed when writing the work order — Firestore rejects
 * serverTimestamp() inside the statusHistory array — so no PM work order was
 * ever auto-created, while a work-order number was consumed each time.)
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {planCalendarRun, usageState, toDate, DAY_MS} = require("./pmScheduling");
const {generatePmWorkOrder} = require("./generatePmWorkOrder");

const db = getFirestore("default");

/** Longest lead time looked ahead for (the form has no upper bound; 60 days covers real use). */
const MAX_LEAD_DAYS = 60;
/** Schedules processed in parallel. */
const CONCURRENCY = 5;

/**
 * Runs `worker` over `items`, `limit` at a time.
 * @param {Array} items items
 * @param {number} limit parallelism
 * @param {Function} worker async (item) => void
 * @return {Promise<void>}
 */
async function runPool(items, limit, worker) {
  let i = 0;
  const lanes = Array.from({length: Math.min(limit, items.length)}, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

/**
 * Processes one calendar schedule.
 * @param {object} docSnap schedule snapshot
 * @param {Date} now run time
 * @return {Promise<'generated'|'ended'|'skipped'>} outcome
 */
async function processCalendarSchedule(docSnap, now) {
  const schedule = docSnap.data();
  const plan = planCalendarRun(schedule, now);
  if (plan.action === "end") {
    await docSnap.ref.update({status: "completed", endedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()});
    return "ended";
  }
  if (plan.action !== "generate") return "skipped";
  const res = await generatePmWorkOrder({
    scheduleId: docSnap.id,
    source: "schedule",
    dueDate: plan.dueDate,
    nextDueDate: plan.nextDueDate,
    expectedNextDueMs: toDate(schedule.nextDueDate).getTime(),
    skipped: plan.skipped,
  });
  if (res) {
    logger.info(`PM WO created: ${res.woNumber} for schedule ${docSnap.id}`, {skipped: plan.skipped});
    return "generated";
  }
  return "skipped";
}

exports.schedulePmCheck = onSchedule(
    {schedule: "0 6 * * *", timeZone: "Asia/Colombo", timeoutSeconds: 540, memory: "512MiB"},
    async () => {
      const now = new Date();
      const horizon = new Date(now.getTime() + MAX_LEAD_DAYS * DAY_MS);
      const counts = {generated: 0, ended: 0, skipped: 0, failed: 0, usage: 0};

      // Calendar schedules due within the lead-time horizon. Each schedule's
      // own lead time and end date are applied by planCalendarRun.
      const calendarSnap = await db
          .collection("pm_schedules")
          .where("status", "==", "active")
          .where("triggerType", "==", "calendar")
          .where("nextDueDate", "<=", Timestamp.fromDate(horizon))
          .get();
      await runPool(calendarSnap.docs, CONCURRENCY, async (docSnap) => {
        try {
          counts[await processCalendarSchedule(docSnap, now)] += 1;
        } catch (err) {
          counts.failed += 1;
          logger.error(`schedulePmCheck: schedule ${docSnap.id} failed`, err);
        }
      });

      // Usage schedules whose meter is already past the threshold (safety net
      // for onPmMeterUpdated).
      const usageSnap = await db
          .collection("pm_schedules")
          .where("status", "==", "active")
          .where("triggerType", "==", "usage")
          .get();
      await runPool(usageSnap.docs.filter((d) => usageState(d.data()).due), CONCURRENCY, async (docSnap) => {
        try {
          const res = await generatePmWorkOrder({scheduleId: docSnap.id, source: "usage", dueDate: now});
          if (res) counts.usage += 1;
        } catch (err) {
          counts.failed += 1;
          logger.error(`schedulePmCheck: usage schedule ${docSnap.id} failed`, err);
        }
      });

      logger.info("schedulePmCheck done", counts);
    },
);

/**
 * Usage-based PM: raises the work order as soon as a meter reading reaches
 * the schedule's threshold (Trigger after N operating hours / cycles).
 * Before, the reading was stored but nothing ever compared it.
 */
exports.onPmMeterUpdated = onDocumentUpdated(
    {database: "default", document: "pm_schedules/{scheduleId}"},
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (after.triggerType !== "usage" || after.status !== "active") return;
      const changed = before.currentMeterValue !== after.currentMeterValue ||
        before.triggerAfterValue !== after.triggerAfterValue ||
        before.status !== after.status;
      if (!changed || !usageState(after).due) return;
      try {
        const res = await generatePmWorkOrder({scheduleId: event.params.scheduleId, source: "usage", dueDate: new Date()});
        if (res) logger.info(`Usage PM WO created: ${res.woNumber}`, {scheduleId: event.params.scheduleId});
      } catch (err) {
        logger.error("onPmMeterUpdated failed", {scheduleId: event.params.scheduleId, err});
      }
    },
);
