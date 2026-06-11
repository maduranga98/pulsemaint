import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface CompanyTechnician {
  id: string;
  name: string;
  role: string;
}

const TECH_ROLES = ['technician', 'maintenance_supervisor', 'supervisor'];

/** Active technicians / supervisors for a company (assignment targets). */
export function useCompanyTechnicians(companyId: string | undefined) {
  const [technicians, setTechnicians] = useState<CompanyTechnician[]>([]);
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
        const list = snap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              name: data.fullName ?? data.name ?? 'Unknown',
              role: data.role ?? '',
              status: data.status ?? 'active',
            };
          })
          .filter((u) => TECH_ROLES.includes(u.role) && u.status !== 'inactive')
          .map(({ id, name, role }) => ({ id, name, role }));
        setTechnicians(list);
      } catch {
        if (!cancelled) setTechnicians([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { technicians, loading };
}
