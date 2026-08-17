import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import ChartDateRangeSelector from '../shared/ChartDateRangeSelector';
import { useBreakdownTrend } from '../../../hooks/dashboard/useBreakdownTrend';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import type { ChartDateRange } from '../../../types/analytics.types';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface BreakdownTrendChartProps {
  companyId: string;
}

export default function BreakdownTrendChart({ companyId }: BreakdownTrendChartProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<ChartDateRange>('30D');
  const { data, loading, error, refetch } = useBreakdownTrend(companyId, range);

  const chartData = data.map((d) => ({
    date: d.date.slice(5),
    opened: d.breakdownsOpened,
    closed: d.breakdownsClosed,
    critical: d.criticalBreakdowns,
  }));

  return (
    <DashboardWidget
      title={t('common.widgets.breakdownTrendChart.title')}
      loading={loading}
      error={error}
      onRetry={refetch}
      action={<ChartDateRangeSelector value={range} onChange={setRange} />}
    >
      {chartData.length === 0 ? (
        <EmptyState message={t('common.widgets.breakdownTrendChart.empty')} />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="bdOpened" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A56DB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1A56DB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bdClosed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="date" />
              <YAxis {...CHART_DEFAULTS.yAxis} allowDecimals={false} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Legend {...CHART_DEFAULTS.legend} />
              <Area
                type="monotone"
                dataKey="opened"
                name={t('common.widgets.breakdownTrendChart.opened')}
                stroke="#1A56DB"
                fill="url(#bdOpened)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="closed"
                name={t('common.widgets.breakdownTrendChart.closed')}
                stroke="#10B981"
                fill="url(#bdClosed)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="critical"
                name={t('common.widgets.breakdownTrendChart.critical')}
                stroke="#EF4444"
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
