import { Clock, Users } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useLiveShiftStatus } from '../../../hooks/useLiveShiftStatus';
import { formatTimeRange } from '../../../utils/handover.utils';

interface Props {
  companyId: string;
}

function formatSince(date: Date | null): string {
  if (!date) return '';
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `since ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayLabel = date.toDateString() === yesterday.toDateString() ? 'yesterday' : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `since ${dayLabel} ${time}`;
}

// Manager-dashboard companion to the full ShiftStatusPanel on the Shift
// Handovers page — condensed to only shift plans with someone actually
// clocked in right now (a plan with nobody working drops out entirely,
// same "only active" convention TodayShiftsByDepartment used, but driven by
// live shift_sessions status instead of a today-only date scope).
export default function LiveShiftStatusWidget({ companyId }: Props) {
  const { rows, loading } = useLiveShiftStatus(companyId);

  const activeRows = rows.filter((r) => r.status === 'working');
  const totalWorking = activeRows.reduce((sum, r) => sum + r.workingCount, 0);

  return (
    <DashboardWidget
      title="Live Shift Status"
      loading={loading}
      live
      action={<span className="text-xs text-[#8BA3BF]">{totalWorking} working now</span>}
    >
      {activeRows.length === 0 ? (
        <EmptyState message="No one is currently on shift" />
      ) : (
        <div className="space-y-4">
          {activeRows.map((row) => (
            <div key={row.shift.id}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8BA3BF]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.shift.color || '#1A56DB' }} />
                  {row.shift.shiftName}
                </h4>
                <span className="flex items-center gap-1 text-[10px] text-[#8BA3BF]">
                  <Clock className="h-3 w-3" />
                  {formatTimeRange(row.shift.startTime, row.shift.endTime)}
                </span>
              </div>
              <div className="space-y-1.5">
                {row.members.filter((m) => m.status === 'working').map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#10B981]" />
                      <span className="truncate text-sm font-medium text-[#F0F4F8]">{m.name}</span>
                      {m.role && (
                        <span className="shrink-0 whitespace-nowrap text-xs capitalize text-[#8BA3BF]">
                          {m.role.replace(/_/g, ' ')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-[#10B981]">{formatSince(m.workingSince)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 border-t border-[#1E3A5F] pt-3 text-[11px] text-[#8BA3BF]">
            <Users className="h-3 w-3" />
            {activeRows.length} {activeRows.length === 1 ? 'shift' : 'shifts'} live · {totalWorking} {totalWorking === 1 ? 'person' : 'people'} working
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
