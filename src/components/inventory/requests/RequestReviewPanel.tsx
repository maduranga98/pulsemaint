import { useState } from 'react';
import { CheckCircle, XCircle, PackageCheck, Undo2 } from 'lucide-react';
import type { PartsRequest } from '@/types/inventory';
import { useAuthStore } from '@/store/authStore';

interface Props {
  request: PartsRequest;
  onIssue: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onCollection: (collected: boolean, collectorName: string) => Promise<void>;
}

function formatStatus(status: string): string {
  if (status === 'parts_reserved') return 'Parts to Collect';
  if (status === 'pending_storekeeper' || status === 'pending_supervisor') return 'To Review';
  if (status === 'cancelled') return 'Not Collected';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Statuses in which the parts have been issued and are waiting to be collected.
const AWAITING_COLLECTION = ['parts_reserved', 'approved', 'partially_approved'];
// Statuses in which the storekeeper still needs to review (issue or reject).
const NEEDS_REVIEW = ['pending_storekeeper', 'pending_supervisor'];

export function RequestReviewPanel({ request, onIssue, onReject, onCollection }: Props) {
  const role = useAuthStore((s) => s.userProfile?.role);

  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<'issue' | 'reject' | 'collect' | 'return' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [collectorName, setCollectorName] = useState(request.requestedByName ?? '');

  const canManage = role === 'store_keeper' || role === 'supervisor' || role === 'admin' || role === 'plant_manager';

  async function run(action: 'issue' | 'reject' | 'collect' | 'return', fn: () => Promise<void>) {
    setIsLoading(true);
    setActiveAction(action);
    try {
      await fn();
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }

  // ── Waiting for collection ────────────────────────────────────────────────
  if (AWAITING_COLLECTION.includes(request.status)) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-indigo-700 font-semibold">
          <PackageCheck className="w-5 h-5" />
          <span>{formatStatus(request.status)}</span>
        </div>
        <p className="text-sm text-indigo-700">
          Parts have been issued and stock deducted. Awaiting collection by{' '}
          <strong>{request.requestedByName}</strong>.
        </p>

        {canManage ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Collected by</label>
              <input
                type="text"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                placeholder="Name of the person collecting the parts"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => run('collect', () => onCollection(true, collectorName))}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {isLoading && activeAction === 'collect' ? 'Saving…' : 'Mark Collected'}
              </button>
              <button
                onClick={() => run('return', () => onCollection(false, collectorName))}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Undo2 className="w-4 h-4" />
                {isLoading && activeAction === 'return' ? 'Returning…' : 'Not Collected — Return Stock'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-indigo-600">The store keeper will confirm collection.</p>
        )}
      </div>
    );
  }

  // ── Completed / issued (legacy) ───────────────────────────────────────────
  if (['issued', 'completed'].includes(request.status)) {
    const collectedAt = request.collectedAt ?? request.issuedAt;
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2 text-green-700 font-semibold">
          <CheckCircle className="w-5 h-5" />
          <span>{formatStatus(request.status)}</span>
        </div>
        <div className="text-sm text-green-700 mt-2 space-y-1">
          {request.collectedByName && (
            <p>
              Collected by <strong>{request.collectedByName}</strong>
              {collectedAt && <> on {collectedAt.toDate().toLocaleString()}</>}
            </p>
          )}
          {(request.confirmedByName || request.issuedByName) && (
            <p>
              Confirmed by <strong>{request.confirmedByName ?? request.issuedByName}</strong>
            </p>
          )}
          {!request.collectedByName && <p className="text-green-600">This request has been processed.</p>}
        </div>
      </div>
    );
  }

  // ── Rejected / not collected (read-only) ──────────────────────────────────
  if (['rejected', 'cancelled'].includes(request.status)) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-700 font-semibold">
          <XCircle className="w-5 h-5" />
          <span>{formatStatus(request.status)}</span>
        </div>
        {request.status === 'rejected' && (request.rejectionReason || request.storeKeeperReview?.notes) && (
          <p className="text-sm text-red-700 mt-2">
            Reason: {request.rejectionReason || request.storeKeeperReview?.notes}
          </p>
        )}
      </div>
    );
  }

  // Requester (technician) sees nothing to act on.
  if (!canManage || !NEEDS_REVIEW.includes(request.status)) return null;

  // ── Store keeper review — Issue or Reject ─────────────────────────────────
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">Review Request</h3>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Requested Parts</p>
        {request.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.partName}</p>
              <p className="text-xs text-gray-500 font-mono">{item.partNumber}</p>
              {item.isCritical && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">Critical</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-sm">
              <span className="font-semibold text-gray-900">{item.quantityRequested}</span>
              <span className="text-xs text-gray-500">{item.unit}</span>
              {item.availableAtRequest < item.quantityRequested && (
                <span className="ml-2 text-xs text-amber-600">only {item.availableAtRequest} in stock</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reject reason — shown once the reject flow is started */}
      {activeAction === 'reject' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Rejection reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Why is this request being rejected?"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run('issue', onIssue)}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PackageCheck className="w-4 h-4" />
          {isLoading && activeAction === 'issue' ? 'Issuing…' : 'Issue Parts'}
        </button>

        <button
          onClick={() => {
            if (activeAction !== 'reject') {
              setActiveAction('reject');
            } else if (rejectReason.trim()) {
              run('reject', () => onReject(rejectReason.trim()));
            }
          }}
          disabled={isLoading || (activeAction === 'reject' && !rejectReason.trim())}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <XCircle className="w-4 h-4" />
          {isLoading && activeAction === 'reject'
            ? 'Rejecting…'
            : activeAction === 'reject'
            ? 'Confirm Reject'
            : 'Reject'}
        </button>
      </div>
    </div>
  );
}
