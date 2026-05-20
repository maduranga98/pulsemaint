import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorJob, ContractorJobStatus } from '@/lib/contractors/contractorTypes';

export interface UseContractorJobsOptions {
  contractorId?: string;
  status?: ContractorJobStatus | 'active' | 'completed' | 'all';
  search?: string;
}

export function useContractorJobs(options: UseContractorJobsOptions = {}) {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [allJobs, setAllJobs] = useState<ContractorJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setAllJobs([]);
      setLoading(false);
      return;
    }

    const constraints = [where('companyId', '==', companyId), orderBy('createdAt', 'desc')];
    if (options.contractorId) constraints.unshift(where('contractorId', '==', options.contractorId));

    return onSnapshot(
      query(collection(db, 'contractorJobs'), ...constraints),
      (snapshot) => {
        setAllJobs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ContractorJob));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [companyId, options.contractorId]);

  const jobs = useMemo(() => {
    const search = options.search?.trim().toLowerCase();
    return allJobs.filter((job) => {
      if (options.status && options.status !== 'all') {
        if (options.status === 'active') {
          if (['payment_processed', 'cancelled'].includes(job.status)) return false;
        } else if (options.status === 'completed') {
          if (!['payment_processed', 'signed_off'].includes(job.status)) return false;
        } else if (job.status !== options.status) return false;
      }
      if (search) {
        const haystack = [job.workOrderNumber, job.contractorName, job.machineName].join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [allJobs, options.search, options.status]);

  return { jobs, loading, error, totalCount: allJobs.length };
}
