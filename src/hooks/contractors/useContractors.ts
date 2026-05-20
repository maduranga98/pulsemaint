import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Contractor, ContractorFilters } from '@/lib/contractors/contractorTypes';

interface UseContractorsResult {
  contractors: Contractor[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  activeCount: number;
  blockedCount: number;
}

export function useContractors(filters: ContractorFilters = {}): UseContractorsResult {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [allContractors, setAllContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setAllContractors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const constraints = [where('companyId', '==', companyId), orderBy('avgRating', 'desc')];
    const unsubscribe = onSnapshot(
      query(collection(db, 'contractors'), ...constraints),
      (snapshot) => {
        setAllContractors(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Contractor));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  const contractors = useMemo(() => {
    const search = filters.search?.trim().toLowerCase();
    return allContractors.filter((contractor) => {
      if (filters.status && filters.status !== 'all' && contractor.status !== filters.status) return false;
      if (filters.minRating && contractor.avgRating < filters.minRating) return false;
      if (filters.specializationTags?.length) {
        const hasTag = filters.specializationTags.some((tag) => contractor.specializationTags.includes(tag));
        if (!hasTag) return false;
      }
      if (filters.documentStatus === 'expired' && !contractor.blocksAssignment) return false;
      if (search) {
        const haystack = [
          contractor.companyName,
          contractor.tradeName ?? '',
          contractor.registrationNumber,
          contractor.primaryContactName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [allContractors, filters]);

  return {
    contractors,
    loading,
    error,
    totalCount: allContractors.length,
    activeCount: allContractors.filter((contractor) => contractor.status === 'active').length,
    blockedCount: allContractors.filter((contractor) => contractor.blocksAssignment).length,
  };
}
