import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import LightAnalyticsWidget from './LightAnalyticsWidget';
import LightEmptyState from './LightEmptyState';
import { usePartsRequestReasons } from '../../../hooks/dashboard/usePartsRequestReasons';
import { CHART_COLORS_LIGHT, CHART_DEFAULTS_LIGHT } from '../../../constants/chartThemeLight';

interface TopUsedPartsChartLightProps {
  companyId: string;
  days?: number;
}

const REASON_COLORS: Record<string, string> = {
  PM: CHART_COLORS_LIGHT.primary,
  Breakdown: CHART_COLORS_LIGHT.danger,
  Other: CHART_COLORS_LIGHT.secondary,
};

export default function TopUsedPartsChartLight({ companyId, days = 30 }: TopUsedPartsChartLightProps) {
  const { data, loading, error } = usePartsRequestReasons(companyId, days);
  const hasData = data.some((d) => d.count > 0);

  return (
    <LightAnalyticsWidget title="Parts Requested By Reason" loading={loading} error={error}>
      {!hasData ? (
        <LightEmptyState message="No request data" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24 }} barCategoryGap="30%">
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS_LIGHT.xAxis} type="number" allowDecimals={false} />
              <YAxis
                {...CHART_DEFAULTS_LIGHT.yAxis}
                dataKey="reason"
                type="category"
                width={100}
              />
              <Tooltip {...CHART_DEFAULTS_LIGHT.tooltip} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((d) => (
                  <Cell key={d.reason} fill={REASON_COLORS[d.reason] ?? CHART_COLORS_LIGHT.secondary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
