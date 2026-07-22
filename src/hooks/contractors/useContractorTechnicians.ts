import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';

export function useContractorTechnicians(contractorId: string | undefined) {
  const [technicians, setTechnicians] = useState<ContractorTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId) {
      setTechnicians([]);
      setLoading(false);
      return;
    }

    // Query the technicians subcollection directly (already contractor-scoped)
    // and sort client-side — avoids a composite index and surfaces techs saved
    // without a companyId field.
    return onSnapshot(
      collection(db, 'contractors', contractorId, 'technicians'),
      (snapshot) => {
        const techs = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as ContractorTechnician)
          .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? ''));
        setTechnicians(techs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [contractorId]);

  return { technicians, loading, error };
}
