/**
 * Machine downtime, measured as real elapsed time:
 *
 * - Breakdown: from the moment it was reported (the machine stopped) until the
 *   linked work order was signed off by the supervisor.
 * - Any other maintenance (PM, corrective, inspection …): from the work
 *   order's actual start until its sign-off.
 *
 * A breakdown whose machine was still running when reported only loses time
 * once repair work starts, so its window opens at the first linked work
 * order's start instead. Work orders raised for a breakdown are counted once,
 * through the breakdown, never again on their own.
 *
 * Pure and Firebase-free so it can be unit-tested and shared by the monthly,
 * per-plant and daily analytics.
 */

type Row = Record<string, any>;

export type DowntimeKind = 'breakdown' | 'maintenance';

export interface DowntimeEvent {
  kind: DowntimeKind;
  /** Breakdown or work-order document id. */
  sourceId: string;
  machineId: string | null;
  machineName: string;
  machineCriticality: number;
  /** When the machine went down. */
  start: Date;
  /** When it was signed off — or `now` while it is still down. */
  end: Date;
  /** True while the machine is still down (no sign-off yet). */
  ongoing: boolean;
  hours: number;
  /** The original record, for plant/department attribution. */
  row: Row;
  /** The date analytics buckets this event under (matches existing month rules). */
  anchor: unknown;
}

const OPEN_BREAKDOWN = (status: unknown) =>
  !['resolved', 'closed', 'cancelled'].includes(String(status ?? ''));

export function toDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ms = (d: Date | null) => (d ? d.getTime() : null);

const NOT_DONE_OUTCOMES = new Set(['failed', 'not_complete']);

/**
 * Did this sign-off put the machine back in service? Not when the work was
 * signed off as failed / not complete — the breakdown stays open for a new
 * work order and the machine stays down.
 */
export const signOffRestoresMachine = (wo: Row) => !NOT_DONE_OUTCOMES.has(String(wo.signOffOutcome ?? ''));

/** Sign-off moment of a work order: the supervisor's sign-off, else its close time. */
export function workOrderSignOff(wo: Row): Date | null {
  return toDateValue(wo.supervisorSignOffAt) ?? toDateValue(wo.closedAt);
}

function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
}

function linkedBreakdownIds(wo: Row): string[] {
  const ids = new Set<string>();
  if (wo.linkedBreakdownId) ids.add(String(wo.linkedBreakdownId));
  if (Array.isArray(wo.linkedBreakdownIds)) wo.linkedBreakdownIds.forEach((i: unknown) => i && ids.add(String(i)));
  return [...ids];
}

/**
 * @param legacyBreakdownHours recorded estimate used when a breakdown has no
 *   linked work order / sign-off to measure from (older tickets).
 */
export function computeDowntimeEvents(
  breakdowns: Row[],
  workOrders: Row[],
  now: Date = new Date(),
  legacyBreakdownHours: (b: Row) => number = () => 0,
): DowntimeEvent[] {
  const events: DowntimeEvent[] = [];

  // Work orders by breakdown they were raised for.
  const wosByBreakdown = new Map<string, Row[]>();
  const claimedWoIds = new Set<string>();
  const breakdownIds = new Set(breakdowns.map((b) => String(b.id)));
  workOrders.forEach((wo) => {
    const ids = linkedBreakdownIds(wo);
    ids.forEach((id) => {
      if (!wosByBreakdown.has(id)) wosByBreakdown.set(id, []);
      wosByBreakdown.get(id)!.push(wo);
    });
    if (ids.some((id) => breakdownIds.has(id))) claimedWoIds.add(String(wo.id));
  });
  // Tickets also point at their work order.
  const woById = new Map(workOrders.map((w) => [String(w.id), w]));
  breakdowns.forEach((b) => {
    const wo = b.linkedWOId ? woById.get(String(b.linkedWOId)) : undefined;
    if (!wo) return;
    const list = wosByBreakdown.get(String(b.id)) ?? [];
    if (!list.includes(wo)) list.push(wo);
    wosByBreakdown.set(String(b.id), list);
    claimedWoIds.add(String(wo.id));
  });

  breakdowns.forEach((b) => {
    if (String(b.status) === 'cancelled') return;
    const reported = toDateValue(b.reportedAt ?? b.createdAt);
    if (!reported) return;
    const linked = wosByBreakdown.get(String(b.id)) ?? [];
    const stopped = b.machineStillRunning !== true;

    let start: Date | null = reported;
    if (!stopped) {
      const starts = linked.map((w) => ms(toDateValue(w.actualStartTime))).filter((x): x is number => x !== null);
      start = starts.length ? new Date(Math.min(...starts)) : null;
    }

    const signOffs = linked.map((w) => ms(workOrderSignOff(w))).filter((x): x is number => x !== null);
    // Signed off = every linked WO is done; the machine is back at the last
    // sign-off — unless that one was failed / not complete.
    const allSignedOff = linked.length > 0 && linked.every((w) => workOrderSignOff(w));
    let end: Date | null = null;
    if (allSignedOff && signOffs.length) {
      const lastAt = Math.max(...signOffs);
      const last = linked.find((w) => ms(workOrderSignOff(w)) === lastAt)!;
      if (signOffRestoresMachine(last)) end = new Date(lastAt);
      // Older tickets a failed sign-off closed anyway: down until then.
      else if (!OPEN_BREAKDOWN(b.status)) end = toDateValue(b.closedAt) ?? toDateValue(b.resolvedAt) ?? new Date(lastAt);
    }
    if (!end && linked.length === 0) {
      end = toDateValue(b.closedAt) ?? toDateValue(b.resolvedAt);
    }

    let hours: number;
    let ongoing = false;
    if (start && end) {
      hours = hoursBetween(start, end);
    } else if (start && OPEN_BREAKDOWN(b.status) && (linked.length > 0 || stopped)) {
      // Still down: count elapsed time so far.
      end = now;
      ongoing = true;
      hours = hoursBetween(start, now);
    } else {
      // Old ticket with nothing to measure from — fall back to the recorded estimate.
      hours = legacyBreakdownHours(b);
      start = start ?? reported;
      end = new Date(start.getTime() + hours * 3_600_000);
    }

    events.push({
      kind: 'breakdown',
      sourceId: String(b.id),
      machineId: b.machineId != null ? String(b.machineId) : null,
      machineName: String(b.machineName ?? b.machineId ?? ''),
      machineCriticality: Number(b.machineCriticality ?? 3),
      start: start!,
      end: end!,
      ongoing,
      hours,
      row: b,
      anchor: b.reportedAt ?? b.createdAt,
    });
  });

  workOrders.forEach((wo) => {
    if (claimedWoIds.has(String(wo.id))) return;
    if (String(wo.status) === 'CANCELLED') return;
    const start = toDateValue(wo.actualStartTime);
    if (!start) return;
    const end = workOrderSignOff(wo);
    if (!end) return; // not signed off yet — counted once it is
    const hours = hoursBetween(start, end);
    events.push({
      kind: 'maintenance',
      sourceId: String(wo.id),
      machineId: wo.machineId != null ? String(wo.machineId) : null,
      machineName: String(wo.machineName ?? wo.machineId ?? ''),
      machineCriticality: Number(wo.machineCriticality ?? 3),
      start,
      end,
      ongoing: false,
      hours,
      row: wo,
      anchor: wo.actualEndTime ?? wo.createdAt,
    });
  });

  return events;
}

/** Total hours of a list of events. */
export function sumDowntimeHours(events: DowntimeEvent[]): number {
  return events.reduce((s, e) => s + e.hours, 0);
}
