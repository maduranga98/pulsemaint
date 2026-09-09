import { useTranslation } from 'react-i18next';
import ContractorPerformanceDashboard from '@/components/contractors/analytics/ContractorPerformanceDashboard';

export function PerformanceDashboardPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.performanceDashboardPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('common.contractors.performanceDashboardPage.subtitle')}</p>
      </div>
      <ContractorPerformanceDashboard />
    </div>
  );
}

export default PerformanceDashboardPage;
