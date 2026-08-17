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
import { useTranslation } from 'react-i18next';

interface LowStockPartsChartLightProps {
  companyId: string;
}

export default function LowStockPartsChartLight({ companyId }: LowStockPartsChartLightProps) {
  const { t } = useTranslation();
  const { parts, loading, error } = useLowStockParts(companyId);

  return (
    <LightAnalyticsWidget title={t('common.widgets.lowStockPartsChartLight.title')} loading={loading} error={error}>
      {parts.length === 0 ? (
        <LightEmptyState message={t('common.widgets.lowStockPartsChartLight.empty')} />
      ) : (
        <div style={{ height: Math.max(320, parts.length * 52) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parts} layout="vertical" margin={{ left: 0, right: 24 }} barCategoryGap="35%">
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS_LIGHT.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS_LIGHT.yAxis} dataKey="name" type="category" width={190} />
              <Tooltip
                {...CHART_DEFAULTS_LIGHT.tooltip}
                formatter={(value: number, _name, item) => [
                  t('common.widgets.lowStockPartsChartLight.belowMin', { value, current: item.payload.currentStock, min: item.payload.minStockLevel }),
                  t('common.widgets.lowStockAlertTable.deficit'),
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
