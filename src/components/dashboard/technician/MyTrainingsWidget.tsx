import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAuthStore } from '../../../store/authStore';
import { useMyAssignments } from '../../../hooks/training/useMyAssignments';
import { useSafetyTrainingModules, isSafetyAssignment } from '../../../hooks/training/useSafetyTrainings';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  quiz_passed: 'Quiz Passed',
  quiz_failed: 'Quiz Failed',
  awaiting_practical: 'Awaiting Practical',
  expired: 'Expired',
  retraining_required: 'Retraining Required',
};

// My non-safety training assignments, excluding ones I've already been
// certified on (safety trainings get their own widget, see
// MySafetyTrainingsWidget).
export default function MyTrainingsWidget() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { moduleIds, loading: modulesLoading } = useSafetyTrainingModules(companyId);
  const { assignments, loading: assignmentsLoading } = useMyAssignments();

  const pending = assignments.filter(
    (a) => a.status !== 'certified' && !isSafetyAssignment(a, moduleIds, a.moduleId),
  );
  const loading = modulesLoading || assignmentsLoading;

  return (
    <DashboardWidget title="My Trainings" loading={loading}>
      {pending.length === 0 ? (
        <EmptyState message="No trainings in progress" />
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {pending.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
            >
              <p className="text-sm text-[#F0F4F8] truncate">{a.moduleName}</p>
              <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-[#1E3A5F] text-[#8BA3BF]">
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
