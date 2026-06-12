import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useTrainingCompliance } from '../../../hooks/dashboard/useTrainingCompliance';

interface TrainingActivityChartProps {
  companyId: string;
}

export default function TrainingActivityChart({ companyId }: TrainingActivityChartProps) {
  const { activity, loading, error } = useTrainingCompliance(companyId);

  const data = activity.map((m) => ({
    month: m.month,
    new: m.newCertifications,
    renewal: m.renewals,
  }));

  const hasData = data.some((d) => d.new > 0 || d.renewal > 0);

  return (
    <DashboardWidget title="Training Activity" loading={loading} error={error}>
      {!hasData ? (
        <EmptyState message="No training data" />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="month" />
              <YAxis {...CHART_DEFAULTS.yAxis} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Legend {...CHART_DEFAULTS.legend} />
              <Bar dataKey="new" name="New Certifications" stackId="a" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
              <Bar dataKey="renewal" name="Renewals" stackId="a" fill={CHART_COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
