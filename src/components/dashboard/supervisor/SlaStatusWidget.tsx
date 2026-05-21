import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import { useSlaStatus } from '../../../hooks/dashboard/useSlaStatus';
import { CHART_COLORS } from '../../../constants/chartTheme';
import { formatDurationMinutes } from '../../../utils/analytics.utils';

interface SlaStatusWidgetProps {
  siteId: string;
}

export default function SlaStatusWidget({ siteId }: SlaStatusWidgetProps) {
  const { summary, loading, error } = useSlaStatus(siteId);

  const chartData = [
    { name: 'Within SLA', value: summary.withinSlaCount, color: CHART_COLORS.success },
    { name: 'At Risk', value: summary.atRiskCount, color: CHART_COLORS.warning },
    { name: 'Breached', value: summary.breachedCount, color: CHART_COLORS.danger },
  ];

  return (
    <DashboardWidget title="SLA Status" live loading={loading} error={error}>
      <div className="flex items-center gap-6">
        {/* Donut chart */}
        <div className="w-28 h-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={28}
                outerRadius={40}
                paddingAngle={3}
                stroke="none"
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[#8BA3BF]">{item.name}</span>
              </div>
              <span className="font-semibold text-[#F0F4F8]">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* At Risk list */}
      {summary.atRiskItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1E3A5F]/50">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-xs font-medium text-[#F59E0B]">At Risk</span>
          </div>
          <div className="space-y-1.5">
            {summary.atRiskItems.map((item) => (
              <div key={item.breakdownId} className="flex items-center justify-between text-[11px]">
                <span className="text-[#F0F4F8] truncate">{item.machineName}</span>
                <span className="text-[#F59E0B] shrink-0">{formatDurationMinutes(item.minutesRemaining)} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breached list */}
      {summary.breachedItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1E3A5F]/50">
          <div className="flex items-center gap-1.5 mb-2">
            <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
            <span className="text-xs font-medium text-[#EF4444]">Breached</span>
          </div>
          <div className="space-y-1.5">
            {summary.breachedItems.map((item) => (
              <div key={item.breakdownId} className="flex items-center justify-between text-[11px]">
                <span className="text-[#F0F4F8] truncate">{item.machineName}</span>
                <span className="text-[#EF4444] shrink-0">
                  {formatDurationMinutes(item.minutesOverdue)} overdue
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.withinSlaCount > 0 && summary.atRiskCount === 0 && summary.breachedCount === 0 && (
        <div className="mt-4 flex items-center gap-2 text-[#10B981]">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">All breakdowns within SLA</span>
        </div>
      )}
    </DashboardWidget>
  );
}
