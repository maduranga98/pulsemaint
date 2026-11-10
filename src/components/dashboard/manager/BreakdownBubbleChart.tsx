import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useDashboardStore } from '../../../store/dashboard.store';
import { packCircles } from '../../../lib/packCircles';

const W = 460;
const H = 280;
const PALETTE = ['#6D5DF6', '#3B82F6', '#22D3A5', '#38BDF8', '#8B5CF6', '#F59E0B'];

/** Breakdown share by type as packed bubbles: the bigger the bubble, the bigger the share. */
export default function BreakdownBubbleChart() {
  const { t } = useTranslation();
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const loading = useDashboardStore((s) => s.analyticsLoading);

  const { bubbles, total } = useMemo(() => {
    const entries = Object.entries(monthly?.breakdownByType ?? {}).map(([id, value]) => ({ id, value: Number(value) || 0 }));
    return { bubbles: packCircles(entries, W, H), total: entries.reduce((s, e) => s + e.value, 0) };
  }, [monthly?.breakdownByType]);

  return (
    <DashboardWidget title={t('common.analytics.charts.bubbleTitle', { defaultValue: 'Breakdown share' })} loading={loading}>
      {bubbles.length === 0 ? (
        <EmptyState message={t('common.widgets.breakdownByTypeChart.empty')} />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="bubble-chart" role="img" aria-label={t('common.analytics.charts.bubbleTitle', { defaultValue: 'Breakdown share' })}>
          <defs>
            {PALETTE.map((c, i) => (
              <radialGradient key={c} id={`bub-${i}`} cx="35%" cy="30%" r="75%">
                <stop offset="0" stopColor={c} stopOpacity="0.85" />
                <stop offset="1" stopColor={c} stopOpacity="1" />
              </radialGradient>
            ))}
          </defs>
          {bubbles.map((b, i) => {
            const pct = total ? Math.round((b.value / total) * 100) : 0;
            return (
              <g key={b.id} className="bubble" style={{ ['--i' as string]: i, transformOrigin: `${b.x}px ${b.y}px` }}>
                <circle cx={b.x} cy={b.y} r={b.r} fill={`url(#bub-${i % PALETTE.length})`} />
                <text x={b.x} y={b.y - (b.r > 34 ? 2 : -4)} textAnchor="middle" className="bubble-pct" style={{ fontSize: Math.max(11, b.r / 2.6) }}>{pct}%</text>
                {b.r > 34 && <text x={b.x} y={b.y + 16} textAnchor="middle" className="bubble-name">{b.id}</text>}
                <title>{`${b.id}: ${b.value} (${pct}%)`}</title>
              </g>
            );
          })}
        </svg>
      )}
    </DashboardWidget>
  );
}
