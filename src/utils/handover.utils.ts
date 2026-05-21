import type { ShiftConfig, ShiftDay } from '@/types/handover.types';

const DAY_LABELS: ShiftDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

export function calculateOverlapMinutes(submittedAt: Date, acceptedAt: Date | null): number | null {
  if (!acceptedAt) return null;
  return Math.max(0, Math.round((acceptedAt.getTime() - submittedAt.getTime()) / 60000));
}

export function getShiftDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
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

export function severityClass(severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized.includes('critical')) return 'text-red-700';
  if (normalized.includes('high')) return 'text-amber-700';
  return 'text-slate-700';
}

export function defaultShiftConfigs(companyId: string): Omit<ShiftConfig, 'id'>[] {
  const activeDays: ShiftDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return [
    { companyId, shiftName: 'Morning Shift', startTime: '06:00', endTime: '14:00', color: '#00C2FF', activeDays, department: null, status: 'active' },
    { companyId, shiftName: 'Afternoon Shift', startTime: '14:00', endTime: '22:00', color: '#F59E0B', activeDays, department: null, status: 'active' },
    { companyId, shiftName: 'Night Shift', startTime: '22:00', endTime: '06:00', color: '#0A1628', activeDays, department: null, status: 'active' },
  ];
}
