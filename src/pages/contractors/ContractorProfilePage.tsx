import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContractor } from '@/hooks/contractors/useContractor';
import { useContractorDocuments } from '@/hooks/contractors/useContractorDocuments';
import { useContractorJobs } from '@/hooks/contractors/useContractorJobs';
import { useContractorWorkOrders } from '@/hooks/contractors/useContractorWorkOrders';
import { useContractorTechnicians } from '@/hooks/contractors/useContractorTechnicians';
import { useContractorAuditRatings } from '@/hooks/contractors/useContractorAuditRatings';
import ContractorAlertBanner from '@/components/contractors/registry/ContractorAlertBanner';
import ContractorAnalyticsTab from '@/components/contractors/registry/ContractorAnalyticsTab';
import ContractorDocumentsTab from '@/components/contractors/registry/ContractorDocumentsTab';
import ContractorJobHistoryTab from '@/components/contractors/registry/ContractorJobHistoryTab';
import ContractorOverviewTab from '@/components/contractors/registry/ContractorOverviewTab';
import ContractorProfileHeader from '@/components/contractors/registry/ContractorProfileHeader';
import ContractorQuickContactBar from '@/components/contractors/registry/ContractorQuickContactBar';
import ContractorTechniciansTab from '@/components/contractors/registry/ContractorTechniciansTab';

const TABS = ['Overview', 'Documents', 'Team Members', 'Job History', 'Analytics'] as const;

export function ContractorProfilePage() {
  const { t } = useTranslation();
  const { contractorId } = useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const { contractor, loading } = useContractor(contractorId);
  const { documents } = useContractorDocuments(contractorId);
  const { technicians } = useContractorTechnicians(contractorId);
  const { jobs } = useContractorJobs({ contractorId });
  const { workOrders: contractorWorkOrders } = useContractorWorkOrders(contractorId);
  const { ratings: auditRatings } = useContractorAuditRatings(contractorId);

  const TAB_LABELS: Record<(typeof TABS)[number], string> = {
    Overview: t('common.contractors.profilePage.tabs.overview'),
    Documents: t('common.contractors.profilePage.tabs.documents'),
    'Team Members': t('common.contractors.profilePage.tabs.teamMembers'),
    'Job History': t('common.contractors.profilePage.tabs.jobHistory'),
    Analytics: t('common.contractors.profilePage.tabs.analytics'),
  };

  if (loading) return <div className="p-6 text-slate-500">{t('common.contractors.profilePage.loading')}</div>;
  if (!contractor) return <div className="p-6 text-slate-500">{t('common.contractors.profilePage.notFound')}</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <ContractorProfileHeader contractor={contractor} />
      <ContractorAlertBanner documentName={documents.find((document) => document.blocksAssignment)?.documentName} expiringCount={documents.filter((document) => document.validityStatus === 'expiring_soon').length} />
      <ContractorQuickContactBar contractor={contractor} />
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${tab === item ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            {TAB_LABELS[item]}
          </button>
        ))}
      </div>
      {tab === 'Overview' && <ContractorOverviewTab contractor={contractor} />}
      {tab === 'Documents' && <ContractorDocumentsTab documents={documents} contractorId={contractor.id} />}
      {tab === 'Team Members' && <ContractorTechniciansTab contractorId={contractor.id} technicians={technicians} />}
      {tab === 'Job History' && <ContractorJobHistoryTab jobs={jobs} workOrders={contractorWorkOrders} previouslyCompletedProjects={contractor.previouslyCompletedProjects} auditRatings={auditRatings} />}
      {tab === 'Analytics' && <ContractorAnalyticsTab contractor={contractor} jobs={jobs} />}
    </div>
  );
}

export default ContractorProfilePage;
