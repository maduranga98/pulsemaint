import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useDepartmentScope } from '../../../hooks/useDepartmentScope';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { Breakdown, BreakdownStatus } from '../../../types/breakdown';

interface MyDepartmentBreakdownsWidgetProps {
  siteId: string;
}

const STATUS_LABEL: Record<BreakdownStatus, string> = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  triage_in_progress: 'In Triage',
  assigned: 'Assigned',
  en_route: 'En Route',
  repair_in_progress: 'In Progress',
  on_hold_parts: 'On Hold (Parts)',
  on_hold_approval: 'On Hold (Approval)',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<BreakdownStatus, string> = {
  reported: 'bg-red-500/15 text-red-300',
  acknowledged: 'bg-amber-500/15 text-amber-300',
  triage_in_progress: 'bg-amber-500/15 text-amber-300',
  assigned: 'bg-blue-500/15 text-blue-300',
  en_route: 'bg-blue-500/15 text-blue-300',
  repair_in_progress: 'bg-cyan-500/15 text-cyan-300',
  on_hold_parts: 'bg-orange-500/15 text-orange-300',
  on_hold_approval: 'bg-orange-500/15 text-orange-300',
  resolved: 'bg-emerald-500/15 text-emerald-300',
  closed: 'bg-slate-500/15 text-slate-400',
  cancelled: 'bg-slate-500/15 text-slate-400',
};

// A read-only view of recent breakdowns on the floor operator's own
// department — they can report a breakdown (see ReportBreakdownWidget) but
// have no assign/attend/close permissions on breakdown_tickets (see
// firestore.rules), so this never offers an action, only status.
export default function MyDepartmentBreakdownsWidget({ siteId }: MyDepartmentBreakdownsWidgetProps) {
  const { department: scopedDepartment } = useDepartmentScope();
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      orderBy('reportedAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBreakdowns(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Breakdown));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [siteId]);

  const closedSet = new Set<BreakdownStatus>(['closed', 'cancelled']);
  const visible = (scopedDepartment ? breakdowns.filter((b) => b.machineDepartment === scopedDepartment) : breakdowns)
    .filter((b) => !closedSet.has(b.status))
    .slice(0, 8);

  return (
    <DashboardWidget title="Breakdowns" loading={loading}>
      {visible.length === 0 ? (
        <EmptyState message="No open breakdowns in your department." />
      ) : (
        <div className="divide-y divide-[#1E3A5F]">
          {visible.map((b) => (
            <Link
              key={b.id}
              to={`/app/breakdowns/${b.id}`}
              className="flex items-center justify-between gap-3 py-2.5 hover:bg-[#0A1628] transition-colors -mx-1 px-1 rounded"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#F0F4F8] truncate">{b.machineName}</p>
                <p className="text-xs text-[#8BA3BF] truncate">{b.ticketNumber}</p>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_COLOR[b.status]}`}>
                {STATUS_LABEL[b.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
