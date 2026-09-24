import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDateRange } from '../../services/analytics.service';
import { computeBreakdownHeatmap } from '../../services/analyticsAggregation';
import { buildHeatmapGrid } from '../../utils/heatmap.utils';
import type { ChartDateRange, HeatmapCell } from '../../types/analytics.types';
import { useDepartmentScope } from '../useDepartmentScope';

export function useBreakdownHeatmap(companyId: string, range: ChartDateRange) {
  // Plant-scoped roles / admin's plant tab only see their plant's figures.
  const { plantId } = useDepartmentScope();
  const [points, setPoints] = useState<Array<{ day: number; hour: number; count: number; machineNames: string[] }>>([]);
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
      const { from, to } = getDateRange(range);
      // Bucket day-of-week × hour-of-day from the raw breakdown tickets so
      // the heatmap shows real report times.
      const result = await computeBreakdownHeatmap(companyId, from, to, plantId);
      setPoints(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, range, plantId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const heatmap = useMemo<HeatmapCell[]>(() => buildHeatmapGrid(points), [points]);

  return { heatmap, loading, error, refetch: fetch };
}
