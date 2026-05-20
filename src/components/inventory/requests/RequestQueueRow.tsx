import type { PartsRequest, RequestStatus } from '@/types/inventory';
import { RequestPriorityBadge } from './RequestPriorityBadge';
import { CostDisplay } from '@/components/inventory/shared/CostDisplay';

interface Props {
  request: PartsRequest;
  onReview: () => void;
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

export function RequestQueueRow({ request, onReview }: Props) {
  const age = formatAge(request.requestedAt);
  const statusCfg = STATUS_BADGE[request.status] ?? { label: request.status, className: 'bg-gray-100 text-gray-600' };
  const firstPart = request.items[0]?.partName ?? '—';
  const extraParts = request.items.length - 1;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-mono text-blue-700 whitespace-nowrap">
        {request.requestNumber}
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span className="font-semibold text-gray-900">{request.workOrderNumber ?? '—'}</span>
        {request.workOrderType && (
          <span className="ml-1.5 text-xs text-gray-500">{request.workOrderType}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        {request.requestedByName}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        <span>{firstPart}</span>
        {extraParts > 0 && (
          <span className="text-xs text-gray-400 ml-1">+{extraParts} more</span>
        )}
        <span className="ml-1.5 text-xs text-gray-400">({request.items.length})</span>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <CostDisplay amount={request.totalEstimatedCost} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <RequestPriorityBadge priority={request.priorityLevel} isUrgent={request.isUrgent} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.className}`}
        >
          {statusCfg.label}
        </span>
      </td>
      <td className={`px-4 py-3 text-sm whitespace-nowrap ${age.isOld ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
        {age.label}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={onReview}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
        >
          Review
        </button>
      </td>
    </tr>
  );
}
