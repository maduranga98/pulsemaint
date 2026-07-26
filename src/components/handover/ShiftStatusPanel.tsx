import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { subscribeShiftConfigs, subscribeShiftSessionsForDate } from '@/services/handover.service';
import type { ShiftConfig, ShiftSession } from '@/types/handover.types';
import { formatTimeRange, getShiftDate, isUserAssignedToShift } from '@/utils/handover.utils';

// SUP-023: the Shift Handovers list only ever showed *submitted* handovers,
// so there was no way to tell, at a glance, which shifts are currently being
// worked, which have ended (with a handover on file below), and which
// haven't started yet today. This panel derives that status per shift plan
// from today's shift_sessions (company-wide, not just the current user's).
type LiveStatus = 'working' | 'ended' | 'not_started';

interface CompanyUser {
  id: string;
  fullName: string;
  role: string;
  shiftId?: string | null;
  department?: string | null;
}

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

function deriveStatus(shift: ShiftConfig, sessions: ShiftSession[], users: CompanyUser[]): ShiftLiveStatus {
  const forShift = sessions.filter((s) => s.shiftConfigId === shift.id);
  const working = new Map(forShift.filter((s) => s.status === 'active').map((s) => [s.userId, s]));
  const ended = new Map(forShift.filter((s) => s.status === 'completed').map((s) => [s.userId, s]));

  // Every role/department this shift plan actually covers — explicit
  // memberIds, individually-set shiftId, bulk-scheduled roles, or a
  // department-wide plan (same rule used everywhere else a user's shift
  // assignment is resolved, e.g. "My Shift"). Anyone assigned this way, of
  // any role, is shown here even before they've clocked in, so "Not
  // Started" is a real roster entry rather than only appearing once
  // someone happens to start a session.
  const rosterUsers = users.filter((u) => isUserAssignedToShift(shift, u));
  const rosterIds = new Set(rosterUsers.map((u) => u.id));
  const rosterMembers: ShiftMemberStatus[] = rosterUsers.map((u) => {
    const state: LiveStatus = working.has(u.id) ? 'working' : ended.has(u.id) ? 'ended' : 'not_started';
    return { name: u.fullName || u.id, role: u.role, state };
  });

  // Anyone who actually clocked in against this shift today but isn't
  // resolved by the assignment rules above (e.g. covering an unassigned
  // shift) — without this they'd be invisible even though their
  // shift_sessions doc is real and live.
  const sessionOnlyMembers: ShiftMemberStatus[] = forShift
    .filter((s) => !rosterIds.has(s.userId))
    .map((s) => ({ name: s.userName || s.userId, role: s.userRole || null, state: s.status === 'active' ? 'working' as const : 'ended' as const }));

  const members = [...rosterMembers, ...sessionOnlyMembers];

  // The shift-level status must reflect live sessions directly rather than
  // just the roster — otherwise a role-scheduled shift with no one clocked
  // in yet, or with sessions from people outside the resolved roster, would
  // report the wrong state.
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
    let users: CompanyUser[] = [];
    const rebuild = () => {
      const active = shifts.filter((s) => s.status === 'active');
      setRows(active.map((shift) => deriveStatus(shift, sessions, users)));
      setLoading(false);
    };

    // Live shift plans + today's sessions (any role) + the live roster of
    // company users (so every role — not just whoever has clocked in — is
    // covered) so working/ended/not_started reflects reality the instant a
    // shift plan, clock-in/out, or user assignment changes.
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
    const unsubUsers = onSnapshot(
      query(collection(db, `companies/${companyId}/users`)),
      (snap) => {
        users = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            fullName: data.fullName ?? '',
            role: data.role ?? '',
            shiftId: data.shiftId ?? null,
            department: data.department ?? null,
          };
        });
        rebuild();
      },
      (err) => console.error('ShiftStatusPanel: company users error', err.message),
    );
    return () => { unsubConfigs(); unsubSessions(); unsubUsers(); };
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
