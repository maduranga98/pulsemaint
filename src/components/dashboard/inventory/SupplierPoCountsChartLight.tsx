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
import { useSupplierPoCounts } from '../../../hooks/dashboard/useSupplierPoCounts';
import { CHART_COLORS_LIGHT, CHART_DEFAULTS_LIGHT } from '../../../constants/chartThemeLight';
import { useTranslation } from 'react-i18next';

interface SupplierPoCountsChartLightProps {
  companyId: string;
  days?: number;
}

export default function SupplierPoCountsChartLight({ companyId, days = 30 }: SupplierPoCountsChartLightProps) {
  const { t } = useTranslation();
  const { suppliers, loading, error } = useSupplierPoCounts(companyId, days);

  return (
    <LightAnalyticsWidget title={t('common.widgets.supplierPoCountsChartLight.title')} loading={loading} error={error}>
      {suppliers.length === 0 ? (
        <LightEmptyState message={t('common.widgets.supplierPoCountsChartLight.empty')} />
      ) : (
        <div style={{ height: Math.max(320, suppliers.length * 52) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={suppliers} layout="vertical" margin={{ left: 0, right: 24 }} barCategoryGap="35%">
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS_LIGHT.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS_LIGHT.yAxis} dataKey="supplierName" type="category" width={190} />
              <Tooltip {...CHART_DEFAULTS_LIGHT.tooltip} />
              <Bar dataKey="count" name={t('common.widgets.supplierPoCountsChartLight.purchaseOrders')} fill={CHART_COLORS_LIGHT.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
