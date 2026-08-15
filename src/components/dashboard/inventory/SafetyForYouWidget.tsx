import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAssignedTasks } from '../../../hooks/dashboard/useAssignedTasks';

// Store keeper's safety picture on the dashboard, replacing the standalone
// Safety nav tab — just the trainings assigned to them and the safety cases
// that have actually been reported to them, never the whole company's feed.
export default function SafetyForYouWidget() {
  const { trainings, safetyCases, loading } = useAssignedTasks();
  const navigate = useNavigate();

  const total = trainings.length + safetyCases.length;

  return (
    <DashboardWidget title="Safety" loading={loading} action={<span className="text-xs text-[#8BA3BF]">{total} open</span>}>
      {total === 0 ? (
        <EmptyState message="Nothing safety-related pending" subMessage="Assigned trainings and cases reported to you will appear here." />
      ) : (
        <div className="space-y-4">
          {safetyCases.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                Safety Cases ({safetyCases.length})
              </p>
              <div className="space-y-1">
                {safetyCases.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate('/app/safety/cases')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {c.title} · {c.severity}
                  </button>
                ))}
              </div>
            </div>
          )}

          {trainings.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                Trainings ({trainings.length})
              </p>
              <div className="space-y-1">
                {trainings.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate('/app/training/my-modules')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {t.moduleName ?? 'Training module'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
