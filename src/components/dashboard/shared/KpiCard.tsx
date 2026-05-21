import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
      className={`bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 border-l-4 ${colors.border} hover:border-[#2E5A8F] transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <p className="text-xs font-medium text-[#8BA3BF] font-[DM_Sans] uppercase tracking-wide">
        {data.label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`text-4xl font-bold ${colors.text} font-[Sora] leading-none`}
          style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}
        >
          {typeof data.value === 'number' ? data.value.toLocaleString() : data.value}
        </span>
        {data.unit && <span className="text-sm text-[#8BA3BF]">{data.unit}</span>}
      </div>
      {data.trend !== undefined && data.trendDirection && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          {data.trendDirection === 'up' ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : data.trendDirection === 'down' ? (
            <TrendingDown className="w-3.5 h-3.5" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
          <span>{Math.abs(data.trend)}% vs last period</span>
        </div>
      )}
    </div>
  );
}
