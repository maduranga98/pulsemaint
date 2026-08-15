import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import LightAnalyticsWidget from './LightAnalyticsWidget';
import LightEmptyState from './LightEmptyState';
import { useTopMovedParts } from '../../../hooks/dashboard/useTopMovedParts';
import { CHART_COLORS_LIGHT, CHART_DEFAULTS_LIGHT } from '../../../constants/chartThemeLight';

interface MostMovedPartsChartLightProps {
  companyId: string;
}

export default function MostMovedPartsChartLight({ companyId }: MostMovedPartsChartLightProps) {
  const { parts, loading, error } = useTopMovedParts(companyId);

  return (
    <LightAnalyticsWidget title="Most Moved Parts (Last 30 Days)" loading={loading} error={error}>
      {parts.length === 0 ? (
        <LightEmptyState message="No usage data" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parts} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS_LIGHT.xAxis} type="number" allowDecimals={false} />
              <YAxis
                {...CHART_DEFAULTS_LIGHT.yAxis}
                dataKey="name"
                type="category"
                width={100}
              />
              <Tooltip {...CHART_DEFAULTS_LIGHT.tooltip} />
              <Bar dataKey="count" name="Units issued" fill={CHART_COLORS_LIGHT.secondary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
