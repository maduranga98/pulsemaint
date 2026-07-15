import { useState, useEffect, useCallback } from 'react';
import { fetchMonthlyAnalytics } from '../../services/analytics.service';
import { computeMonthlyAnalytics } from '../../services/analyticsAggregation';
import type { AnalyticsMonthly } from '../../types/analytics.types';

export function useContractorScoreboard(companyId: string, month: string) {
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
      let result = await fetchMonthlyAnalytics(companyId, month);
      if (!result || result.contractorPerformance.length === 0) {
        // Nothing recorded for the selected month yet — show the all-time
        // scoreboard instead of an empty panel.
        result = await computeMonthlyAnalytics(companyId, 'all');
      }
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
