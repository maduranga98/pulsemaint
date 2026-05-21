import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTrainingModules } from '@/hooks/training/useTrainingModules';
import type { TrainingModuleStatus } from '@/lib/training/trainingTypes';
import ModuleLibraryList from '@/components/training/manager/ModuleLibraryList';

export default function ModuleLibraryPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<TrainingModuleStatus | undefined>(undefined);
  const { modules, loading } = useTrainingModules({ status: statusFilter });

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this module? It will no longer be visible to trainees.')) return;
    await updateDoc(doc(db, 'trainingModules', id), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Module Library</h1>
        <button
          onClick={() => navigate('/app/training/manage/modules/new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> New Module
        </button>
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
        onEdit={(id) => navigate(`/app/training/manage/modules/${id}`)}
        onAssign={(id) => navigate(`/app/training/manage/assign?moduleId=${id}`)}
        onArchive={handleArchive}
      />
    </div>
  );
}
