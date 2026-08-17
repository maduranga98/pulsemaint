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
import { useTranslation } from 'react-i18next';

interface TrainingActivityChartProps {
  companyId: string;
}

export default function TrainingActivityChart({ companyId }: TrainingActivityChartProps) {
  const { t } = useTranslation();
  const { activity, loading, error } = useTrainingCompliance(companyId);

  const data = activity.map((m) => ({
    month: m.month,
    new: m.newCertifications,
    renewal: m.renewals,
  }));

  const hasData = data.some((d) => d.new > 0 || d.renewal > 0);

  return (
    <DashboardWidget title={t('common.widgets.trainingActivityChart.title')} loading={loading} error={error}>
      {!hasData ? (
        <EmptyState message={t('common.widgets.trainingActivityChart.empty')} />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="month" />
              <YAxis {...CHART_DEFAULTS.yAxis} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Legend {...CHART_DEFAULTS.legend} />
              <Bar dataKey="new" name={t('common.widgets.trainingActivityChart.newCertifications')} stackId="a" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
              <Bar dataKey="renewal" name={t('common.widgets.trainingActivityChart.renewals')} stackId="a" fill={CHART_COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
