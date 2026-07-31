import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { subscribeSafetyCases, subscribeWorkPermits } from '../../services/safety.service';
import type { SafetyCase, WorkPermit } from '../../types/safety';

/**
 * The Work Permit gating a given work order, live (or null).
 *
 * Matches every permit linked to the WO by `workOrderId` (not just one) and
 * surfaces the one that actually gates the job — an `active` permit wins over a
 * closed/expired one, so a WO that has been signed off once and re-permitted
 * still shows its live permit. `limit(1)` with no ordering used to return an
 * arbitrary permit, which could hand back a closed one (or miss the active one
 * entirely) and leave the start gate insisting no permit exists.
 */
export function useWorkOrderPermit(
  workOrderId: string | undefined,
  workPermitId?: string | null,
) {
  const [byWorkOrder, setByWorkOrder] = useState<WorkPermit[]>([]);
  const [byId, setById] = useState<WorkPermit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workOrderId) {
      setByWorkOrder([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'work_permits'), where('workOrderId', '==', workOrderId)),
      (snap) => {
        setByWorkOrder(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkPermit)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [workOrderId]);

  // Fallback link: the WO stores the id of the permit it was gated on. This
  // covers a permit whose `workOrderId` field was never written (older data),
  // so the start gate still finds it.
  useEffect(() => {
    if (!workPermitId) {
      setById(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'work_permits', workPermitId),
      (snap) => setById(snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkPermit) : null),
      () => setById(null),
    );
    return () => unsub();
  }, [workPermitId]);

  const all = byId ? [byId, ...byWorkOrder.filter((p) => p.id !== byId.id)] : byWorkOrder;
  const permit = all.find((p) => p.status === 'active') ?? all[0] ?? null;

  // Every permit linked to the WO — those attached when the WO was created and
  // those raised later from the Work Permits tab with this WO selected. Active
  // permits first, then the rest newest-ish (their query order). `permit` stays
  // the single gating permit used by the start-gate.
  const permits = [...all].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === 'active' ? -1 : b.status === 'active' ? 1 : 0;
  });

  return { permit, permits, loading };
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
