import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../../store/authStore';
import type {
  AuditZone,
  FiveSAudit,
  CorrectiveAction,
  AuditDraft,
} from '../types/fives.types';
import {
  subscribeZones,
  subscribeAudits,
  subscribeCorrectiveActions,
  fetchAuditsByDateRange,
  loadDraft,
} from '../services/fives.service';

// ─── useAuditZones ────────────────────────────────────────────────────────────

interface UseAuditZonesResult {
  zones: AuditZone[];
  loading: boolean;
  error: string | null;
}

export function useAuditZones(): UseAuditZonesResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [zones, setZones] = useState<AuditZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    const unsub = subscribeZones(
      plantId,
      (data) => {
        setZones(data);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [plantId]);

  return { zones, loading, error };
}

// ─── useAuditHistory ──────────────────────────────────────────────────────────

interface DateRange {
  startDate: string;
  endDate: string;
}

interface UseAuditHistoryResult {
  audits: FiveSAudit[];
  loading: boolean;
  error: string | null;
}

export function useAuditHistory(
  zoneId: string | null,
  dateRange?: DateRange,
): UseAuditHistoryResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [audits, setAudits] = useState<FiveSAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);

    if (zoneId && dateRange) {
      fetchAuditsByDateRange(plantId, zoneId, dateRange.startDate, dateRange.endDate)
        .then((data) => {
          setAudits(data);
          setLoading(false);
        })
        .catch((e: Error) => {
          setError(e.message);
          setLoading(false);
        });
      return;
    }

    const unsub = subscribeAudits(
      plantId,
      zoneId,
      100,
      (data) => {
        setAudits(data);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [plantId, zoneId, dateRange?.startDate, dateRange?.endDate]);

  return { audits, loading, error };
}

// ─── useZoneTrend ─────────────────────────────────────────────────────────────

interface MonthlyScore {
  month: string;
  overallScore: number;
  sort: number;
  set_in_order: number;
  shine: number;
  standardize: number;
  sustain: number;
}

export function useZoneTrend(
  zoneId: string | null,
  months: number = 12,
): { trend: MonthlyScore[]; loading: boolean } {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [allAudits, setAllAudits] = useState<FiveSAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!plantId || !zoneId) return;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = new Date().toISOString().split('T')[0];

    const unsub = subscribeAudits(
      plantId,
      zoneId,
      200,
      (data) => {
        setAllAudits(data.filter((a) => a.auditDate >= startStr && a.auditDate <= endStr));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [plantId, zoneId, months]);

  const trend = useMemo<MonthlyScore[]>(() => {
    const byMonth: Record<string, FiveSAudit[]> = {};

    allAudits.forEach((a) => {
      const mo = a.auditDate.slice(0, 7);
      if (!byMonth[mo]) byMonth[mo] = [];
      byMonth[mo].push(a);
    });

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, audits]) => {
        const avg = (key: string) => {
          const vals = audits.map((a) => (a.pillarScores as Record<string, number>)[key] ?? 0);
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        };
        const overall = audits.reduce((a, b) => a + b.overallScore, 0) / audits.length;
        return {
          month,
          overallScore: Math.round(overall),
          sort: Number(avg('sort').toFixed(1)),
          set_in_order: Number(avg('set_in_order').toFixed(1)),
          shine: Number(avg('shine').toFixed(1)),
          standardize: Number(avg('standardize').toFixed(1)),
          sustain: Number(avg('sustain').toFixed(1)),
        };
      });
  }, [allAudits]);

  return { trend, loading };
}

// ─── useFactoryScore ──────────────────────────────────────────────────────────

export function useFactoryScore(): { score: number; loading: boolean } {
  const { zones, loading } = useAuditZones();

  const score = useMemo(() => {
    const scores = zones
      .map((z) => z.lastAuditScore)
      .filter((s): s is number => s !== null && s !== undefined);
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [zones]);

  return { score, loading };
}

// ─── useCorrectiveActions ─────────────────────────────────────────────────────

interface CAFilters {
  zoneId?: string;
  status?: string;
  assignedTo?: string;
  overdueOnly?: boolean;
}

interface UseCorrectiveActionsResult {
  actions: CorrectiveAction[];
  loading: boolean;
  error: string | null;
}

export function useCorrectiveActions(filters: CAFilters = {}): UseCorrectiveActionsResult {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);

    const { overdueOnly, ...fsFilters } = filters;
    const unsub = subscribeCorrectiveActions(
      plantId,
      fsFilters,
      (data) => {
        let filtered = data;
        if (overdueOnly) {
          const today = new Date().toISOString().split('T')[0];
          filtered = data.filter(
            (a) => a.status !== 'closed' && a.dueDate < today,
          );
        }
        setActions(filtered);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [plantId, filters.zoneId, filters.status, filters.assignedTo, filters.overdueOnly]);

  return { actions, loading, error };
}

// ─── useActiveAudit ───────────────────────────────────────────────────────────

export function useActiveAudit(): AuditDraft | null {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  if (!plantId) return null;
  return loadDraft(plantId);
}
