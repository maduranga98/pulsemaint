import { useState, useEffect, useCallback } from 'react';
import {
  fetchTeamPerformanceByUser,
  type UserPerformanceSummary,
  type DateRange,
} from '../../services/teamPerformance.service';

export type { UserPerformanceSummary };

export function useTeamPerformanceAnalytics(companyId: string, dateRange?: DateRange | null) {
  const [data, setData] = useState<UserPerformanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTeamPerformanceByUser(companyId, dateRange));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
