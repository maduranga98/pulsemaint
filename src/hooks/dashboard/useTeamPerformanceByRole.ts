import { useState, useEffect, useCallback } from 'react';
import {
  fetchTeamPerformanceByRole,
  type RolePerformanceSummary,
  type DateRange,
} from '../../services/teamPerformance.service';

export type { RolePerformanceSummary };

// Role-aggregated Team Performance — used by the HR dashboard's headcount
// and evaluation/audit/triage-activity-by-role charts, which need per-role
// counts, not the per-person rows the Analytics "Team Performance" widget
// and the Team Performance report use (see useTeamPerformanceAnalytics.ts).
export function useTeamPerformanceByRole(companyId: string, dateRange?: DateRange | null) {
  const [data, setData] = useState<RolePerformanceSummary[]>([]);
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
      setData(await fetchTeamPerformanceByRole(companyId, dateRange));
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
