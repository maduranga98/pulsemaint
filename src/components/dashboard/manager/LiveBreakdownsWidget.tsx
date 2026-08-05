import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useActiveBreakdowns } from '../../../hooks/dashboard/useActiveBreakdowns';

interface LiveBreakdownsWidgetProps {
  siteId: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#EAB308',
  low: '#8BA3BF',
};
const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export default function LiveBreakdownsWidget({ siteId }: LiveBreakdownsWidgetProps) {
  const { t } = useTranslation();
  const { breakdowns, loading, error } = useActiveBreakdowns(siteId);

  // One row per machine — every active breakdown ticket on it rolls up into
  // a single count instead of repeating the machine name per ticket.
  const byMachine = useMemo(() => {
    const map = new Map<string, { machineName: string; count: number; worstSeverity: string | null }>();
    for (const b of breakdowns) {
      const key = b.machineId || b.machineName;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (b.severity && (!existing.worstSeverity || SEVERITY_RANK[b.severity] > SEVERITY_RANK[existing.worstSeverity])) {
          existing.worstSeverity = b.severity;
        }
      } else {
        map.set(key, { machineName: b.machineName, count: 1, worstSeverity: b.severity ?? null });
      }
    }
    return Array.from(map.values()).sort((a, b) => (SEVERITY_RANK[b.worstSeverity ?? ''] ?? 0) - (SEVERITY_RANK[a.worstSeverity ?? ''] ?? 0));
  }, [breakdowns]);

  return (
    <DashboardWidget
      title={t('common.dashboard.liveBreakdowns.title')}
      loading={loading}
      error={error}
      live
      action={<span className="text-xs text-[#8BA3BF]">{t('common.dashboard.liveBreakdowns.active', { count: breakdowns.length })}</span>}
    >
      {byMachine.length === 0 ? (
        <EmptyState message={t('common.dashboard.liveBreakdowns.empty')} />
      ) : (
        <div className="space-y-1.5">
          {byMachine.map((m) => {
            const color = SEVERITY_COLOR[m.worstSeverity ?? ''] ?? '#8BA3BF';
            return (
              <div
                key={m.machineName}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                style={{ backgroundColor: `${color}12`, borderColor: `${color}40` }}
              >
                <p className="truncate text-sm font-semibold text-[#F0F4F8]">{m.machineName}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-[#0A1628] px-2 py-0.5 text-[10px] font-semibold text-[#F0F4F8]">
                    {t('common.dashboard.liveBreakdowns.count', { count: m.count })}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color, backgroundColor: `${color}20` }}>
                    {m.worstSeverity ?? t('common.dashboard.liveBreakdowns.pending')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
