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
// the same way the Breakdowns page's Assigned tab does — but every ticket
// on that machine is still listed individually (not collapsed into a
// count), and "Attend & Fill" is the exact same action the page's Assigned
// tab uses: batch-assess every one of my not-yet-assessed tickets on that
// machine, then go straight to the assessment form.
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
        <div className="space-y-3">
          {groups.map((g) => {
            const worstSeverity = g.tickets.reduce<BreakdownSeverity | null>((worst, t) => {
              if (!t.severity) return worst;
              if (!worst || SEVERITY_RANK[t.severity] > SEVERITY_RANK[worst]) return t.severity;
              return worst;
            }, null);
            // Assigned but not yet assessed by me — the same next step the
            // Breakdowns page's "Attend & Fill" action leads to.
            const unfilled = g.tickets.filter((t) => t.status === 'assigned' && !t.severity);

            return (
              <div key={g.machineId} className="bg-[#0A1628] rounded-lg border border-[#1E3A5F] overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#1E3A5F]">
                  <p className="text-sm font-medium text-[#F0F4F8] truncate">{g.machineName}</p>
                  <div className="shrink-0 flex items-center gap-2">
                    {worstSeverity && (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_COLOR[worstSeverity]}`}>
                        {worstSeverity}
                      </span>
                    )}
                    {unfilled.length > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/breakdowns/attend?ids=${unfilled.map((t) => t.id).join(',')}`)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-[#1A56DB] text-white rounded-md hover:bg-[#1442ad]"
                      >
                        Attend &amp; Fill{unfilled.length > 1 ? ` (${unfilled.length})` : ''}
                      </button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-[#1E3A5F]">
                  {g.tickets.map((t) => (
                    <Link
                      key={t.id}
                      to={`/app/breakdowns/${t.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#0F1E35] transition-colors"
                    >
                      <span className="text-xs text-[#60A5FA]">{t.ticketNumber}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 rounded-full bg-[#1E3A5F] overflow-hidden">
                          <div className="h-full bg-[#1A56DB]" style={{ width: `${STATUS_PROGRESS[t.status] ?? 0}%` }} />
                        </div>
                        <span className="text-[11px] text-[#8BA3BF] whitespace-nowrap">
                          {t.status === 'assigned' && !t.severity ? 'Needs assessment' : STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
