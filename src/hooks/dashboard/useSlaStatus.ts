import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Breakdown } from '../../types';
import type { SlaStatusSummary } from '../../types/analytics.types';

export function useSlaStatus(siteId: string) {
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      where('status', 'not-in', ['closed', 'resolved']),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Breakdown));
        setBreakdowns(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [siteId]);

  const summary = useMemo<SlaStatusSummary>(() => {
    const now = Date.now();
    const atRiskItems: SlaStatusSummary['atRiskItems'] = [];
    const breachedItems: SlaStatusSummary['breachedItems'] = [];

    let withinSlaCount = 0;
    let atRiskCount = 0;
    let breachedCount = 0;

    for (const b of breakdowns) {
      const deadline = b.slaDeadline?.toMillis?.();
      if (!deadline) {
        withinSlaCount++;
        continue;
      }

      const minutesRemaining = (deadline - now) / 60000;

      if (minutesRemaining < 0) {
        breachedCount++;
        breachedItems.push({
          breakdownId: b.id,
          ticketNumber: b.ticketNumber,
          machineName: b.machineName,
          minutesOverdue: Math.abs(Math.round(minutesRemaining)),
          assignedTechName: b.assignedTechnicianNames?.[0] ?? null,
        });
      } else if (minutesRemaining <= 30) {
        atRiskCount++;
        atRiskItems.push({
          breakdownId: b.id,
          ticketNumber: b.ticketNumber,
          machineName: b.machineName,
          minutesRemaining: Math.round(minutesRemaining),
          assignedTechName: b.assignedTechnicianNames?.[0] ?? null,
        });
      } else {
        withinSlaCount++;
      }
    }

    const total = breakdowns.length || 1;
    return {
      complianceRate: Math.round((withinSlaCount / total) * 100),
      withinSlaCount,
      atRiskCount,
      breachedCount,
      atRiskItems: atRiskItems.slice(0, 5),
      breachedItems: breachedItems.slice(0, 5),
    };
  }, [breakdowns]);

  return { summary, loading, error };
}
