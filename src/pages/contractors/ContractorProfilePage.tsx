import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useContractor } from '@/hooks/contractors/useContractor';
import { useContractorDocuments } from '@/hooks/contractors/useContractorDocuments';
import { useContractorJobs } from '@/hooks/contractors/useContractorJobs';
import { useContractorTechnicians } from '@/hooks/contractors/useContractorTechnicians';
import ContractorAlertBanner from '@/components/contractors/registry/ContractorAlertBanner';
import ContractorAnalyticsTab from '@/components/contractors/registry/ContractorAnalyticsTab';
import ContractorDocumentsTab from '@/components/contractors/registry/ContractorDocumentsTab';
import ContractorJobHistoryTab from '@/components/contractors/registry/ContractorJobHistoryTab';
import ContractorOverviewTab from '@/components/contractors/registry/ContractorOverviewTab';
import ContractorProfileHeader from '@/components/contractors/registry/ContractorProfileHeader';
import ContractorQuickContactBar from '@/components/contractors/registry/ContractorQuickContactBar';
import ContractorTechniciansTab from '@/components/contractors/registry/ContractorTechniciansTab';

const TABS = ['Overview', 'Documents', 'Technicians', 'Job History', 'Analytics'] as const;

export function ContractorProfilePage() {
  const { contractorId } = useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const { contractor, loading } = useContractor(contractorId);
  const { documents } = useContractorDocuments(contractorId);
  const { technicians } = useContractorTechnicians(contractorId);
  const { jobs } = useContractorJobs({ contractorId });

  if (loading) return <div className="p-6 text-slate-500">Loading contractor...</div>;
  if (!contractor) return <div className="p-6 text-slate-500">Contractor not found.</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <ContractorProfileHeader contractor={contractor} />
      <ContractorAlertBanner documentName={documents.find((document) => document.blocksAssignment)?.documentName} expiringCount={documents.filter((document) => document.validityStatus === 'expiring_soon').length} />
      <ContractorQuickContactBar contractor={contractor} />
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${tab === item ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            {item}
          </button>
        ))}
      </div>
      {tab === 'Overview' && <ContractorOverviewTab contractor={contractor} />}
      {tab === 'Documents' && <ContractorDocumentsTab documents={documents} />}
      {tab === 'Technicians' && <ContractorTechniciansTab contractorId={contractor.id} technicians={technicians} />}
      {tab === 'Job History' && <ContractorJobHistoryTab jobs={jobs} />}
      {tab === 'Analytics' && <ContractorAnalyticsTab contractor={contractor} jobs={jobs} />}
    </div>
  );
}

export default ContractorProfilePage;
