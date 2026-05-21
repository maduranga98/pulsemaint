import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchDailyAnalytics, getDateRange } from '../../services/analytics.service';
import { buildHeatmapGrid } from '../../utils/heatmap.utils';
import type { AnalyticsDaily, ChartDateRange, HeatmapCell } from '../../types/analytics.types';

export function useBreakdownHeatmap(companyId: string, range: ChartDateRange) {
  const [data, setData] = useState<AnalyticsDaily[]>([]);
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
      const result = await fetchDailyAnalytics(companyId, from, to);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, range]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const heatmap = useMemo<HeatmapCell[]>(() => {
    // Group by day-of-week and hour
    const raw = data.flatMap((d) => {
      const date = new Date(d.date);
      const day = (date.getDay() + 6) % 7; // Mon=0, Sun=6
      const hour = 12; // Placeholder — daily data doesn't have hourly granularity
      return [{ day, hour, count: d.breakdownsOpened }];
    });
    return buildHeatmapGrid(raw);
  }, [data]);

  return { data, heatmap, loading, error, refetch: fetch };
}
