import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AssignTrainingWizard from '@/components/training/manager/AssignTrainingWizard';

export default function AssignTrainingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultModuleId = searchParams.get('moduleId') ?? undefined;
  const defaultTraineeId = searchParams.get('traineeId') ?? undefined;

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label={t('common.trainingShared.manager.assignWizard.pageBack')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm">{t('common.trainingShared.manager.assignWizard.pageTitle')}</h1>
      </div>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <AssignTrainingWizard
          defaultModuleId={defaultModuleId}
          defaultTraineeId={defaultTraineeId}
          onComplete={() => navigate('/app/training/manage/assignments')}
          onCancel={() => navigate(-1)}
        />
      </div>
    </div>
  );
}
