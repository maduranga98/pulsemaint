import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KpiCardData } from '../../../types/analytics.types';
import { useCountUp } from '../../../hooks/useCountUp';

// Each tile is outlined and lettered in its own colour (set per theme in style.css: .kpi-card).
const KPI_COLORS = new Set(['green', 'amber', 'red', 'cyan', 'blue']);

interface KpiCardProps {
  data: KpiCardData;
  onClick?: () => void;
}

export default function KpiCard({ data, onClick }: KpiCardProps) {
  const { t } = useTranslation();
  const color = KPI_COLORS.has(data.color) ? data.color : 'blue';
  const numeric = typeof data.value === 'number' ? data.value : null;
  const counted = useCountUp(numeric ?? 0);
  // Whole numbers count up as integers, fractions keep their decimals.
  const shown = numeric === null ? data.value : (Number.isInteger(numeric) ? Math.round(counted) : Number(counted.toFixed(String(numeric).split('.')[1]?.length ?? 1))).toLocaleString();
  const isPositiveTrend = data.trendPositive !== false;
  const trendColor =
    data.trendDirection === 'up'
      ? isPositiveTrend
        ? 'text-[#10B981]'
        : 'text-[#EF4444]'
      : data.trendDirection === 'down'
        ? isPositiveTrend
          ? 'text-[#EF4444]'
          : 'text-[#10B981]'
        : 'text-[#8BA3BF]';

  return (
    <div
      onClick={onClick}
      data-color={color}
      className={`kpi-card bg-[#0F1E35] rounded-xl p-4 min-h-[104px] ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="kpi-ink text-[11px] font-semibold font-[DM_Sans] uppercase tracking-wide leading-snug break-words">
          {data.label}
        </p>
        {data.scope && (
          <span
            className={`shrink-0 text-[9.5px] font-bold tracking-wider ${
              data.scope === 'today' ? 'text-[#4ADE80]' : 'text-[#6C87A6]'
            }`}
          >
            {data.scope === 'today'
              ? t('common.dashboard.kpiScope.today', { defaultValue: 'TODAY' })
              : t('common.dashboard.kpiScope.mtd', { defaultValue: 'MTD' })}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
        <span className="kpi-ink text-3xl font-bold leading-none">
          {shown}
        </span>
        {data.unit && <span className="text-xs text-[#8BA3BF]">{data.unit}</span>}
      </div>
      {data.subtitle && (
        <p
          className={`mt-2 text-xs font-medium ${
            data.subtitleTone === 'red' ? 'text-[#FCA5A5]' : data.subtitleTone === 'amber' ? 'text-[#FDE68A]' : 'text-[#8BA3BF]'
          }`}
        >
          {data.subtitle}
        </p>
      )}
      {data.trend !== undefined && data.trendDirection && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          {data.trendDirection === 'up' ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : data.trendDirection === 'down' ? (
            <TrendingDown className="w-3.5 h-3.5" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
          <span>{t('common.widgets.kpiCard.trendVsLastPeriod', { trend: Math.abs(data.trend) })}</span>
        </div>
      )}
    </div>
  );
}
