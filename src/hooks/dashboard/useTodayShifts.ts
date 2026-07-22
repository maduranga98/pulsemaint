import { useState, useEffect } from 'react';
import { subscribeShiftConfigs, subscribeActiveShiftSessions } from '../../services/handover.service';
import type { ShiftConfig, ShiftSession } from '../../types/handover.types';

export interface DepartmentShift {
  department: string;
  shifts: Array<{
    shiftName: string;
    startTime: string;
    endTime: string;
    color: string;
    memberCount: number;
    isActive: boolean;
  }>;
}

function isShiftActiveNow(startTime: string, endTime: string): boolean {
  const now = new Date();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (endMinutes > startMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// Must match the values ShiftConfigForm writes to ShiftConfig.activeDays
// ('Mon' | 'Tue' | ... — see src/types/handover.types.ts).
const DAY_MAP: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

// `configs` (shift_config) only describes the *plan* — who's rostered and
// when a shift is scheduled to run. Whether someone has actually clocked in
// is a separate fact recorded in `shift_sessions` by startShiftSession /
// completeShiftSession (see src/services/handover.service.ts and
// EndShiftButton.tsx). This widget previously derived `isActive` purely from
// wall-clock time against the scheduled window and `memberCount` purely from
// the config's static roster size — neither of which is touched by an actual
// shift start/end action, so the widget never reflected clock-ins/outs, live
// or otherwise. Folding in `activeSessions` (live via onSnapshot, same
// pattern as useTechnicianStatuses/ShiftStatusPanel) fixes that.
function groupTodayShifts(configs: ShiftConfig[], activeSessions: ShiftSession[]): DepartmentShift[] {
  const today = DAY_MAP[new Date().getDay()];
  const activeConfigs = configs.filter(
    (c) => c.status === 'active' && c.activeDays.includes(today as ShiftConfig['activeDays'][number]),
  );

  const grouped = new Map<string, DepartmentShift['shifts']>();
  for (const c of activeConfigs) {
    const dept = c.department ?? 'General';
    const clockedInCount = activeSessions.filter((s) => s.shiftConfigId === c.id).length;
    if (!grouped.has(dept)) grouped.set(dept, []);
    grouped.get(dept)!.push({
      shiftName: c.shiftName,
      startTime: c.startTime,
      endTime: c.endTime,
      color: c.color,
      // Live headcount of people currently clocked in, falling back to the
      // rostered size when nobody has started a session yet (e.g. just
      // before the shift begins).
      memberCount: clockedInCount > 0 ? clockedInCount : c.memberIds.length,
      // "Active" now reflects real attendance first (someone actually
      // clocked in) and falls back to the scheduled time window otherwise.
      isActive: clockedInCount > 0 || isShiftActiveNow(c.startTime, c.endTime),
    });
  }

  return Array.from(grouped.entries())
    .map(([department, shifts]) => ({ department, shifts }))
    .sort((a, b) => a.department.localeCompare(b.department));
}

export function useTodayShifts(companyId: string) {
  const [configs, setConfigs] = useState<ShiftConfig[]>([]);
  const [activeSessions, setActiveSessions] = useState<ShiftSession[]>([]);
  const [departments, setDepartments] = useState<DepartmentShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live subscription to shift plans — reflects adds/edits/removals instantly.
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeShiftConfigs(
      companyId,
      (next) => {
        setConfigs(next);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  // Live subscription to who's actually clocked in right now — reflects
  // startShiftSession/completeShiftSession writes (shift start/end) the
  // instant they land, scoped to the current company (siteId/companyId).
  useEffect(() => {
    if (!companyId) return;
    const unsub = subscribeActiveShiftSessions(
      companyId,
      (next) => setActiveSessions(next),
      (message) => setError(message),
    );
    return () => unsub();
  }, [companyId]);

  // Recompute the grouping (and the time-based "active" badge) on every config
  // or session change and once a minute, so the widget stays current without
  // a reload.
  useEffect(() => {
    setDepartments(groupTodayShifts(configs, activeSessions));
    const id = setInterval(() => setDepartments(groupTodayShifts(configs, activeSessions)), 60_000);
    return () => clearInterval(id);
  }, [configs, activeSessions]);

  return { departments, loading, error };
}
