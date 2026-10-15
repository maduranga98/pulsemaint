/**
 * Machine health score — computed here, never typed in by hand.
 *
 * The documented algorithm (MODULE_3_MACHINES_README, src/lib/machineHealth.ts):
 * start at 100; over the last 90 days deduct per breakdown by severity
 * (critical 20, high 12, medium 6, low 3 — one not assessed yet counts as
 * medium; cancelled ones don't count), 10 per overdue PM (still open past
 * due, or closed as missed), 5 while the machine is under maintenance; add 5
 * per PM done on time (max +20); clamp to 0–100.
 *
 * Until now nothing computed it: machines.healthScore was a slider on the
 * machine form, the machine_health collection held a different formula
 * (100 − 15 per open breakdown − 5 per open WO) and the dashboards a third.
 * This recomputes the one score whenever a breakdown, PM occurrence, work
 * order or the machine's status changes, and daily (the 90-day window moves
 * with time), and stores it on machines/{id}.healthScore plus a full
 * machine_health/{companyId}_{machineId} snapshot for reports.
 *
 * healthScore() is a port of machineHealthScoreFromRecords in
 * src/lib/machineHealth.ts — keep both in sync (machineHealthParity.test.ts).
 */

const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {computeDowntimeEvents, toDateValue} = require("../lib/machineDowntime");
const {woCost, breakdownDowntimeHours} = require("../lib/maintenanceMetrics");
const {safeZone, localDateKey} = require("../lib/zonedTime");

// Opened on first use, so the pure helpers below can be unit-tested.
let cachedDb = null;
const getDb = () => (cachedDb = cachedDb || getFirestore("default"));

const WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const BREAKDOWN_DEDUCTIONS = {critical: 20, high: 12, medium: 6, low: 3};
const OVERDUE_PM_DEDUCTION = 10;
const UNDER_MAINTENANCE_DEDUCTION = 5;
const ON_TIME_PM_ADDITION = 5;
const MAX_PM_ADDITIONS = 20;

const OPEN_BREAKDOWN_STATUSES = [
  "reported", "acknowledged", "triage_in_progress", "assigned", "en_route",
  "repair_in_progress", "on_hold_parts", "on_hold_approval",
];
const OPEN_WO_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD_PARTS", "ON_HOLD_APPROVAL"];
const DONE_WO_STATUSES = new Set(["COMPLETED", "SIGNED_OFF", "CLOSED"]);
const OPEN_PM_STATUSES = ["in_progress", "overdue"];

/**
 * @param {unknown} machineStatus machines/{id}.status
 * @param {object[]} breakdowns the machine's breakdown tickets
 * @param {object[]} pmHistory the machine's PM occurrences
 * @param {Date} now evaluation time
 * @return {number} health score 0–100
 */
function healthScore(machineStatus, breakdowns, pmHistory, now = new Date()) {
  const since = now.getTime() - WINDOW_DAYS * DAY_MS;
  const inWindow = (d) => !!d && d.getTime() >= since && d.getTime() <= now.getTime();
  let score = 100;

  breakdowns.forEach((b) => {
    if (String(b.status ?? "") === "cancelled") return;
    if (!inWindow(toDateValue(b.reportedAt ?? b.createdAt))) return;
    score -= BREAKDOWN_DEDUCTIONS[b.severity] ?? BREAKDOWN_DEDUCTIONS.medium;
  });

  let overdue = 0;
  let onTime = 0;
  pmHistory.forEach((p) => {
    const status = String(p.status ?? "");
    const due = toDateValue(p.dueDate);
    const completed = toDateValue(p.completedDate);
    if (status === "completed_on_time") {
      if (inWindow(completed || due)) onTime += 1;
      return;
    }
    if (status === "completed_late") return;
    if (status === "missed") {
      if (inWindow(due)) overdue += 1;
      return;
    }
    if (!completed && due && due.getTime() < now.getTime()) overdue += 1;
  });
  score -= overdue * OVERDUE_PM_DEDUCTION;
  if (machineStatus === "under_maintenance") score -= UNDER_MAINTENANCE_DEDUCTION;
  score += Math.min(onTime * ON_TIME_PM_ADDITION, MAX_PM_ADDITIONS);
  return Math.max(0, Math.min(100, score));
}

