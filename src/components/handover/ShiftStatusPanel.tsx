import { useAuthStore } from '@/store/authStore';
import { useLiveShiftStatus, type ShiftLiveStatus, type ShiftMemberStatus } from '@/hooks/useLiveShiftStatus';
import { formatTimeRange } from '@/utils/handover.utils';

function formatSince(date: Date | null): string {
  if (!date) return '';
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Since ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayLabel = date.toDateString() === yesterday.toDateString()
    ? 'yesterday'
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `Since ${dayLabel} ${time}`;
}

function formatEnded(date: Date | null): string {
  if (!date) return 'Not started today';
  return `Ended ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function MemberRow({ member }: { member: ShiftMemberStatus }) {
  const working = member.status === 'working';
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${working ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <span className="truncate text-sm font-medium text-slate-800">{member.name}</span>
        {member.role && (
          <span className="shrink-0 whitespace-nowrap text-xs capitalize text-slate-400">
            {member.role.replace(/_/g, ' ')}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className={`block text-xs font-semibold ${working ? 'text-emerald-600' : 'text-slate-400'}`}>
          {working ? 'Working' : 'Not Working'}
        </span>
        <span className="block text-[11px] text-slate-400">
          {working ? formatSince(member.workingSince) : formatEnded(member.endedAt)}
        </span>
      </span>
    </li>
  );
}

function ShiftCard({ row }: { row: ShiftLiveStatus }) {
  const isLive = row.status === 'working';
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{row.shift.shiftName}</p>
          <p className="text-xs text-slate-500">{formatTimeRange(row.shift.startTime, row.shift.endTime)}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
            isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          {isLive ? `Working (${row.workingCount})` : 'Not Working'}
        </span>
      </div>
      {row.members.length > 0 ? (
        <ul className="divide-y divide-slate-50 px-4">
          {row.members.map((m) => <MemberRow key={m.id} member={m} />)}
        </ul>
      ) : (
        <p className="px-4 py-3 text-xs text-slate-400">No one scheduled on this shift yet.</p>
      )}
    </div>
  );
}

export function ShiftStatusPanel() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const { rows, loading } = useLiveShiftStatus(companyId);

  if (loading && rows.length === 0) return null;
  if (rows.length === 0) return null;

  const totalWorking = rows.reduce((sum, r) => sum + r.workingCount, 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-[Sora] text-base font-bold text-slate-950">Live Shift Status</h2>
        <p className="text-xs text-slate-500">
          {totalWorking} {totalWorking === 1 ? 'person' : 'people'} currently working, across {rows.length} {rows.length === 1 ? 'shift' : 'shifts'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => <ShiftCard key={row.shift.id} row={row} />)}
      </div>
    </section>
  );
}

export default ShiftStatusPanel;
