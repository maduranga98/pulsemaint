import type { PartsRequest } from '@/types/inventory';
import { RequestPriorityBadge } from './RequestPriorityBadge';
import { formatDistanceToNow } from 'date-fns';

interface RequestDetailHeaderProps {
  request: PartsRequest;
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  pending_storekeeper: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800' },
  pending_supervisor: { label: 'Awaiting Supervisor', className: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
  partially_approved: { label: 'Partially Approved', className: 'bg-teal-100 text-teal-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  parts_reserved: { label: 'Parts Reserved', className: 'bg-indigo-100 text-indigo-800' },
  issued: { label: 'Issued', className: 'bg-purple-100 text-purple-800' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-400' },
};

export function RequestDetailHeader({ request }: RequestDetailHeaderProps) {
  const status = statusConfig[request.status] ?? { label: request.status, className: 'bg-gray-100 text-gray-700' };

  const requestedDate = request.requestedAt?.toDate?.();
  const ageText = requestedDate
    ? formatDistanceToNow(requestedDate, { addSuffix: true })
    : '—';
  const dateStr = requestedDate ? requestedDate.toLocaleDateString() : '—';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Request #{request.requestNumber}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
            <RequestPriorityBadge
              priority={request.priorityLevel}
              isUrgent={request.isUrgent}
            />
          </div>
        </div>

        <div className="text-right text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-medium">Created:</span> {dateStr}
          </div>
          <div>
            <span className="font-medium">Age:</span> {ageText}
          </div>
          <div>
            <span className="font-medium">By:</span>{' '}
            <span className="text-gray-900 font-medium">{request.requestedByName}</span>{' '}
            <span className="text-gray-500 capitalize">
              ({request.requestedByRole.replace(/_/g, ' ')})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
