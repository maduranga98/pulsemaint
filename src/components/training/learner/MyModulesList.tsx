import { useNavigate } from 'react-router-dom';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import { isLearnerCompletedStatus } from '@/lib/training/assignmentStatus';
import ModuleCard from './ModuleCard';
import TrainingEmptyState from '../shared/TrainingEmptyState';

interface MyModulesListProps {
  assignments: TrainingAssignment[];
  loading: boolean;
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

// A flat list of the assignments this learner still has to act on — no
// filter tabs, and completed ones (including those awaiting a manager's
// practical sign-off) are left off entirely rather than tucked behind a
// "Completed" tab nobody needs to check.
export default function MyModulesList({ assignments, loading }: MyModulesListProps) {
  const navigate = useNavigate();
  const filtered = assignments.filter((a) => !isLearnerCompletedStatus(a.status));

  return (
    <div className="space-y-4">
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
