import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useCategoryStatusCounts } from '../../../hooks/dashboard/useCategoryStatusCounts';
import type { CategoryStatusRow, DateRange } from '../../../services/teamPerformance.service';

interface CategoryStatusChartProps {
  companyId: string;
  title: string;
  emptyMessage: string;
  fetcher: (companyId: string, dateRange?: DateRange | null) => Promise<CategoryStatusRow[]>;
  dateRange?: DateRange | null;
}

// Grouped Ongoing-vs-Completed bars per category, for the Trainings /
// Audits / Evaluations tabs — replaces the old single-series "count by
// category" chart with a status breakdown for each category.
export default function CategoryStatusChart({ companyId, title, emptyMessage, fetcher, dateRange }: CategoryStatusChartProps) {
  const { data, loading, error, refetch } = useCategoryStatusCounts(companyId, fetcher, dateRange);
  const hasData = data.some((d) => d.ongoing > 0 || d.completed > 0);

  return (
    <DashboardWidget title={title} loading={loading} error={error} onRetry={refetch}>
      {!hasData ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS.yAxis} type="category" dataKey="category" width={140} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Legend {...CHART_DEFAULTS.legend} />
              <Bar dataKey="ongoing" name="Ongoing" fill={CHART_COLORS.warning} radius={[0, 4, 4, 0]} />
              <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.success} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
