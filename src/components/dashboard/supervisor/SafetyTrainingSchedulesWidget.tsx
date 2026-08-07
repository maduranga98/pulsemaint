import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAuthStore } from '../../../store/authStore';
import { useSafetyTrainingModules, getModuleSessions } from '../../../hooks/training/useSafetyTrainings';

// Upcoming safety-training sessions — replaces the standalone "Safety
// Training Schedules" nav tab supervisors used to have.
export default function SafetyTrainingSchedulesWidget() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { modules, loading } = useSafetyTrainingModules(companyId);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = modules
    .flatMap(getModuleSessions)
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
    .slice(0, 5);

  return (
    <DashboardWidget
      title="Safety Training Schedules"
      loading={loading}
      action={
        <button
          type="button"
          onClick={() => navigate('/app/safety/calendar')}
          className="text-xs text-[#00C2FF] hover:underline"
        >
          View all
        </button>
      }
    >
      {upcoming.length === 0 ? (
        <EmptyState message="No upcoming safety trainings scheduled" />
      ) : (
        <div className="space-y-2">
          {upcoming.map((s, i) => (
            <div
              key={`${s.moduleId}-${i}`}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{s.moduleTitle}</p>
                <p className="text-[11px] text-[#8BA3BF] truncate">{s.lessonTitle}</p>
              </div>
              <span className="shrink-0 text-xs text-[#8BA3BF]">
                {s.date}{s.time ? ` ${s.time}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
