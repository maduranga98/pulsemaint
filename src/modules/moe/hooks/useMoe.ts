import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../../store/authStore';
import {
  computeMoeSummaries,
  aggregatePlantMoe,
  fetchMoeConfig,
  fetchMoeTrendForMachine,
} from '../services/moe.service';
import type { MoeConfig, MoePlantAggregate, MoeTrendPoint } from '../types/moe.types';

function subtractRangeDuration(start: Date, end: Date): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - durationMs),
    end: new Date(start.getTime() - 1),
  };
}

export function useSiteId(): string | null {
  const userProfile = useAuthStore((s) => s.userProfile);
  // Machine docs carry `siteId`, which equals `companyId` for the
  // single-site tenants this app currently supports (see useMachineOptions).
  return userProfile?.siteIds?.[0] ?? userProfile?.companyId ?? null;
}

export function useMoeDashboard(start: Date, end: Date) {
  const siteId = useSiteId();
  const [data, setData] = useState<MoePlantAggregate | null>(null);
  const [config, setConfig] = useState<MoeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cfg = await fetchMoeConfig(siteId);
      setConfig(cfg);
      const current = await computeMoeSummaries(siteId, start, end, cfg);
      const prevRange = subtractRangeDuration(start, end);
      const previous = await computeMoeSummaries(siteId, prevRange.start, prevRange.end, cfg);
      setData(aggregatePlantMoe(current, previous));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compute MOE');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, start.getTime(), end.getTime()]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, config, loading, error, reload: load };
}

export function useMoeMachineTrend(machineId: string | null, start: Date, end: Date) {
  const siteId = useSiteId();
  const [trend, setTrend] = useState<MoeTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!siteId || !machineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchMoeTrendForMachine(siteId, machineId, start, end)
      .then((res) => {
        if (!cancelled) setTrend(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to compute MOE trend');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, machineId, start.getTime(), end.getTime()]);

  return { trend, loading, error };
}

export function useMoeConfig() {
  const siteId = useSiteId();
  const [config, setConfig] = useState<MoeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!siteId) {
      setLoading(false);
      return;
    }
    fetchMoeConfig(siteId).then((cfg) => {
      if (!cancelled) {
        setConfig(cfg);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  return { config, setConfig, loading, siteId };
}
