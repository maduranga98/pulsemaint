import { useTechnicianPerformance } from '../../../hooks/dashboard/useTechnicianPerformance';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';

interface Props {
  companyId: string;
  month: string;
}

export default function TeamPerformanceWidget({ companyId, month }: Props) {
  const { data, loading, error, refetch } = useTechnicianPerformance(companyId, month);
  const techs = data?.technicianPerformance ?? [];

  const totalJobs = techs.reduce((s, t) => s + t.jobsCompleted, 0);
  const avgResponse =
    techs.length > 0
      ? techs.reduce((s, t) => s + t.avgResponseMins, 0) / techs.length
      : 0;
  const avgRepair =
    techs.length > 0
      ? techs.reduce((s, t) => s + t.avgRepairHours, 0) / techs.length
      : 0;
  const avgSla =
    techs.length > 0
      ? techs.reduce((s, t) => s + t.slaCompliance, 0) / techs.length
      : 0;

  return (
    <DashboardWidget title="Team Performance" loading={loading} error={error} onRetry={refetch}>
      {techs.length === 0 ? (
        <EmptyState message="No team performance data available" />
      ) : (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCell label="WOs Completed" value={totalJobs.toString()} />
            <SummaryCell label="Avg Response" value={`${Math.round(avgResponse)}m`} />
            <SummaryCell label="Avg Repair" value={`${avgRepair.toFixed(1)}h`} />
            <SummaryCell label="SLA Compliance" value={`${Math.round(avgSla)}%`} />
          </div>

          {/* Top performers */}
          <div>
            <h4 className="text-xs font-semibold text-[#8BA3BF] uppercase tracking-wide mb-2">
              Top Performers
            </h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {[...techs]
                .sort((a, b) => b.jobsCompleted - a.jobsCompleted)
                .slice(0, 5)
                .map((t) => (
                  <div
                    key={t.techId}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0A1628] border border-[#1E3A5F]"
                  >
                    <span className="text-sm font-medium text-[#F0F4F8] truncate">
                      {t.techName}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-[#8BA3BF]">
                      <span>{t.jobsCompleted} jobs</span>
                      <span>{Math.round(t.slaCompliance)}% SLA</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-3 py-2 text-center">
      <p className="text-[10px] text-[#8BA3BF] uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-[#00C2FF] font-[Sora] mt-0.5">{value}</p>
    </div>
  );
}
