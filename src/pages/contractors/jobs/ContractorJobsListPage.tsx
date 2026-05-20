import { useState } from 'react';
import { useContractorJobs } from '@/hooks/contractors/useContractorJobs';
import type { ContractorJobStatus } from '@/lib/contractors/contractorTypes';
import ContractorJobList from '@/components/contractors/jobs/ContractorJobList';

export function ContractorJobsListPage() {
  const [status, setStatus] = useState<ContractorJobStatus | 'active' | 'completed' | 'all'>('active');
  const { jobs, loading } = useContractorJobs({ status });

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Contractor Jobs</h1>
        <p className="mt-1 text-sm text-slate-500">Track invitations, arrivals, work logs, sign-off, invoices, and ratings.</p>
      </div>
      {loading ? <div className="text-slate-500">Loading contractor jobs...</div> : <ContractorJobList jobs={jobs} onStatusChange={setStatus} />}
    </div>
  );
}

export default ContractorJobsListPage;
