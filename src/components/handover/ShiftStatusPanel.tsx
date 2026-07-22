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

interface ShiftMemberStatus {
  name: string;
  role: string | null;
  state: LiveStatus;
}

interface ShiftLiveStatus {
  shift: ShiftConfig;
  status: LiveStatus;
  members: ShiftMemberStatus[];
}

const STATUS_CONFIG: Record<LiveStatus, { label: string; dot: string; text: string }> = {
  working: { label: 'Working', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  ended: { label: 'Ended', dot: 'bg-slate-400', text: 'text-slate-600' },
  not_started: { label: 'Not Started', dot: 'bg-amber-400', text: 'text-amber-700' },
};

function deriveStatus(shift: ShiftConfig, sessions: ShiftSession[]): ShiftLiveStatus {
  const forShift = sessions.filter((s) => s.shiftConfigId === shift.id);
  const working = new Map(forShift.filter((s) => s.status === 'active').map((s) => [s.userId, s]));
  const ended = new Map(forShift.filter((s) => s.status === 'completed').map((s) => [s.userId, s]));

  // Everyone assigned to the shift plan, with their live state.
  const names = shift.memberNames?.length ? shift.memberNames : shift.memberIds ?? [];
  const roles = shift.roles ?? [];
  const members: ShiftMemberStatus[] = names.map((name, i) => {
    const id = shift.memberIds?.[i];
    const state: LiveStatus = id && working.has(id) ? 'working' : id && ended.has(id) ? 'ended' : 'not_started';
    return { name, role: roles[i] ?? null, state };
  });

  const status: LiveStatus =
    members.some((m) => m.state === 'working') ? 'working'
      : members.some((m) => m.state === 'ended') ? 'ended'
        : 'not_started';
  return { shift, status, members };
}

export function ShiftStatusPanel() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [rows, setRows] = useState<ShiftLiveStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);

    const load = () => {
      const today = getShiftDate();
      Promise.all([fetchShiftConfigs(companyId), fetchShiftSessionsForDate(companyId, today)])
        .then(([shifts, sessions]) => {
          if (cancelled) return;
          const active = shifts.filter((s) => s.status === 'active');
          setRows(active.map((shift) => deriveStatus(shift, sessions)));
        })
        .catch((err) => console.error('ShiftStatusPanel: failed to load shift status', err))
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    // Auto-refresh so working/ended status stays current without a reload.
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [companyId]);

  if (loading && rows.length === 0) return null;
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-[Sora] text-sm font-bold text-slate-950">Today&apos;s Shift Status</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const cfg = STATUS_CONFIG[row.status];
          return (
            <div key={row.shift.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{row.shift.shiftName}</div>
                  <div className="text-xs text-slate-500">{formatTimeRange(row.shift.startTime, row.shift.endTime)}</div>
                </div>
                <span className={`inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold ${cfg.text}`}>
                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>
              {/* All people under this shift, with their individual live state. */}
              {row.members.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {row.members.map((m, i) => {
                    const mc = STATUS_CONFIG[m.state];
                    return (
                      <li key={`${m.name}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 text-slate-700">
                          <span className={`h-1.5 w-1.5 rounded-full ${mc.dot}`} />
                          {m.name}
                          {m.role && <span className="capitalize text-slate-400">· {m.role.replace(/_/g, ' ')}</span>}
                        </span>
                        <span className={`font-medium ${mc.text}`}>{mc.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShiftStatusPanel;
