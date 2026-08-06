import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { Breakdown } from '../../../types/breakdown';

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

// Breakdowns assigned to me that I haven't finished yet.
export default function AssignedBreakdownsWidget({ technicianId, siteId }: AssignedBreakdownsWidgetProps) {
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

  return (
    <DashboardWidget title="My Assigned Breakdowns" loading={loading}>
      {breakdowns.length === 0 ? (
        <EmptyState message="No breakdowns assigned to you" />
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {breakdowns.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{b.machineName}</p>
                <p className="text-[11px] text-[#8BA3BF]">{b.ticketNumber}</p>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-[#1E3A5F] text-[#8BA3BF]">
                {STATUS_LABEL[b.status] ?? b.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
