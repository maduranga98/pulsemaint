import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';

/** Parts cost recorded directly on the contractor job document. */
export function jobOwnPartsCost(job: Pick<ContractorJob, 'partsFromFactory' | 'partsFromContractor'>): number {
  const factory = (job.partsFromFactory ?? []).reduce((sum, part) => sum + (part.totalCost ?? 0), 0);
  const contractor = (job.partsFromContractor ?? []).reduce((sum, part) => sum + (part.estimatedCost ?? 0), 0);
  return Number((factory + contractor).toFixed(2));
}

/**
 * Live total cost of the parts consumed by a contractor job.
 *
 * Parts on a contractor job are recorded against the *work order* it belongs
 * to (`workOrders/{id}.partsUsed`, written at WO completion) — the job's own
 * `partsFromFactory` / `partsFromContractor` arrays are only populated when
 * materials are logged directly against the job. The sign-off previously read
 * `job.totalPartsCost`, a field nothing ever wrote, so the parts half of the
 * total project cost was always zero. Summing both sources fixes that and
 * keeps working whichever way the parts were recorded.
 */
export function useJobPartsCost(job: ContractorJob | null | undefined): number {
  const ownCost = job ? jobOwnPartsCost(job) : 0;
  const workOrderId = job?.workOrderId;
  const [woPartsCost, setWoPartsCost] = useState(0);

  useEffect(() => {
    if (!workOrderId) {
      setWoPartsCost(0);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'workOrders', workOrderId),
      (snap) => {
        const parts = (snap.data()?.partsUsed ?? []) as Array<{ totalCost?: number }>;
        setWoPartsCost(Number(parts.reduce((sum, p) => sum + (p.totalCost ?? 0), 0).toFixed(2)));
      },
      () => setWoPartsCost(0)
    );
    return () => unsub();
  }, [workOrderId]);

  return Number((ownCost + woPartsCost).toFixed(2));
}
