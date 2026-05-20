import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorInvitation } from '@/lib/contractors/contractorTypes';

export function useContractorInvitations(contractorJobId: string | undefined) {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [invitations, setInvitations] = useState<ContractorInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorJobId || !companyId) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    return onSnapshot(
      query(
        collection(db, 'contractorInvitations'),
        where('companyId', '==', companyId),
        where('contractorJobId', '==', contractorJobId),
        orderBy('sentAt', 'desc'),
      ),
      (snapshot) => {
        setInvitations(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ContractorInvitation));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [companyId, contractorJobId]);

  return { invitations, loading, error };
}
