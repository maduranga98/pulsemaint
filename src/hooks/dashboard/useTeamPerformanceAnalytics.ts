import { useState, useEffect, useCallback } from 'react';
import { fetchTeamPerformanceByUser, type UserPerformanceSummary } from '../../services/teamPerformance.service';

export type { UserPerformanceSummary };

export function useTeamPerformanceAnalytics(companyId: string) {
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
      setData(await fetchTeamPerformanceByUser(companyId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
