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
import { useLowStockParts } from '../../../hooks/dashboard/useLowStockParts';
import { CHART_COLORS_LIGHT, CHART_DEFAULTS_LIGHT } from '../../../constants/chartThemeLight';

interface LowStockPartsChartLightProps {
  companyId: string;
}

export default function LowStockPartsChartLight({ companyId }: LowStockPartsChartLightProps) {
  const { parts, loading, error } = useLowStockParts(companyId);

  return (
    <LightAnalyticsWidget title="Low Stock Parts" loading={loading} error={error}>
      {parts.length === 0 ? (
        <LightEmptyState message="All stock levels healthy" />
      ) : (
        <div style={{ height: Math.max(256, parts.length * 32) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parts} layout="vertical" margin={{ left: 0, right: 24 }} barCategoryGap="30%">
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS_LIGHT.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS_LIGHT.yAxis} dataKey="name" type="category" width={100} />
              <Tooltip
                {...CHART_DEFAULTS_LIGHT.tooltip}
                formatter={(value: number, _name, item) => [
                  `${value} below min (${item.payload.currentStock}/${item.payload.minStockLevel})`,
                  'Deficit',
                ]}
              />
              <Bar dataKey="deficit" radius={[0, 4, 4, 0]}>
                {parts.map((p) => (
                  <Cell key={p.partId} fill={p.currentStock === 0 ? CHART_COLORS_LIGHT.danger : CHART_COLORS_LIGHT.warning} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
