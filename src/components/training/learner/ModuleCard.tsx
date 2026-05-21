import { Cpu } from 'lucide-react';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import TrainingStatusBadge from '../shared/TrainingStatusBadge';
import TrainingProgressBar from '../shared/TrainingProgressBar';
import ModuleTypeBadge from '../shared/ModuleTypeBadge';
import RetrainingBadge from '../shared/RetrainingBadge';

interface ModuleCardProps {
  assignment: TrainingAssignment;
  onClick?: () => void;
}

function formatDueDate(dueDate: { seconds: number } | null): {
  label: string;
  overdue: boolean;
} | null {
  if (!dueDate) return null;
  const date = new Date(dueDate.seconds * 1000);
  const now = new Date();
  const overdue = date < now;
  const label = `Due ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  return { label, overdue };
}

export default function ModuleCard({ assignment, onClick }: ModuleCardProps) {
  const dueInfo = formatDueDate(assignment.dueDate as unknown as { seconds: number } | null);

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.();
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open training module: ${assignment.moduleName}`}
    >
      {/* Cover image area (16:9) */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-blue-600 to-blue-800 overflow-hidden">
        {assignment.moduleName ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <Cpu size={40} className="text-white/30" aria-hidden="true" />
            </div>
            {/* Module name overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
              <span className="text-white text-xs font-medium truncate block">
                {assignment.machineName}
              </span>
            </div>
          </>
        ) : null}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <ModuleTypeBadge machineName={assignment.machineName} />
          <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
            {assignment.moduleName}
          </h3>
        </div>

        <div className="space-y-1.5">
          <TrainingProgressBar progress={assignment.overallProgress} showLabel />
          <p className="text-xs text-slate-500">
            {assignment.lessonsCompleted} of {assignment.totalLessons} lessons
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TrainingStatusBadge status={assignment.status} />
          {dueInfo && (
            <span
              className={`text-xs font-medium ${dueInfo.overdue ? 'text-red-600' : 'text-slate-500'}`}
              aria-label={dueInfo.label}
            >
              {dueInfo.label}
            </span>
          )}
        </div>

        {assignment.isRetraining && (
          <RetrainingBadge reason={assignment.retrainingReason} />
        )}
      </div>
    </div>
  );
}
