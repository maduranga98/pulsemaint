import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import TrainingModuleLibrary from '@/components/training/manager/library/TrainingModuleLibrary';
import TrainingAssignedTab from '@/components/training/manager/TrainingAssignedTab';

const CAN_AUTHOR_ROLES = ['plant_manager', 'admin', 'hr_officer', 'supervisor', 'safety_officer'];

type Tab = 'modules' | 'assigned';

/**
 * The Training tab's landing page for admins and plant managers: created
 * modules on one tab, everyone currently assigned to them on the other.
 */
export default function ModuleLibraryPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.userProfile?.role);
  const canAuthor = !!role && CAN_AUTHOR_ROLES.includes(role);
  const [tab, setTab] = useState<Tab>('modules');

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Training</h1>
        {canAuthor && (
          <button
            onClick={() => navigate('/app/training/manage/modules/new')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Create Training Module
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            { value: 'modules', label: 'Modules' },
            { value: 'assigned', label: 'Assigned' },
          ] as { value: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'modules' ? <TrainingModuleLibrary hideHeaderActions /> : <TrainingAssignedTab />}
    </div>
  );
}
