import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useDashboardStore } from '../../../store/dashboard.store';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import { complianceColor } from '../../../utils/analytics.utils';
import { usePmComplianceHistory } from '../../../hooks/dashboard/usePmComplianceHistory';
import EmptyState from '../shared/EmptyState';

interface PmComplianceWidgetProps {
  companyId: string;
}

export default function PmComplianceWidget({ companyId }: PmComplianceWidgetProps) {
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const storeLoading = useDashboardStore((s) => s.analyticsLoading);
  const { data: miniData, loading: historyLoading } = usePmComplianceHistory(companyId);

  const rate = monthly?.pmComplianceRate ?? 0;
  const color = complianceColor(rate);
  const onTime = monthly?.pmCompletedOnTime ?? 0;
  const missed = monthly?.pmMissed ?? 0;
  const loading = storeLoading || historyLoading;

  return (
    <DashboardWidget title="PM Compliance Rate" loading={loading}>
      <div className="text-center">
        <span
          className={`text-6xl font-bold font-[Sora] ${
            color === 'green' ? 'text-[#10B981]' : color === 'amber' ? 'text-[#F59E0B]' : 'text-[#EF4444]'
          }`}
        >
          {Math.round(rate)}%
        </span>
        <p className="text-xs text-[#8BA3BF] mt-1">This month</p>
      </div>

      <div className="mt-4 h-24">
        {miniData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={miniData}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="month" tick={{ fontSize: 9 }} />
              <YAxis {...CHART_DEFAULTS.yAxis} hide />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Bar dataKey="rate" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No PM data" />
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-[#1E3A5F]/50 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-[#8BA3BF]">On time</span>
          <span className="text-[#10B981] font-medium">{onTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8BA3BF]">Missed</span>
          <span className="text-[#EF4444] font-medium">{missed}</span>
        </div>
      </div>
    </DashboardWidget>
  );
}
