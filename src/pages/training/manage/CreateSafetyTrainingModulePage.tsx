import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingModule } from '@/lib/training/trainingTypes';
import { SAFETY_TRAINING_TYPE } from '@/lib/training/trainingTypes';
import ModuleEditorLayout from '@/components/training/manager/ModuleEditorLayout';
import ModuleSettingsForm from '@/components/training/manager/ModuleSettingsForm';

/**
 * Template for creating a Safety Training module only — the general
 * Category and Training Type pickers are hidden and every module saved
 * here is locked to trainingType 'safety_training', so it only ever shows
 * up on the Safety Trainings page, never the general Training tab.
 */
export default function CreateSafetyTrainingModulePage() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (updates: Partial<TrainingModule>) => {
    if (!companyId || !userId) return;
    setIsSaving(true);
    try {
      const status = updates.status ?? 'active';
      const ref = await addDoc(collection(db, 'trainingModules'), {
        ...updates,
        // A lesson can be added (see ModuleEditorLayout) before the Settings
        // form is ever submitted, creating the module with no title yet —
        // falls back to something recognizable rather than a blank title
        // that reads as "New Module" on the editor this then lands on.
        title: updates.title || 'Untitled Safety Training',
        trainingType: SAFETY_TRAINING_TYPE,
        companyId,
        createdBy: userId,
        libraryScope: 'training',
        status,
        lessons: updates.lessons ?? [],
        estimatedMinutes: updates.estimatedMinutes ?? 0,
        passingScore: updates.passingScore ?? 80,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Safety training module saved. You can now add a quiz or assign it.');
      navigate(`/app/training/manage/modules/${ref.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to save safety training module', err);
      toast.error('Failed to save module. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate('/app/training/manage/safety-trainings')}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back to Safety Trainings"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm flex-1">Create Safety Training Module</h1>
      </div>
      <ModuleEditorLayout
        module={undefined}
        onSave={handleSave}
        moduleId={undefined}
        editorBasePath="/app/training/manage/modules"
        renderSettings={() => (
          <ModuleSettingsForm
            defaultValues={undefined}
            onSubmit={handleSave}
            isLoading={isSaving}
            lockTrainingType={SAFETY_TRAINING_TYPE}
          />
        )}
      />
    </div>
  );
}
