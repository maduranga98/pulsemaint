import { useEffect, useState } from 'react';
import { subscribeMonthlyAnalytics, type MonthArg } from '../../services/analyticsAggregation';
import type { AnalyticsMonthly, ContractorPerformanceRecord } from '../../types/analytics.types';
import { useDepartmentScope } from '../useDepartmentScope';

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
// range changes. It is live (the same subscription the Analytics page uses),
// so a job that is finished or rated shows up without a reload.
export function useContractorScoreboard(companyId: string, month: MonthArg) {
  // Plant-scoped roles / admin's plant tab only see their plant's figures.
  const { plantId } = useDepartmentScope();
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
    try {
      return subscribeMonthlyAnalytics(
        companyId,
        month,
        (result) => {
          setData({ contractorPerformance: rankRecords(result.contractorPerformance) } as AnalyticsMonthly);
          setLoading(false);
        },
        plantId,
      );
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthKeyStr, nonce, plantId]);

  return { data, loading, error, refetch: () => setNonce((n) => n + 1) };
}
