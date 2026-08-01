import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, Play, Square, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useHandoverStore } from '@/store/handover.store';
import { fetchMyRecentSessions, subscribeShiftConfigs } from '@/services/handover.service';
import {
  formatDuration,
  formatTimeRange,
  getMyShiftPlans,
  isTimeWithinShift,
  scheduledShiftMinutes,
} from '@/utils/handover.utils';
import ShiftSummaryModal from '@/components/handover/ShiftSummaryModal';
import type { ShiftConfig, ShiftSession } from '@/types/handover.types';

/** Full date + time for the Recent Shifts table (e.g. "31 Jul 2026, 12:25 AM"). */
function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '-';
  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MyShiftPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.userProfile);
  const isShiftActive = useHandoverStore((state) => state.isShiftActive);
  const isShiftStateLoaded = useHandoverStore((state) => state.isShiftStateLoaded);
  const activeSession = useHandoverStore((state) => state.activeSession);
  const shiftStartTime = useHandoverStore((state) => state.shiftStartTime);
  const initShiftState = useHandoverStore((state) => state.initShiftState);
  const startShift = useHandoverStore((state) => state.startShift);
  const endShift = useHandoverStore((state) => state.endShift);

  const [plans, setPlans] = useState<ShiftConfig[]>([]);
  const [recent, setRecent] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summarySession, setSummarySession] = useState<ShiftSession | null>(null);
  const [now, setNow] = useState(() => new Date());

  // SUP-018: admin's start/end shift should match plant manager's and
  // technician's plain flow — only supervisors compile a handover report
  // (see handover.store.ts endShift).
  const canHandover = profile?.role === 'supervisor';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (profile && !isShiftStateLoaded) void initShiftState();
  }, [profile, isShiftStateLoaded, initShiftState]);

  // Live shift-config subscription — so a reassignment (or an edit to the
  // shift plan itself) made in Settings → Shifts/Users shows up here
  // immediately instead of only after the next full page load.
  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const unsubscribe = subscribeShiftConfigs(
      profile.companyId,
      (configs) => {
        setPlans(getMyShiftPlans(configs, { id: profile.id, role: profile.role, shiftId: profile.shiftId, department: profile.department }));
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      try {
        const sessions = await fetchMyRecentSessions(profile.companyId, profile.id);
        if (!cancelled) setRecent(sessions);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load recent shifts');
      }
    })();
    return () => { cancelled = true; };
  }, [profile, isShiftActive]);

  const currentPlan = useMemo(() => plans.find((plan) => isTimeWithinShift(now, plan)) ?? null, [plans, now]);

  // "My Shift Plans" should only surface plans that are currently active —
  // i.e. happening right now — not every plan the technician is ever
  // scheduled on (past/future/not-yet-started plans belong elsewhere).
  const activePlans = useMemo(() => plans.filter((plan) => isTimeWithinShift(now, plan)), [plans, now]);

  async function handleStart(shiftConfigId?: string) {
    setError(null);
    setBusy(true);
    try {
      await startShift(shiftConfigId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start shift');
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    setError(null);
    setBusy(true);
    try {
      const completed = await endShift();
      if (canHandover) {
        // Supervisors go straight from ending their shift into the handover
        // form to submit — no separate "Shift Ended" summary stop in between.
        navigate('/app/shift/handover/create');
        return;
      }
      setSummarySession(completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end shift');
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="font-[Sora] text-2xl font-bold text-slate-950">My Shift</h1>
        <p className="mt-1 text-sm text-slate-500">Your shift plans, current shift, and worked hours.</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Current / active shift */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-[Sora] text-sm font-bold text-slate-700">Current Shift</h2>
        {isShiftActive && activeSession ? (
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-[Sora] text-lg font-bold text-slate-950">{activeSession.shiftName}</p>
              <p className="text-sm text-slate-500">
                Scheduled {formatTimeRange(activeSession.scheduledStart, activeSession.scheduledEnd)} · Started {activeSession.actualStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
                <Clock className="h-4 w-4" />
                On shift for {shiftStartTime ? formatDuration(now.getTime() - shiftStartTime.getTime()) : '-'}
                {shiftStartTime && (now.getTime() - shiftStartTime.getTime()) > activeSession.scheduledMinutes * 60000 && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700">
                    OT {formatDuration(now.getTime() - shiftStartTime.getTime() - activeSession.scheduledMinutes * 60000)}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleEnd()}
              disabled={busy}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-amber-500 px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Square className="h-4 w-4" /> {busy ? 'Ending…' : 'End Shift'}
            </button>
          </div>
        ) : currentPlan ? (
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-[Sora] text-lg font-bold text-slate-950">{currentPlan.shiftName}</p>
              <p className="text-sm text-slate-500">{formatTimeRange(currentPlan.startTime, currentPlan.endTime)} · happening now</p>
            </div>
            <button
              type="button"
              onClick={() => void handleStart(currentPlan.id)}
              disabled={busy}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              <Play className="h-4 w-4" /> {busy ? 'Starting…' : 'Start Shift'}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {plans.length === 0
              ? 'You are not scheduled on any shift plan yet. Ask an admin to assign you in Settings → Shifts or Settings → Users.'
              : 'None of your shift plans is running right now. You can start your next shift from the list below.'}
          </p>
        )}
      </section>

      {/* Available shift plans */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-[Sora] text-sm font-bold text-slate-700"><CalendarDays className="h-4 w-4" /> My Shift Plans</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading shift plans…</p>
        ) : activePlans.length === 0 ? (
          <p className="text-sm text-slate-500">
            {plans.length === 0
              ? 'No shift plans assigned to you.'
              : 'None of your shift plans is active right now.'}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activePlans.map((plan) => (
              <article key={plan.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-[Sora] font-bold text-slate-950">{plan.shiftName}</h3>
                    <p className="text-sm text-slate-500">{formatTimeRange(plan.startTime, plan.endTime)} · {formatDuration(scheduledShiftMinutes(plan.startTime, plan.endTime) * 60000)}</p>
                  </div>
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: plan.color }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">{plan.activeDays.join(', ')}</p>
                <p className="text-xs text-slate-500">{plan.department || 'All departments'}</p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Active now</span>
                  {!isShiftActive && (
                    <button
                      type="button"
                      onClick={() => void handleStart(plan.id)}
                      disabled={busy}
                      className="text-sm font-bold text-emerald-700 hover:text-emerald-900 disabled:opacity-60"
                    >
                      Start this shift
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Recent worked shifts */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-[Sora] text-sm font-bold text-slate-700"><TrendingUp className="h-4 w-4" /> Recent Shifts</h2>
        {recent.filter((session) => session.status === 'completed').length === 0 ? (
          <p className="text-sm text-slate-500">No completed shifts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Ended</th>
                  <th className="px-4 py-3">Total Hours</th>
                  <th className="px-4 py-3">OT</th>
                </tr>
              </thead>
              <tbody>
                {recent.filter((session) => session.status === 'completed').map((session) => (
                  <tr key={session.id} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-950">{session.shiftName}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(session.actualStart)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(session.actualEnd)}</td>
                    <td className="px-4 py-3 font-semibold text-cyan-700">{session.totalMinutes != null ? formatDuration(session.totalMinutes * 60000) : '-'}</td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{session.otMinutes ? formatDuration(session.otMinutes * 60000) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ShiftSummaryModal
        session={summarySession}
        canHandover={Boolean(canHandover)}
        onClose={() => setSummarySession(null)}
        onContinueToHandover={() => {
          setSummarySession(null);
          navigate('/app/shift/handover/create');
        }}
      />
    </div>
  );
}

export default MyShiftPage;
