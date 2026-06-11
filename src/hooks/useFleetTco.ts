import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import {
  workOrderCost,
  REPLACEMENT_RECOMMENDATION_RATIO,
  type MachineTcoSummary,
} from './useMachineTco';

const COMPLETED_WO_STATUSES = ['COMPLETED', 'SIGNED_OFF', 'CLOSED'];

/**
 * Fleet-wide TCO ranking. Aggregates completed-WO spend per machine and joins
 * with machine purchase/replacement values. Sorted by spend ratio (then spend).
 */
export function useFleetTco() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;
  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';

  const [machines, setMachines] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !siteId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [mSnap, wSnap] = await Promise.all([
          getDocs(query(collection(db, 'machines'), where('siteId', '==', siteId))),
          getDocs(query(collection(db, 'workOrders'), where('companyId', '==', companyId))),
        ]);
        if (cancelled) return;
        setMachines(mSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setWorkOrders(wSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load fleet TCO');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, siteId]);

  const ranking = useMemo<MachineTcoSummary[]>(() => {
    const spendByMachine = new Map<string, { parts: number; labour: number; count: number }>();
    for (const wo of workOrders) {
      if (!COMPLETED_WO_STATUSES.includes(wo.status)) continue;
      const c = workOrderCost(wo);
      const cur = spendByMachine.get(wo.machineId) ?? { parts: 0, labour: 0, count: 0 };
      cur.parts += c.parts;
      cur.labour += c.labour;
      cur.count += 1;
      spendByMachine.set(wo.machineId, cur);
    }

    const rows: MachineTcoSummary[] = machines.map((m) => {
      const agg = spendByMachine.get(m.id) ?? { parts: 0, labour: 0, count: 0 };
      const cumulative = agg.parts + agg.labour;
      const replacementValue = m.replacementValue ?? null;
      const spendRatio =
        replacementValue && replacementValue > 0 ? cumulative / replacementValue : null;
      return {
        machineId: m.id,
        machineName: m.name ?? '—',
        purchasePrice: m.purchasePrice ?? null,
        replacementValue,
        cumulativeMaintenanceSpend: Math.round(cumulative),
        partsSpend: Math.round(agg.parts),
        labourSpend: Math.round(agg.labour),
        workOrderCount: agg.count,
        spendRatio,
        replacementRecommended:
          spendRatio !== null && spendRatio >= REPLACEMENT_RECOMMENDATION_RATIO,
      };
    });

    rows.sort((a, b) => {
      const ra = a.spendRatio ?? -1;
      const rb = b.spendRatio ?? -1;
      if (rb !== ra) return rb - ra;
      return b.cumulativeMaintenanceSpend - a.cumulativeMaintenanceSpend;
    });
    return rows;
  }, [machines, workOrders]);

  return { ranking, loading, error };
}
