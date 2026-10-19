/**
 * Shared definitions for maintenance KPIs, so every dashboard, chart and
 * report computes them the same way. Pure and Firebase-free (unit-tested in
 * src/lib/__tests__/maintenanceMetrics.test.ts).
 */

type Row = Record<string, any>;

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DONE_WO = new Set(['COMPLETED', 'SIGNED_OFF', 'CLOSED']);

export const isDoneWo = (wo: Row) => DONE_WO.has(String(wo.status ?? ''));
export const isCancelledBreakdown = (b: Row) => String(b.status ?? '') === 'cancelled';

/** Parts cost of a work order — inventory parts consumed (priced server-side when missing). */
export function woPartsCost(wo: Row): number {
  return Array.isArray(wo.partsUsed)
    ? wo.partsUsed.reduce((s: number, p: Row) => s + (Number(p.totalCost) || 0), 0)
    : 0;
}

/**
 * Labour cost of a work order: logged hours × each person's labour rate,
 * stamped by the costWorkOrder Cloud Function (totalLaborCost). 0 when no
 * rate is set — a floor, never a guess.
 */
export function woLaborCost(wo: Row): number {
  if (wo.totalLaborCost != null && Number.isFinite(Number(wo.totalLaborCost))) return Number(wo.totalLaborCost);
  return Array.isArray(wo.technicianWorkLogs)
    ? wo.technicianWorkLogs.reduce((s: number, l: Row) => s + (Number(l.laborCost) || 0), 0)
    : 0;
}

export const woCost = (wo: Row) => woPartsCost(wo) + woLaborCost(wo);

/** When a work order's cost / completion counts: when the work ended. */
export const woDoneAt = (wo: Row): Date | null => asDate(wo.actualEndTime) ?? asDate(wo.closedAt);

/**
 * SLA outcome of one work order:
 *  - 'met'       done on or before its SLA deadline;
 *  - 'breached'  done after it, or still open past it (or flagged breached);
 *  - 'pending'   still open, deadline not reached yet;
 *  - null        no deadline, or cancelled — not evaluated.
 */
export function woSlaOutcome(wo: Row, now: Date = new Date()): 'met' | 'breached' | 'pending' | null {
  if (String(wo.status ?? '') === 'CANCELLED') return null;
  const deadline = asDate(wo.slaDeadline);
  if (!deadline) return null;
  if (isDoneWo(wo)) {
    const done = woDoneAt(wo);
    if (wo.slaBreached === true) return 'breached';
    if (!done) return 'met';
    return done.getTime() <= deadline.getTime() ? 'met' : 'breached';
  }
  if (wo.slaBreached === true || now.getTime() > deadline.getTime()) return 'breached';
  return 'pending';
}

/**
 * SLA compliance (%) of the work orders whose deadline falls in the period:
 * met / (met + breached). Open ones still inside their deadline aren't
 * counted yet. null when nothing was due — shown as "—", not as 0 % or 100 %.
 */
export function slaCompliance(workOrders: Row[], inPeriod: (d: Date) => boolean, now: Date = new Date()): {
  rate: number | null; met: number; breached: number;
} {
  let met = 0;
  let breached = 0;
  workOrders.forEach((wo) => {
    const deadline = asDate(wo.slaDeadline);
    if (!deadline || !inPeriod(deadline)) return;
    const outcome = woSlaOutcome(wo, now);
    if (outcome === 'met') met += 1;
    else if (outcome === 'breached') breached += 1;
  });
  const total = met + breached;
  return { rate: total ? (met / total) * 100 : null, met, breached };
}

/** Contractor jobs that cost money: everything except cancelled ones. */
export const isCountableContractorJob = (c: Row) => String(c.status ?? '') !== 'cancelled';

const sumBy = (list: unknown, key: string) =>
  Array.isArray(list) ? list.reduce((s: number, x: Row) => s + (Number(x?.[key]) || 0), 0) : 0;

/** Parts logged directly on a contractor job (not on its work order). */
export const contractorJobOwnPartsCost = (c: Row) =>
  sumBy(c.partsFromFactory, 'totalCost') + sumBy(c.partsFromContractor, 'estimatedCost');

/**
 * What a contractor job adds to maintenance cost on top of its work order.
 * The sign-off total (totalProjectCost, mirrored into systemInvoiceAmount) is
 * the work order's parts + parts logged on the job + the contractor's project
 * cost — and the work order's parts are already counted in the work order's
 * own cost, so adding the whole total counted them twice. This is the
 * contractor's project cost + the job's own parts; before sign-off, the
 * contractor's invoice.
 */
export function contractorJobCost(c: Row): number {
  const ownParts = contractorJobOwnPartsCost(c);
  if (c.projectCost != null && Number.isFinite(Number(c.projectCost))) return Number(c.projectCost) + ownParts;
  const total = c.totalProjectCost ?? c.systemInvoiceAmount;
  if (total != null && Number.isFinite(Number(total))) {
    // totalPartsCost = the work order's parts + the job's own, at sign-off.
    return Math.max(0, Number(total) - (Number(c.totalPartsCost) || 0)) + ownParts;
  }
  return Number(c.contractorInvoiceAmount ?? 0) || 0;
}

/**
 * When a contractor job's cost counts: when the work was completed / signed
 * off (the same rule as work orders), falling back to creation for older jobs.
 */
export const contractorJobCostDate = (c: Row): Date | null =>
  asDate(c.workCompletedAt) ?? asDate(c.signedOffAt) ?? asDate(c.departedAt) ?? asDate(c.createdAt);

/** Hours of the given months that have already elapsed (the current month counts up to now). */
export function elapsedHoursInMonths(months: string[], now: Date = new Date()): number {
  return months.reduce((sum, mk) => {
    const y = Number(mk.slice(0, 4));
    const m = Number(mk.slice(5, 7)) - 1;
    const start = new Date(y, m, 1).getTime();
    const end = Math.min(new Date(y, m + 1, 1).getTime(), now.getTime());
    return sum + Math.max(0, end - start) / 3_600_000;
  }, 0);
}

/**
 * MTBF (days) — mean operating time between failures: for each machine that
 * failed in the window, (window time − its downtime) / its failures, averaged
 * over those machines. Cancelled tickets aren't failures.
 */
export function mtbfDays(
  failuresByMachine: Map<string, number>,
  downtimeHoursByMachine: Map<string, number>,
  windowHours: number,
): number {
  const values: number[] = [];
  failuresByMachine.forEach((failures, machineId) => {
    if (failures <= 0) return;
    const uptime = Math.max(0, windowHours - (downtimeHoursByMachine.get(machineId) ?? 0));
    values.push(uptime / failures / 24);
  });
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
