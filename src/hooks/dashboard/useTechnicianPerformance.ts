import { useState, useEffect, useCallback } from 'react';
import { fetchMonthlyAnalytics } from '../../services/analytics.service';
import { computeMonthlyAnalytics, type MonthArg } from '../../services/analyticsAggregation';
import type { AnalyticsMonthly } from '../../types/analytics.types';

export function useTechnicianPerformance(companyId: string, month: MonthArg) {
  const [data, setData] = useState<AnalyticsMonthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthKey = Array.isArray(month) ? month.join(',') : month;

  const fetch = useCallback(async () => {
    if (!companyId || !monthKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let result = await fetchMonthlyAnalytics(companyId, month);
      if (!result || result.technicianPerformance.length === 0) {
        // No completed WOs recorded in the selected month yet — fall back to
        // the all-time aggregation so the panel still shows live data.
        result = await computeMonthlyAnalytics(companyId, 'all');
      }
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
