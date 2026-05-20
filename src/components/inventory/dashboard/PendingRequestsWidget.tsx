import { Link, useNavigate } from 'react-router-dom';
import type { PartsRequest, RequestStatus } from '@/types/inventory';
import { RequestPriorityBadge } from '@/components/inventory/requests/RequestPriorityBadge';

interface Props {
  requests: PartsRequest[];
}

function formatAge(ts: { seconds: number } | null | undefined): { label: string; isOld: boolean } {
  if (!ts) return { label: '—', isOld: false };
  const diffMs = Date.now() - ts.seconds * 1000;
  const diffH = diffMs / 3600000;
  const diffD = diffMs / 86400000;
  if (diffH < 1) return { label: 'Just now', isOld: false };
  if (diffH < 24) return { label: `${Math.floor(diffH)}h ago`, isOld: false };
  return { label: `${Math.floor(diffD)}d ago`, isOld: true };
}

const STATUS_BADGE: Record<RequestStatus, { label: string; className: string }> = {
  pending_storekeeper: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  pending_supervisor: { label: 'Awaiting Supervisor', className: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  partially_approved: { label: 'Partial', className: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  parts_reserved: { label: 'Reserved', className: 'bg-indigo-100 text-indigo-700' },
  issued: { label: 'Issued', className: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-400' },
};

export function PendingRequestsWidget({ requests }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Pending Requests</h2>
        <Link
          to="/app/inventory/requests"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View All
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-400 text-sm">No pending requests</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Request #', 'WO #', 'Technician', 'Parts', 'Value', 'Priority', 'Age', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 10).map((r) => {
                  const age = formatAge(r.requestedAt);
                  const statusCfg = STATUS_BADGE[r.status];
                  return (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-mono text-blue-700 whitespace-nowrap">
                        {r.requestNumber}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                        {r.workOrderNumber ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                        {r.requestedByName}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">
                        {r.items.length} part{r.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                        LKR {r.totalEstimatedCost.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <RequestPriorityBadge priority={r.priorityLevel} isUrgent={r.isUrgent} />
                      </td>
                      <td className={`px-4 py-2.5 text-sm whitespace-nowrap ${age.isOld ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {age.label}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg?.className ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {statusCfg?.label ?? r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {requests.slice(0, 10).map((r) => {
              const age = formatAge(r.requestedAt);
              return (
                <button
                  key={r.id}
                  onClick={() => navigate(`/app/inventory/requests/${r.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm text-blue-700">{r.requestNumber}</span>
                    <RequestPriorityBadge priority={r.priorityLevel} isUrgent={r.isUrgent} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-1">{r.requestedByName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">{r.items.length} parts</span>
                    <span className={`text-xs ${age.isOld ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {age.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
