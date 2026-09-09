import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContractorJob, ContractorJobStatus } from '@/lib/contractors/contractorTypes';
import ContractorJobCard from './ContractorJobCard';
import ContractorJobRow from './ContractorJobRow';

interface ContractorJobListProps {
  jobs: ContractorJob[];
  onStatusChange?: (status: ContractorJobStatus | 'active' | 'completed' | 'all') => void;
}

const TAB_VALUES: Array<ContractorJobStatus | 'active' | 'completed' | 'all'> = [
  'active',
  'invitation_sent',
  'work_in_progress',
  'checklist_complete',
  'invoice_submitted',
  'completed',
  'cancelled',
];

export function ContractorJobList({ jobs, onStatusChange }: ContractorJobListProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<ContractorJobStatus | 'active' | 'completed' | 'all'>('active');

  const setTab = (value: ContractorJobStatus | 'active' | 'completed' | 'all') => {
    setActive(value);
    onStatusChange?.(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {TAB_VALUES.map((value) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${active === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            {t(`common.contractors.jobs.jobList.tabs.${value}`)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:hidden">
        {jobs.map((job) => <ContractorJobCard key={job.id} job={job} />)}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.wo')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.contractor')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.machine')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.priority')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.status')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.invited')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.onSite')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.rating')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.invoice')}</th>
              <th className="px-4 py-3">{t('common.contractors.jobs.jobList.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => <ContractorJobRow key={job.id} job={job} />)}
          </tbody>
        </table>
      </div>
      {!jobs.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">{t('common.contractors.jobs.jobList.empty')}</div>}
    </div>
  );
}

export default ContractorJobList;
