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

export default function LiveBreakdownsWidget({ siteId }: LiveBreakdownsWidgetProps) {
  const { breakdowns, loading, error } = useActiveBreakdowns(siteId);

  return (
    <DashboardWidget
      title="Live Breakdowns"
      loading={loading}
      error={error}
      live
      action={<span className="text-xs text-[#8BA3BF]">{breakdowns.length} active</span>}
    >
      {breakdowns.length === 0 ? (
        <EmptyState message="No active breakdowns" />
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {breakdowns.map((b) => {
            const color = SEVERITY_COLOR[b.severity ?? ''] ?? '#8BA3BF';
            return (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                style={{ backgroundColor: `${color}12`, borderColor: `${color}40` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F0F4F8]">{b.machineName}</p>
                  <p className="truncate text-[11px] text-[#8BA3BF]">{b.ticketNumber}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color, backgroundColor: `${color}20` }}>
                  {b.severity ?? 'pending'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
