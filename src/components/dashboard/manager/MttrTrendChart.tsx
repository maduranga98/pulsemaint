import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import ChartDateRangeSelector from '../shared/ChartDateRangeSelector';
import { useMttrTrend } from '../../../hooks/dashboard/useMttrTrend';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import type { ChartDateRange } from '../../../types/analytics.types';
import type { DashboardRange } from '../../../utils/analytics/dashboardRange';
import EmptyState from '../shared/EmptyState';

interface MttrTrendChartProps {
  companyId: string;
  /**
   * When provided, the chart follows this shared MTD/3M/6M/12M range (e.g.
   * the Analytics page's top-level filter) instead of showing its own
   * independent date-range selector.
   */
  range?: DashboardRange;
}

const SLA_TARGET_STORAGE_KEY = 'firmicore.mttrSlaTargetHours';

function loadStoredSlaTarget(): number {
  if (typeof window === 'undefined') return 4;
  const stored = Number(window.localStorage.getItem(SLA_TARGET_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : 4;
}

const DASHBOARD_TO_CHART_RANGE: Record<DashboardRange, ChartDateRange> = {
  mtd: '30D',
  '3m': '3M',
  '6m': '6M',
  '12m': '12M',
};

export default function MttrTrendChart({ companyId, range: sharedRange }: MttrTrendChartProps) {
  const [ownRange, setOwnRange] = useState<ChartDateRange>('30D');
  const range = sharedRange ? DASHBOARD_TO_CHART_RANGE[sharedRange] : ownRange;
  const { data, loading, error, refetch } = useMttrTrend(companyId, range);
  const [slaTarget, setSlaTarget] = useState<number>(loadStoredSlaTarget);
  const [slaInput, setSlaInput] = useState<string>(() => String(loadStoredSlaTarget()));

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    mttr: Number(d.mttrHours.toFixed(2)),
  }));

  function applySlaTarget() {
    const parsed = Number(slaInput);
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : slaTarget;
    setSlaTarget(next);
    setSlaInput(String(next));
    if (typeof window !== 'undefined') window.localStorage.setItem(SLA_TARGET_STORAGE_KEY, String(next));
  }

  return (
    <DashboardWidget
      title="MTTR Trend"
      loading={loading}
      error={error}
      onRetry={refetch}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[#8BA3BF]">
            SLA target
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={slaInput}
              onChange={(e) => setSlaInput(e.target.value)}
              onBlur={applySlaTarget}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applySlaTarget(); } }}
              className="w-14 rounded-md border border-[#1E3A5F] bg-[#0A1628] px-2 py-1 text-xs text-[#F0F4F8] focus:border-[#1A56DB] focus:outline-none"
            />
            h
          </label>
          {!sharedRange && <ChartDateRangeSelector value={ownRange} onChange={setOwnRange} />}
        </div>
      }
    >
      {chartData.length === 0 ? (
        <EmptyState message="No MTTR data" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="date" />
              <YAxis {...CHART_DEFAULTS.yAxis} unit="h" />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <ReferenceLine
                y={slaTarget}
                stroke="#F59E0B"
                strokeDasharray="4 4"
                label={{ value: `SLA Target (${slaTarget}h)`, fill: '#F59E0B', fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="mttr"
                stroke="#1A56DB"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1A56DB' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
