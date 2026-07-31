import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useTrainingModule } from '@/hooks/training/useTrainingModule';
import type { TrainingModule } from '@/lib/training/trainingTypes';
import { isTrainingLibraryModule } from '@/lib/training/trainingTypes';
import ModuleEditorLayout from '@/components/training/manager/ModuleEditorLayout';
import ModuleSettingsForm from '@/components/training/manager/ModuleSettingsForm';
import ModuleAssignForm from '@/components/training/manager/ModuleAssignForm';

/** Edits a module in the Training tab's library. A module belonging to
 *  Trainee Management's library cannot be opened here — it has its own
 *  editor at training/manage/trainee-modules/:moduleId. */
export default function EditModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { module, loading, error } = useTrainingModule(moduleId ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const handleSave = async (updates: Partial<TrainingModule>) => {
    if (!moduleId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'trainingModules', moduleId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      toast.success('Module updated.');
    } catch (err) {
      console.error('Failed to update training module', err);
      toast.error('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };


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

  // Cross-library guard: opening a trainee-library module through the
  // Training tab's route would edit it with the wrong settings form and
  // silently rewrite its libraryScope.
  if (!isTrainingLibraryModule(module)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-600 px-6 text-center">
        <p className="font-medium">Not found in this library.</p>
        <p className="text-sm text-slate-500">
          This module belongs to the Trainee Management library. Open it from Trainee Management instead.
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
        {module.status === 'active' && (
          <button
            onClick={() => setAssigning(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shrink-0"
          >
            <UserPlus size={14} /> Assign
          </button>
        )}
        <button
          onClick={() => navigate(`/app/training/manage/modules/${moduleId}/quiz`)}
          className="text-xs text-blue-600 hover:underline shrink-0"
        >
          Quiz Builder
        </button>
      </div>
      <ModuleEditorLayout
        module={module}
        onSave={handleSave}
        moduleId={moduleId}
        editorBasePath="/app/training/manage/modules"
        renderSettings={() => (
          <ModuleSettingsForm defaultValues={module} onSubmit={handleSave} isLoading={isSaving} />
        )}
      />
      {assigning && (
        <ModuleAssignForm
          module={module}
          onClose={() => setAssigning(false)}
          onAssigned={() => setAssigning(false)}
        />
      )}
    </div>
  );
}
