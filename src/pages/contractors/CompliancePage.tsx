import { useTranslation } from 'react-i18next';
import { useDocumentCompliance } from '@/hooks/contractors/useDocumentCompliance';
import BlockedContractorList from '@/components/contractors/analytics/BlockedContractorList';
import ComplianceMatrix from '@/components/contractors/analytics/ComplianceMatrix';
import ExpiryAlertList from '@/components/contractors/analytics/ExpiryAlertList';

export function CompliancePage() {
  const { t } = useTranslation();
  const { contractors, documents, summary, loading } = useDocumentCompliance();

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.compliancePage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('common.contractors.compliancePage.subtitle')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.compliancePage.stats.totalContractors')}</p><p className="text-2xl font-bold">{summary.totalContractors}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.compliancePage.stats.fullyValid')}</p><p className="text-2xl font-bold">{summary.fullyValid}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.compliancePage.stats.expiringDocs')}</p><p className="text-2xl font-bold">{summary.expiringCount}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.compliancePage.stats.blocked')}</p><p className="text-2xl font-bold">{summary.blockedCount}</p></div>
      </div>
      {loading ? <div className="text-slate-500">{t('common.contractors.compliancePage.loading')}</div> : (
        <>
          <BlockedContractorList documents={summary.blockingDocuments} />
          <ExpiryAlertList documents={summary.expiringDocuments} />
          <ComplianceMatrix contractors={contractors} documents={documents} />
        </>
      )}
    </div>
  );
}

export default CompliancePage;
