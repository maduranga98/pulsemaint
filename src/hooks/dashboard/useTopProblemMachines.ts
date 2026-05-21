import { useState, useEffect, useCallback } from 'react';
import { fetchMonthlyAnalytics } from '../../services/analytics.service';
import type { AnalyticsMonthly } from '../../types/analytics.types';

export function useTopProblemMachines(companyId: string, month: string) {
  const [data, setData] = useState<AnalyticsMonthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!companyId || !month) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMonthlyAnalytics(companyId, month);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, month]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