const currentStatusOf = (machineStatus, openBreakdowns) => {
  if (machineStatus === "decommissioned") return "decommissioned";
  if (openBreakdowns > 0) return "breakdown";
  if (machineStatus === "under_maintenance") return "maintenance";
  return "operational";
};

/**
 * The machine_health snapshot of one machine (MachineHealthDoc), with the
 * same definitions as the dashboards: MTTR = mean reported → sign-off time of
 * the window's restored breakdowns; MTBF = (window − downtime) / failures.
 * @param {object} input machine, records and clock
 * @return {object} snapshot fields
 */
function healthSnapshot({machineId, machine, breakdowns, openBreakdowns, workOrders, openWorkOrders, pmHistory, now, timeZone}) {
  const since = now.getTime() - WINDOW_DAYS * DAY_MS;
  const monthKey = localDateKey(now, timeZone).slice(0, 7);
  const inMonth = (d) => !!d && localDateKey(d, timeZone).slice(0, 7) === monthKey;
  const counted = breakdowns.filter((b) => String(b.status ?? "") !== "cancelled");

  const events = computeDowntimeEvents(counted, workOrders, now, breakdownDowntimeHours)
      .filter((e) => {
        const at = toDateValue(e.anchor);
        return at && at.getTime() >= since;
      });
  const restored = events.filter((e) => e.kind === "breakdown" && !e.ongoing).map((e) => e.hours);
  const mttrHours = restored.length ? restored.reduce((a, c) => a + c, 0) / restored.length : 0;
  const failures = counted.filter((b) => {
    const d = toDateValue(b.reportedAt ?? b.createdAt);
    return d && d.getTime() >= since;
  }).length;
  const downtime = events.reduce((s, e) => s + e.hours, 0);
  const mtbfDays = failures ? Math.max(0, WINDOW_DAYS * 24 - downtime) / failures / 24 : 0;

  let lastBreakdown = null;
  counted.forEach((b) => {
    const d = toDateValue(b.reportedAt ?? b.createdAt);
    if (d && (!lastBreakdown || d > lastBreakdown)) lastBreakdown = d;
  });
  const breakdownCountMTD = counted.filter((b) => inMonth(toDateValue(b.reportedAt ?? b.createdAt))).length;
  const maintenanceCostMTD = workOrders
      .filter((w) => DONE_WO_STATUSES.has(String(w.status ?? "")) && inMonth(toDateValue(w.actualEndTime) || toDateValue(w.closedAt)))
      .reduce((s, w) => s + woCost(w), 0);

  const openBreakdownCount = openBreakdowns.length;
  const watchFlagLevel = openBreakdownCount > 0 ? "critical_watch" : breakdownCountMTD >= 3 ? "monitor" : null;
  return {
    companyId: machine.siteId,
    machineId,
    machineIdCode: String(machineId).slice(0, 6).toUpperCase(),
    machineName: machine.name || machineId,
    department: typeof machine.department === "string" ? machine.department : "",
    location: [machine.floor, machine.bay, machine.station].filter((x) => x != null && x !== "").join(" · "),
    plantId: machine.plantId || null,
    currentStatus: currentStatusOf(machine.status, openBreakdownCount),
    healthScore: healthScore(machine.status, breakdowns, pmHistory, now),
    mtbfDays: Number(mtbfDays.toFixed(1)),
    mttrHours: Number(mttrHours.toFixed(2)),
    lastBreakdownDate: lastBreakdown ? Timestamp.fromDate(lastBreakdown) : null,
    lastServiceDate: machine.lastServiceDate || null,
    nextPmDue: machine.nextPmDue || null,
    openBreakdownCount,
    openWoCount: openWorkOrders.length,
    breakdownCountMTD,
    maintenanceCostMTD: Math.round(maintenanceCostMTD),
    watchFlag: watchFlagLevel !== null,
    watchFlagLevel,
  };
}

