/**
 * calculateDailyMoeSnapshots
 * Scheduled daily (00:30). For every active machine of every company,
 * computes the four MOE sub-scores + composite MOE for "yesterday" from
 * breakdowns / PM history / machine healthScore + criticality, and upserts
 * an idempotent snapshot doc keyed by machineId+date into `moeSnapshots`.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {
  DEFAULT_CONFIG,
  calculateAvailabilityScore,
  calculateReliabilityScore,
  calculateMaintenanceComplianceScore,
  calculateMoeScore,
} = require("./moeCalc");

const db = getFirestore("default");

function getEffectivePmStatus(record, now) {
  const status = record.status || "";
  if (["completed_on_time", "completed_late", "missed", "overdue"].includes(status)) {
    return status;
  }
  const due = record.dueDate && record.dueDate.toDate ? record.dueDate.toDate() : null;
  const completed = record.completedDate && record.completedDate.toDate ? record.completedDate.toDate() : null;
  if (due && !completed && due.getTime() < now.getTime()) return "overdue";
  return status || "in_progress";
}

async function fetchMoeConfig(siteId) {
  const snap = await db.collection("moeConfig").doc(siteId).get();
  if (snap.exists) return { ...DEFAULT_CONFIG, ...snap.data() };
  return { siteId, ...DEFAULT_CONFIG };
}

/**
 * Computes and upserts a single machine/day MOE snapshot. Exported so both
 * the schedule and the hourly recalc-queue processor can call it directly.
 */
async function calculateAndUpsertSnapshot(machine, dayStart, dayEnd) {
  const siteId = machine.siteId;
  const config = await fetchMoeConfig(siteId);
  const now = new Date();

  const [breakdownSnap, pmSnap] = await Promise.all([
    db
      .collection("breakdown_tickets")
      .where("siteId", "==", siteId)
      .where("machineId", "==", machine.id)
      .get(),
    db
      .collection("pm_history")
      .where("companyId", "==", siteId)
      .where("machineId", "==", machine.id)
      .get(),
  ]);

  let breakdownCount = 0;
  let totalDowntimeMinutes = 0;
  breakdownSnap.docs.forEach((doc) => {
    const b = doc.data();
    const reportedAt = b.reportedAt && b.reportedAt.toDate ? b.reportedAt.toDate() : null;
    if (!reportedAt || reportedAt < dayStart || reportedAt > dayEnd) return;
    breakdownCount += 1;
    const resolvedAt = b.resolvedAt && b.resolvedAt.toDate ? b.resolvedAt.toDate() : now;
    const start = Math.max(dayStart.getTime(), reportedAt.getTime());
    const end = Math.min(dayEnd.getTime(), resolvedAt.getTime());
    if (end > start) totalDowntimeMinutes += (end - start) / 60000;
  });

  let pmScheduledCount = 0;
  let pmCompletedOnTimeCount = 0;
  pmSnap.docs.forEach((doc) => {
    const p = doc.data();
    const due = p.dueDate && p.dueDate.toDate ? p.dueDate.toDate() : null;
    if (!due || due < dayStart || due > dayEnd) return;
    const status = getEffectivePmStatus(p, now);
    if (status === "in_progress") return;
    pmScheduledCount += 1;
    if (status === "completed_on_time") pmCompletedOnTimeCount += 1;
  });

  const periodMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60000;
  const availabilityScore = calculateAvailabilityScore(periodMinutes, totalDowntimeMinutes);
  const maintenanceComplianceScore = calculateMaintenanceComplianceScore(pmScheduledCount, pmCompletedOnTimeCount);
  const reliabilityScore = calculateReliabilityScore(breakdownCount, config.reliabilityPenaltyFactor);
  const healthScore = typeof machine.healthScore === "number" ? machine.healthScore : 100;
  const moeScore = calculateMoeScore(
      {availabilityScore, maintenanceComplianceScore, reliabilityScore, healthScore},
      config.weights,
  );

  const dateKey = dayStart.toISOString().slice(0, 10);
  const snapshotId = `${machine.id}_${dateKey}`;

  await db.collection("moeSnapshots").doc(snapshotId).set({
    siteId,
    machineId: machine.id,
    periodStart: Timestamp.fromDate(dayStart),
    periodEnd: Timestamp.fromDate(dayEnd),
    periodType: "daily",
    availabilityScore,
    maintenanceComplianceScore,
    reliabilityScore,
    healthScore,
    moeScore,
    breakdownCount,
    totalDowntimeMinutes: Math.round(totalDowntimeMinutes),
    pmScheduledCount,
    pmCompletedOnTimeCount,
    criticality: machine.criticality || 1,
    calculatedAt: Timestamp.now(),
  }, {merge: true});

  return snapshotId;
}

const calculateDailyMoeSnapshots = onSchedule(
    {schedule: "30 0 * * *", timeZone: "UTC"},
    async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dayStart = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()));
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

      const machinesSnap = await db.collection("machines").where("status", "!=", "decommissioned").get();
      let count = 0;
      for (const doc of machinesSnap.docs) {
        const machine = {id: doc.id, ...doc.data()};
        if (!machine.siteId) continue;
        try {
          await calculateAndUpsertSnapshot(machine, dayStart, dayEnd);
          count += 1;
        } catch (err) {
          logger.error(`calculateDailyMoeSnapshots failed for machine ${machine.id}`, err);
        }
      }
      logger.info(`calculateDailyMoeSnapshots: wrote ${count} snapshots for ${dayStart.toISOString().slice(0, 10)}`);
    },
);

module.exports = {calculateDailyMoeSnapshots, calculateAndUpsertSnapshot, getEffectivePmStatus};
