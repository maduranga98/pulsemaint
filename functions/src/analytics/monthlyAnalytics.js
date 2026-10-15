/**
 * One company's analytics for one month — a port of buildMonthlyAnalytics in
 * src/services/analyticsAggregation.ts (the dashboards' figures), bucketed by
 * the company's own calendar (companies/{id}.timezone). Kept in sync by
 * src/lib/__tests__/monthlyAnalyticsParity.test.ts.
 */

const {computeDowntimeEvents} = require("../lib/machineDowntime");
const {localDateKey, localDayWindow} = require("../lib/zonedTime");
const {
  asDate,
  isCancelledBreakdown,
  woCost,
  woPartsCost,
  woDoneAt,
  woSlaOutcome,
  slaCompliance,
  isCountableContractorJob,
  contractorJobCost,
  contractorJobCostDate,
  mtbfDays,
  effectivePmStatus,
  machineCostPerHour,
  breakdownDowntimeHours,
} = require("../lib/maintenanceMetrics");

const SEVERITY_RANK = {critical: 4, high: 3, medium: 2, low: 1};
const SEVERITY_BY_RANK = ["low", "low", "medium", "high", "critical"];
const severityFromRank = (rank) => SEVERITY_BY_RANK[Math.max(0, Math.min(4, rank))];
const isCompletedWoStatus = (status) => ["COMPLETED", "SIGNED_OFF", "CLOSED"].includes(String(status ?? ""));
const avg = (arr) => (arr.length ? arr.reduce((a, c) => a + c, 0) / arr.length : 0);

/**
 * Hours of a local month that have elapsed by `now`.
 * @param {string} month YYYY-MM
 * @param {string} timeZone IANA zone
 * @param {Date} now evaluation time
 * @return {number} hours
 */
function elapsedHoursInMonth(month, timeZone, now) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const start = localDayWindow(`${month}-01`, timeZone).start.getTime();
  const end = Math.min(localDayWindow(next, timeZone).start.getTime(), now.getTime());
  return Math.max(0, end - start) / 3600000;
}

/**
 * @param {string} companyId company id
 * @param {string} month YYYY-MM
 * @param {{breakdowns: object[], workOrders: object[], contractorJobs: object[],
 *   pmHistory: object[], machines: object[]}} raw the company's records
 * @param {{timeZone?: string, now?: Date}} options calendar and clock
 * @return {object} AnalyticsMonthly fields (without updatedAt)
 */
