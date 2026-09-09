import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContractor } from '@/hooks/contractors/useContractor';
import { useContractorJobs } from '@/hooks/contractors/useContractorJobs';
import ContractorAnalyticsTab from '@/components/contractors/registry/ContractorAnalyticsTab';

export function ContractorAnalyticsPage() {
  const { t } = useTranslation();
  const { contractorId } = useParams();
  const { contractor, loading } = useContractor(contractorId);
  const { jobs } = useContractorJobs({ contractorId });

  if (loading) return <div className="p-6 text-slate-500">{t('common.contractors.analyticsPage.loading')}</div>;
  if (!contractor) return <div className="p-6 text-slate-500">{t('common.contractors.analyticsPage.notFound')}</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.analyticsPage.title', { companyName: contractor.companyName })}</h1>
      <ContractorAnalyticsTab contractor={contractor} jobs={jobs} />
    </div>
  );
}

export default ContractorAnalyticsPage;
