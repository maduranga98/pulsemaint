import { useMemo } from 'react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useSafetyCases } from '../../../hooks/safety/useSafety';

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#EAB308',
  low: '#10B981',
};

function isToday(ts: { seconds: number } | null | undefined): boolean {
  if (!ts?.seconds) return false;
  const d = new Date(ts.seconds * 1000);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function TodaySafetyCasesWidget({ companyId }: { companyId: string }) {
  const { cases, loading } = useSafetyCases(companyId);
  const todayCases = useMemo(() => cases.filter((c) => isToday(c.reportedAt)), [cases]);

  return (
    <DashboardWidget
      title="Today's Safety Cases"
      loading={loading}
      live
      action={<span className="text-xs text-[#8BA3BF]">{todayCases.length} today</span>}
    >
      {todayCases.length === 0 ? (
        <EmptyState message="No safety cases reported today" />
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {todayCases.map((c) => {
            const color = SEVERITY_COLOR[c.severity] ?? '#8BA3BF';
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                style={{ backgroundColor: `${color}12`, borderColor: `${color}40` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F0F4F8]">{c.title}</p>
                  <p className="truncate text-[11px] text-[#8BA3BF] capitalize">{c.type.replace(/_/g, ' ')}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color, backgroundColor: `${color}20` }}>
                  {c.severity}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
