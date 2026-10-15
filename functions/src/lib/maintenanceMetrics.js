/**
 * Shared maintenance KPI definitions — a port of
 * src/lib/analytics/maintenanceMetrics.ts so server aggregates (monthly
 * analytics, machine health snapshots) count exactly what the dashboards
 * count. Keep both in sync (src/lib/__tests__/monthlyAnalyticsParity.test.ts).
 */

const {toDateValue: asDate} = require("./machineDowntime");

const DONE_WO = new Set(["COMPLETED", "SIGNED_OFF", "CLOSED"]);

const isDoneWo = (wo) => DONE_WO.has(String(wo.status ?? ""));
const isCancelledBreakdown = (b) => String(b.status ?? "") === "cancelled";

const woPartsCost = (wo) => Array.isArray(wo.partsUsed) ?
  wo.partsUsed.reduce((s, p) => s + (Number(p.totalCost) || 0), 0) : 0;

const woLaborCost = (wo) => {
  if (wo.totalLaborCost != null && Number.isFinite(Number(wo.totalLaborCost))) return Number(wo.totalLaborCost);
  return Array.isArray(wo.technicianWorkLogs) ?
    wo.technicianWorkLogs.reduce((s, l) => s + (Number(l.laborCost) || 0), 0) : 0;
};

const woCost = (wo) => woPartsCost(wo) + woLaborCost(wo);

const woDoneAt = (wo) => asDate(wo.actualEndTime) || asDate(wo.closedAt);

/**
 * @param {object} wo work order
 * @param {Date} now evaluation time
 * @return {"met"|"breached"|"pending"|null} SLA outcome
 */
function woSlaOutcome(wo, now = new Date()) {
  if (String(wo.status ?? "") === "CANCELLED") return null;
  const deadline = asDate(wo.slaDeadline);
  if (!deadline) return null;
  if (isDoneWo(wo)) {
    const done = woDoneAt(wo);
    if (wo.slaBreached === true) return "breached";
    if (!done) return "met";
    return done.getTime() <= deadline.getTime() ? "met" : "breached";
  }
  if (wo.slaBreached === true || now.getTime() > deadline.getTime()) return "breached";
  return "pending";
}

/**
 * @param {object[]} workOrders work orders
 * @param {function(Date): boolean} inPeriod deadline filter
 * @param {Date} now evaluation time
 * @return {{rate: number|null, met: number, breached: number}} SLA compliance
 */
function slaCompliance(workOrders, inPeriod, now = new Date()) {
  let met = 0;
  let breached = 0;
  workOrders.forEach((wo) => {
    const deadline = asDate(wo.slaDeadline);
    if (!deadline || !inPeriod(deadline)) return;
    const outcome = woSlaOutcome(wo, now);
    if (outcome === "met") met += 1;
    else if (outcome === "breached") breached += 1;
  });
  const total = met + breached;
  return {rate: total ? (met / total) * 100 : null, met, breached};
}

const isCountableContractorJob = (c) => String(c.status ?? "") !== "cancelled";

const sumBy = (list, key) => Array.isArray(list) ?
  list.reduce((s, x) => s + (Number(x && x[key]) || 0), 0) : 0;

const contractorJobOwnPartsCost = (c) => sumBy(c.partsFromFactory, "totalCost") + sumBy(c.partsFromContractor, "estimatedCost");

/**
 * What a contractor job adds on top of its work order's own cost (the
 * sign-off total repeats the work order's parts).
 * @param {object} c contractor job
 * @return {number} cost
 */
function contractorJobCost(c) {
  const ownParts = contractorJobOwnPartsCost(c);
  if (c.projectCost != null && Number.isFinite(Number(c.projectCost))) return Number(c.projectCost) + ownParts;
  const total = c.totalProjectCost ?? c.systemInvoiceAmount;
  if (total != null && Number.isFinite(Number(total))) {
    return Math.max(0, Number(total) - (Number(c.totalPartsCost) || 0)) + ownParts;
  }
  return Number(c.contractorInvoiceAmount ?? 0) || 0;
}

const contractorJobCostDate = (c) =>
  asDate(c.workCompletedAt) || asDate(c.signedOffAt) || asDate(c.departedAt) || asDate(c.createdAt);

/**
 * @param {Map<string, number>} failuresByMachine failures per machine
 * @param {Map<string, number>} downtimeHoursByMachine downtime hours per machine
 * @param {number} windowHours elapsed window
 * @return {number} MTBF in days
 */
function mtbfDays(failuresByMachine, downtimeHoursByMachine, windowHours) {
  const values = [];
  failuresByMachine.forEach((failures, machineId) => {
    if (failures <= 0) return;
    const uptime = Math.max(0, windowHours - (downtimeHoursByMachine.get(machineId) || 0));
    values.push(uptime / failures / 24);
  });
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * PM occurrence status with overdue derived (port of getEffectivePMHistoryStatus).
 * @param {object} record pm_history record
 * @param {Date} now evaluation time
 * @return {string} effective status
 */
function effectivePmStatus(record, now = new Date()) {
  const status = record.status || "";
  if (["completed_on_time", "completed_late", "missed", "overdue"].includes(status)) return status;
  const due = asDate(record.dueDate);
  if (due && !asDate(record.completedDate) && due.getTime() < now.getTime()) return "overdue";
  return status || "in_progress";
}

/**
 * Machine Downtime Cost rate (port of computeEffectiveCostPerHour).
 * @param {object} m machine
 * @return {number|null} rate per hour
 */
function machineCostPerHour(m) {
  const costPerHourDown = m.costPerHourDown ?? null;
  const unitsPerHour = m.unitsPerHour ?? null;
  const unitValue = m.unitValue ?? null;
  if (costPerHourDown !== null) return costPerHourDown;
  if (unitsPerHour !== null && unitValue !== null) return unitsPerHour * unitValue;
  return null;
}

/** @return {number} recorded downtime estimate for old tickets */
const breakdownDowntimeHours = (b) => {
  const mins = Number(b.estimatedDowntimeMinutes ?? (b.oeeImpact && b.oeeImpact.downtimeMinutes) ?? 0);
  if (mins > 0) return mins / 60;
  return Number(b.productionHoursLost ?? 0);
};

module.exports = {
  asDate,
  isDoneWo,
  isCancelledBreakdown,
  woPartsCost,
  woLaborCost,
  woCost,
  woDoneAt,
  woSlaOutcome,
  slaCompliance,
  isCountableContractorJob,
  contractorJobOwnPartsCost,
  contractorJobCost,
  contractorJobCostDate,
  mtbfDays,
  effectivePmStatus,
  machineCostPerHour,
  breakdownDowntimeHours,
};
