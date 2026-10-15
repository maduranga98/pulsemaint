/**
 * calculateDailyMoeSnapshots
 * Scheduled daily. For every company, computes yesterday's (company-local
 * day) MOE sub-scores + composite MOE for each active machine and upserts an
 * idempotent snapshot doc `${machineId}_${YYYY-MM-DD}` into `moeSnapshots`.
 *
 * Downtime uses the app's single definition (lib/machineDowntime — reported
 * until the linked work order is signed off), clipped to the day, with
 * overlapping breakdowns on one machine counted once and cancelled tickets
 * ignored. A breakdown that runs over several days counts on every one of
 * them (it used to count only on the day it was reported).
 *
 * Reads are per company (a handful of queries), not per machine — the old
 * version read every machine's entire breakdown and PM history, one machine
 * at a time across all companies, which could not finish at scale.
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {
  DEFAULT_CONFIG,
  calculateAvailabilityScore,
  calculateReliabilityScore,
  calculateMaintenanceComplianceScore,
  calculateMoeScore,
} = require("./moeCalc");
const {computeDowntimeEvents, downtimeMinutesInWindow, toDateValue} = require("../lib/machineDowntime");
const {localDateKey, localDayWindow, safeZone} = require("../lib/zonedTime");

const db = getFirestore("default");

/** How far back a still-relevant breakdown may have been reported. */
const LOOKBACK_DAYS = 365;

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
  if (snap.exists) return {...DEFAULT_CONFIG, ...snap.data()};
  return {siteId, ...DEFAULT_CONFIG};
}

/**
 * Loads the work orders the tickets point at (linkedWOId), in chunks.
 * @param {string[]} ids work order ids
 * @return {Promise<object[]>} work orders with id
 */
async function fetchWorkOrders(ids) {
  const out = [];
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  for (let i = 0; i < unique.length; i += 100) {
    const refs = unique.slice(i, i + 100).map((id) => db.collection("workOrders").doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => s.exists && out.push({id: s.id, ...s.data()}));
  }
  return out;
}

/**
 * Computes and writes one company-local day's snapshots for a company.
 * @param {string} companyId company / site id
 * @param {string} dateKey local date YYYY-MM-DD
 * @param {{timeZone?: string, machineIds?: Set<string>|null}} [opts] options
 * @return {Promise<number>} snapshots written
 */