function buildMonthlyAnalytics(companyId, month, raw, {timeZone = "UTC", now = new Date()} = {}) {
  const {breakdowns, workOrders, contractorJobs, pmHistory, machines} = raw;
  const monthOf = (d) => (d ? localDateKey(d, timeZone).slice(0, 7) : null);
  const inMonth = (value) => monthOf(asDate(value)) === month;

  const monthBreakdowns = breakdowns.filter((b) => !isCancelledBreakdown(b) && inMonth(b.reportedAt ?? b.createdAt));
  const monthWOs = workOrders.filter((w) => String(w.status ?? "") !== "CANCELLED" && inMonth(woDoneAt(w) || w.createdAt));
  const monthContractor = contractorJobs.filter((c) => isCountableContractorJob(c) && inMonth(contractorJobCostDate(c)));
  const monthPm = pmHistory.filter((p) => inMonth(p.dueDate ?? p.completedDate));

  const woCostTotal = monthWOs.reduce((s, w) => s + woCost(w), 0);
  const contractorCostTotal = monthContractor.reduce((s, c) => s + contractorJobCost(c), 0);
  const totalMaintenanceCost = woCostTotal + contractorCostTotal;

  const sla = slaCompliance(workOrders, (d) => monthOf(d) === month, now);
  const overallSlaCompliance = sla.rate ?? 100;

  const monthDowntime = computeDowntimeEvents(breakdowns, workOrders, now, breakdownDowntimeHours)
      .filter((e) => inMonth(e.anchor));
  const totalProductionHoursLost = monthDowntime.reduce((s, e) => s + e.hours, 0);
  const mttrValues = monthDowntime.filter((e) => e.kind === "breakdown" && !e.ongoing).map((e) => e.hours);
  const avgMttrHours = avg(mttrValues);

  const rates = new Map();
  machines.forEach((m) => {
    const rate = machineCostPerHour(m);
    if (rate !== null) rates.set(String(m.id), rate);
  });
  const downtimeHoursForCost = new Map();
  monthDowntime.forEach((e) => {
    if (!e.machineId || e.hours <= 0) return;
    const id = String(e.machineId);
    downtimeHoursForCost.set(id, (downtimeHoursForCost.get(id) || 0) + e.hours);
  });
  let totalDowntimeCost = 0;
  downtimeHoursForCost.forEach((hours, id) => {
    const rate = rates.get(id);
    if (rate !== undefined) totalDowntimeCost += hours * rate;
  });

  const pmEff = monthPm.map((p) => effectivePmStatus(p, now));
  const pmRelevant = pmEff.filter((s) => s && s !== "in_progress");
  const pmOnTime = pmEff.filter((s) => s === "completed_on_time").length;
  const pmMissed = pmEff.filter((s) => s === "missed" || s === "overdue").length;
  const pmComplianceRate = pmRelevant.length ? (pmOnTime / pmRelevant.length) * 100 : 100;

  const breakdownByType = {};
  const breakdownBySeverity = {};
  const breakdownByDepartment = {};
  monthBreakdowns.forEach((b) => {
    const t = String(b.type ?? "other");
    const s = String(b.severity ?? "low");
    const dept = String(b.machineDepartment ?? b.department ?? "Unassigned").trim() || "Unassigned";
    breakdownByType[t] = (breakdownByType[t] || 0) + 1;
    breakdownBySeverity[s] = (breakdownBySeverity[s] || 0) + 1;
    breakdownByDepartment[dept] = (breakdownByDepartment[dept] || 0) + 1;
  });

  const machineAgg = new Map();
  const ensureMachine = (id, name, criticality) => {
    let m = machineAgg.get(id);
    if (!m) {
      m = {machineId: id, machineName: name, breakdownCount: 0, woCount: 0, downtimeHours: 0, cost: 0,
        criticality, severity: "low", sevRank: 0};
      machineAgg.set(id, m);
    }
    return m;
  };
  monthBreakdowns.forEach((b) => {
    const id = String(b.machineId ?? b.machineName ?? "unknown");
    const m = ensureMachine(id, String(b.machineName ?? id), Number(b.machineCriticality ?? 3));
    m.breakdownCount += 1;
    m.sevRank = Math.max(m.sevRank, SEVERITY_RANK[String(b.severity ?? "low")] ?? 1);
  });
  monthWOs.forEach((w) => {
    const id = String(w.machineId ?? w.machineName ?? "");
    if (!id) return;
    const m = ensureMachine(id, String(w.machineName ?? id), Number(w.machineCriticality ?? 3));
    m.woCount += 1;
    m.cost += woPartsCost(w);
    m.sevRank = Math.max(m.sevRank, SEVERITY_RANK[String(w.priority ?? "low")] ?? 1);
  });
  monthDowntime.forEach((e) => {
    const id = String(e.machineId ?? e.machineName ?? "");
    if (!id) return;
    ensureMachine(id, e.machineName || id, e.machineCriticality).downtimeHours += e.hours;
  });
  monthContractor.forEach((c) => {
    const id = String(c.machineId ?? c.machineName ?? "");
    if (!id) return;
    const m = ensureMachine(id, String(c.machineName ?? id), Number(c.machineCriticality ?? 3));
    m.cost += contractorJobCost(c);
  });
  const topProblemMachines = Array.from(machineAgg.values())
      .sort((a, b) => b.woCount - a.woCount || b.breakdownCount - a.breakdownCount)
      .slice(0, 10)
      .map(({sevRank, ...m}) => ({
        ...m,
        downtimeHours: Number(m.downtimeHours.toFixed(1)),
        cost: Math.round(m.cost),
        severity: severityFromRank(sevRank),
      }));

  const windowHours = elapsedHoursInMonth(month, timeZone, now);
  const failures = new Map();
  const downtimeByMachine = new Map();
  machineAgg.forEach((m) => {
    if (m.breakdownCount > 0) failures.set(m.machineId, m.breakdownCount);
    downtimeByMachine.set(m.machineId, m.downtimeHours);
  });
  const avgMtbfDays = mtbfDays(failures, downtimeByMachine, windowHours);

  const techAgg = new Map();
  monthWOs.filter((w) => isCompletedWoStatus(w.status)).forEach((w) => {
    const ids = Array.isArray(w.assignedTechnicianIds) ? w.assignedTechnicianIds : [];
    const names = Array.isArray(w.assignedTechnicianNames) ? w.assignedTechnicianNames : [];
    const created = asDate(w.createdAt);
    const started = asDate(w.actualStartTime);
    const responseMins = created && started && started > created ? (started.getTime() - created.getTime()) / 60000 : null;
    ids.forEach((id, i) => {
      const rec = techAgg.get(id) || {techId: id, techName: names[i] ?? id, jobsCompleted: 0, repair: [], response: [], slaTotal: 0, slaOk: 0};
      rec.jobsCompleted += 1;
      if (w.totalDurationMinutes) rec.repair.push(Number(w.totalDurationMinutes) / 60);
      if (responseMins != null) rec.response.push(responseMins);
      const outcome = woSlaOutcome(w, now);
      if (outcome === "met" || outcome === "breached") {
        rec.slaTotal += 1;
        if (outcome === "met") rec.slaOk += 1;
      }
      techAgg.set(id, rec);
    });
  });
  const technicianPerformance = Array.from(techAgg.values()).map((r) => ({
    techId: r.techId,
    techName: r.techName,
    jobsCompleted: r.jobsCompleted,
    avgResponseMins: Number(avg(r.response).toFixed(1)),
    avgRepairHours: Number(avg(r.repair).toFixed(2)),
    slaCompliance: r.slaTotal ? Number(((r.slaOk / r.slaTotal) * 100).toFixed(1)) : 100,
  }));

  const conAgg = new Map();
  monthContractor.forEach((c) => {
    const id = String(c.contractorId ?? c.contractorName ?? "unknown");
    const rec = conAgg.get(id) || {contractorId: id, contractorName: String(c.contractorName ?? id), jobsCompleted: 0,
      mttr: [], rating: [], slaTotal: 0, slaOk: 0, firstFix: 0, firstFixTotal: 0};
    rec.jobsCompleted += 1;
    const dur = Number(c.actualWorkDurationMinutes ?? c.onSiteDurationMinutes ?? 0);
    if (dur > 0) rec.mttr.push(dur / 60);
    const rating = Number((c.rating && c.rating.overallScore) ?? 0);
    if (rating > 0) rec.rating.push(rating);
    const slaDeadline = asDate(c.slaDeadline);
    const completed = asDate(c.workCompletedAt ?? c.departedAt);
    if (slaDeadline && completed) {
      rec.slaTotal += 1;
      if (completed <= slaDeadline) rec.slaOk += 1;
    }
    if (typeof c.firstTimeFix === "boolean" || c.requiresReturnVisit != null || c.reopened != null) {
      rec.firstFixTotal += 1;
      if (c.firstTimeFix === true || (c.requiresReturnVisit !== true && c.reopened !== true)) rec.firstFix += 1;
    }
    conAgg.set(id, rec);
  });
  const contractorPerformance = Array.from(conAgg.values()).map((r) => ({
    contractorId: r.contractorId,
    contractorName: r.contractorName,
    jobsCompleted: r.jobsCompleted,
    avgMttr: Number(avg(r.mttr).toFixed(2)),
    firstFixRate: r.firstFixTotal ? Number(((r.firstFix / r.firstFixTotal) * 100).toFixed(1)) : 100,
    slaCompliance: r.slaTotal ? Number(((r.slaOk / r.slaTotal) * 100).toFixed(1)) : 100,
    avgRating: Number(avg(r.rating).toFixed(2)),
    ratingTrend: "stable",
  }));

  return {
    companyId,
    month,
    year: Number(month.slice(0, 4)),
    totalBreakdowns: monthBreakdowns.length,
    avgMttrHours: Number(avgMttrHours.toFixed(2)),
    avgMtbfDays: Number(avgMtbfDays.toFixed(1)),
    overallSlaCompliance: Number(overallSlaCompliance.toFixed(1)),
    totalMaintenanceCost: Math.round(totalMaintenanceCost),
    totalProductionHoursLost: Number(totalProductionHoursLost.toFixed(1)),
    totalDowntimeCost: Math.round(totalDowntimeCost),
    pmComplianceRate: Number(pmComplianceRate.toFixed(1)),
    slaMet: sla.met,
    slaBreached: sla.breached,
    pmCompletedOnTime: pmOnTime,
    pmMissed,
    topProblemMachines,
    technicianPerformance,
    contractorPerformance,
    breakdownByType,
    breakdownBySeverity,
    breakdownByDepartment,
  };
}

module.exports = {buildMonthlyAnalytics, elapsedHoursInMonth};
