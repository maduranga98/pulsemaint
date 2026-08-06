import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { Breakdown } from '../../../types/breakdown';

interface UnassignedBreakdownsWidgetProps {
  siteId: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

// Breakdowns nobody has attended or been assigned to yet — every technician
// needs visibility into these so one doesn't sit unnoticed.
export default function UnassignedBreakdownsWidget({ siteId }: UnassignedBreakdownsWidgetProps) {
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
      where('status', '==', 'reported'),
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

  return (
    <DashboardWidget title="Breakdowns" loading={loading}>
      {breakdowns.length === 0 ? (
        <EmptyState message="No unassigned breakdowns" />
      ) : (
        <div className="space-y-2">
          {breakdowns.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{b.machineName}</p>
                <p className="text-[11px] text-[#8BA3BF]">{b.ticketNumber}</p>
              </div>
              {b.severity && (
                <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_COLOR[b.severity] ?? 'bg-slate-500 text-white'}`}>
                  {b.severity}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
