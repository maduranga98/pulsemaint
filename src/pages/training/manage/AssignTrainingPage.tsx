import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AssignTrainingWizard from '@/components/training/manager/AssignTrainingWizard';

export default function AssignTrainingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultModuleId = searchParams.get('moduleId') ?? undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm">Assign Training</h1>
      </div>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <AssignTrainingWizard
          defaultModuleId={defaultModuleId}
          onComplete={() => navigate('/app/training/manage/assignments')}
        />
      </div>
    </div>
  );
}
