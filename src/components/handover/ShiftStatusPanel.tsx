import { useTranslation, type TFunction } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useLiveShiftStatus, type ShiftLiveStatus, type ShiftMemberStatus } from '@/hooks/useLiveShiftStatus';
import { formatTimeRange } from '@/utils/handover.utils';

function formatSince(t: TFunction, date: Date | null): string {
  if (!date) return '';
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return t('common.shiftHandovers.statusPanel.since', { time });
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayLabel = date.toDateString() === yesterday.toDateString()
    ? t('common.shiftHandovers.statusPanel.yesterday')
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return t('common.shiftHandovers.statusPanel.sinceDay', { day: dayLabel, time });
}

function formatEnded(t: TFunction, date: Date | null): string {
  if (!date) return t('common.shiftHandovers.statusPanel.notStartedToday');
  return t('common.shiftHandovers.statusPanel.ended', { time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
}

function MemberRow({ member }: { member: ShiftMemberStatus }) {
  const { t } = useTranslation();
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
          {working ? t('common.shiftHandovers.statusPanel.working') : t('common.shiftHandovers.statusPanel.notWorking')}
        </span>
        <span className="block text-[11px] text-slate-400">
          {working ? formatSince(t, member.workingSince) : formatEnded(t, member.endedAt)}
        </span>
      </span>
    </li>
  );
}

function ShiftCard({ row }: { row: ShiftLiveStatus }) {
  const { t } = useTranslation();
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
          {isLive ? t('common.shiftHandovers.statusPanel.workingCount', { count: row.workingCount }) : t('common.shiftHandovers.statusPanel.notWorking')}
        </span>
      </div>
      {row.members.length > 0 ? (
        <ul className="divide-y divide-slate-50 px-4">
          {row.members.map((m) => <MemberRow key={m.id} member={m} />)}
        </ul>
      ) : (
        <p className="px-4 py-3 text-xs text-slate-400">{t('common.shiftHandovers.statusPanel.noOneScheduled')}</p>
      )}
    </div>
  );
}

export function ShiftStatusPanel() {
  const { t } = useTranslation();
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const { rows, loading } = useLiveShiftStatus(companyId);

  if (loading && rows.length === 0) return null;
  if (rows.length === 0) return null;

  const totalWorking = rows.reduce((sum, r) => sum + r.workingCount, 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className=" text-base font-bold text-slate-950">{t('common.shiftHandovers.statusPanel.liveShiftStatus')}</h2>
        <p className="text-xs text-slate-500">
          {t('common.shiftHandovers.statusPanel.summaryLine', {
            people: t('common.shiftHandovers.statusPanel.personCount', { count: totalWorking }),
            shifts: t('common.shiftHandovers.statusPanel.shiftCount', { count: rows.length }),
          })}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => <ShiftCard key={row.shift.id} row={row} />)}
      </div>
    </section>
  );
}

export default ShiftStatusPanel;
