import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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

    // Single query (works without composite indexes), aggregate in memory.
    getDocs(query(collection(db, 'workOrders'), where('siteId', '==', siteId)))
      .then((snap) => {
        const byType = { ...EMPTY_TYPE_COUNTS };
        const byStatus = { ...EMPTY_STATUS_COUNTS };
        let openCount = 0;
        let overdueCount = 0;
        let completedThisWeek = 0;
        let totalCompletionMinutes = 0;
        let completedCount = 0;

        const TERMINAL = ['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'];

        for (const d of snap.docs) {
          const wo = d.data() as any;
          if (wo.woType in byType) byType[wo.woType as WOType]++;
          if (wo.status in byStatus) byStatus[wo.status as WOStatus]++;

          if (!['CLOSED', 'CANCELLED'].includes(wo.status)) openCount++;

          if (!TERMINAL.includes(wo.status)) {
            if (wo.slaBreached) overdueCount++;
            else if (wo.slaDeadline?.toDate && wo.slaDeadline.toDate() < now) overdueCount++;
          }

          if (['CLOSED', 'SIGNED_OFF'].includes(wo.status) && wo.closedAt?.toDate && wo.closedAt.toDate() >= startOfWeek) {
            completedThisWeek++;
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
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [siteId]);

  return { stats, loading, error };
}
