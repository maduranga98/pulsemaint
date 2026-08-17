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
import DashboardWidget from '../shared/DashboardWidget';
import { usePartsRequestReasons } from '../../../hooks/dashboard/usePartsRequestReasons';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface TopUsedPartsChartProps {
  companyId: string;
}

const REASON_COLORS: Record<string, string> = {
  PM: CHART_COLORS.primary,
  Breakdown: CHART_COLORS.danger ?? CHART_COLORS.secondary,
  Other: CHART_COLORS.secondary,
};

export default function TopUsedPartsChart({ companyId }: TopUsedPartsChartProps) {
  const { t } = useTranslation();
  const { data, loading, error } = usePartsRequestReasons(companyId);
  const hasData = data.some((d) => d.count > 0);

  return (
    <DashboardWidget title={t('common.widgets.topUsedPartsChart.title')} loading={loading} error={error}>
      {!hasData ? (
        <EmptyState message={t('common.widgets.topUsedPartsChart.empty')} />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" allowDecimals={false} />
              <YAxis
                {...CHART_DEFAULTS.yAxis}
                dataKey="reason"
                type="category"
                width={90}
                tick={{ fontSize: 10 }}
              />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((d) => (
                  <Cell key={d.reason} fill={REASON_COLORS[d.reason] ?? CHART_COLORS.secondary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
