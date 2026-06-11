import { useState, useEffect } from 'react';
import { fetchShiftConfigs } from '../../services/handover.service';
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

const DAY_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export function useTodayShifts(companyId: string) {
  const [departments, setDepartments] = useState<DepartmentShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const configs = await fetchShiftConfigs(companyId);
        if (cancelled) return;

        const today = DAY_MAP[new Date().getDay()];
        const activeConfigs = configs.filter(
          (c: ShiftConfig) =>
            c.status === 'active' && c.activeDays.includes(today as ShiftConfig['activeDays'][number]),
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

        const result: DepartmentShift[] = Array.from(grouped.entries())
          .map(([department, shifts]) => ({ department, shifts }))
          .sort((a, b) => a.department.localeCompare(b.department));

        setDepartments(result);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { departments, loading, error };
}
