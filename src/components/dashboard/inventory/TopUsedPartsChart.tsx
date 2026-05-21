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
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

interface TopUsedPartsChartProps {
  companyId: string;
}

export default function TopUsedPartsChart({}: TopUsedPartsChartProps) {
  // Placeholder data
  const data = [
    { name: 'Bearing 6204', count: 45 },
    { name: 'V-Belt A68', count: 38 },
    { name: 'Oil Seal 25x40', count: 32 },
    { name: 'Filter Element', count: 28 },
    { name: 'Gasket Set', count: 24 },
    { name: 'Coupling Insert', count: 20 },
    { name: 'Lubricant VG68', count: 18 },
    { name: 'Switch Limit', count: 15 },
    { name: 'Relay 24V', count: 12 },
    { name: 'Hose 1/2"', count: 10 },
  ];

  return (
    <DashboardWidget title="Top 10 Most Used Parts">
      {data.length === 0 ? (
        <EmptyState message="No usage data" />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" />
              <YAxis
                {...CHART_DEFAULTS.yAxis}
                dataKey="name"
                type="category"
                width={90}
                tick={{ fontSize: 10 }}
              />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Bar dataKey="count" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
