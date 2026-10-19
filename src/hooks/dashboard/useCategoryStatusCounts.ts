import { useState, useEffect, useCallback, useRef } from 'react';
import type { CategoryStatusRow, DateRange, PersonFilter } from '../../services/teamPerformance.service';
import { usePlantUserIds } from '../usePlantUserIds';

export type { CategoryStatusRow };

export function useCategoryStatusCounts(
  companyId: string,
  fetcher: (companyId: string, dateRange?: DateRange | null, personFilter?: PersonFilter) => Promise<CategoryStatusRow[]>,
  dateRange?: DateRange | null,
) {
  const [data, setData] = useState<CategoryStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only people in the caller's plant (admin: selected plant tab).
  const plantUserIds = usePlantUserIds(companyId);
  const requestRef = useRef(0);

  const fetch = useCallback(async () => {
    const requestId = ++requestRef.current;
    const isLatest = () => requestId === requestRef.current;
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Several fetches overlap while the plant roster loads (null → empty
    // placeholder → real ids); only the newest one may write its result, or
    // a slower, stale one leaves the chart empty or unscoped.
    try {
      const rows = await fetcher(companyId, dateRange, plantUserIds ? (id: string) => plantUserIds.has(id) : undefined);
      if (isLatest()) setData(rows);
    } catch (err) {
      if (isLatest()) setError((err as Error).message);
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [companyId, fetcher, dateRange?.from, dateRange?.to, plantUserIds]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
