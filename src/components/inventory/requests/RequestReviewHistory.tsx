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

function decisionLabel(decision: string): string {
  switch (decision) {
    case 'approve': return 'Approved';
    case 'escalate': return 'Escalated to Supervisor';
    case 'reject': return 'Rejected';
    case 'partial': return 'Partially Approved';
    default: return decision;
  }
}

interface TimelineEvent {
  key: string;
  label: string;
  timestamp: Timestamp | null | undefined;
  dotColor: string;
}

export function RequestReviewHistory({ request }: Props) {
  const events: TimelineEvent[] = [];

  events.push({
    key: 'submitted',
    label: `Submitted by ${request.requestedByName}`,
    timestamp: request.requestedAt,
    dotColor: 'bg-blue-500',
  });

  if (request.storeKeeperReview) {
    events.push({
      key: 'storekeeper',
      label: `Store Keeper ${request.storeKeeperReview.reviewedByName} — ${decisionLabel(request.storeKeeperReview.decision)}`,
      timestamp: request.storeKeeperReview.reviewedAt,
      dotColor: 'bg-purple-500',
    });
  }

  if (request.supervisorReview) {
    events.push({
      key: 'supervisor',
      label: `Supervisor ${request.supervisorReview.reviewedByName} — ${decisionLabel(request.supervisorReview.decision)}`,
      timestamp: request.supervisorReview.reviewedAt,
      dotColor: 'bg-orange-500',
    });
  }

  if (request.reservedAt) {
    events.push({
      key: 'reserved',
      label: 'Stock reserved',
      timestamp: request.reservedAt,
      dotColor: 'bg-green-500',
    });
  }

  if (request.issuedAt) {
    events.push({
      key: 'issued',
      label: `Parts issued${request.issuedByName ? ` by ${request.issuedByName}` : ''}`,
      timestamp: request.issuedAt,
      dotColor: 'bg-green-600',
    });
  }

  if (request.completedAt) {
    events.push({
      key: 'completed',
      label: 'Request completed',
      timestamp: request.completedAt,
      dotColor: 'bg-gray-400',
    });
  }

  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Review History</h3>
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
