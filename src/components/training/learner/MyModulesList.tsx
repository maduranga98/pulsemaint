import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TrainingAssignment, AssignmentStatus } from '@/lib/training/trainingTypes';
import ModuleCard from './ModuleCard';
import TrainingEmptyState from '../shared/TrainingEmptyState';

type FilterTab = 'all' | 'in_progress' | 'not_started' | 'completed' | 'retraining';

interface MyModulesListProps {
  assignments: TrainingAssignment[];
  loading: boolean;
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'not_started', label: 'Not Started' },
  { key: 'completed', label: 'Completed' },
  { key: 'retraining', label: 'Retraining' },
];

const COMPLETED_STATUSES: AssignmentStatus[] = [
  'certified',
  'quiz_passed',
  'awaiting_practical',
];

function filterAssignments(
  assignments: TrainingAssignment[],
  tab: FilterTab
): TrainingAssignment[] {
  switch (tab) {
    case 'in_progress':
      return assignments.filter((a) => a.status === 'in_progress');
    case 'not_started':
      return assignments.filter((a) => a.status === 'not_started');
    case 'completed':
      return assignments.filter((a) => COMPLETED_STATUSES.includes(a.status));
    case 'retraining':
      return assignments.filter(
        (a) => a.isRetraining || a.status === 'retraining_required'
      );
    default:
      return assignments;
  }
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
      <div className="w-full aspect-video bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-2 bg-slate-200 rounded" />
        <div className="h-5 bg-slate-200 rounded w-1/4" />
      </div>
    </div>
  );
}

export default function MyModulesList({ assignments, loading }: MyModulesListProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const navigate = useNavigate();

  const filtered = filterAssignments(assignments, activeTab);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Filter training modules">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <TrainingEmptyState variant="no_modules" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((assignment) => (
            <ModuleCard
              key={assignment.id}
              assignment={assignment}
              onClick={() => navigate(`/app/training/my-modules/${assignment.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
