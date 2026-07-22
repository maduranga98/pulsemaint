import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, type Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WOStats, WOType, WOStatus } from '../types/workOrder';
import { useAuthStore } from '../store/authStore';

interface UseWOStatsResult {
  stats: WOStats | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_TYPE_COUNTS: Record<WOType, number> = {
  BREAKDOWN: 0, CORRECTIVE: 0, PREVENTIVE: 0, INSTALLATION: 0,
  MODIFICATION: 0, INSPECTION: 0, CONTRACTOR: 0, OTHER: 0,
};

const EMPTY_STATUS_COUNTS: Record<WOStatus, number> = {
  DRAFT: 0, OPEN: 0, ASSIGNED: 0, IN_PROGRESS: 0,
  ON_HOLD_PARTS: 0, ON_HOLD_APPROVAL: 0, COMPLETED: 0,
  SIGNED_OFF: 0, CLOSED: 0, CANCELLED: 0,
};

export function useWOStats(): UseWOStatsResult {
  const [stats, setStats] = useState<WOStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId;

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Live subscription so the WO stats bar updates automatically as work
    // orders progress. Aggregated in memory to avoid composite-index needs.
    const unsub = onSnapshot(
      query(collection(db, 'workOrders'), where('siteId', '==', siteId)),
      (snap) => {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const now = new Date();

        const byType = { ...EMPTY_TYPE_COUNTS };
        const byStatus = { ...EMPTY_STATUS_COUNTS };
        let openCount = 0;
        let overdueCount = 0;
        let completedThisWeek = 0;
        let totalCompletionMinutes = 0;
        let completedCount = 0;

        const OPEN_TERMINAL = ['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'];
        // A WO is "completed" once it reaches any of these states.
        const COMPLETED_STATES = ['COMPLETED', 'SIGNED_OFF', 'CLOSED'];
        const toDateSafe = (v: Timestamp | null | undefined): Date | null =>
          v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate() : null;

        for (const d of snap.docs) {
          const wo = d.data() as any;
          if (wo.woType in byType) byType[wo.woType as WOType]++;
          if (wo.status in byStatus) byStatus[wo.status as WOStatus]++;

          if (!['CLOSED', 'CANCELLED'].includes(wo.status)) openCount++;

          if (!OPEN_TERMINAL.includes(wo.status)) {
            if (wo.slaBreached) overdueCount++;
            else if (wo.slaDeadline?.toDate && wo.slaDeadline.toDate() < now) overdueCount++;
          }

          // Count everything completed/signed-off/closed this week, using the
          // best available completion timestamp.
          if (COMPLETED_STATES.includes(wo.status)) {
            const completedAt =
              toDateSafe(wo.actualEndTime) ??
              toDateSafe(wo.completedAt) ??
              toDateSafe(wo.closedAt) ??
              toDateSafe(wo.updatedAt);
            if (completedAt && completedAt >= startOfWeek) completedThisWeek++;
          }

          if (wo.totalDurationMinutes) {
            totalCompletionMinutes += wo.totalDurationMinutes;
            completedCount++;
          }
        }

        setStats({
          openCount,
          overdueCount,
          avgCompletionTimeMinutes: completedCount > 0 ? Math.round(totalCompletionMinutes / completedCount) : 0,
          completedThisWeek,
          byType,
          byStatus,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [siteId]);

  return { stats, loading, error };
}
