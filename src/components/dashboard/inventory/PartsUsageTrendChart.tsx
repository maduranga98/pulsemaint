import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { usePartsRequestTrend } from '../../../hooks/dashboard/usePartsRequestTrend';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface PartsUsageTrendChartProps {
  companyId: string;
}

export default function PartsUsageTrendChart({ companyId }: PartsUsageTrendChartProps) {
  const { t } = useTranslation();
  const { data, loading, error } = usePartsRequestTrend(companyId);
  const hasData = data.some((d) => d.count > 0);

  return (
    <DashboardWidget title={t('common.widgets.partsUsageTrendChart.title')} loading={loading} error={error}>
      {!hasData ? (
        <EmptyState message={t('common.widgets.partsUsageTrendChart.empty')} />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis
                {...CHART_DEFAULTS.xAxis}
                dataKey="date"
                tick={{ fontSize: 9 }}
                interval={4}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis {...CHART_DEFAULTS.yAxis} allowDecimals={false} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Line
                type="monotone"
                dataKey="count"
                name={t('common.widgets.partsUsageTrendChart.woPartRequests')}
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
