import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useCategoryCounts } from '../../../hooks/dashboard/useCategoryCounts';
import type { CategoryCountRow } from '../../../services/teamPerformance.service';

const BAR_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
  '#8B5CF6',
];

interface CategoryCountChartProps {
  companyId: string;
  title: string;
  emptyMessage: string;
  barName: string;
  fetcher: (companyId: string) => Promise<CategoryCountRow[]>;
}

export default function CategoryCountChart({ companyId, title, emptyMessage, barName, fetcher }: CategoryCountChartProps) {
  const { data, loading, error, refetch } = useCategoryCounts(companyId, fetcher);

  return (
    <DashboardWidget title={title} loading={loading} error={error} onRetry={refetch}>
      {data.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS.yAxis} type="category" dataKey="category" width={140} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Bar dataKey="count" name={barName} radius={[0, 4, 4, 0]}>
                {data.map((entry, idx) => (
                  <Cell key={entry.category} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
