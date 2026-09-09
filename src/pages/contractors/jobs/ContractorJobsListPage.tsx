import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useContractorJobs } from '@/hooks/contractors/useContractorJobs';
import type { ContractorJobStatus } from '@/lib/contractors/contractorTypes';
import ContractorJobList from '@/components/contractors/jobs/ContractorJobList';

export function ContractorJobsListPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ContractorJobStatus | 'active' | 'completed' | 'all'>('active');
  const { jobs, loading } = useContractorJobs({ status });

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.jobs.listPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('common.contractors.jobs.listPage.subtitle')}</p>
      </div>
      {loading ? <div className="text-slate-500">{t('common.contractors.jobs.listPage.loading')}</div> : <ContractorJobList jobs={jobs} onStatusChange={setStatus} />}
    </div>
  );
}

export default ContractorJobsListPage;
