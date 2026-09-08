import { useTranslation } from 'react-i18next';
import type { PartsRequest, RequestStatus } from '@/types/inventory';
import { RequestPriorityBadge } from './RequestPriorityBadge';
import { ReturnCell, type ReturnInfo } from './RequestQueueRow';

interface Props {
  request: PartsRequest;
  returnInfo?: ReturnInfo | null;
  onReview: () => void;
  canManageReturns?: boolean;
  showStatus?: boolean;
}

function useFormatAge() {
  const { t } = useTranslation();
  return (ts: { seconds: number } | null | undefined): { label: string; isOld: boolean } => {
    if (!ts) return { label: '', isOld: false };
    const diffMs = Date.now() - ts.seconds * 1000;
    const diffH = diffMs / 3600000;
    const diffD = diffMs / 86400000;
    if (diffH < 1) return { label: t('common.inventory.requests.queue.justNow'), isOld: false };
    if (diffH < 24) return { label: t('common.inventory.requests.queue.hoursAgo', { count: Math.floor(diffH) }), isOld: false };
    return { label: t('common.inventory.requests.queue.daysAgo', { count: Math.floor(diffD) }), isOld: true };
  };
}

const STATUS_BADGE_CLASSNAME: Record<RequestStatus, string> = {
  pending_storekeeper: 'bg-amber-100 text-amber-700',
  pending_supervisor: 'bg-blue-100 text-blue-700',
  approved: 'bg-indigo-100 text-indigo-700',
  partially_approved: 'bg-indigo-100 text-indigo-700',
  rejected: 'bg-red-100 text-red-700',
  parts_reserved: 'bg-indigo-100 text-indigo-700',
  issued: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

export function RequestQueueCard({ request, returnInfo, onReview, canManageReturns = false, showStatus = true }: Props) {
  const { t } = useTranslation();
  const formatAge = useFormatAge();
  const age = formatAge(request.requestedAt);
  const statusLabel = t(`common.inventory.requests.statusLabels.${request.status}`, { defaultValue: request.status });
  const statusClassName = STATUS_BADGE_CLASSNAME[request.status] ?? 'bg-gray-100 text-gray-600';

  const firstTwo = request.items.slice(0, 2).map((i) => i.partName);
  const remaining = request.items.length - 2;
  const hasPendingReturn = request.items.some((i) => i.isReturnable && !i.isReturned);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-blue-700 font-semibold">
            {request.requestNumber}
          </span>
          <RequestPriorityBadge priority={request.priorityLevel} isUrgent={request.isUrgent} />
        </div>
        {showStatus && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusClassName}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {(returnInfo || hasPendingReturn) && (
        <ReturnCell returnInfo={returnInfo} hasPendingReturn={hasPendingReturn} canManageReturns={canManageReturns} />
      )}

      {/* WO + Machine */}
      <div>
        <p className="font-bold text-gray-900">
          {request.workOrderNumber ?? t('common.inventory.requests.queue.noWo')}
          {request.workOrderType && (
            <span className="ml-1.5 text-sm font-normal text-gray-500">{request.workOrderType}</span>
          )}
        </p>
        {request.machineName && (
          <p className="text-sm text-gray-500">{request.machineName}</p>
        )}
      </div>

      {/* Parts */}
      <div className="text-sm text-gray-700">
        {firstTwo.map((name, i) => (
          <span key={i} className="block truncate">{name}</span>
        ))}
        {remaining > 0 && (
          <span className="text-xs text-gray-400">{t('common.inventory.requests.queue.andMore', { count: remaining })}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 font-medium">
          LKR {request.totalEstimatedCost.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={age.isOld ? 'text-red-600 font-semibold' : 'text-gray-500'}>
          {age.label}
        </span>
      </div>

      {/* Review button */}
      <button
        onClick={onReview}
        className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
      >
        {t('common.inventory.requests.queue.reviewButton')}
      </button>
    </div>
  );
}
