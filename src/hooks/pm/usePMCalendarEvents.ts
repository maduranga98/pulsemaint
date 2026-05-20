import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PMSchedule, CalendarEvent } from '../../types/pm.types';

interface UsePMCalendarEventsOptions {
  companyId: string;
  month?: number; // 0-11
  year?: number;
}

export function usePMCalendarEvents({ companyId, month, year }: UsePMCalendarEventsOptions) {
  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setError('Company ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);

    const constraints = [where('companyId', '==', companyId), where('status', 'in', ['active', 'paused'])];

    const q = query(collection(db, 'pm_schedules'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PMSchedule[];
        setSchedules(fetched);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching calendar events:', err);
        setError(err.message || 'Failed to fetch calendar events');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  const events: CalendarEvent[] = useMemo(() => {
    return schedules.map((s) => {
      const nextDue = s.nextDueDate instanceof Date
        ? s.nextDueDate
        : 'toDate' in s.nextDueDate ? s.nextDueDate.toDate() : new Date(s.nextDueDate as unknown as string);

      return {
        id: `event-${s.id}`,
        scheduleId: s.id,
        title: s.name,
        date: nextDue,
        priority: s.priority,
        machineName: s.machineName,
        technicianNames: s.assignedTechnicianNames,
        pmType: s.pmType,
        status: s.status,
      };
    }).filter((e) => {
      if (month === undefined || year === undefined) return true;
      return e.date.getMonth() === month && e.date.getFullYear() === year;
    });
  }, [schedules, month, year]);

  return { events, loading, error };
}
