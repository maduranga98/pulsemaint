import { useState, useEffect, useCallback } from 'react';
import {
  fetchTeamPerformanceByUser,
  type UserPerformanceSummary,
  type DateRange,
} from '../../services/teamPerformance.service';
import { usePlantUserIds } from '../usePlantUserIds';

export type { UserPerformanceSummary };

export function useTeamPerformanceAnalytics(companyId: string, dateRange?: DateRange | null) {
  const [data, setData] = useState<UserPerformanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only people in the caller's plant (admin: selected plant tab).
  const plantUserIds = usePlantUserIds(companyId);

  const fetch = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchTeamPerformanceByUser(companyId, dateRange);
      setData(plantUserIds ? rows.filter((r) => plantUserIds.has(r.userId)) : rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, dateRange?.from, dateRange?.to, plantUserIds]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
