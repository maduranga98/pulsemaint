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

interface PMWorkOrderEvent {
  id: string;
  machineName: string;
  description: string;
  dueDate: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTechnicianNames: string[];
  status: 'active' | 'paused';
}

export function usePMCalendarEvents({ companyId, month, year }: UsePMCalendarEventsOptions) {
  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [pmWOs, setPmWOs] = useState<PMWorkOrderEvent[]>([]);
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

    // Also surface ad-hoc Preventive work orders so they appear on the
    // calendar even when they are not tied to a recurring schedule.
    const woQuery = query(
      collection(db, 'workOrders'),
      where('woType', '==', 'PREVENTIVE'),
    );
    const unsubWO = onSnapshot(woQuery, (snap) => {
      const list: PMWorkOrderEvent[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        // Filter by company via siteId prefix or explicit companyId field.
        if (data.companyId && data.companyId !== companyId) return;
        const due: Date | null = data.dueDate?.toDate ? data.dueDate.toDate() : null;
        if (!due) return;
        const terminal = ['CLOSED', 'CANCELLED', 'COMPLETED', 'SIGNED_OFF'];
        if (terminal.includes(data.status)) return;
        list.push({
          id: d.id,
          machineName: data.machineName ?? 'Unknown',
          description: data.description ?? data.woNumber ?? 'Preventive WO',
          dueDate: due,
          priority: data.priority ?? 'medium',
          assignedTechnicianNames: data.assignedTechnicianNames ?? [],
          status: 'active',
        });
      });
      setPmWOs(list);
    }, (err) => {
      console.error('Error fetching PM WOs for calendar:', err);
    });

    return () => {
      unsubscribe();
      unsubWO();
    };
  }, [companyId]);

  const events: CalendarEvent[] = useMemo(() => {
    const scheduleEvents: CalendarEvent[] = schedules.map((s) => {
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
    });

    const woEvents: CalendarEvent[] = pmWOs.map((wo) => ({
      id: `wo-${wo.id}`,
      scheduleId: '',
      title: wo.description.slice(0, 60),
      date: wo.dueDate,
      priority: wo.priority,
      machineName: wo.machineName,
      technicianNames: wo.assignedTechnicianNames,
      pmType: 'other',
      status: wo.status,
    }));

    return [...scheduleEvents, ...woEvents].filter((e) => {
      if (month === undefined || year === undefined) return true;
      return e.date.getMonth() === month && e.date.getFullYear() === year;
    });
  }, [schedules, pmWOs, month, year]);

  return { events, loading, error };
}
