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
import { usePoReceiptQuality } from '../../../hooks/dashboard/usePoReceiptQuality';
import { CHART_COLORS_LIGHT, CHART_DEFAULTS_LIGHT } from '../../../constants/chartThemeLight';

interface PoReceiptQualityChartLightProps {
  companyId: string;
  days?: number;
}

const CONDITION_COLORS: Record<string, string> = {
  Good: CHART_COLORS_LIGHT.success,
  Damaged: CHART_COLORS_LIGHT.danger,
  'Wrong Item': CHART_COLORS_LIGHT.warning,
};

export default function PoReceiptQualityChartLight({ companyId, days = 30 }: PoReceiptQualityChartLightProps) {
  const { data, loading, error } = usePoReceiptQuality(companyId, days);
  const hasData = data.some((d) => d.quantity > 0);

  return (
    <LightAnalyticsWidget title="Parts Received: Good vs Rejected/Damaged" loading={loading} error={error}>
      {!hasData ? (
        <LightEmptyState message="No receipts recorded in this period" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0 }} barCategoryGap="30%">
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS_LIGHT.xAxis} dataKey="condition" />
              <YAxis {...CHART_DEFAULTS_LIGHT.yAxis} allowDecimals={false} />
              <Tooltip {...CHART_DEFAULTS_LIGHT.tooltip} />
              <Bar dataKey="quantity" name="Units received" radius={[4, 4, 0, 0]}>
                {data.map((d) => (
                  <Cell key={d.condition} fill={CONDITION_COLORS[d.condition] ?? CHART_COLORS_LIGHT.secondary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
