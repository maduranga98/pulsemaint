import { useState } from 'react';
import type { ContractorJob, ContractorJobStatus } from '@/lib/contractors/contractorTypes';
import ContractorJobCard from './ContractorJobCard';
import ContractorJobRow from './ContractorJobRow';

interface ContractorJobListProps {
  jobs: ContractorJob[];
  onStatusChange?: (status: ContractorJobStatus | 'active' | 'completed' | 'all') => void;
}

const TABS: Array<{ label: string; value: ContractorJobStatus | 'active' | 'completed' | 'all' }> = [
  { label: 'Active', value: 'active' },
  { label: 'Invitation Sent', value: 'invitation_sent' },
  { label: 'In Progress', value: 'work_in_progress' },
  { label: 'Awaiting Sign-Off', value: 'checklist_complete' },
  { label: 'Invoice Pending', value: 'invoice_submitted' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export function ContractorJobList({ jobs, onStatusChange }: ContractorJobListProps) {
  const [active, setActive] = useState<ContractorJobStatus | 'active' | 'completed' | 'all'>('active');

  const setTab = (value: ContractorJobStatus | 'active' | 'completed' | 'all') => {
    setActive(value);
    onStatusChange?.(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.value} type="button" onClick={() => setTab(tab.value)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${active === tab.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            {tab.label}
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
              <th className="px-4 py-3">WO</th>
              <th className="px-4 py-3">Contractor</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Invited</th>
              <th className="px-4 py-3">On-site</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => <ContractorJobRow key={job.id} job={job} />)}
          </tbody>
        </table>
      </div>
      {!jobs.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No contractor jobs found.</div>}
    </div>
  );
}

export default ContractorJobList;