const zoneCache = new Map();
/** @return {Promise<string>} the company's IANA timezone (UTC when unset) */
async function companyZone(companyId) {
  if (!zoneCache.has(companyId)) {
    const snap = await getDb().collection("companies").doc(String(companyId)).get();
    zoneCache.set(companyId, safeZone(snap.exists ? snap.data().timezone : null));
  }
  return zoneCache.get(companyId);
}

const rows = (snap) => snap.docs.map((d) => ({id: d.id, ...d.data()}));

/**
 * Recomputes one machine's health score and snapshot from its records.
 * Writes only when something changed, so its own writes don't cascade.
 * @param {string} machineId machines/{id}
 * @param {Date} now evaluation time
 * @return {Promise<void>}
 */
async function recomputeMachineHealth(machineId, now = new Date()) {
  if (!machineId) return;
  const machineRef = getDb().collection("machines").doc(String(machineId));
  const machineSnap = await machineRef.get();
  if (!machineSnap.exists) return;
  const machine = machineSnap.data();
  const companyId = machine.siteId;
  if (!companyId) return;

  const since = Timestamp.fromMillis(now.getTime() - WINDOW_DAYS * DAY_MS);
  // Work orders from a little before the window, so a breakdown's linked work
  // order (raised after it) and work started inside the window are all found.
  const woSince = Timestamp.fromMillis(now.getTime() - (WINDOW_DAYS + 30) * DAY_MS);
  const [bdSnap, openBdSnap, woSnap, openWoSnap, pmSnap, openPmSnap, timeZone] = await Promise.all([
    getDb().collection("breakdown_tickets").where("machineId", "==", machineId).where("reportedAt", ">=", since).get(),
    getDb().collection("breakdown_tickets").where("machineId", "==", machineId).where("status", "in", OPEN_BREAKDOWN_STATUSES).get(),
    getDb().collection("workOrders").where("machineId", "==", machineId).where("createdAt", ">=", woSince).get(),
    getDb().collection("workOrders").where("machineId", "==", machineId).where("status", "in", OPEN_WO_STATUSES).get(),
    getDb().collection("pm_history").where("machineId", "==", machineId).where("dueDate", ">=", since).get(),
    getDb().collection("pm_history").where("machineId", "==", machineId).where("status", "in", OPEN_PM_STATUSES).get(),
    companyZone(companyId),
  ]);
  // Only the machine's own company's records.
  const own = (r) => (r.companyId || r.siteId) === companyId;
  const byId = (list) => [...new Map(list.map((r) => [r.id, r])).values()];
  const breakdowns = byId([...rows(bdSnap), ...rows(openBdSnap)]).filter(own);
  const workOrders = byId([...rows(woSnap), ...rows(openWoSnap)]).filter(own);
  const pmHistory = byId([...rows(pmSnap), ...rows(openPmSnap)]).filter(own);

  const snapshot = healthSnapshot({
    machineId,
    machine,
    breakdowns,
    openBreakdowns: rows(openBdSnap).filter(own),
    workOrders,
    openWorkOrders: rows(openWoSnap).filter(own),
    pmHistory,
    now,
    timeZone,
  });

  const healthRef = getDb().collection("machine_health").doc(`${companyId}_${machineId}`);
  const healthSnap = await healthRef.get();
  const prev = healthSnap.exists ? healthSnap.data() : null;
  const writes = [];
  if (machine.healthScore !== snapshot.healthScore || !machine.healthScoreUpdatedAt) {
    writes.push(machineRef.update({
      healthScore: snapshot.healthScore,
      healthScoreUpdatedAt: FieldValue.serverTimestamp(),
    }));
  }
  const changed = !prev || Object.keys(snapshot).some((k) => JSON.stringify(prev[k] ?? null) !== JSON.stringify(snapshot[k] ?? null));
  if (changed) writes.push(healthRef.set({...snapshot, updatedAt: FieldValue.serverTimestamp()}));
  await Promise.all(writes);
}

const machineIdsOf = (event) => {
  const before = event.data.before.exists ? event.data.before.data() : {};
  const after = event.data.after.exists ? event.data.after.data() : {};
  return {before, after, ids: [...new Set([before.machineId, after.machineId].filter(Boolean).map(String))]};
};
const changedAny = (before, after, keys) =>
  keys.some((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));

