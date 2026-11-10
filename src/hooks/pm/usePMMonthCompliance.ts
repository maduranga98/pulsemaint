import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { plantConstraints } from '../../lib/plantQuery';
import { pmMonthCompliance, pmMonthKey, type PmMonthCompliance } from '../../lib/pmMonthCompliance';

/**
 * Live PM compliance for the month shown on the PM calendar, read from
 * pm_history (the calendar's own events only hold open / upcoming PMs, so
 * they can't tell how many were done). `null` while loading, when the role
 * may not read pm_history, or when the query fails — the caller hides the ring.
 */
export function usePMMonthCompliance(companyId: string, year: number, monthIndex: number): PmMonthCompliance | null {
  const [result, setResult] = useState<PmMonthCompliance | null>(null);

  useEffect(() => {
    setResult(null);
    if (!companyId) return;
    const monthKey = pmMonthKey(year, monthIndex);
    const q = query(
      collection(db, 'pm_history'),
      where('companyId', '==', companyId),
      ...plantConstraints('pm_history'),
      where('month', '==', monthKey),
    );
    return onSnapshot(
      q,
      (snap) => setResult(pmMonthCompliance(snap.docs.map((d) => d.data()), monthKey)),
      (err) => {
        console.error('PM calendar: could not load compliance', err);
        setResult(null);
      },
    );
  }, [companyId, year, monthIndex]);

  return result;
}
