import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAuthStore } from '../../../store/authStore';
import { useMyAssignments } from '../../../hooks/training/useMyAssignments';
import { useSafetyTrainingModules, isSafetyAssignment } from '../../../hooks/training/useSafetyTrainings';
import { formatDate } from '../../../lib/dateUtils';

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  quiz_passed: 'Quiz Passed',
  quiz_failed: 'Quiz Failed',
  awaiting_practical: 'Awaiting Practical',
  expired: 'Expired',
  retraining_required: 'Retraining Required',
};

// Safety-training modules assigned to me, excluding ones I've already been
// certified on.
export default function MySafetyTrainingsWidget() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { moduleIds, loading: modulesLoading } = useSafetyTrainingModules(companyId);
  const { assignments, loading: assignmentsLoading } = useMyAssignments();

  // Excludes assignments whose module has since been deleted — those can
  // never actually open (they dead-end on "Module not found"), so they're
  // left off the dashboard rather than shown as a clickable item that fails.
  const pending = assignments.filter(
    (a) => a.status !== 'certified' && moduleIds.has(a.moduleId) && isSafetyAssignment(a, moduleIds, a.moduleId),
  );
  const loading = modulesLoading || assignmentsLoading;

  return (
    <DashboardWidget title="Safety Trainings Assigned to Me" loading={loading}>
      {pending.length === 0 ? (
        <EmptyState message="No safety trainings assigned" />
      ) : (
        <div className="space-y-2">
          {pending.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/app/training/my-modules/${a.id}`)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left hover:border-[#1A56DB] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{a.moduleName}</p>
                {a.dueDate && (
                  <p className={`text-[10px] mt-0.5 ${a.dueDate.toMillis() < Date.now() ? 'text-[#EF4444]' : 'text-[#8BA3BF]'}`}>
                    Due {formatDate(a.dueDate.toDate())}
                  </p>
                )}
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-[#1E3A5F] text-[#8BA3BF]">
                {a.status === 'not_started' ? 'Start' : a.status === 'in_progress' ? 'Resume' : STATUS_LABEL[a.status] ?? a.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
