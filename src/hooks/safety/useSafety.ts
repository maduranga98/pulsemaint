import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { subscribeSafetyCases, subscribeWorkPermits } from '../../services/safety.service';
import type { SafetyCase, WorkPermit } from '../../types/safety';

/** The latest Work Permit linked to a given work order, live (or null). */
export function useWorkOrderPermit(workOrderId: string | undefined) {
  const [permit, setPermit] = useState<WorkPermit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workOrderId) {
      setPermit(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'work_permits'), where('workOrderId', '==', workOrderId), limit(1)),
      (snap) => {
        setPermit(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as WorkPermit));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [workOrderId]);

  return { permit, loading };
}

/** Live safety cases for the company, newest first. */
export function useSafetyCases(companyId: string) {
  const [cases, setCases] = useState<SafetyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeSafetyCases(
      companyId,
      (next) => {
        setCases(next);
        setError(null);
        setLoading(false);
      },
      (msg) => {
        setError(msg);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  return { cases, loading, error };
}

/** Live work permits for the company, newest first. */
export function useWorkPermits(companyId: string) {
  const [permits, setPermits] = useState<WorkPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeWorkPermits(
      companyId,
      (next) => {
        setPermits(next);
        setError(null);
        setLoading(false);
      },
      (msg) => {
        setError(msg);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  return { permits, loading, error };
}

function toMillis(ts: { seconds: number } | null | undefined): number {
  return ts?.seconds ? ts.seconds * 1000 : 0;
}

/** Number of training modules with at least one lesson scheduled for `day`. */
function useSafetyTrainingsToday(companyId: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!companyId) return;
    const today = new Date().toISOString().slice(0, 10);
    const unsub = onSnapshot(
      query(collection(db, 'trainingModules'), where('companyId', '==', companyId)),
      (snap) => {
        const n = snap.docs.filter((d) => {
          const lessons = (d.data().lessons ?? []) as Array<{ scheduledDate?: string }>;
          return Array.isArray(lessons) && lessons.some((l) => l.scheduledDate === today);
        }).length;
        setCount(n);
      },
      () => setCount(0),
    );
    return () => unsub();
  }, [companyId]);
  return count;
}

export interface SafetyKpis {
  totalCases: number;
  openCases: number;
  nearMiss30d: number;
  safetyTrainingsToday: number;
  activePermits: number;
  daysSinceLastIncident: number | null;
}

/**
 * Headline numbers for the Safety Officer dashboard, derived live from safety
 * cases, work permits, and today's scheduled training.
 */
export function useSafetyKpis(companyId: string): { kpis: SafetyKpis; loading: boolean } {
  const { cases, loading: casesLoading } = useSafetyCases(companyId);
  const { permits, loading: permitsLoading } = useWorkPermits(companyId);
  const safetyTrainingsToday = useSafetyTrainingsToday(companyId);

  const kpis = useMemo<SafetyKpis>(() => {
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const nearMiss30d = cases.filter(
      (c) => c.type === 'near_miss' && now - toMillis(c.reportedAt) <= THIRTY_DAYS,
    ).length;

    // Most recent recorded incident (not near-miss/hazard), for a leading
    // "days since last incident" safety metric.
    const lastIncidentMs = cases
      .filter((c) => c.type === 'incident')
      .reduce((max, c) => Math.max(max, toMillis(c.reportedAt)), 0);
    const daysSinceLastIncident =
      lastIncidentMs > 0 ? Math.floor((now - lastIncidentMs) / (24 * 60 * 60 * 1000)) : null;

    return {
      totalCases: cases.length,
      openCases: cases.filter((c) => c.status !== 'closed').length,
      nearMiss30d,
      safetyTrainingsToday,
      activePermits: permits.filter((p) => p.status === 'active').length,
      daysSinceLastIncident,
    };
  }, [cases, permits, safetyTrainingsToday]);

  return { kpis, loading: casesLoading || permitsLoading };
}
