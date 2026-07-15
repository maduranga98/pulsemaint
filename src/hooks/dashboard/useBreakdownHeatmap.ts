import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDateRange } from '../../services/analytics.service';
import { computeBreakdownHeatmap } from '../../services/analyticsAggregation';
import { buildHeatmapGrid } from '../../utils/heatmap.utils';
import type { ChartDateRange, HeatmapCell } from '../../types/analytics.types';

export function useBreakdownHeatmap(companyId: string, range: ChartDateRange) {
  const [points, setPoints] = useState<Array<{ day: number; hour: number; count: number }>>([]);
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
      const result = await computeBreakdownHeatmap(companyId, from, to);
      setPoints(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, range]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const heatmap = useMemo<HeatmapCell[]>(() => buildHeatmapGrid(points), [points]);

  return { heatmap, loading, error, refetch: fetch };
}
