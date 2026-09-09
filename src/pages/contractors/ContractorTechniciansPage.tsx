import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContractorTechnicians } from '@/hooks/contractors/useContractorTechnicians';
import TechnicianGrid from '@/components/contractors/technicians/TechnicianGrid';

export function ContractorTechniciansPage() {
  const { t } = useTranslation();
  const { contractorId } = useParams();
  const { technicians, loading } = useContractorTechnicians(contractorId);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.techniciansPage.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('common.contractors.techniciansPage.registeredCount', { count: technicians.length })}</p>
        </div>
        <Link to={`/app/contractors/${contractorId}/technicians/new`} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{t('common.contractors.techniciansPage.actions.addTeamMember')}</Link>
      </div>
      {loading ? <div className="text-slate-500">{t('common.contractors.techniciansPage.loading')}</div> : <TechnicianGrid contractorId={contractorId} technicians={technicians} canManage />}
    </div>
  );
}

export default ContractorTechniciansPage;
