import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { fetchShiftConfigs, fetchShiftSessionsForDate } from '@/services/handover.service';
import type { ShiftConfig, ShiftSession } from '@/types/handover.types';
import { formatTimeRange, getShiftDate } from '@/utils/handover.utils';

// SUP-023: the Shift Handovers list only ever showed *submitted* handovers,
// so there was no way to tell, at a glance, which shifts are currently being
// worked, which have ended (with a handover on file below), and which
// haven't started yet today. This panel derives that status per shift plan
// from today's shift_sessions (company-wide, not just the current user's).
type LiveStatus = 'working' | 'ended' | 'not_started';

interface ShiftLiveStatus {
  shift: ShiftConfig;
  status: LiveStatus;
  workingUsers: string[];
  endedUsers: string[];
}

const STATUS_CONFIG: Record<LiveStatus, { label: string; dot: string; text: string }> = {
  working: { label: 'Working', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  ended: { label: 'End Shift', dot: 'bg-slate-400', text: 'text-slate-600' },
  not_started: { label: 'Not Started', dot: 'bg-amber-400', text: 'text-amber-700' },
};

function deriveStatus(shift: ShiftConfig, sessions: ShiftSession[]): ShiftLiveStatus {
  const forShift = sessions.filter((s) => s.shiftConfigId === shift.id);
  const working = forShift.filter((s) => s.status === 'active');
  const ended = forShift.filter((s) => s.status === 'completed');
  const status: LiveStatus = working.length > 0 ? 'working' : ended.length > 0 ? 'ended' : 'not_started';
  return {
    shift,
    status,
    workingUsers: working.map((s) => s.userName),
    endedUsers: ended.map((s) => s.userName),
  };
}

export function ShiftStatusPanel() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [rows, setRows] = useState<ShiftLiveStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    const today = getShiftDate();
    Promise.all([fetchShiftConfigs(companyId), fetchShiftSessionsForDate(companyId, today)])
      .then(([shifts, sessions]) => {
        if (cancelled) return;
        const active = shifts.filter((s) => s.status === 'active');
        setRows(active.map((shift) => deriveStatus(shift, sessions)));
      })
      .catch((err) => console.error('ShiftStatusPanel: failed to load shift status', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  if (loading && rows.length === 0) return null;
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-[Sora] text-sm font-bold text-slate-950">Today&apos;s Shift Status</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const cfg = STATUS_CONFIG[row.status];
          const people = row.status === 'working' ? row.workingUsers : row.status === 'ended' ? row.endedUsers : [];
          return (
            <div key={row.shift.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm">
              <div>
                <div className="font-semibold text-slate-900">{row.shift.shiftName}</div>
                <div className="text-xs text-slate-500">{formatTimeRange(row.shift.startTime, row.shift.endTime)}</div>
                {people.length > 0 && <div className="text-xs text-slate-500">{people.join(', ')}</div>}
              </div>
              <span className={`inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold ${cfg.text}`}>
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShiftStatusPanel;
