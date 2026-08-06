import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { Breakdown, BreakdownSeverity, BreakdownStatus } from '../../../types/breakdown';
import { groupBreakdownsByMachine } from '../../../lib/breakdowns/groupByMachine';

interface AssignedBreakdownsWidgetProps {
  technicianId: string;
  siteId: string;
}

const CLOSED_STATUSES = new Set(['closed', 'cancelled', 'resolved']);

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Assigned',
  en_route: 'En Route',
  repair_in_progress: 'In Progress',
  on_hold_parts: 'On Hold (Parts)',
  on_hold_approval: 'On Hold (Approval)',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

const SEVERITY_RANK: Record<BreakdownSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const STATUS_PROGRESS: Record<BreakdownStatus, number> = {
  reported: 5,
  acknowledged: 15,
  triage_in_progress: 25,
  assigned: 40,
  en_route: 55,
  repair_in_progress: 70,
  on_hold_parts: 60,
  on_hold_approval: 60,
  resolved: 95,
  closed: 100,
  cancelled: 0,
};

// Breakdowns assigned to me that I haven't finished yet, grouped by machine
// the same way the Breakdowns page's Assigned tab does — with the same
// "Attend & Fill" direct action for tickets I haven't assessed yet, so
// nothing requires a detour through that page first.
export default function AssignedBreakdownsWidget({ technicianId, siteId }: AssignedBreakdownsWidgetProps) {
  const navigate = useNavigate();
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId || !technicianId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      where('assignedTechnicianIds', 'array-contains', technicianId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }) as Breakdown)
          .filter((b) => !CLOSED_STATUSES.has(b.status));
        setBreakdowns(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [technicianId, siteId]);

  const groups = groupBreakdownsByMachine(breakdowns);

  return (
    <DashboardWidget title="My Assigned Breakdowns" loading={loading}>
      {groups.length === 0 ? (
        <EmptyState message="No breakdowns assigned to you" />
      ) : (
        <div className="space-y-2">
          {groups.map((g) => {
            const worstSeverity = g.tickets.reduce<BreakdownSeverity | null>((worst, t) => {
              if (!t.severity) return worst;
              if (!worst || SEVERITY_RANK[t.severity] > SEVERITY_RANK[worst]) return t.severity;
              return worst;
            }, null);
            const representative = g.tickets.reduce((best, t) =>
              (STATUS_PROGRESS[t.status] ?? 0) > (STATUS_PROGRESS[best.status] ?? 0) ? t : best
            , g.tickets[0]);
            // Assigned but not yet assessed by me — the same next step the
            // Breakdowns page's "Attend & Fill" action leads to.
            const unfilled = g.tickets.filter((t) => t.status === 'assigned' && !t.severity);

            return (
              <div
                key={g.machineId}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
              >
                <Link to={`/app/breakdowns/${g.tickets[0].id}`} className="min-w-0 hover:opacity-90">
                  <p className="text-sm text-[#F0F4F8] truncate">
                    {g.machineName}
                    {g.tickets.length > 1 && <span className="text-[#8BA3BF]"> ×{g.tickets.length}</span>}
                  </p>
                  <p className="text-[11px] text-[#8BA3BF]">{g.tickets.map((t) => t.ticketNumber).join(', ')}</p>
                </Link>
                <div className="shrink-0 flex items-center gap-2">
                  {worstSeverity && (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_COLOR[worstSeverity]}`}>
                      {worstSeverity}
                    </span>
                  )}
                  {unfilled.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/breakdowns/attend?ids=${unfilled.map((t) => t.id).join(',')}`)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-[#1A56DB] text-white rounded-md hover:bg-[#1442ad]"
                    >
                      Attend &amp; Fill{unfilled.length > 1 ? ` (${unfilled.length})` : ''}
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#1E3A5F] text-[#8BA3BF]">
                      {STATUS_LABEL[representative.status] ?? representative.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
