import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { useOpenWorkOrders } from '../../../hooks/dashboard/useOpenWorkOrders';
import { useRecordPlantMatcher } from '../../../hooks/useRecordPlantMatcher';
import { usePlantNameLookup } from '../../../hooks/usePlantNameLookup';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import PlantBadge from '../shared/PlantBadge';

const toDate = (v: unknown): Date | null => {
  const x = v as { toDate?: () => Date } | Date | null | undefined;
  if (!x) return null;
  return x instanceof Date ? x : typeof x.toDate === 'function' ? x.toDate() : null;
};

/**
 * Preventive-maintenance work orders due today (or overdue), for the
 * supervisor / plant manager / admin dashboards — the same PMs the assigned
 * technicians and the bell are alerted about at the start of the day.
 */
export default function TodaysPmWidget({ siteId }: { siteId: string }) {
  const navigate = useNavigate();
  const { workOrders, loading, error } = useOpenWorkOrders(siteId);
  const inScope = useRecordPlantMatcher();
  const plantName = usePlantNameLookup();

  const rows = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return workOrders
      .filter((wo) => wo.woType === 'PREVENTIVE' && inScope(wo))
      .map((wo) => ({ wo, due: toDate(wo.dueDate) }))
      .filter((r): r is { wo: typeof r.wo; due: Date } => !!r.due && r.due <= endOfToday)
      .map((r) => ({ ...r, overdue: r.due < startOfToday }))
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [workOrders, inScope]);

  return (
    <DashboardWidget
      title="PM due today"
      live
      loading={loading}
      error={error}
      action={<span className="text-xs text-[#8BA3BF]">{rows.length} due</span>}
    >
      {rows.length === 0 ? (
        <EmptyState message="No preventive maintenance due today" />
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {rows.map(({ wo, due, overdue }) => (
            <button
              key={wo.id}
              type="button"
              onClick={() => navigate(`/app/work-orders?woId=${wo.id}`)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-left transition-colors hover:border-[#1A56DB]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#F0F4F8]">{wo.machineName}</p>
                <p className="truncate text-[11px] text-[#8BA3BF]">
                  {wo.woNumber || wo.id}
                  {(wo.assignedTechnicianNames ?? []).length > 0 ? ` · ${(wo.assignedTechnicianNames ?? []).join(', ')}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    overdue ? 'bg-[#EF4444]/15 text-[#EF4444]' : 'bg-[#1A56DB]/20 text-[#5B8DEF]'
                  }`}
                >
                  <CalendarClock className="h-3 w-3" />
                  {overdue ? 'Overdue' : 'Today'} · {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <PlantBadge name={plantName(wo.machinePlantId)} />
              </div>
            </button>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
