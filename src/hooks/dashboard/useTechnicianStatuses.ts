import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TechnicianStatusDoc } from '../../types/analytics.types';

interface ShiftSessionRow {
  userId: string;
  userName: string;
  userRole: string;
  shiftName: string;
  actualStart: any;
}

interface WorkOrderRow {
  status: string;
  woNumber: string;
  machineName: string;
  assignedTechnicianIds: string[];
  actualEndTime: any;
}

const isTechnicianRole = (role: string) => role === 'technician' || role === 'trainee';

const isTodayTimestamp = (value: any): boolean => {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

// Technician "live" status is derived from who currently has an active shift
// session (SUP-004: the technician_status aggregate collection was never
// populated because its writer function was wired to a Firestore trigger
// on a collection name that doesn't exist) cross-referenced with in-progress
// work orders to tell "on job" apart from "available".
export function useTechnicianStatuses(companyId: string) {
  const [sessions, setSessions] = useState<ShiftSessionRow[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    let sessionsLoaded = false;
    let workOrdersLoaded = false;
    const markLoaded = () => {
      if (sessionsLoaded && workOrdersLoaded) setLoading(false);
    };

    const sessionsQuery = query(
      collection(db, 'shift_sessions'),
      where('companyId', '==', companyId),
      where('status', '==', 'active'),
    );
    const unsubSessions = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        setSessions(snapshot.docs.map((d) => d.data() as ShiftSessionRow));
        sessionsLoaded = true;
        markLoaded();
      },
      (err) => {
        setError(err.message);
        sessionsLoaded = true;
        markLoaded();
      },
    );

    const workOrdersQuery = query(
      collection(db, 'workOrders'),
      where('companyId', '==', companyId),
      where('status', 'in', ['IN_PROGRESS', 'COMPLETED', 'SIGNED_OFF', 'CLOSED']),
    );
    const unsubWorkOrders = onSnapshot(
      workOrdersQuery,
      (snapshot) => {
        setWorkOrders(snapshot.docs.map((d) => d.data() as WorkOrderRow));
        workOrdersLoaded = true;
        markLoaded();
      },
      (err) => {
        setError(err.message);
        workOrdersLoaded = true;
        markLoaded();
      },
    );

    return () => {
      unsubSessions();
      unsubWorkOrders();
    };
  }, [companyId]);

  const technicians = useMemo<TechnicianStatusDoc[]>(() => {
    return sessions
      .filter((s) => isTechnicianRole(s.userRole))
      .map((s) => {
        const activeWo = workOrders.find(
          (w) => w.status === 'IN_PROGRESS' && w.assignedTechnicianIds?.includes(s.userId),
        );
        const jobsCompletedToday = workOrders.filter(
          (w) =>
            ['COMPLETED', 'SIGNED_OFF', 'CLOSED'].includes(w.status) &&
            w.assignedTechnicianIds?.includes(s.userId) &&
            isTodayTimestamp(w.actualEndTime),
        ).length;

        return {
          companyId,
          userId: s.userId,
          name: s.userName,
          role: s.userRole,
          shiftName: s.shiftName ?? null,
          currentStatus: activeWo ? 'on_job' : 'available',
          currentWoId: null,
          currentWoNumber: activeWo?.woNumber ?? null,
          currentMachineName: activeWo?.machineName ?? null,
          shiftStartTime: s.actualStart ?? null,
          jobsCompletedToday,
          avgResponseTimeMins: 0,
          avgRepairTimeHours: 0,
          updatedAt: s.actualStart ?? null,
        } as TechnicianStatusDoc;
      });
  }, [sessions, workOrders, companyId]);

  return { technicians, loading, error };
}
