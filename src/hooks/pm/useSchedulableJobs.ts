import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PMSchedule } from '../../types/pm.types';
import { durationToHours, type SchedulableJob } from '../../lib/pm/schedulerConflict';

const TERMINAL_WO_STATUSES = ['CLOSED', 'CANCELLED', 'COMPLETED', 'SIGNED_OFF'];

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value.toDate) return value.toDate();
  return new Date(value);
}

/**
 * Loads every assignable job (active PM schedules + open Preventive work orders)
 * for a company, normalized into SchedulableJob, so conflict detection can run
 * client-side against an already-cached list.
 */
export function useSchedulableJobs(companyId: string | undefined) {
  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubPm = onSnapshot(
      query(
        collection(db, 'pm_schedules'),
        where('companyId', '==', companyId),
        where('status', 'in', ['active', 'paused']),
      ),
      (snap) => {
        setSchedules(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PMSchedule[]);
        setLoading(false);
      },
      () => setLoading(false),
    );

    const unsubWo = onSnapshot(
      query(
        collection(db, 'workOrders'),
        where('companyId', '==', companyId),
        where('woType', '==', 'PREVENTIVE'),
      ),
      (snap) => {
        setWorkOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {},
    );

    return () => {
      unsubPm();
      unsubWo();
    };
  }, [companyId]);

  const jobs = useMemo<SchedulableJob[]>(() => {
    const pmJobs: SchedulableJob[] = schedules.map((s) => {
      const date = toDate(s.nextDueDate) ?? new Date();
      return {
        id: s.id,
        source: 'pm_schedule',
        title: s.name,
        machineName: s.machineName,
        date,
        estimatedHours: durationToHours(s.estimatedDuration, s.estimatedDurationUnit),
        priority: s.priority,
        assignedTechnicianIds: s.assignedTechnicianIds ?? [],
        assignedTechnicianNames: s.assignedTechnicianNames ?? [],
      };
    });

    const woJobs: SchedulableJob[] = workOrders
      .filter((w) => !TERMINAL_WO_STATUSES.includes(w.status))
      .map((w) => {
        const date = toDate(w.dueDate) ?? new Date();
        const unit = (w.estimatedDurationUnit === 'days' ? 'days' : 'hours') as 'hours' | 'days';
        return {
          id: w.id,
          source: 'work_order' as const,
          title: w.description?.slice(0, 60) || w.woNumber || 'Preventive WO',
          machineName: w.machineName ?? 'Unknown',
          date,
          estimatedHours: durationToHours(Number(w.estimatedDuration ?? 1), unit),
          priority: w.priority ?? 'medium',
          assignedTechnicianIds: w.assignedTechnicianIds ?? [],
          assignedTechnicianNames: w.assignedTechnicianNames ?? [],
        };
      });

    return [...pmJobs, ...woJobs];
  }, [schedules, workOrders]);

  return { jobs, loading };
}
