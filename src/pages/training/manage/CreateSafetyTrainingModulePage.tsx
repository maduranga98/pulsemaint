import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);
  const [isSaving, setIsSaving] = useState(false);
  // A lesson can be added/reordered/deleted (see ModuleEditorLayout) before
  // the Settings form is ever submitted — the first onSave of any kind
  // creates the Firestore doc, and every save after that must update the
  // same doc rather than creating duplicates.
  const [createdModuleId, setCreatedModuleId] = useState<string | undefined>(undefined);

  const handleSave = async (updates: Partial<TrainingModule>) => {
    if (!companyId || !userId) return;
    setIsSaving(true);
    try {
      if (createdModuleId) {
        await updateDoc(doc(db, 'trainingModules', createdModuleId), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
      } else {
        const status = updates.status ?? 'active';
        const ref = await addDoc(collection(db, 'trainingModules'), {
          ...updates,
          // Falls back to something recognizable rather than a blank title
          // that reads as "New Module" on the editor while it's mid-creation.
          title: updates.title || t('common.safetyTrainings.createPage.untitled'),
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
        setCreatedModuleId(ref.id);
      }
    } catch (err) {
      console.error('Failed to save safety training module', err);
      toast.error(t('common.safetyTrainings.toasts.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async (updates: Partial<TrainingModule>) => {
    await handleSave(updates);
    toast.success(t('common.safetyTrainings.toasts.saved'));
    navigate('/app/training/manage/safety-trainings', { replace: true });
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate('/app/training/manage/safety-trainings')}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label={t('common.safetyTrainings.createPage.backAria')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm flex-1">{t('common.safetyTrainings.createPage.title')}</h1>
      </div>
      <ModuleEditorLayout
        module={undefined}
        onSave={handleSave}
        moduleId={createdModuleId}
        editorBasePath="/app/training/manage/modules"
        renderSettings={() => (
          <ModuleSettingsForm
            defaultValues={undefined}
            onSubmit={handleSaveSettings}
            isLoading={isSaving}
            lockTrainingType={SAFETY_TRAINING_TYPE}
          />
        )}
      />
    </div>
  );
}
