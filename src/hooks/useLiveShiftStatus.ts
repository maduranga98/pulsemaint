import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeActiveShiftSessions, subscribeShiftConfigs, subscribeShiftSessionsForDate } from '@/services/handover.service';
import type { ShiftConfig, ShiftSession } from '@/types/handover.types';
import { getShiftDate, isUserAssignedToShift } from '@/utils/handover.utils';

// SUP-023 (follow-up): the original panel derived "working" from *today's*
// shift_sessions only, so a person who clocked in yesterday on an overnight
// shift and hasn't clocked out yet read as "not working" the moment the date
// rolled over — even though their session is still `status: 'active'`. Live
// status has to come from every active session company-wide, regardless of
// which calendar day it started on; today's date is only still needed to
// decide whether someone who isn't currently active has "ended today" or
// simply hasn't started yet.
export type LiveStatus = 'working' | 'not_working';

interface CompanyUser {
  id: string;
  fullName: string;
  role: string;
  shiftId?: string | null;
  department?: string | null;
}

export interface ShiftMemberStatus {
  id: string;
  name: string;
  role: string | null;
  status: LiveStatus;
  /** When they clocked in, for a currently-working member (may be from a prior calendar day). */
  workingSince: Date | null;
  /** When they clocked out, for a member who ended their shift earlier today. */
  endedAt: Date | null;
}

export interface ShiftLiveStatus {
  shift: ShiftConfig;
  status: LiveStatus;
  workingCount: number;
  members: ShiftMemberStatus[];
}

function deriveStatus(
  shift: ShiftConfig,
  activeSessions: ShiftSession[],
  todayEndedSessions: ShiftSession[],
  users: CompanyUser[],
): ShiftLiveStatus {
  const working = new Map(activeSessions.filter((s) => s.shiftConfigId === shift.id).map((s) => [s.userId, s]));
  const endedToday = new Map(todayEndedSessions.filter((s) => s.shiftConfigId === shift.id).map((s) => [s.userId, s]));

  // Every person this shift plan actually covers — explicit members,
  // individually-set shiftId, bulk-scheduled roles, or a department-wide
  // plan — so "Not Working" is a real roster entry, not just whoever
  // happens to have a session on file.
  const rosterUsers = users.filter((u) => isUserAssignedToShift(shift, u));
  const rosterIds = new Set(rosterUsers.map((u) => u.id));
  const rosterMembers: ShiftMemberStatus[] = rosterUsers.map((u) => {
    const active = working.get(u.id);
    const ended = endedToday.get(u.id);
    return {
      id: u.id,
      name: u.fullName || u.id,
      role: u.role,
      status: active ? 'working' : 'not_working',
      workingSince: active?.actualStart ?? null,
      endedAt: ended?.actualEnd ?? null,
    };
  });

  // Anyone with a live/ended-today session against this shift who isn't
  // resolved by the roster rules above (e.g. covering an unassigned shift).
  const extraMembers: ShiftMemberStatus[] = [...working.values(), ...endedToday.values()]
    .filter((s) => !rosterIds.has(s.userId))
    .reduce<ShiftMemberStatus[]>((acc, s) => {
      if (acc.some((m) => m.id === s.userId)) return acc;
      const active = working.get(s.userId);
      const ended = endedToday.get(s.userId);
      acc.push({
        id: s.userId,
        name: s.userName || s.userId,
        role: s.userRole || null,
        status: active ? 'working' : 'not_working',
        workingSince: active?.actualStart ?? null,
        endedAt: ended?.actualEnd ?? null,
      });
      return acc;
    }, []);

  const members = [...rosterMembers, ...extraMembers];

  return {
    shift,
    status: working.size > 0 ? 'working' : 'not_working',
    workingCount: working.size,
    members,
  };
}

/**
 * Live "who's actually on shift right now" status per active shift plan.
 * Unlike a date-scoped query, "working" reflects every currently-active
 * shift_sessions doc company-wide, so a session that started on a previous
 * calendar day (an overnight shift still in progress) is still shown as
 * working. "Ended" context is still scoped to today, since it only exists to
 * distinguish "finished for today" from "hasn't started yet".
 */
export function useLiveShiftStatus(companyId: string | undefined) {
  const [rows, setRows] = useState<ShiftLiveStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

    let shifts: ShiftConfig[] = [];
    let activeSessions: ShiftSession[] = [];
    let todaySessions: ShiftSession[] = [];
    let users: CompanyUser[] = [];
    const rebuild = () => {
      const active = shifts.filter((s) => s.status === 'active');
      const todayEnded = todaySessions.filter((s) => s.status === 'completed');
      setRows(active.map((shift) => deriveStatus(shift, activeSessions, todayEnded, users)));
      setLoading(false);
    };

    const today = getShiftDate();
    const unsubConfigs = subscribeShiftConfigs(
      companyId,
      (next) => { shifts = next; rebuild(); },
      (msg) => console.error('useLiveShiftStatus: shift configs error', msg),
    );
    const unsubActive = subscribeActiveShiftSessions(
      companyId,
      (next) => { activeSessions = next; rebuild(); },
      (msg) => console.error('useLiveShiftStatus: active sessions error', msg),
    );
    const unsubToday = subscribeShiftSessionsForDate(
      companyId,
      today,
      (next) => { todaySessions = next; rebuild(); },
      (msg) => console.error('useLiveShiftStatus: today sessions error', msg),
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
      (err) => console.error('useLiveShiftStatus: company users error', err.message),
    );
    return () => { unsubConfigs(); unsubActive(); unsubToday(); unsubUsers(); };
  }, [companyId]);

  return { rows, loading };
}
