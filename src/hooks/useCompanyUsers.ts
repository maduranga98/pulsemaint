import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CompanyUser {
  id: string;
  name: string;
  role: string;
}

/** All active users of a company — used for @mention autocomplete. */
export function useCompanyUsers(companyId: string | undefined) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', companyId)),
        );
        if (cancelled) return;
        setUsers(
          snap.docs
            .map((d) => {
              const data = d.data() as any;
              return {
                id: d.id,
                name: data.fullName ?? data.name ?? 'Unknown',
                role: data.role ?? '',
                status: data.status ?? 'active',
              };
            })
            .filter((u) => u.status !== 'inactive')
            .map(({ id, name, role }) => ({ id, name, role })),
        );
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { users, loading };
}
