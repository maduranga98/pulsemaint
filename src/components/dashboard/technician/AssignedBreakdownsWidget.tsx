import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { Breakdown, BreakdownSeverity } from '../../../types/breakdown';
import { groupBreakdownsByMachine } from '../../../lib/breakdowns/groupByMachine';

interface AssignedBreakdownsWidgetProps {
  technicianId: string;
  siteId: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

const SEVERITY_RANK: Record<BreakdownSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

// Machines with a breakdown assigned to me that I still need to assess
// (status assigned, no severity recorded yet) — one compact row per
// machine: name, worst severity, and the same "Attend & Fill" action the
// Breakdowns page's Assigned tab uses. Machines where every assigned
// ticket has already been assessed (in progress, on hold, etc. — nothing
// left for me to fill in) aren't shown here; there's no action to take.
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
          .filter((b) => b.status === 'assigned' && !b.severity);
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
            return (
              <div
                key={g.machineId}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
              >
                <p className="text-sm text-[#F0F4F8] truncate">{g.machineName}</p>
                <div className="shrink-0 flex items-center gap-2">
                  {worstSeverity && (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_COLOR[worstSeverity]}`}>
                      {worstSeverity}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/app/breakdowns/attend?ids=${g.tickets.map((t) => t.id).join(',')}`)}
                    className="px-2.5 py-1 text-[11px] font-medium bg-[#1A56DB] text-white rounded-md hover:bg-[#1442ad]"
                  >
                    Attend &amp; Fill{g.tickets.length > 1 ? ` (${g.tickets.length})` : ''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
