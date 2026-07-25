import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PMSchedule, CalendarEvent } from '../../types/pm.types';
import { getPMOperationalStatus } from '../../utils/pm.utils';
import { PM_TYPE_CONFIG } from '../../constants/pmConfig';

interface UsePMCalendarEventsOptions {
  companyId: string;
  siteId: string;
  month?: number; // 0-11
  year?: number;
}

interface PMWorkOrderEvent {
  id: string;
  woNumber: string;
  machineName: string;
  dueDate: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTechnicianNames: string[];
  status: 'active' | 'paused';
  woStatus: string;
  pmScheduleId: string | null;
  pmType: PMSchedule['pmType'];
}

export function usePMCalendarEvents({ companyId, siteId, month, year }: UsePMCalendarEventsOptions) {
  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [pmWOs, setPmWOs] = useState<PMWorkOrderEvent[]>([]);
  // Every Preventive WO keyed by id (including terminal ones) so a schedule's
  // linked WO ticket number/status can be looked up regardless of its state.
  const [woById, setWoById] = useState<Map<string, PMWorkOrderEvent>>(new Map());
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
    // WO read rules gate on siteId, so the query must constrain it or
    // Firestore rejects the whole listen.
    const woQuery = query(
      collection(db, 'workOrders'),
      where('woType', '==', 'PREVENTIVE'),
      where('siteId', '==', siteId),
    );
    const unsubWO = onSnapshot(woQuery, (snap) => {
      const list: PMWorkOrderEvent[] = [];
      const byId = new Map<string, PMWorkOrderEvent>();
      const terminal = ['CLOSED', 'CANCELLED', 'COMPLETED', 'SIGNED_OFF'];
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const due: Date | null = data.dueDate?.toDate ? data.dueDate.toDate() : null;
        const event: PMWorkOrderEvent = {
          id: d.id,
          woNumber: data.woNumber ?? '',
          machineName: data.machineName ?? 'Unknown',
          dueDate: due ?? new Date(),
          priority: data.priority ?? 'medium',
          assignedTechnicianNames: data.assignedTechnicianNames ?? [],
          status: 'active',
          woStatus: data.status ?? 'OPEN',
          pmScheduleId: data.pmScheduleId ?? null,
          pmType: data.pmType ?? 'other',
        };
        byId.set(d.id, event);
        if (due && !terminal.includes(data.status)) list.push(event);
      });
      setPmWOs(list);
      setWoById(byId);
    }, (err) => {
      console.error('Error fetching PM WOs for calendar:', err);
    });

    return () => {
      unsubscribe();
      unsubWO();
    };
  }, [companyId, siteId]);

  const events: CalendarEvent[] = useMemo(() => {
    const scheduleIds = new Set(schedules.map((s) => s.id));

    const scheduleEvents: CalendarEvent[] = schedules.map((s) => {
      const nextDue = s.nextDueDate instanceof Date
        ? s.nextDueDate
        : 'toDate' in s.nextDueDate ? s.nextDueDate.toDate() : new Date(s.nextDueDate as unknown as string);

      const linkedWo = woById.get(s.activeWoId ?? s.lastWoId ?? '');
      const pmType = linkedWo?.pmType ?? s.pmType;

      return {
        id: `event-${s.id}`,
        scheduleId: s.id,
        woId: linkedWo?.id ?? null,
        woNumber: linkedWo?.woNumber || null,
        // Calendar entries show the PM type, not the (often junk) free-text
        // schedule name or WO description.
        title: PM_TYPE_CONFIG[pmType].label,
        date: nextDue,
        priority: s.priority,
        machineName: s.machineName,
        technicianNames: s.assignedTechnicianNames,
        pmType,
        status: s.status,
        operationalStatus: getPMOperationalStatus(s),
      };
    });

    const woEvents: CalendarEvent[] = pmWOs
      // Skip ad-hoc PM WOs that already surface through their own schedule
      // record so the same PM isn't drawn twice on the calendar.
      .filter((wo) => !(wo.pmScheduleId && scheduleIds.has(wo.pmScheduleId)))
      .map((wo) => ({
        id: `wo-${wo.id}`,
        scheduleId: wo.pmScheduleId ?? '',
        woId: wo.id,
        woNumber: wo.woNumber || null,
        title: PM_TYPE_CONFIG[wo.pmType].label,
        date: wo.dueDate,
        priority: wo.priority,
        machineName: wo.machineName,
        technicianNames: wo.assignedTechnicianNames,
        pmType: wo.pmType,
        status: wo.status,
        operationalStatus: getPMOperationalStatus({
          status: 'active',
          nextDueDate: wo.dueDate as unknown as PMSchedule['nextDueDate'],
          activeWoStatus: wo.woStatus,
        }),
      }));

    return [...scheduleEvents, ...woEvents].filter((e) => {
      if (month === undefined || year === undefined) return true;
      return e.date.getMonth() === month && e.date.getFullYear() === year;
    });
  }, [schedules, pmWOs, woById, month, year]);

  return { events, loading, error };
}
