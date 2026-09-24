import { useEffect, useState } from 'react';
import { fetchMonthlyAnalytics } from '../../services/analytics.service';
import { useDepartmentScope } from '../useDepartmentScope';

export interface PmComplianceHistoryPoint {
  month: string;
  rate: number;
}

/**
 * Loads PM compliance for the last N months (default 6) using the analytics
 * service (which computes from raw data when no pre-aggregated docs exist).
 */
export function usePmComplianceHistory(companyId: string, monthsBack = 6) {
  // Plant-scoped roles / admin's plant tab only see their plant's figures.
  const { plantId } = useDepartmentScope();
  const [data, setData] = useState<PmComplianceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const months: string[] = [];
    const now = new Date();
    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    Promise.all(months.map((m) => fetchMonthlyAnalytics(companyId, m, plantId)))
      .then((results) => {
        if (cancelled) return;
        setData(
          results.map((r, i) => ({
            month: new Date(`${months[i]}-01`).toLocaleString('en', { month: 'short' }),
            rate: r ? Math.round(r.pmComplianceRate) : 0,
          })),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, monthsBack, plantId]);

  return { data, loading };
}
