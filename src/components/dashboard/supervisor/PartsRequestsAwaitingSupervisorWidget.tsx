import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { usePartsRequests } from '../../../hooks/inventory/usePartsRequests';

// Parts requests waiting on this supervisor's approval — the one Inventory
// action a supervisor needs day to day, surfaced here instead of requiring
// the full Inventory Management section (removed from their nav).
export default function PartsRequestsAwaitingSupervisorWidget() {
  const navigate = useNavigate();
  const { requests, loading } = usePartsRequests({ status: 'pending_supervisor' });

  return (
    <DashboardWidget title="Parts Requests Awaiting Supervisor" loading={loading}>
      {requests.length === 0 ? (
        <EmptyState message="No parts requests awaiting your approval" />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const itemsLabel = r.items.map((i) => `${i.partName} ×${i.quantityRequested}`).join(', ');
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/app/inventory/requests/${r.id}`)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left hover:border-[#1A56DB] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F0F4F8] truncate">{itemsLabel || r.requestNumber}</p>
                  <p className="text-[11px] text-[#8BA3BF]">
                    {r.requestedByName}{r.machineName ? ` · ${r.machineName}` : ''}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/15 text-blue-300">
                  Review
                </span>
              </button>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
