import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../../store/authStore';
import type { AMTask, AMTaskShift, TPMMachineScore, TPMMonthlyScore, TPMPillar } from '../types/tpm.types';
import { PILLAR_META, PILLAR_WEIGHTS } from '../types/tpm.types';
import type { TPMPillarId } from '../types/tpm.types';
import {
  subscribeCurrentMonthScore,
  subscribePillarData,
  subscribeAMTasks,
  fetchMonthlyScores,
  subscribeMachineMaturity,
} from '../services/tpm.service';
import type { Timestamp } from 'firebase/firestore';

// ─── useTPMScore ──────────────────────────────────────────────────────────────

interface UseTPMScoreResult {
  composite: number | null;
  pillars: TPMPillar[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export function useTPMScore(): UseTPMScoreResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [monthlyScore, setMonthlyScore] = useState<TPMMonthlyScore | null>(null);
  const [rawPillars, setRawPillars] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

    const unsub1 = subscribeCurrentMonthScore(
      companyId,
      (score) => {
        setMonthlyScore(score);
        setLoading(false);
      },
      (e) => setError(e.message)
    );

    const unsub2 = subscribePillarData(
      companyId,
      (pillars) => setRawPillars(pillars),
      (e) => setError(e.message)
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [companyId]);

  const pillars = useMemo<TPMPillar[]>(() => {
    const pillarIds = Object.keys(PILLAR_WEIGHTS) as TPMPillarId[];
    return pillarIds.map((id) => {
      const stored = rawPillars.find((p) => (p as { id: string }).id === id) as
        | Record<string, unknown>
        | undefined;
      const scoreFromMonth = monthlyScore?.pillars?.[id] ?? null;
      const storedScore = stored?.score as number | undefined;

      return {
        id,
        name: PILLAR_META[id].name,
        icon: PILLAR_META[id].icon,
        score: storedScore ?? scoreFromMonth ?? 0,
        trend: (stored?.trend as 'up' | 'down' | 'stable') ?? 'stable',
        lastUpdated: (stored?.lastUpdated as Timestamp) ?? null,
        actionPlan: (stored?.actionPlan as string) ?? '',
        responsible: (stored?.responsible as string) ?? null,
      } satisfies TPMPillar;
    });
  }, [rawPillars, monthlyScore]);

  const lastUpdated = monthlyScore?.calculatedAt
    ? (monthlyScore.calculatedAt as Timestamp).toDate().toLocaleDateString()
    : null;

  return {
    composite: monthlyScore?.composite ?? null,
    pillars,
    loading,
    error,
    lastUpdated,
  };
}

// ─── useAMTasks ───────────────────────────────────────────────────────────────

interface GroupedTasks {
  machineId: string;
  machineName: string;
  tasks: AMTask[];
}

interface UseAMTasksResult {
  tasks: AMTask[];
  grouped: GroupedTasks[];
  overdue: AMTask[];
  compliance: number; // 0-100
  loading: boolean;
  error: string | null;
}

export function useAMTasks(date: string, shift: AMTaskShift): UseAMTasksResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [tasks, setTasks] = useState<AMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !date) return;
    setLoading(true);

    const unsub = subscribeAMTasks(
      companyId,
      date,
      shift,
      (data) => {
        setTasks(data);
        setLoading(false);
      },
      (e) => setError(e.message)
    );

    return unsub;
  }, [companyId, date, shift]);

  const grouped = useMemo<GroupedTasks[]>(() => {
    const map = new Map<string, GroupedTasks>();
    for (const task of tasks) {
      if (!map.has(task.machineId)) {
        map.set(task.machineId, {
          machineId: task.machineId,
          machineName: task.machineName,
          tasks: [],
        });
      }
      map.get(task.machineId)!.tasks.push(task);
    }
    return Array.from(map.values());
  }, [tasks]);

  const overdue = useMemo(() => tasks.filter((t) => t.status === 'overdue'), [tasks]);

  const compliance = useMemo(() => {
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.status === 'done').length;
    return Math.round((done / tasks.length) * 100);
  }, [tasks]);

  return { tasks, grouped, overdue, compliance, loading, error };
}

// ─── useTPMTrend ──────────────────────────────────────────────────────────────

interface UseTPMTrendResult {
  data: TPMMonthlyScore[];
  loading: boolean;
  error: string | null;
  daysSinceUpdate: number | null;
}

export function useTPMTrend(months = 12): UseTPMTrendResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [data, setData] = useState<TPMMonthlyScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    fetchMonthlyScores(companyId, months)
      .then((scores) => {
        setData(scores);
        setLoading(false);
      })
      .catch((e: Error) => setError(e.message));
  }, [companyId, months]);

  const daysSinceUpdate = useMemo(() => {
    if (data.length === 0) return null;
    const last = data[data.length - 1];
    if (!last.calculatedAt) return null;
    const ms = Date.now() - (last.calculatedAt as Timestamp).toDate().getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }, [data]);

  return { data, loading, error, daysSinceUpdate };
}

// ─── useMachineMaturity ───────────────────────────────────────────────────────

interface UseMachineMaturityResult {
  machines: TPMMachineScore[];
  loading: boolean;
  error: string | null;
  countByLevel: Record<number, number>;
}

export function useMachineMaturity(): UseMachineMaturityResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [machines, setMachines] = useState<TPMMachineScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

    const unsub = subscribeMachineMaturity(
      companyId,
      (data) => {
        setMachines(data);
        setLoading(false);
      },
      (e) => setError(e.message)
    );

    return unsub;
  }, [companyId]);

  const countByLevel = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const m of machines) {
      counts[m.maturityLevel] = (counts[m.maturityLevel] ?? 0) + 1;
    }
    return counts;
  }, [machines]);

  return { machines, loading, error, countByLevel };
}
