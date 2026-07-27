import type { ShiftConfig, ShiftDay } from '@/types/handover.types';

const DAY_LABELS: ShiftDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDuration(ms: number): string {
  // NaN/Infinity must never surface as "NaNh NaNm" in the UI.
  if (!Number.isFinite(ms)) return '0h 00m';
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '';
  return `${startTime} - ${endTime}`;
}

export function calculateOverlapMinutes(submittedAt: Date, acceptedAt: Date | null): number | null {
  if (!acceptedAt) return null;
  return Math.max(0, Math.round((acceptedAt.getTime() - submittedAt.getTime()) / 60000));
}

/**
 * Minutes the supervisor clocked in late against their assigned shift's
 * scheduled start time (HH:MM), 0 if on time or early. Used as the
 * handover's "Overlap (minutes)" — how much of the outgoing supervisor's
 * shift already ran without the incoming one having started theirs.
 */
export function calculateLateStartMinutes(scheduledStart: string | null | undefined, actualStart: Date): number {
  if (!scheduledStart) return 0;
  const [hours, minutes] = scheduledStart.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  const scheduled = new Date(actualStart);
  scheduled.setHours(hours, minutes, 0, 0);
  return Math.max(0, Math.round((actualStart.getTime() - scheduled.getTime()) / 60000));
}

export function getShiftDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(time: string): number {
  // Shift configs saved with a cleared/invalid time input used to propagate
  // NaN into every duration and "invalid time" display downstream.
  const [hours, minutes] = (time ?? '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function isTimeWithinShift(now: Date, shift: Pick<ShiftConfig, 'startTime' | 'endTime' | 'activeDays'>): boolean {
  const day = DAY_LABELS[now.getDay()];
  if (!shift.activeDays.includes(day)) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

export function detectCurrentShift(shifts: ShiftConfig[], now = new Date()): ShiftConfig | null {
  return shifts.find((shift) => shift.status === 'active' && isTimeWithinShift(now, shift)) ?? null;
}

export function detectNextShift(shifts: ShiftConfig[], current: ShiftConfig | null): ShiftConfig | null {
  if (!shifts.length) return null;
  if (!current) return shifts.find((shift) => shift.status === 'active') ?? null;
  const sorted = [...shifts].filter((shift) => shift.status === 'active').sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const index = sorted.findIndex((shift) => shift.id === current.id);
  return sorted[(index + 1) % sorted.length] ?? null;
}

/** Scheduled length of a shift in minutes; overnight shifts (end < start) wrap past midnight. */
export function scheduledShiftMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === 0 && end === 0) return 0;
  return end > start ? end - start : 24 * 60 - start + end;
}

/** Total worked minutes and overtime (time worked beyond the scheduled shift length). */
export function computeShiftTotals(
  shift: Pick<ShiftConfig, 'startTime' | 'endTime'>,
  actualStart: Date,
  actualEnd: Date,
): { scheduledMinutes: number; totalMinutes: number; otMinutes: number } {
  const scheduledMinutes = scheduledShiftMinutes(shift.startTime, shift.endTime);
  const totalMinutes = Math.max(0, Math.round((actualEnd.getTime() - actualStart.getTime()) / 60000));
  const otMinutes = Math.max(0, totalMinutes - scheduledMinutes);
  return { scheduledMinutes, totalMinutes, otMinutes };
}

/**
 * A user belongs to a shift plan if directly assigned (member list, or their
 * profile's individually-set shiftId), or — only when they have no explicit
 * shiftId of their own — their role is bulk-scheduled on the plan.
 *
 * Without the shiftId short-circuit, a user with an explicit individual
 * assignment could still match an unrelated plan that merely lists their
 * role (e.g. a second shift plan scheduling the same role at a different
 * time), and "My Shift" would show whichever of the two plans happened to
 * be in its active time window — not the shift the user is actually on.
 */
export function isUserAssignedToShift(
  shift: Pick<ShiftConfig, 'id' | 'memberIds' | 'roles' | 'department'>,
  user: { id: string; role: string; shiftId?: string | null; department?: string | null },
): boolean {
  if (shift.memberIds?.includes(user.id)) return true;
  if (user.shiftId) return user.shiftId === shift.id;
  if ((shift.roles ?? []).includes(user.role)) return true;
  // Settings → Users shows a user as "on" a department-wide shift plan once
  // they have no explicit shiftId/role assignment of their own (see
  // UserShiftChips) — apply the same fallback here so "My Shift" agrees with
  // what the admin roster displays instead of showing "not scheduled".
  return Boolean(shift.department) && shift.department === user.department;
}

/**
 * How specifically a shift plan was matched to a user, most specific first.
 * Used to rank a user's matching plans so the most-authoritative assignment
 * (explicit member/shiftId) always wins over a bulk role/department
 * fallback when more than one plan happens to be active at the same time.
 */
function matchSpecificity(
  shift: Pick<ShiftConfig, 'id' | 'memberIds' | 'roles' | 'department'>,
  user: { id: string; role: string; shiftId?: string | null; department?: string | null },
): number {
  if (shift.memberIds?.includes(user.id)) return 0;
  if (user.shiftId && user.shiftId === shift.id) return 1;
  if ((shift.roles ?? []).includes(user.role)) return 2;
  if (Boolean(shift.department) && shift.department === user.department) return 3;
  return 4;
}

/**
 * Shift plans the given user is scheduled on (by member assignment, role, or
 * department), most specific/authoritative match first — so callers that
 * pick "the" current plan (e.g. My Shift) land on the one the user was
 * actually assigned to rather than an incidental bulk role/department match.
 */
export function getMyShiftPlans(
  shifts: ShiftConfig[],
  user: { id: string; role: string; shiftId?: string | null; department?: string | null },
): ShiftConfig[] {
  return shifts
    .filter((shift) => shift.status === 'active' && isUserAssignedToShift(shift, user))
    .sort((a, b) => matchSpecificity(a, user) - matchSpecificity(b, user));
}

export function severityClass(severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized.includes('critical')) return 'text-red-700';
  if (normalized.includes('high')) return 'text-amber-700';
  return 'text-slate-700';
}

export function defaultShiftConfigs(companyId: string): Omit<ShiftConfig, 'id'>[] {
  const activeDays: ShiftDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return [
    { companyId, shiftName: 'Morning Shift', startTime: '06:00', endTime: '14:00', color: '#00C2FF', activeDays, department: null, status: 'active', memberIds: [], memberNames: [], roles: [] },
    { companyId, shiftName: 'Afternoon Shift', startTime: '14:00', endTime: '22:00', color: '#F59E0B', activeDays, department: null, status: 'active', memberIds: [], memberNames: [], roles: [] },
    { companyId, shiftName: 'Night Shift', startTime: '22:00', endTime: '06:00', color: '#0A1628', activeDays, department: null, status: 'active', memberIds: [], memberNames: [], roles: [] },
  ];
}
