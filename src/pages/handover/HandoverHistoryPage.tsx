import { useEffect, useMemo, useState } from 'react';
import HandoverFilterBar from '@/components/handover/HandoverFilterBar';
import HandoverHistoryCard from '@/components/handover/HandoverHistoryCard';
import HandoverHistoryTable, { type ShiftTableRow } from '@/components/handover/HandoverHistoryTable';
import ShiftStatusPanel from '@/components/handover/ShiftStatusPanel';
import { useHandoverHistory } from '@/hooks/useHandoverHistory';
import { useAuthStore } from '@/store/authStore';
import { subscribeCompletedShiftSessions } from '@/services/handover.service';
import type { HandoverHistoryFilters, ShiftSession } from '@/types/handover.types';

const initialFilters: HandoverHistoryFilters = {
  dateFrom: null,
  dateTo: null,
  supervisorName: '',
  shiftName: '',
  department: '',
};

export function HandoverHistoryPage() {
  const [filters, setFilters] = useState(initialFilters);
  const { handoverHistory, loading, error } = useHandoverHistory(filters);

  // Completed shift sessions for every role (technician, store keeper, operator…)
  // so ending a shift shows up in the table even without a supervisor handover.
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  useEffect(() => {
    if (!companyId) return;
    return subscribeCompletedShiftSessions(companyId, setSessions);
  }, [companyId]);

  const rows = useMemo<ShiftTableRow[]>(() => {
    // Handover rows.
    const handoverRows: ShiftTableRow[] = handoverHistory.map((h) => ({
      id: `handover-${h.id}`,
      kind: 'handover',
      shiftName: h.shiftName,
      personName: h.outgoingSupervisorName,
      personRole: h.outgoingSupervisorDesignation ?? null,
      start: h.shiftActualStart,
      end: h.shiftActualEnd ?? h.handoverSubmittedAt,
      scheduledStart: h.scheduledStart,
      otMinutes: h.otMinutes,
      ongoingBreakdowns: h.ongoingBreakdowns,
      pendingWOs: h.pendingWOs,
      watchFlags: h.watchFlags,
      handover: h,
    }));

    // Session rows — skip any session already represented by a handover.
    const sessionRows: ShiftTableRow[] = sessions
      .filter((s) => !s.handoverId)
      .filter((s) => {
        if (filters.supervisorName && !s.userName.toLowerCase().includes(filters.supervisorName.toLowerCase())) return false;
        if (filters.shiftName && !s.shiftName.toLowerCase().includes(filters.shiftName.toLowerCase())) return false;
        if (filters.dateFrom && s.shiftDate < filters.dateFrom) return false;
        if (filters.dateTo && s.shiftDate > filters.dateTo) return false;
        return true;
      })
      .map((s) => ({
        id: `session-${s.id}`,
        kind: 'session' as const,
        shiftName: s.shiftName,
        personName: s.userName,
        personRole: s.userRole || null,
        start: s.actualStart,
        end: s.actualEnd,
        scheduledStart: s.scheduledStart || null,
        otMinutes: s.otMinutes,
        ongoingBreakdowns: [],
        pendingWOs: [],
        watchFlags: [],
      }));

    return [...handoverRows, ...sessionRows].sort((a, b) => {
      const at = (a.end ?? a.start)?.getTime() ?? 0;
      const bt = (b.end ?? b.start)?.getTime() ?? 0;
      return bt - at;
    });
  }, [handoverHistory, sessions, filters]);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="font-[Sora] text-2xl font-bold text-slate-950">Shift Handovers</h1>
        <p className="mt-1 text-sm text-slate-500">Timestamped archive of supervisor accountability transfers across every shift and user.</p>
      </div>
      <ShiftStatusPanel />
      <HandoverFilterBar filters={filters} onChange={setFilters} />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-3 lg:hidden">
        {handoverHistory.map((handover) => <HandoverHistoryCard key={handover.id} handover={handover} />)}
      </div>
      <div className="hidden lg:block"><HandoverHistoryTable rows={rows} /></div>
      {loading && !rows.length && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">Loading…</div>
      )}
      {!loading && !rows.length && !error && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No handovers found.</div>
      )}
    </div>
  );
}

export default HandoverHistoryPage;
