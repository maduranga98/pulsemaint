import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';

export function useContractorJob(jobId: string | undefined) {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [job, setJob] = useState<ContractorJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !companyId) {
      setJob(null);
      setLoading(false);
      return;
    }

    return onSnapshot(
      doc(db, 'contractorJobs', jobId),
      (snapshot) => {
        const data = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as ContractorJob) : null;
        setJob(data?.companyId === companyId ? data : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [companyId, jobId]);

  return { job, loading, error };
}
