import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

export default function CreateModulePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTraineeContext = searchParams.get('context') === 'trainee';
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
        const libraryScope = isTraineeContext ? 'trainee_management' : 'training';
        const ref = await addDoc(collection(db, 'trainingModules'), {
          ...updates,
          companyId,
          createdBy: userId,
          libraryScope,
          // Respect the status chosen in the settings form — forcing 'draft'
          // here left modules unassignable (Assign only works on 'active').
          status: updates.status ?? 'draft',
          lessons: updates.lessons ?? [],
          estimatedMinutes: updates.estimatedMinutes ?? 0,
          passingScore: updates.passingScore ?? 80,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setModuleId(ref.id);
        setModule({ id: ref.id, companyId, createdBy: userId, libraryScope, status: 'draft', lessons: [], estimatedMinutes: 0, passingScore: 80, ...updates } as TrainingModule);
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

  // The settings form itself already created/saved the module with
  // status: 'active' (and every other field) via handleSave before this
  // fires — just navigate away. No separate "fill in settings first" guard
  // needed anymore since Publish now creates the module itself if it
  // doesn't exist yet.
  const handlePublish = () => navigate(-1);

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
        <h1 className="font-semibold text-slate-900 text-sm">Create New Module</h1>
      </div>
      <ModuleEditorLayout
        module={module}
        onSave={handleSave}
        onPublish={handlePublish}
        isSaving={isSaving}
        moduleId={moduleId}
        hideCategorySection={isTraineeContext}
      />
    </div>
  );
}
