import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KpiCardData } from '../../../types/analytics.types';

const COLOR_MAP: Record<string, { border: string; text: string; glow?: string }> = {
  green: { border: 'border-l-[#10B981]', text: 'text-[#10B981]' },
  amber: { border: 'border-l-[#F59E0B]', text: 'text-[#F59E0B]' },
  red: { border: 'border-l-[#EF4444]', text: 'text-[#EF4444]' },
  cyan: { border: 'border-l-[#00C2FF]', text: 'text-[#00C2FF]' },
  blue: { border: 'border-l-[#1A56DB]', text: 'text-[#1A56DB]' },
};

interface KpiCardProps {
  data: KpiCardData;
  onClick?: () => void;
}

export default function KpiCard({ data, onClick }: KpiCardProps) {
  const { t } = useTranslation();
  const colors = COLOR_MAP[data.color] ?? COLOR_MAP.blue;
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
      className={`bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 min-h-[104px] border-l-4 ${colors.border} hover:border-[#2E5A8F] transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-[#8BA3BF] font-[DM_Sans] uppercase tracking-wide leading-snug break-words">
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
        <span className={`text-3xl font-bold ${colors.text} leading-none`}>
          {typeof data.value === 'number' ? data.value.toLocaleString() : data.value}
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
