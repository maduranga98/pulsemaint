import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  return (
    <DashboardWidget title="My Assigned Breakdowns" loading={loading}>
      {breakdowns.length === 0 ? (
        <EmptyState message="No breakdowns assigned to you" />
      ) : (
        <div className="space-y-2">
          {breakdowns.map((b) => {
            // Assigned but not yet assessed — clicking opens the same
            // start/attend assessment form (severity, description, attempted
            // fixes, attachments) an admin/supervisor fills when attending a
            // breakdown. Once assessed, it opens the read-only ticket detail.
            const needsAssessment = b.status === 'assigned' && !b.severity;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => navigate(needsAssessment ? `/app/breakdowns/attend?ids=${b.id}` : `/app/breakdowns/${b.id}`)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left hover:border-[#1A56DB] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F0F4F8] truncate">{b.machineName}</p>
                  <p className="text-[11px] text-[#8BA3BF]">{b.ticketNumber}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${needsAssessment ? 'bg-[#1A56DB]/20 text-[#60A5FA]' : 'bg-[#1E3A5F] text-[#8BA3BF]'}`}>
                  {needsAssessment ? 'Start / Attend' : STATUS_LABEL[b.status] ?? b.status}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
