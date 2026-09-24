import { useState, useEffect, useCallback } from 'react';
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

  const fetch = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetcher(companyId, dateRange, plantUserIds ? (id: string) => plantUserIds.has(id) : undefined),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, fetcher, dateRange?.from, dateRange?.to, plantUserIds]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
