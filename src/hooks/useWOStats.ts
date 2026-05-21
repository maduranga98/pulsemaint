import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
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

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const now = new Date();

    Promise.all([
      getDocs(query(
        collection(db, 'workOrders'),
        where('siteId', '==', siteId),
        where('status', 'not-in', ['CLOSED', 'CANCELLED']),
      )),
      getDocs(query(
        collection(db, 'workOrders'),
        where('siteId', '==', siteId),
        where('status', 'in', ['CLOSED', 'SIGNED_OFF']),
        where('closedAt', '>=', Timestamp.fromDate(startOfWeek)),
      )),
    ])
      .then(([activeSnap, closedThisWeekSnap]) => {
        const byType = { ...EMPTY_TYPE_COUNTS };
        const byStatus = { ...EMPTY_STATUS_COUNTS };
        let overdueCount = 0;
        let totalCompletionMinutes = 0;
        let completedCount = 0;

        for (const d of activeSnap.docs) {
          const wo = d.data();
          if (wo.woType in byType) byType[wo.woType as WOType]++;
          if (wo.status in byStatus) byStatus[wo.status as WOStatus]++;
          if (wo.slaBreached && !['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'].includes(wo.status)) {
            overdueCount++;
          } else if (wo.slaDeadline?.toDate() < now && !['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'].includes(wo.status)) {
            overdueCount++;
          }
          if (wo.totalDurationMinutes) {
            totalCompletionMinutes += wo.totalDurationMinutes;
            completedCount++;
          }
        }

        setStats({
          openCount: activeSnap.size,
          overdueCount,
          avgCompletionTimeMinutes: completedCount > 0 ? Math.round(totalCompletionMinutes / completedCount) : 0,
          completedThisWeek: closedThisWeekSnap.size,
          byType,
          byStatus,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [siteId]);

  return { stats, loading, error };
}
