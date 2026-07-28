import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTrainingModule } from '@/hooks/training/useTrainingModule';
import type { TrainingModule } from '@/lib/training/trainingTypes';
import { isTraineeLibraryModule } from '@/lib/training/trainingTypes';
import ModuleEditorLayout from '@/components/training/manager/ModuleEditorLayout';
import TraineeModuleSettingsForm from '@/components/training/manager/TraineeModuleSettingsForm';

/** Edits a module in Trainee Management's library. A Training-tab module
 *  cannot be opened here — it has its own editor at
 *  training/manage/modules/:moduleId. */
export default function EditTraineeModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { module, loading, error } = useTrainingModule(moduleId ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (updates: Partial<TrainingModule>) => {
    if (!moduleId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'trainingModules', moduleId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = () => navigate(-1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-600">
        <p className="font-medium">Module not found.</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline text-sm">
          Back
        </button>
      </div>
    );
  }

  // Cross-library guard — see EditModulePage for the mirror case.
  if (!isTraineeLibraryModule(module)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-600 px-6 text-center">
        <p className="font-medium">Not found in this library.</p>
        <p className="text-sm text-slate-500">
          This module belongs to the Training library. Open it from the Training tab instead.
        </p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline text-sm">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm truncate flex-1">{module.title}</h1>
        <button
          onClick={() => navigate(`/app/training/manage/trainee-modules/${moduleId}/quiz`)}
          className="text-xs text-blue-600 hover:underline shrink-0"
        >
          Quiz Builder
        </button>
      </div>
      <ModuleEditorLayout
        module={module}
        onSave={handleSave}
        onPublish={handlePublish}
        isSaving={isSaving}
        moduleId={moduleId}
        editorBasePath="/app/training/manage/trainee-modules"
        renderSettings={(ref) => (
          <TraineeModuleSettingsForm ref={ref} defaultValues={module} onSubmit={handleSave} isLoading={isSaving} />
        )}
      />
    </div>
  );
}
