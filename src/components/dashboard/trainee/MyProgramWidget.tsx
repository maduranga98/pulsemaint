import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useMyProgramme } from '../../../hooks/traineeProgram/useMyProgramme';
import { useMyAssignments } from '../../../hooks/training/useMyAssignments';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  certified: 'Certified',
};

// Summarizes the trainee's own programme (if one has been set up) with a
// progress bar based on how many of its assigned modules are certified —
// full detail lives on the My Program page (see MyProgramPage.tsx).
export default function MyProgramWidget() {
  const navigate = useNavigate();
  const { programme, loading } = useMyProgramme();
  const { assignments } = useMyAssignments();

  const moduleIds = programme ? new Set(programme.months.flatMap((m) => m.moduleIds)) : new Set<string>();
  const programmeAssignments = assignments.filter((a) => moduleIds.has(a.moduleId));
  const certifiedCount = programmeAssignments.filter((a) => a.status === 'certified').length;
  const totalCount = moduleIds.size;
  const pct = totalCount > 0 ? Math.round((certifiedCount / totalCount) * 100) : 0;

  return (
    <DashboardWidget
      title="My Program"
      loading={loading}
      action={
        <button
          type="button"
          onClick={() => navigate('/app/training/my-program')}
          className="text-xs text-[#00C2FF] hover:underline"
        >
          View all
        </button>
      }
    >
      {!programme ? (
        <EmptyState message="No training programme assigned yet" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#F0F4F8] truncate">
              {programme.durationMonths}-month programme
            </p>
            <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-[#1E3A5F] text-[#8BA3BF]">
              {STATUS_LABEL[programme.status] ?? programme.status}
            </span>
          </div>
          <div>
            <div className="h-2 w-full rounded-full bg-[#1E3A5F] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1A56DB] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-[#8BA3BF] mt-1.5">
              {certifiedCount} of {totalCount} modules certified ({pct}%)
            </p>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