const recomputeAll = async (ids, label) => {
  for (const id of ids) {
    try {
      await recomputeMachineHealth(id);
    } catch (err) {
      logger.error(`${label}: health recompute failed`, {machineId: id, err});
    }
  }
};

// Name kept from the old breakdown trigger so the deploy updates it in place.
exports.updateMachineHealth = onDocumentWritten(
    {database: "default", document: "breakdown_tickets/{ticketId}"},
    async (event) => {
      const {before, after, ids} = machineIdsOf(event);
      if (!changedAny(before, after, ["status", "severity", "reportedAt", "machineId", "linkedWOId", "closedAt", "resolvedAt"])) return;
      await recomputeAll(ids, "updateMachineHealth");
    },
);

exports.machineHealthOnPmHistoryWrite = onDocumentWritten(
    {database: "default", document: "pm_history/{historyId}"},
    async (event) => {
      const {before, after, ids} = machineIdsOf(event);
      if (!changedAny(before, after, ["status", "dueDate", "completedDate", "machineId"])) return;
      await recomputeAll(ids, "machineHealthOnPmHistoryWrite");
    },
);

// Open work-order count, MTD cost and downtime (sign-off) feed the snapshot.
exports.machineHealthOnWorkOrderWrite = onDocumentWritten(
    {database: "default", document: "workOrders/{woId}"},
    async (event) => {
      const {before, after, ids} = machineIdsOf(event);
      if (!changedAny(before, after, ["status", "machineId", "supervisorSignOffAt", "totalPartsCost", "totalLaborCost"])) return;
      await recomputeAll(ids, "machineHealthOnWorkOrderWrite");
    },
);

// Fields of the machine the score / snapshot depend on.
const MACHINE_INPUT_KEYS = [
  "status", "healthScore", "siteId", "plantId", "name", "department", "floor", "bay", "station",
  "lastServiceDate", "nextPmDue",
];

// Under maintenance costs 5 points; a new machine gets its first score; a
// score written by anyone but this function is put back.
exports.machineHealthOnMachineWrite = onDocumentWritten(
    {database: "default", document: "machines/{machineId}"},
    async (event) => {
      if (!event.data.after.exists) return;
      const before = event.data.before.exists ? event.data.before.data() : null;
      const after = event.data.after.data();
      if (before) {
        // Our own write (it always stamps healthScoreUpdatedAt) — nothing to redo.
        const stamp = (d) => (d.healthScoreUpdatedAt ? d.healthScoreUpdatedAt.toMillis() : null);
        if (stamp(before) !== stamp(after)) return;
        if (!changedAny(before, after, MACHINE_INPUT_KEYS)) return;
      }
      await recomputeAll([event.params.machineId], "machineHealthOnMachineWrite");
    },
);

// The 90-day window moves daily: breakdowns age out, PMs fall due.
exports.recomputeMachineHealthDaily = onSchedule(
    {schedule: "30 2 * * *", timeZone: "UTC", timeoutSeconds: 540, memory: "512MiB"},
    async () => {
      const started = Date.now();
      const now = new Date();
      const snap = await getDb().collection("machines").select("status").get();
      const ids = snap.docs.filter((d) => d.data().status !== "decommissioned").map((d) => d.id);
      let done = 0;
      const CONCURRENCY = 10;
      for (let i = 0; i < ids.length; i += CONCURRENCY) {
        if (Date.now() - started > 480 * 1000) {
          logger.warn(`recomputeMachineHealthDaily: stopped after ${done}/${ids.length} machines (time limit)`);
          return;
        }
        await Promise.all(ids.slice(i, i + CONCURRENCY).map((id) =>
          recomputeMachineHealth(id, now).then(() => done++).catch((err) =>
            logger.error("recomputeMachineHealthDaily: machine failed", {machineId: id, err}))));
      }
      logger.info(`recomputeMachineHealthDaily: ${done}/${ids.length} machines`);
    },
);

exports.healthScore = healthScore;
exports.healthSnapshot = healthSnapshot;
exports.recomputeMachineHealth = recomputeMachineHealth;
