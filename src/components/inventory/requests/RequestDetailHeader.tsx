import { useTranslation } from 'react-i18next';
import type { PartsRequest } from '@/types/inventory';
import { RequestPriorityBadge } from './RequestPriorityBadge';
import { formatDistanceToNow } from 'date-fns';

interface RequestDetailHeaderProps {
  request: PartsRequest;
}

const statusClassNames: Record<string, string> = {
  pending_storekeeper: 'bg-yellow-100 text-yellow-800',
  pending_supervisor: 'bg-blue-100 text-blue-800',
  approved: 'bg-indigo-100 text-indigo-800',
  partially_approved: 'bg-indigo-100 text-indigo-800',
  rejected: 'bg-red-100 text-red-800',
  parts_reserved: 'bg-indigo-100 text-indigo-800',
  issued: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

export function RequestDetailHeader({ request }: RequestDetailHeaderProps) {
  const { t } = useTranslation();
  const statusLabel = t(`common.inventory.requests.statusLabels.${request.status}`, { defaultValue: request.status });
  const statusClassName = statusClassNames[request.status] ?? 'bg-gray-100 text-gray-700';

  const requestedDate = request.requestedAt?.toDate?.();
  const ageText = requestedDate
    ? formatDistanceToNow(requestedDate, { addSuffix: true })
    : '';
  const dateStr = requestedDate ? requestedDate.toLocaleDateString() : '';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {t('common.inventory.requests.detailHeader.requestNumber', { number: request.requestNumber })}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClassName}`}>
              {statusLabel}
            </span>
            <RequestPriorityBadge
              priority={request.priorityLevel}
              isUrgent={request.isUrgent}
            />
          </div>
        </div>

        <div className="text-right text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-medium">{t('common.inventory.requests.detailHeader.createdLabel')}</span> {dateStr}
          </div>
          <div>
            <span className="font-medium">{t('common.inventory.requests.detailHeader.ageLabel')}</span> {ageText}
          </div>
          <div>
            <span className="font-medium">{t('common.inventory.requests.detailHeader.byLabel')}</span>{' '}
            <span className="text-gray-900 font-medium">{request.requestedByName}</span>{' '}
            <span className="text-gray-500 capitalize">
              ({request.requestedByRole.replace(/_/g, ' ')})
            </span>
          </div>
        </div>
      </div>

      {(request.status === 'issued' || request.status === 'completed') && request.collectedByName && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
          <span className="font-medium text-gray-900">{t('common.inventory.requests.detailHeader.collectedByLabel')}</span>{' '}
          {request.collectedByName}
          {request.collectedAt?.toDate && (
            <span className="text-gray-500">
              {' '}
              {t('common.inventory.requests.detailHeader.collectedOn', { date: request.collectedAt.toDate().toLocaleString() })}
            </span>
          )}
          {request.confirmedByName && (
            <span className="text-gray-500"> · {t('common.inventory.requests.detailHeader.confirmedBy', { name: request.confirmedByName })}</span>
          )}
        </div>
      )}
    </div>
  );
}
