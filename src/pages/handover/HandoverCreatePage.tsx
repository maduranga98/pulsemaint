import { useTranslation } from 'react-i18next';
import HandoverCreateForm from '@/components/handover/HandoverCreateForm';

export function HandoverCreatePage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className=" text-2xl font-bold text-slate-950">{t('common.shiftHandovers.createPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('common.shiftHandovers.createPage.subtitle')}</p>
      </div>
      <HandoverCreateForm />
    </div>
  );
}

export default HandoverCreatePage;
