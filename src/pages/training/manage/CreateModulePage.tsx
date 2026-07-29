import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
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
  const [moduleId, setModuleId] = useState<string | undefined>(undefined);
  const [module, setModule] = useState<TrainingModule | undefined>(undefined);

  const handleSave = async (updates: Partial<TrainingModule>) => {
    if (!companyId || !userId) return;
    setIsSaving(true);
    try {
      if (!moduleId) {
        const ref = await addDoc(collection(db, 'trainingModules'), {
          ...updates,
          companyId,
          createdBy: userId,
          // This page only ever writes into the Training tab's library —
          // the trainee library has its own editor pages.
          libraryScope: 'training',
          // Respect the status chosen in the settings form, which defaults to
          // 'active' — forcing 'draft' here left modules unassignable
          // (Assign only works on 'active').
          status: updates.status ?? 'active',
          lessons: updates.lessons ?? [],
          estimatedMinutes: updates.estimatedMinutes ?? 0,
          passingScore: updates.passingScore ?? 80,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setModuleId(ref.id);
        setModule({
          id: ref.id,
          companyId,
          createdBy: userId,
          libraryScope: 'training',
          status: 'active',
          lessons: [],
          estimatedMinutes: 0,
          passingScore: 80,
          ...updates,
        } as TrainingModule);
        toast.success('Module saved.');
      } else {
        await updateDoc(doc(db, 'trainingModules', moduleId), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
        setModule((prev) => (prev ? { ...prev, ...updates } : prev));
      }
    } finally {
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
        <h1 className="font-semibold text-slate-900 text-sm">Create Training Module</h1>
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
    </div>
  );
}
