import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Every existing training module id for the company, across both module
 * libraries — used to filter out assignments whose module has since been
 * deleted (a stale/orphaned assignment can't actually be opened; clicking
 * it just dead-ends on "Module not found").
 */
export function useCompanyModuleIds(companyId: string | undefined) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'trainingModules'), where('companyId', '==', companyId)),
      (snap) => {
        setIds(new Set(snap.docs.map((d) => d.id)));
        setLoading(false);
      },
      () => {
        setIds(new Set());
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  return { moduleIds: useMemo(() => ids, [ids]), loading };
}
