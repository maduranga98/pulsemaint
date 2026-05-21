import { ResponsiveContainer, RadialBarChart, RadialBar, Legend } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useDashboardStore } from '../../../store/dashboard.store';
import { CHART_COLORS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

interface SlaGaugeWidgetProps {
  companyId: string;
}

export default function SlaGaugeWidget({}: SlaGaugeWidgetProps) {
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const loading = useDashboardStore((s) => s.analyticsLoading);

  const rate = monthly?.overallSlaCompliance ?? 0;
  const total = monthly?.totalBreakdowns ?? 0;
  const within = Math.round((total * rate) / 100);
  const breached = total - within;

  const data = [
    { name: 'Within SLA', value: rate, fill: CHART_COLORS.success },
    { name: 'Remaining', value: 100 - rate, fill: '#1E3A5F' },
  ];

  return (
    <DashboardWidget title="SLA Compliance" loading={loading}>
      {total === 0 ? (
        <EmptyState message="No SLA data" />
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="100%"
                innerRadius="60%"
                outerRadius="100%"
                data={data}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#1E3A5F' }} />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#8BA3BF', fontFamily: 'DM Sans' }}
                  verticalAlign="bottom"
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-center -mt-4">
            <span className="text-3xl font-bold text-[#F0F4F8] font-[Sora]">{Math.round(rate)}%</span>
          </div>

          <div className="w-full mt-3 pt-3 border-t border-[#1E3A5F]/50 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[#8BA3BF]">Within SLA</span>
              <span className="text-[#10B981] font-medium">{within} ({Math.round(rate)}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8BA3BF]">Breached</span>
              <span className="text-[#EF4444] font-medium">{breached}</span>
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
