import { useState } from 'react';
import TraineeModuleLibrary from '@/components/training/manager/library/TraineeModuleLibrary';
import AssignedProgramsTab from '@/components/training/manager/programs/AssignedProgramsTab';
import ProgramsTab from '@/components/training/manager/programs/ProgramsTab';

type Tab = 'assigned' | 'programs' | 'modules';

/**
 * Trainee Management landing page: Assigned | Programs | Modules.
 * Entirely separate from the Training tab — its own module library
 * (libraryScope 'trainee_management') and its own flat Program model
 * (a list of modules, each with its own due duration, plus one overall
 * program duration — no monthly/weekend-summary structure).
 */
export default function AssignmentsListPage() {
  const [tab, setTab] = useState<Tab>('assigned');

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Trainee Management</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            { value: 'assigned', label: 'Assigned' },
            { value: 'programs', label: 'Programs' },
            { value: 'modules', label: 'Modules' },
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

      {tab === 'assigned' && <AssignedProgramsTab />}
      {tab === 'programs' && <ProgramsTab />}
      {tab === 'modules' && <TraineeModuleLibrary />}
    </div>
  );
}
