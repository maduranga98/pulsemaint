import { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { WOTypeBadge } from '../../components/workorders/WOTypeBadge';
import { PriorityBadge } from '../../components/workorders/PriorityBadge';
import { WOReviewSignOffPanel } from '../../components/workorders/WOReviewSignOffPanel';

export default function SignOffQueuePage() {
  const { workOrders, loading, error } = useWorkOrders({ status: ['COMPLETED'] });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedWO = useMemo(
    () => workOrders.find((w) => w.id === selectedId) ?? null,
    [workOrders, selectedId],
  );

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Sign-Off Queue</h1>
          {workOrders.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-700">
              {workOrders.length}
            </span>
          )}
        </div>

        {loading && <p className="text-sm text-gray-500">Loading completed work orders…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && workOrders.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">Nothing awaiting sign-off</p>
            <p className="mt-1 text-xs text-gray-500">Completed work orders will appear here for review.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workOrders.map((wo) => (
            <button
              key={wo.id}
              onClick={() => setSelectedId(wo.id)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-gray-900">{wo.woNumber}</p>
              </div>
              <p className="mt-1 text-sm text-gray-700">{wo.machineName}</p>
              <p className="text-xs text-gray-500">{wo.machineLocation}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <WOTypeBadge woType={wo.woType} size="sm" />
                <PriorityBadge priority={wo.priority} size="sm" />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <p>{wo.assignedTechnicianNames?.join(', ') || 'Unassigned'}</p>
                {wo.actualEndTime && (
                  <p>Completed {wo.actualEndTime.toDate().toLocaleDateString()}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedWO && (
        <WOReviewSignOffPanel workOrder={selectedWO} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
