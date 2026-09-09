import { useTranslation } from 'react-i18next';
import TechnicianForm from '@/components/contractors/technicians/TechnicianForm';

export function EditTechnicianPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.editTechnicianPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('common.contractors.editTechnicianPage.subtitle')}</p>
      </div>
      <TechnicianForm />
    </div>
  );
}

export default EditTechnicianPage;
