import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../../store/authStore';
import type {
  OEERecord,
  OEETarget,
  OEEMonthlyAggregate,
  MachineSummary,
  ShiftOEEComparison,
  BigLoss,
} from '../types/oee.types';
import {
  subscribeOEERecords,
  subscribeAllLatestOEE,
  fetchOEEMonthlyTrend,
  fetchOEETarget,
  fetchOEERecordsByDateRange,
  fetchOEERecordsByMonth,
  fetchShiftComparison,
  calculateBigLosses,
} from '../services/oee.service';

// ─── useOEEByMachine ──────────────────────────────────────────────────────────

interface DateRange {
  startDate: string;
  endDate: string;
}

interface UseOEEByMachineResult {
  records: OEERecord[];
  trend: OEEMonthlyAggregate[];
  loading: boolean;
  error: string | null;
}

export function useOEEByMachine(machineId: string, dateRange?: DateRange): UseOEEByMachineResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [records, setRecords] = useState<OEERecord[]>([]);
  const [trend, setTrend] = useState<OEEMonthlyAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId || !machineId) return;
    setLoading(true);

    if (dateRange) {
      fetchOEERecordsByDateRange(plantId, machineId, dateRange.startDate, dateRange.endDate)
        .then((data) => {
          setRecords(data);
          setLoading(false);
        })
        .catch((e: Error) => setError(e.message));
    } else {
      const unsub = subscribeOEERecords(
        plantId,
        machineId,
        30,
        (data) => {
          setRecords(data);
          setLoading(false);
        },
        (e) => setError(e.message)
      );
      return unsub;
    }
  }, [plantId, machineId, dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    if (!plantId || !machineId) return;
    fetchOEEMonthlyTrend(plantId, machineId, 12)
      .then(setTrend)
      .catch((e: Error) => setError(e.message));
  }, [plantId, machineId]);

  return { records, trend, loading, error };
}

// ─── useOEEDashboard ──────────────────────────────────────────────────────────

interface UseOEEDashboardResult {
  machines: MachineSummary[];
  plantAvgOEE: number | null;
  bestMachine: MachineSummary | null;
  worstMachine: MachineSummary | null;
  criticalCount: number;
  loading: boolean;
  error: string | null;
}

export function useOEEDashboard(): UseOEEDashboardResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [latestRecords, setLatestRecords] = useState<OEERecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    const unsub = subscribeAllLatestOEE(
      plantId,
      (records) => {
        setLatestRecords(records);
        setLoading(false);
      },
      (e) => setError(e.message)
    );
    return unsub;
  }, [plantId]);

  const machines = useMemo<MachineSummary[]>(() => {
    return latestRecords
      .map((r) => ({
        machineId: r.machineId,
        machineName: r.machineName,
        department: r.department ?? '—',
        latestOEE: r.oee,
        latestAvailability: r.availability,
        latestPerformance: r.performance,
        latestQuality: r.quality,
        latestRecord: r,
      }))
      .sort((a, b) => (a.latestOEE ?? 100) - (b.latestOEE ?? 100));
  }, [latestRecords]);

  const plantAvgOEE = useMemo(() => {
    if (machines.length === 0) return null;
    const sum = machines.reduce((s, m) => s + (m.latestOEE ?? 0), 0);
    return Math.round((sum / machines.length) * 10) / 10;
  }, [machines]);

  const bestMachine = useMemo(() => {
    if (machines.length === 0) return null;
    return [...machines].sort((a, b) => (b.latestOEE ?? 0) - (a.latestOEE ?? 0))[0];
  }, [machines]);

  const worstMachine = useMemo(() => machines[0] ?? null, [machines]);

  const criticalCount = useMemo(
    () => machines.filter((m) => (m.latestOEE ?? 0) < 65).length,
    [machines]
  );

  return { machines, plantAvgOEE, bestMachine, worstMachine, criticalCount, loading, error };
}

// ─── useBigLosses ─────────────────────────────────────────────────────────────

interface UseBigLossesResult {
  losses: BigLoss[];
  totalLostHours: number;
  loading: boolean;
  error: string | null;
}

export function useBigLosses(month: string, lkrPerHour = 0): UseBigLossesResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [records, setRecords] = useState<OEERecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId || !month) return;
    setLoading(true);
    fetchOEERecordsByMonth(plantId, month)
      .then((data) => {
        setRecords(data);
        setLoading(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [plantId, month]);

  const losses = useMemo(() => calculateBigLosses(records, lkrPerHour), [records, lkrPerHour]);
  const totalLostHours = useMemo(() => losses.reduce((s, l) => s + l.hours, 0), [losses]);

  return { losses, totalLostHours, loading, error };
}

// ─── useShiftComparison ───────────────────────────────────────────────────────

interface UseShiftComparisonResult {
  data: ShiftOEEComparison[];
  loading: boolean;
  error: string | null;
}

export function useShiftComparison(machineId: string, months = 3): UseShiftComparisonResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [data, setData] = useState<ShiftOEEComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId || !machineId) return;
    setLoading(true);
    fetchShiftComparison(plantId, machineId, months)
      .then((result) => {
        setData(result as ShiftOEEComparison[]);
        setLoading(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [plantId, machineId, months]);

  return { data, loading, error };
}

// ─── useOEETarget ─────────────────────────────────────────────────────────────

interface UseOEETargetResult {
  target: OEETarget | null;
  loading: boolean;
  error: string | null;
}

export function useOEETarget(machineId: string): UseOEETargetResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [target, setTarget] = useState<OEETarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId || !machineId) return;
    setLoading(true);
    fetchOEETarget(plantId, machineId)
      .then((data) => {
        setTarget(data ?? {
          machineId,
          targetOEE: 85,
          targetAvailability: 90,
          targetPerformance: 95,
          targetQuality: 99,
          lkrPerHour: 0,
        });
        setLoading(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [plantId, machineId]);

  return { target, loading, error };
}
