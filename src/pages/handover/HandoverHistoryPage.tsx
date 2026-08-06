import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import HandoverFilterBar from '@/components/handover/HandoverFilterBar';
import HandoverHistoryCard from '@/components/handover/HandoverHistoryCard';
import HandoverHistoryTable, { type ShiftTableRow } from '@/components/handover/HandoverHistoryTable';
import { useHandoverHistory } from '@/hooks/useHandoverHistory';
import { useAuthStore } from '@/store/authStore';
import { subscribeCompletedShiftSessions, subscribeShiftConfigs } from '@/services/handover.service';
import { calculateLateStartMinutes } from '@/utils/handover.utils';
import type { HandoverHistoryFilters, ShiftConfig, ShiftSession } from '@/types/handover.types';

const initialFilters: HandoverHistoryFilters = {
  dateFrom: null,
  dateTo: null,
  personName: '',
  role: '',
  shiftName: '',
  department: '',
  lateOnly: false,
};

export function HandoverHistoryPage() {
  const [filters, setFilters] = useState(initialFilters);
  const { handoverHistory, loading, error } = useHandoverHistory(filters);

  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  // Completed shift sessions for every role (technician, store keeper, operator…)
  // so ending a shift shows up in the table even without a supervisor handover.
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  useEffect(() => {
    if (!companyId) return;
    return subscribeCompletedShiftSessions(companyId, setSessions);
  }, [companyId]);

  // Shift plans, only to resolve each row's department (handovers/sessions
  // don't carry department themselves) and to populate the Shift/Department
  // filter selects with the plans that actually exist.
  const [shiftConfigs, setShiftConfigs] = useState<ShiftConfig[]>([]);
  useEffect(() => {
    if (!companyId) return;
    return subscribeShiftConfigs(companyId, setShiftConfigs, (msg) => console.error('HandoverHistoryPage: shift configs error', msg));
  }, [companyId]);

  const departmentByShiftConfigId = useMemo(() => {
    const map = new Map<string, string | null>();
    shiftConfigs.forEach((s) => map.set(s.id, s.department ?? null));
    return map;
  }, [shiftConfigs]);

  const shiftNameOptions = useMemo(
    () => Array.from(new Set(shiftConfigs.map((s) => s.shiftName))).sort(),
    [shiftConfigs],
  );
  const departmentOptions = useMemo(
    () => Array.from(new Set(shiftConfigs.map((s) => s.department).filter((d): d is string => Boolean(d)))).sort(),
    [shiftConfigs],
  );

  const rows = useMemo<ShiftTableRow[]>(() => {
    // Handover rows — always submitted by a supervisor (see SUP-018: only
    // supervisors compile/hand over a shift report on end-shift).
    const handoverRows: ShiftTableRow[] = handoverHistory.map((h) => ({
      id: `handover-${h.id}`,
      kind: 'handover',
      shiftName: h.shiftName,
      personName: h.outgoingSupervisorName,
      personRole: 'supervisor',
      department: departmentByShiftConfigId.get(h.shiftConfigId) ?? null,
      shiftDate: h.shiftDate,
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
      .map((s) => ({
        id: `session-${s.id}`,
        kind: 'session' as const,
        shiftName: s.shiftName,
        personName: s.userName,
        personRole: s.userRole || null,
        department: departmentByShiftConfigId.get(s.shiftConfigId) ?? null,
        shiftDate: s.shiftDate,
        start: s.actualStart,
        end: s.actualEnd,
        scheduledStart: s.scheduledStart || null,
        otMinutes: s.otMinutes,
        ongoingBreakdowns: [],
        pendingWOs: [],
        watchFlags: [],
      }));

    // Person name / role / shift / department / lateOnly are applied once,
    // uniformly, here — date range is already applied to handoverHistory by
    // useHandoverHistory (sessions have no date filter upstream, so it must
    // also be reapplied here for them).
    return [...handoverRows, ...sessionRows]
      .filter((row) => {
        if (filters.personName && !row.personName.toLowerCase().includes(filters.personName.toLowerCase())) return false;
        if (filters.role && row.personRole !== filters.role) return false;
        if (filters.shiftName && row.shiftName !== filters.shiftName) return false;
        if (filters.department && (row.department ?? '') !== filters.department) return false;
        if (filters.dateFrom && row.shiftDate < filters.dateFrom) return false;
        if (filters.dateTo && row.shiftDate > filters.dateTo) return false;
        if (filters.lateOnly && !(row.scheduledStart && row.start && calculateLateStartMinutes(row.scheduledStart, row.start) > 0)) return false;
        return true;
      })
      .sort((a, b) => {
        const at = (a.end ?? a.start)?.getTime() ?? 0;
        const bt = (b.end ?? b.start)?.getTime() ?? 0;
        return bt - at;
      });
  }, [handoverHistory, sessions, filters, departmentByShiftConfigId]);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-[Sora] text-2xl font-bold text-slate-950">Shift Handovers</h1>
          <p className="mt-1 text-sm text-slate-500">Timestamped archive of supervisor accountability transfers across every shift and user.</p>
        </div>
        <Link
          to="/app/settings/shifts"
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          <Settings2 className="h-4 w-4" />
          Shift Configuration
        </Link>
      </div>
      <HandoverFilterBar
        filters={filters}
        onChange={setFilters}
        shiftOptions={shiftNameOptions}
        departmentOptions={departmentOptions}
      />
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
