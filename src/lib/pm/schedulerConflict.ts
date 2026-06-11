import type { ShiftConfig } from '../../types/handover.types';

// ---------------------------------------------------------------------------
// Scheduler conflict detection (PM Calendar technician assignment)
// ---------------------------------------------------------------------------

export const DEFAULT_SHIFT_CAPACITY_HOURS = 8;

/** A unit of schedulable work that can be assigned to a technician. */
export interface SchedulableJob {
  id: string;
  source: 'pm_schedule' | 'work_order';
  title: string;
  machineName: string;
  date: Date;
  estimatedHours: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTechnicianIds: string[];
  assignedTechnicianNames: string[];
}

/** Convert an estimated duration + unit into hours (1 day = one shift). */
export function durationToHours(
  value: number,
  unit: 'hours' | 'days',
  shiftHours = DEFAULT_SHIFT_CAPACITY_HOURS,
): number {
  if (!value || value <= 0) return 0;
  return unit === 'days' ? value * shiftHours : value;
}

/** Parse an "HH:MM" time string into fractional hours from midnight. */
function parseTimeToHours(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h + min / 60;
}

/** Duration of a single shift in hours, handling overnight shifts. */
export function shiftDurationHours(shift: Pick<ShiftConfig, 'startTime' | 'endTime'>): number | null {
  const start = parseTimeToHours(shift.startTime);
  const end = parseTimeToHours(shift.endTime);
  if (start === null || end === null) return null;
  let dur = end - start;
  if (dur <= 0) dur += 24; // overnight shift
  return dur;
}

/**
 * Per-technician daily capacity in hours. Uses the longest active shift the
 * company has configured, falling back to an 8-hour day.
 */
export function shiftCapacityHours(shifts: ShiftConfig[] | undefined): number {
  if (!shifts || shifts.length === 0) return DEFAULT_SHIFT_CAPACITY_HOURS;
  let max = 0;
  for (const s of shifts) {
    if (s.status && s.status !== 'active') continue;
    const dur = shiftDurationHours(s);
    if (dur && dur > max) max = dur;
  }
  return max > 0 ? max : DEFAULT_SHIFT_CAPACITY_HOURS;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface ConflictResult {
  technicianId: string;
  date: Date;
  capacityHours: number;
  /** Hours already booked that day (excluding the job being assigned). */
  existingHours: number;
  /** Hours of the job being assigned. */
  addedHours: number;
  totalHours: number;
  /** True when total booked hours exceed shift capacity. */
  isDoubleBooked: boolean;
  /** The other jobs the technician already has that day. */
  conflictingJobs: SchedulableJob[];
}

/**
 * Detects whether assigning `addedHours` of work to a technician on a given day
 * would exceed their shift capacity, given their already-booked jobs.
 *
 * `existingJobs` should be the technician's jobs for that day; the job being
 * assigned (if already present) is excluded by `excludeJobId`.
 */
export function detectConflict(params: {
  technicianId: string;
  date: Date;
  addedHours: number;
  existingJobs: SchedulableJob[];
  capacityHours: number;
  excludeJobId?: string;
}): ConflictResult {
  const { technicianId, date, addedHours, existingJobs, capacityHours, excludeJobId } = params;

  const sameDayJobs = existingJobs.filter(
    (j) =>
      j.id !== excludeJobId &&
      isSameDay(j.date, date) &&
      j.assignedTechnicianIds.includes(technicianId),
  );

  const existingHours = sameDayJobs.reduce((sum, j) => sum + j.estimatedHours, 0);
  const totalHours = existingHours + addedHours;

  return {
    technicianId,
    date,
    capacityHours,
    existingHours,
    addedHours,
    totalHours,
    isDoubleBooked: totalHours > capacityHours,
    conflictingJobs: sameDayJobs,
  };
}
