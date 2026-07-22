import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { computeMonthlyAnalytics } from '../../services/analyticsAggregation';
import type { AnalyticsMonthly, ContractorPerformanceRecord } from '../../types/analytics.types';
import type { Contractor } from '../../lib/contractors/contractorTypes';

function contractorToRecord(c: Contractor): ContractorPerformanceRecord {
  return {
    contractorId: c.id,
    contractorName: c.tradeName || c.companyName || c.id,
    jobsCompleted: Number(c.totalJobsCount ?? 0),
    avgMttr: Number(c.avgMttr ?? 0),
    firstFixRate: Number(c.firstFixRate ?? 0),
    slaCompliance: Number(c.slaComplianceRate ?? 0),
    avgRating: Number(c.avgRating ?? 0),
    ratingTrend: 'stable',
  };
}

// Rank: most jobs first, then best rating, then best SLA compliance.
function rankRecords(records: ContractorPerformanceRecord[]): ContractorPerformanceRecord[] {
  return [...records].sort(
    (a, b) =>
      b.jobsCompleted - a.jobsCompleted ||
      b.avgRating - a.avgRating ||
      b.slaCompliance - a.slaCompliance,
  );
}

export function useContractorScoreboard(companyId: string, _month: string) {
  const [data, setData] = useState<AnalyticsMonthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;

    // Primary source: the contractor registry, which carries synced
    // performance metrics (jobs, ratings, SLA, first-fix) and updates live.
    const unsub = onSnapshot(
      query(collection(db, 'contractors'), where('companyId', '==', companyId)),
      async (snap) => {
        if (cancelled) return;
        const registry = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Contractor)
          .filter((c) => c.status !== 'blacklisted')
          .map(contractorToRecord);

        if (registry.length > 0) {
          setData({ contractorPerformance: rankRecords(registry) } as AnalyticsMonthly);
          setLoading(false);
          return;
        }

        // No registered contractors — fall back to aggregating raw job records.
        try {
          const result = await computeMonthlyAnalytics(companyId, 'all');
          if (!cancelled) {
            setData({ contractorPerformance: rankRecords(result.contractorPerformance) } as AnalyticsMonthly);
            setLoading(false);
          }
        } catch (err) {
          if (!cancelled) {
            setError((err as Error).message);
            setLoading(false);
          }
        }
      },
      (err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [companyId, nonce]);

  return { data, loading, error, refetch: () => setNonce((n) => n + 1) };
}