async function computeCompanyDay(companyId, dateKey, opts = {}) {
  const timeZone = safeZone(opts.timeZone);
  const {start: dayStart, end: dayEnd} = localDayWindow(dateKey, timeZone);
  const now = new Date();
  const config = await fetchMoeConfig(companyId);

  const machinesSnap = await db.collection("machines").where("siteId", "==", companyId).get();
  const machines = machinesSnap.docs
      .map((d) => ({id: d.id, ...d.data()}))
      .filter((m) => m.status !== "decommissioned")
      .filter((m) => !opts.machineIds || opts.machineIds.has(m.id));
  if (machines.length === 0) return 0;

  const lookback = new Date(dayStart.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const [ticketSnap, pmSnap] = await Promise.all([
    db.collection("breakdown_tickets")
        .where("siteId", "==", companyId)
        .where("reportedAt", ">=", Timestamp.fromDate(lookback))
        .where("reportedAt", "<=", Timestamp.fromDate(dayEnd))
        .get(),
    db.collection("pm_history")
        .where("companyId", "==", companyId)
        .where("dueDate", ">=", Timestamp.fromDate(dayStart))
        .where("dueDate", "<=", Timestamp.fromDate(dayEnd))
        .get(),
  ]);
  const tickets = ticketSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  const workOrders = await fetchWorkOrders(tickets.map((t) => t.linkedWOId));
  const events = computeDowntimeEvents(tickets, workOrders, now).filter((e) => e.kind === "breakdown");

  const eventsByMachine = new Map();
  events.forEach((e) => {
    if (!e.machineId) return;
    if (!eventsByMachine.has(e.machineId)) eventsByMachine.set(e.machineId, []);
    eventsByMachine.get(e.machineId).push(e);
  });
  const reportedToday = new Map();
  tickets.forEach((t) => {
    if (String(t.status) === "cancelled" || !t.machineId) return;
    const r = toDateValue(t.reportedAt);
    if (!r || r < dayStart || r > dayEnd) return;
    reportedToday.set(String(t.machineId), (reportedToday.get(String(t.machineId)) || 0) + 1);
  });
  const pmByMachine = new Map();
  pmSnap.docs.forEach((d) => {
    const p = d.data();
    if (!p.machineId) return;
    const status = getEffectivePmStatus(p, now);
    if (status === "in_progress") return;
    const cur = pmByMachine.get(String(p.machineId)) || {scheduled: 0, onTime: 0};
    cur.scheduled += 1;
    if (status === "completed_on_time") cur.onTime += 1;
    pmByMachine.set(String(p.machineId), cur);
  });

  const periodMinutes = (dayEnd.getTime() + 1 - dayStart.getTime()) / 60000;
  let written = 0;
  let batch = db.batch();
  let inBatch = 0;
  for (const machine of machines) {
    const totalDowntimeMinutes = downtimeMinutesInWindow(eventsByMachine.get(machine.id) || [], dayStart, dayEnd);
    const breakdownCount = reportedToday.get(machine.id) || 0;
    const pm = pmByMachine.get(machine.id) || {scheduled: 0, onTime: 0};
    const availabilityScore = calculateAvailabilityScore(periodMinutes, totalDowntimeMinutes);
    const maintenanceComplianceScore = calculateMaintenanceComplianceScore(pm.scheduled, pm.onTime);
    const reliabilityScore = calculateReliabilityScore(breakdownCount, config.reliabilityPenaltyFactor);
    const healthScore = typeof machine.healthScore === "number" ? machine.healthScore : 100;
    const moeScore = calculateMoeScore(
        {availabilityScore, maintenanceComplianceScore, reliabilityScore, healthScore},
        config.weights,
    );
    batch.set(db.collection("moeSnapshots").doc(`${machine.id}_${dateKey}`), {
      siteId: companyId,
      machineId: machine.id,
      machinePlantId: machine.plantId || null,
      periodStart: Timestamp.fromDate(dayStart),
      periodEnd: Timestamp.fromDate(dayEnd),
      periodType: "daily",
      dateKey,
      timeZone,
      availabilityScore,
      maintenanceComplianceScore,
      reliabilityScore,
      healthScore,
      moeScore,
      breakdownCount,
      totalDowntimeMinutes: Math.round(totalDowntimeMinutes),
      pmScheduledCount: pm.scheduled,
      pmCompletedOnTimeCount: pm.onTime,
      criticality: machine.criticality || 1,
      calculatedAt: Timestamp.now(),
    }, {merge: true});
    written += 1;
    inBatch += 1;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();
  return written;
}

const calculateDailyMoeSnapshots = onSchedule(
    {schedule: "30 0 * * *", timeZone: "UTC", timeoutSeconds: 540, memory: "1GiB"},
    async () => {
      const companies = await db.collection("companies").get();
      let total = 0;
      for (const company of companies.docs) {
        const timeZone = safeZone(company.data().timezone);
        // Yesterday in the company's own calendar — always a complete day.
        const yesterdayKey = localDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000), timeZone);
        try {
          total += await computeCompanyDay(company.id, yesterdayKey, {timeZone});
        } catch (err) {
          logger.error(`calculateDailyMoeSnapshots failed for company ${company.id}`, err);
        }
      }
      logger.info(`calculateDailyMoeSnapshots: wrote ${total} snapshots`);
    },
);

module.exports = {calculateDailyMoeSnapshots, computeCompanyDay, getEffectivePmStatus};
