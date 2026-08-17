import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useTopMovedParts } from '../../../hooks/dashboard/useTopMovedParts';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface MostMovedPartsChartProps {
  companyId: string;
}

export default function MostMovedPartsChart({ companyId }: MostMovedPartsChartProps) {
  const { t } = useTranslation();
  const { parts, loading, error } = useTopMovedParts(companyId);

  return (
    <DashboardWidget title={t('common.widgets.mostMovedPartsChart.title')} loading={loading} error={error}>
      {parts.length === 0 ? (
        <EmptyState message={t('common.widgets.mostMovedPartsChart.empty')} />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parts} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" allowDecimals={false} />
              <YAxis
                {...CHART_DEFAULTS.yAxis}
                dataKey="name"
                type="category"
                width={90}
                tick={{ fontSize: 10 }}
              />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Bar dataKey="count" name={t('common.widgets.mostMovedPartsChart.unitsIssued')} fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
