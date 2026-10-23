/**
 * Time-slot based availability for assigning people to work orders and
 * breakdowns. One person may hold several jobs as long as their time slots
 * don't overlap; when the new job's slot overlaps one they already hold, they
 * are shown as "already assigned" with that work order / ticket.
 *
 * Pure (no Firebase imports) so it is unit-tested.
 */

export interface Slot {
  startMs: number;
  endMs: number;
}

export interface SlotJob {
  kind: 'work_order' | 'breakdown';
  id: string;
  /** WO number / ticket number, for display. */
  ref: string;
  machineName: string | null;
  slot: Slot;
  technicianIds: string[];
}

type TimeLike = { toMillis?: () => number; seconds?: number } | Date | number | null | undefined;

const MIN = 60_000;
/** A work order with no estimate is assumed to take this long. */
export const DEFAULT_JOB_MINUTES = 4 * 60;
/** Minimum time a breakdown call occupies the person who took it. */
export const BREAKDOWN_MINUTES = 2 * 60;
/** A started job that has overrun its estimate still occupies the person for a while. */
const OVERRUN_MINUTES = 30;

function ms(t: TimeLike): number | null {
  if (t === null || t === undefined) return null;
  if (typeof t === 'number') return Number.isFinite(t) ? t : null;
  if (t instanceof Date) return Number.isNaN(t.getTime()) ? null : t.getTime();
  if (typeof t.toMillis === 'function') return t.toMillis();
  return typeof t.seconds === 'number' ? t.seconds * 1000 : null;
}

export function durationMinutes(value: number | null | undefined, unit: string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_JOB_MINUTES;
  if (unit === 'days') return n * 24 * 60;
  if (unit === 'minutes') return n;
  return n * 60; // hours (the default unit)
}

/** The slot a NEW work order will occupy: its scheduled start (or "now") for its estimated duration. */
export function newWorkOrderSlot(
  scheduledStart: TimeLike,
  estimatedDuration: number | null | undefined,
  unit: string | null | undefined,
  nowMs: number,
): Slot {
  const startMs = ms(scheduledStart) ?? nowMs;
  return { startMs, endMs: startMs + durationMinutes(estimatedDuration, unit) * MIN };
}

/** The slot a NEW breakdown assignment occupies: starting now. */
export function newBreakdownSlot(nowMs: number): Slot {
  return { startMs: nowMs, endMs: nowMs + BREAKDOWN_MINUTES * MIN };
}

export function slotsOverlap(a: Slot, b: Slot): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

const WORKING = new Set(['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL']);
const OPEN_WO = new Set(['OPEN', 'ASSIGNED', ...WORKING]);

export interface SlotWorkOrder {
  id: string;
  woNumber?: string;
  status: string;
  machineName?: string | null;
  assignedTechnicianIds?: string[] | null;
  assigneeCompletions?: { technicianId: string }[] | null;
  scheduledStart?: TimeLike;
  actualStartTime?: TimeLike;
  estimatedDuration?: number | null;
  estimatedDurationUnit?: string | null;
}

/**
 * The slot an existing work order occupies, or null when it claims no time
 * (open and not scheduled — it can't clash with anything).
 */
export function workOrderJob(wo: SlotWorkOrder, nowMs: number): SlotJob | null {
  if (!OPEN_WO.has(wo.status)) return null;
  const working = WORKING.has(wo.status);
  const start = (working ? ms(wo.actualStartTime) : null) ?? ms(wo.scheduledStart) ?? (working ? nowMs : null);
  if (start === null) return null;
  let end = start + durationMinutes(wo.estimatedDuration, wo.estimatedDurationUnit) * MIN;
  if (working) end = Math.max(end, nowMs + OVERRUN_MINUTES * MIN);
  const done = new Set((wo.assigneeCompletions ?? []).map((c) => c.technicianId));
  return {
    kind: 'work_order',
    id: wo.id,
    ref: wo.woNumber || wo.id,
    machineName: wo.machineName ?? null,
    slot: { startMs: start, endMs: end },
    technicianIds: (wo.assignedTechnicianIds ?? []).filter((id) => !done.has(id)),
  };
}

export interface SlotBreakdown {
  id: string;
  ticketNumber?: string;
  status: string;
  machineName?: string | null;
  assignedTechnicianIds?: string[] | null;
  attendedBy?: string | null;
  attendedAt?: TimeLike;
  assignedAt?: TimeLike;
  reportedAt?: TimeLike;
  linkedWOId?: string | null;
}

const OPEN_BREAKDOWN = new Set([
  'acknowledged', 'triage_in_progress', 'assigned', 'en_route', 'repair_in_progress', 'on_hold_parts', 'on_hold_approval',
]);

/** The slot a breakdown occupies for the people on it, or null when nobody is on it / it is resolved. */
export function breakdownJob(b: SlotBreakdown, nowMs: number): SlotJob | null {
  if (!OPEN_BREAKDOWN.has(b.status)) return null;
  // Once a work order carries the repair it is that work order that holds the people.
  if (b.linkedWOId) return null;
  const ids = [...new Set([...(b.assignedTechnicianIds ?? []), ...(b.attendedBy ? [b.attendedBy] : [])])];
  if (ids.length === 0) return null;
  const start = ms(b.attendedAt) ?? ms(b.assignedAt) ?? ms(b.reportedAt) ?? nowMs;
  const end = Math.max(start + BREAKDOWN_MINUTES * MIN, nowMs + OVERRUN_MINUTES * MIN);
  return { kind: 'breakdown', id: b.id, ref: b.ticketNumber || b.id, machineName: b.machineName ?? null, slot: { startMs: start, endMs: end }, technicianIds: ids };
}

export interface Conflict {
  job: SlotJob;
}

/**
 * For each person, the first existing job whose slot overlaps `slot`.
 * People with no overlapping job are absent from the map (free to assign).
 * Jobs listed in `ignoreIds` (e.g. the breakdown this WO is being raised for) are skipped.
 */
export function findConflicts(slot: Slot, jobs: SlotJob[], ignoreIds: ReadonlySet<string> = new Set()): Map<string, Conflict> {
  const out = new Map<string, Conflict>();
  const sorted = [...jobs].sort((a, b) => a.slot.startMs - b.slot.startMs);
  for (const job of sorted) {
    if (ignoreIds.has(job.id) || !slotsOverlap(slot, job.slot)) continue;
    for (const id of job.technicianIds) if (!out.has(id)) out.set(id, { job });
  }
  return out;
}

const two = (n: number) => String(n).padStart(2, '0');
/** "23 Oct 10:00–12:30" (or with both dates when it spans days), in the viewer's local time. */
export function formatSlot(slot: Slot): string {
  const a = new Date(slot.startMs);
  const b = new Date(slot.endMs);
  const day = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;
  return a.toDateString() === b.toDateString()
    ? `${day(a)} ${time(a)}–${time(b)}`
    : `${day(a)} ${time(a)} – ${day(b)} ${time(b)}`;
}

/** Short text for the picker: "WO-0012 · 23 Oct 10:00–12:30". */
export function describeConflict(c: Conflict): string {
  return `${c.job.ref} · ${formatSlot(c.job.slot)}`;
}
