import { useState, useEffect } from 'react';
import { subscribeShiftConfigs } from '../../services/handover.service';
import type { ShiftConfig } from '../../types/handover.types';

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

function groupTodayShifts(configs: ShiftConfig[]): DepartmentShift[] {
  const today = DAY_MAP[new Date().getDay()];
  const activeConfigs = configs.filter(
    (c) => c.status === 'active' && c.activeDays.includes(today as ShiftConfig['activeDays'][number]),
  );

  const grouped = new Map<string, DepartmentShift['shifts']>();
  for (const c of activeConfigs) {
    const dept = c.department ?? 'General';
    if (!grouped.has(dept)) grouped.set(dept, []);
    grouped.get(dept)!.push({
      shiftName: c.shiftName,
      startTime: c.startTime,
      endTime: c.endTime,
      color: c.color,
      memberCount: c.memberIds.length,
      isActive: isShiftActiveNow(c.startTime, c.endTime),
    });
  }

  return Array.from(grouped.entries())
    .map(([department, shifts]) => ({ department, shifts }))
    .sort((a, b) => a.department.localeCompare(b.department));
}

export function useTodayShifts(companyId: string) {
  const [configs, setConfigs] = useState<ShiftConfig[]>([]);
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

  // Recompute the grouping (and the time-based "active" badge) on every config
  // change and once a minute, so the widget stays current without a reload.
  useEffect(() => {
    setDepartments(groupTodayShifts(configs));
    const id = setInterval(() => setDepartments(groupTodayShifts(configs)), 60_000);
    return () => clearInterval(id);
  }, [configs]);

  return { departments, loading, error };
}
