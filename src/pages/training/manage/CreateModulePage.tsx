import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingModule } from '@/lib/training/trainingTypes';
import ModuleEditorLayout from '@/components/training/manager/ModuleEditorLayout';
import ModuleSettingsForm from '@/components/training/manager/ModuleSettingsForm';

/** Authors a module into the Training tab's library (libraryScope 'training'). */
export default function CreateModulePage() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);
  const [isSaving, setIsSaving] = useState(false);

  // The very first save creates the module document, then we hand off to the
  // module's own Edit page. That page loads the saved module (confirming the
  // write), keeps the user in the editor — it does NOT bounce back to the
  // Training dashboard — and is where the Assign action lives, so a module can
  // be assigned immediately after it's created.
  const handleSave = async (updates: Partial<TrainingModule>) => {
    if (!companyId || !userId) return;
    setIsSaving(true);
    try {
      const status = updates.status ?? 'active';
      const ref = await addDoc(collection(db, 'trainingModules'), {
        ...updates,
        // A lesson can be added (see ModuleEditorLayout) before the Settings
        // form is ever submitted, creating the module with no title yet.
        title: updates.title || 'Untitled Module',
        companyId,
        createdBy: userId,
        // This page only ever writes into the Training tab's library —
        // the trainee library has its own editor pages.
        libraryScope: 'training',
        // Respect the status chosen in the settings form, which defaults to
        // 'active' — forcing 'draft' here left modules unassignable
        // (Assign only works on 'active').
        status,
        lessons: updates.lessons ?? [],
        estimatedMinutes: updates.estimatedMinutes ?? 0,
        passingScore: updates.passingScore ?? 80,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Module saved. You can now add a quiz or assign it.');
      navigate(`/app/training/manage/modules/${ref.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to save training module', err);
      toast.error('Failed to save module. Please try again.');
      setIsSaving(false);
    }
  };

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
        <h1 className="font-semibold text-slate-900 text-sm flex-1">Create Training Module</h1>
      </div>
      <ModuleEditorLayout
        module={undefined}
        onSave={handleSave}
        moduleId={undefined}
        editorBasePath="/app/training/manage/modules"
        renderSettings={() => (
          <ModuleSettingsForm defaultValues={undefined} onSubmit={handleSave} isLoading={isSaving} />
        )}
      />
    </div>
  );
}
