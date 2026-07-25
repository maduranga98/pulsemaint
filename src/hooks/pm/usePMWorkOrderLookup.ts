import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface PMWorkOrderLookupEntry {
  woNumber: string;
  status: string;
}

/**
 * Maps every Preventive WO for the site to its ticket number/status, so
 * PM Schedules and PM Calendar can show the real WO ticket that services a
 * schedule instead of just the schedule's own (often auto-generated) name.
 *
 * Filtered by siteId (not companyId) to match the Work Orders security
 * rules, which gate list reads on siteId.
 */
export function usePMWorkOrderLookup(siteId: string): Map<string, PMWorkOrderLookupEntry> {
  const [lookup, setLookup] = useState<Map<string, PMWorkOrderLookupEntry>>(new Map());

  useEffect(() => {
    if (!siteId) {
      setLookup(new Map());
      return;
    }

    const q = query(
      collection(db, 'workOrders'),
      where('woType', '==', 'PREVENTIVE'),
      where('siteId', '==', siteId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = new Map<string, PMWorkOrderLookupEntry>();
        snapshot.docs.forEach((d) => {
          const data = d.data() as { woNumber?: string; status?: string };
          next.set(d.id, { woNumber: data.woNumber ?? '', status: data.status ?? '' });
        });
        setLookup(next);
      },
      (err) => {
        console.error('Error fetching PM work orders for lookup:', err);
      },
    );

    return () => unsubscribe();
  }, [siteId]);

  return lookup;
}
