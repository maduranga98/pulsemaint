import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { subscribeShiftConfigs, subscribeShiftSessionsForDate } from '@/services/handover.service';
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

  // Explicitly-rostered members, with their live state.
  const rosterIds = new Set(shift.memberIds ?? []);
  const roles = shift.roles ?? [];
  const rosterMembers: ShiftMemberStatus[] = (shift.memberIds ?? []).map((id, i) => {
    const name = shift.memberNames?.[i] ?? id;
    const state: LiveStatus = working.has(id) ? 'working' : ended.has(id) ? 'ended' : 'not_started';
    return { name, role: roles[i] ?? null, state };
  });

  // Anyone who actually clocked in against this shift today but isn't on
  // the static roster — role/department-based bulk scheduling has no entry
  // in memberIds/memberNames, so without this they'd be invisible here even
  // though their shift_sessions doc is real and live.
  const sessionOnlyMembers: ShiftMemberStatus[] = forShift
    .filter((s) => !rosterIds.has(s.userId))
    .map((s) => ({ name: s.userName || s.userId, role: s.userRole || null, state: s.status === 'active' ? 'working' as const : 'ended' as const }));

  const members = [...rosterMembers, ...sessionOnlyMembers];

  // The shift-level status must reflect live sessions directly rather than
  // just the roster — otherwise a role-scheduled shift with no explicit
  // memberIds always reads "Not Started" even while people are clocked in.
  const status: LiveStatus =
    working.size > 0 ? 'working'
      : ended.size > 0 ? 'ended'
        : 'not_started';
  return { shift, status, members };
}

export function ShiftStatusPanel() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [rows, setRows] = useState<ShiftLiveStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

    let shifts: ShiftConfig[] = [];
    let sessions: ShiftSession[] = [];
    const rebuild = () => {
      const active = shifts.filter((s) => s.status === 'active');
      setRows(active.map((shift) => deriveStatus(shift, sessions)));
      setLoading(false);
    };

    // Live shift plans + today's sessions (any role) so working/ended status
    // reflects clock-ins and clock-outs the instant they're written.
    const today = getShiftDate();
    const unsubConfigs = subscribeShiftConfigs(
      companyId,
      (next) => { shifts = next; rebuild(); },
      (msg) => console.error('ShiftStatusPanel: shift configs error', msg),
    );
    const unsubSessions = subscribeShiftSessionsForDate(
      companyId,
      today,
      (next) => { sessions = next; rebuild(); },
      (msg) => console.error('ShiftStatusPanel: shift sessions error', msg),
    );
    return () => { unsubConfigs(); unsubSessions(); };
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
