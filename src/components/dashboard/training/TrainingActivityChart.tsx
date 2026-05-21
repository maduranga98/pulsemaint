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

interface TrainingActivityChartProps {
  companyId: string;
}

export default function TrainingActivityChart({}: TrainingActivityChartProps) {
  // Placeholder data
  const data = [
    { month: 'Jan', new: 12, renewal: 5 },
    { month: 'Feb', new: 15, renewal: 8 },
    { month: 'Mar', new: 10, renewal: 6 },
    { month: 'Apr', new: 18, renewal: 10 },
    { month: 'May', new: 14, renewal: 7 },
    { month: 'Jun', new: 20, renewal: 12 },
  ];

  return (
    <DashboardWidget title="Training Activity">
      {data.length === 0 ? (
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
