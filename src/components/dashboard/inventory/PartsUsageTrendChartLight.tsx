import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import LightAnalyticsWidget from './LightAnalyticsWidget';
import LightEmptyState from './LightEmptyState';
import { usePartsRequestTrend } from '../../../hooks/dashboard/usePartsRequestTrend';
import { CHART_COLORS_LIGHT, CHART_DEFAULTS_LIGHT } from '../../../constants/chartThemeLight';

interface PartsUsageTrendChartLightProps {
  companyId: string;
}

export default function PartsUsageTrendChartLight({ companyId }: PartsUsageTrendChartLightProps) {
  const { data, loading, error } = usePartsRequestTrend(companyId);
  const hasData = data.some((d) => d.count > 0);

  return (
    <LightAnalyticsWidget title="Parts Request Trends (Last 30 Days)" loading={loading} error={error}>
      {!hasData ? (
        <LightEmptyState message="No request activity" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis
                {...CHART_DEFAULTS_LIGHT.xAxis}
                dataKey="date"
                interval={4}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis {...CHART_DEFAULTS_LIGHT.yAxis} allowDecimals={false} />
              <Tooltip {...CHART_DEFAULTS_LIGHT.tooltip} />
              <Line
                type="monotone"
                dataKey="count"
                name="WO part requests"
                stroke={CHART_COLORS_LIGHT.primary}
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
