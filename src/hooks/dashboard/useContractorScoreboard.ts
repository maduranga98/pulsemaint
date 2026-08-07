import { useState, useEffect } from 'react';
import { computeMonthlyAnalytics, type MonthArg } from '../../services/analyticsAggregation';
import type { AnalyticsMonthly, ContractorPerformanceRecord } from '../../types/analytics.types';

// Rank: most jobs first, then best rating, then best SLA compliance.
function rankRecords(records: ContractorPerformanceRecord[]): ContractorPerformanceRecord[] {
  return [...records].sort(
    (a, b) =>
      b.jobsCompleted - a.jobsCompleted ||
      b.avgRating - a.avgRating ||
      b.slaCompliance - a.slaCompliance,
  );
}

// Jobs/SLA/first-fix are computed from contractorJobs for the selected
// month range, not read off the (lifetime, non-range-aware) contractor
// registry fields — that's what lets the scoreboard actually move when the
// Analytics page's MTD/3M/6M/12M range changes.
export function useContractorScoreboard(companyId: string, month: MonthArg) {
  const [data, setData] = useState<AnalyticsMonthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const monthKeyStr = Array.isArray(month) ? month.join(',') : month;

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;

    computeMonthlyAnalytics(companyId, month)
      .then((result) => {
        if (cancelled) return;
        setData({ contractorPerformance: rankRecords(result.contractorPerformance) } as AnalyticsMonthly);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthKeyStr, nonce]);

  return { data, loading, error, refetch: () => setNonce((n) => n + 1) };
}
