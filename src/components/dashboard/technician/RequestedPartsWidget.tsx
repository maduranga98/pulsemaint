import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { usePartsRequests } from '../../../hooks/inventory/usePartsRequests';
import type { RequestStatus } from '../../../types/inventory';

// Every one of my own requests that hasn't reached a terminal state yet
// (issued/completed = fulfilled, rejected/cancelled = closed out).
const FULFILLED_OR_CLOSED: RequestStatus[] = ['issued', 'completed', 'rejected', 'cancelled'];

const STATUS_LABEL: Partial<Record<RequestStatus, { label: string; className: string }>> = {
  pending_storekeeper: { label: 'Requested', className: 'bg-amber-500/15 text-amber-300' },
  pending_supervisor: { label: 'In Approval of Supervisor', className: 'bg-blue-500/15 text-blue-300' },
  approved: { label: 'Need to Collect', className: 'bg-indigo-500/15 text-indigo-300' },
  partially_approved: { label: 'Need to Collect', className: 'bg-indigo-500/15 text-indigo-300' },
  parts_reserved: { label: 'Need to Collect', className: 'bg-indigo-500/15 text-indigo-300' },
};

export default function RequestedPartsWidget() {
  const { requests, loading, error } = usePartsRequests({ ownOnly: true });
  const pending = requests.filter((r) => !FULFILLED_OR_CLOSED.includes(r.status));

  return (
    <DashboardWidget title="Requested Parts — Not Fulfilled" loading={loading} error={error}>
      {pending.length === 0 ? (
        <EmptyState message="No outstanding parts requests" />
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {pending.map((r) => {
            const badge = STATUS_LABEL[r.status] ?? { label: r.status, className: 'bg-[#1E3A5F] text-[#8BA3BF]' };
            const itemsLabel = r.items.map((i) => `${i.partName} ×${i.quantityRequested}`).join(', ');
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F0F4F8] truncate">{itemsLabel || r.requestNumber}</p>
                  <p className="text-[11px] text-[#8BA3BF]">{r.machineName ? r.machineName : r.purpose || 'General request'}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
