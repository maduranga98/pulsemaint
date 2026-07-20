import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useTrainingModules } from '@/hooks/training/useTrainingModules';
import { sampleTrainingModules } from '@/lib/training/sampleTrainingModules';
import type { TrainingModuleStatus } from '@/lib/training/trainingTypes';
import ModuleLibraryList from '@/components/training/manager/ModuleLibraryList';

const CAN_AUTHOR_ROLES = ['plant_manager', 'admin', 'hr_officer'];

export default function ModuleLibraryPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.userProfile?.role);
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);
  const canAuthor = !!role && CAN_AUTHOR_ROLES.includes(role);
  const [statusFilter, setStatusFilter] = useState<TrainingModuleStatus | undefined>(undefined);
  const [seeding, setSeeding] = useState(false);
  const { modules, loading } = useTrainingModules({ status: statusFilter });

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this module? It will no longer be visible to trainees.')) return;
    await updateDoc(doc(db, 'trainingModules', id), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this module permanently? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'trainingModules', id));
  };

  const handleLoadSamples = async () => {
    if (!companyId || !userId) return;
    setSeeding(true);
    try {
      for (const sample of sampleTrainingModules()) {
        await addDoc(collection(db, 'trainingModules'), {
          ...sample,
          companyId,
          createdBy: userId,
          status: 'active',
          machineId: null,
          machineTypeId: null,
          coverImageUrl: '',
          version: 1,
          prerequisiteModuleIds: [],
          usageCount: 0,
          completionCount: 0,
          updatedBy: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-xl font-bold text-slate-900">Module Library</h1>
        {canAuthor && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleLoadSamples()}
              disabled={seeding}
              className="flex items-center gap-2 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Sparkles size={16} /> {seeding ? 'Loading…' : 'Load Sample Modules'}
            </button>
            <button
              onClick={() => navigate('/app/training/manage/modules/new')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} /> New Module
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'draft', 'archived'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === 'all' ? undefined : (s as TrainingModuleStatus))}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              (statusFilter ?? 'all') === s
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <ModuleLibraryList
        modules={modules}
        loading={loading}
        canAuthor={canAuthor}
        onEdit={(id) => navigate(`/app/training/manage/modules/${id}`)}
        onAssign={(id) => navigate(`/app/training/manage/assign?moduleId=${id}`)}
        onArchive={handleArchive}
        onDelete={(id) => void handleDelete(id)}
      />
    </div>
  );
}
