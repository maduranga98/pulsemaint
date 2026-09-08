import { useTranslation } from 'react-i18next';
import type { Timestamp } from 'firebase/firestore';
import type { PartsRequest } from '@/types/inventory';

interface Props {
  request: PartsRequest;
}

function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

interface TimelineEvent {
  key: string;
  label: string;
  timestamp: Timestamp | null | undefined;
  dotColor: string;
}

export function RequestReviewHistory({ request }: Props) {
  const { t } = useTranslation();

  function decisionLabel(decision: string): string {
    return t(`common.inventory.requests.reviewHistory.decisions.${decision}`, { defaultValue: decision });
  }

  const events: TimelineEvent[] = [];

  events.push({
    key: 'submitted',
    label: t('common.inventory.requests.reviewHistory.submittedBy', { name: request.requestedByName }),
    timestamp: request.requestedAt,
    dotColor: 'bg-blue-500',
  });

  if (request.storeKeeperReview) {
    events.push({
      key: 'storekeeper',
      label: t('common.inventory.requests.reviewHistory.storeKeeperDecision', {
        name: request.storeKeeperReview.reviewedByName,
        decision: decisionLabel(request.storeKeeperReview.decision),
      }),
      timestamp: request.storeKeeperReview.reviewedAt,
      dotColor: 'bg-purple-500',
    });
  }

  if (request.supervisorReview) {
    events.push({
      key: 'supervisor',
      label: t('common.inventory.requests.reviewHistory.supervisorDecision', {
        name: request.supervisorReview.reviewedByName,
        decision: decisionLabel(request.supervisorReview.decision),
      }),
      timestamp: request.supervisorReview.reviewedAt,
      dotColor: 'bg-orange-500',
    });
  }

  if (request.reservedAt) {
    events.push({
      key: 'reserved',
      label: t('common.inventory.requests.reviewHistory.stockReserved'),
      timestamp: request.reservedAt,
      dotColor: 'bg-green-500',
    });
  }

  if (request.issuedAt) {
    events.push({
      key: 'issued',
      label: request.issuedByName
        ? t('common.inventory.requests.reviewHistory.partsIssuedBy', { name: request.issuedByName })
        : t('common.inventory.requests.reviewHistory.partsIssued'),
      timestamp: request.issuedAt,
      dotColor: 'bg-green-600',
    });
  }

  if (request.collectedAt) {
    events.push({
      key: 'collected',
      label: request.collectedByName
        ? t('common.inventory.requests.reviewHistory.collectedBy', { name: request.collectedByName })
        : t('common.inventory.requests.reviewHistory.collected'),
      timestamp: request.collectedAt,
      dotColor: 'bg-teal-500',
    });
  }

  if (request.returnedAt) {
    events.push({
      key: 'returned',
      label: request.confirmedByName
        ? t('common.inventory.requests.reviewHistory.returnedConfirmedBy', { name: request.confirmedByName })
        : t('common.inventory.requests.reviewHistory.returned'),
      timestamp: request.returnedAt,
      dotColor: 'bg-indigo-500',
    });
  }

  if (request.completedAt) {
    events.push({
      key: 'completed',
      label: t('common.inventory.requests.reviewHistory.requestCompleted'),
      timestamp: request.completedAt,
      dotColor: 'bg-gray-400',
    });
  }

  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('common.inventory.requests.reviewHistory.title')}</h3>
      <ol className="relative">
        {events.map((event, idx) => (
          <li key={event.key} className="flex gap-3 pb-4 last:pb-0">
            {/* Dot + connector */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${event.dotColor}`} />
              {idx < events.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
              )}
            </div>
            {/* Content */}
            <div className="pb-1">
              <p className="text-sm text-gray-800 font-medium">{event.label}</p>
              {event.timestamp && (
                <p className="text-xs text-gray-500 mt-0.5">{formatTimestamp(event.timestamp)}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
