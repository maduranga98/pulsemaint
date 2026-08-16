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

interface SupplierPoCountsChartLightProps {
  companyId: string;
  days?: number;
}

export default function SupplierPoCountsChartLight({ companyId, days = 30 }: SupplierPoCountsChartLightProps) {
  const { suppliers, loading, error } = useSupplierPoCounts(companyId, days);

  return (
    <LightAnalyticsWidget title="Purchase Orders By Supplier" loading={loading} error={error}>
      {suppliers.length === 0 ? (
        <LightEmptyState message="No purchase orders in this period" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={suppliers} layout="vertical" margin={{ left: 90 }} barCategoryGap="30%">
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS_LIGHT.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS_LIGHT.yAxis} dataKey="supplierName" type="category" width={100} />
              <Tooltip {...CHART_DEFAULTS_LIGHT.tooltip} />
              <Bar dataKey="count" name="Purchase orders" fill={CHART_COLORS_LIGHT.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
