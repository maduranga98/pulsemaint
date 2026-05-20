import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';

export function useContractorTechnicians(contractorId: string | undefined) {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [technicians, setTechnicians] = useState<ContractorTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId || !companyId) {
      setTechnicians([]);
      setLoading(false);
      return;
    }

    const techniciansQuery = query(
      collection(db, 'contractors', contractorId, 'technicians'),
      where('companyId', '==', companyId),
      orderBy('fullName', 'asc'),
    );

    return onSnapshot(
      techniciansQuery,
      (snapshot) => {
        setTechnicians(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ContractorTechnician));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [companyId, contractorId]);

  return { technicians, loading, error };
}
