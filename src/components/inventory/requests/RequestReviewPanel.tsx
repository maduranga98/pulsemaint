import { useState } from 'react';
import { CheckCircle, XCircle, PackageCheck, Undo2, ArrowUp } from 'lucide-react';
import type { PartsRequest } from '@/types/inventory';
import { useAuthStore } from '@/store/authStore';

interface Props {
  request: PartsRequest;
  onDecision: (payload: {
    decision: 'approve' | 'partial' | 'escalate' | 'reject';
    notes?: string;
    escalationReason?: string;
    rejectionReason?: string;
    approvedQuantities?: Record<string, number>;
  }) => Promise<void>;
  onCollection: (collected: boolean, collectorName: string) => Promise<void>;
}

const ESCALATION_REASONS = [
  'Cost exceeds approval limit',
  'Critical parts require supervisor sign-off',
  'Unusual request — needs verification',
  'Contractor job — supervisor awareness required',
  'Other',
];

// Statuses in which the parts have been issued and are waiting to be collected.
const AWAITING_COLLECTION = ['parts_reserved', 'approved', 'partially_approved'];

function formatStatus(status: string): string {
  if (status === 'parts_reserved') return 'Parts to Collect';
  if (status === 'pending_storekeeper' || status === 'pending_supervisor') return 'To Review';
  if (status === 'cancelled') return 'Not Collected';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RequestReviewPanel({ request, onDecision, onCollection }: Props) {
  const role = useAuthStore((s) => s.userProfile?.role);

  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<
    'approve' | 'partial' | 'escalate' | 'reject' | 'collect' | 'return' | null
  >(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [customEscalation, setCustomEscalation] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [collectorName, setCollectorName] = useState(request.requestedByName ?? '');
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>(
    Object.fromEntries(
      request.items.map((i) => [i.id, i.quantityApproved > 0 ? i.quantityApproved : i.quantityRequested]),
    ),
  );

  const canManage = role === 'store_keeper' || role === 'supervisor' || role === 'admin' || role === 'plant_manager';

  async function run(action: typeof activeAction, fn: () => Promise<void>) {
    setIsLoading(true);
    setActiveAction(action);
    try {
      await fn();
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }

  const isPartial = request.items.some(
    (i) => (approvedQuantities[i.id] ?? i.quantityRequested) < i.quantityRequested,
  );

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

  const isStoreKeeperStage = request.status === 'pending_storekeeper';
  const isSupervisorStage = request.status === 'pending_supervisor';

  // Requester (technician) or a stage this user can't act on → nothing to show.
  if (!canManage || (!isStoreKeeperStage && !isSupervisorStage)) return null;
  // Only supervisors / managers / admins act on the supervisor stage.
  if (isSupervisorStage && role === 'store_keeper') {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        Escalated — awaiting supervisor review.
      </div>
    );
  }

  // ── Store keeper / supervisor review ──────────────────────────────────────
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">
        {isSupervisorStage ? 'Supervisor Review' : 'Review Request'}
      </h3>

      {/* Per-item approved quantities (enables partial issue) */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Approved Quantities</p>
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
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500">Req: {item.quantityRequested}</span>
              <input
                type="number"
                min={0}
                max={item.quantityRequested}
                value={approvedQuantities[item.id] ?? item.quantityRequested}
                onChange={(e) =>
                  setApprovedQuantities((prev) => ({
                    ...prev,
                    [item.id]: Math.min(
                      item.quantityRequested,
                      Math.max(0, parseInt(e.target.value, 10) || 0),
                    ),
                  }))
                }
                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">{item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Escalation reason — store keeper only, shown when escalate is armed */}
      {isStoreKeeperStage && activeAction === 'escalate' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-500">
            Escalation Reason <span className="text-red-500">*</span>
          </label>
          <div className="space-y-1">
            {ESCALATION_REASONS.map((reason) => (
              <label key={reason} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="escalation"
                  value={reason}
                  checked={escalationReason === reason}
                  onChange={() => setEscalationReason(reason)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">{reason}</span>
              </label>
            ))}
          </div>
          {escalationReason === 'Other' && (
            <textarea
              value={customEscalation}
              onChange={(e) => setCustomEscalation(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe reason for escalation…"
            />
          )}
        </div>
      )}

      {/* Reject reason */}
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

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {isPartial ? (
          <button
            onClick={() => run('partial', () => onDecision({ decision: 'partial', approvedQuantities }))}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PackageCheck className="w-4 h-4" />
            {isLoading && activeAction === 'partial' ? 'Issuing…' : 'Partially Issue'}
          </button>
        ) : (
          <button
            onClick={() => run('approve', () => onDecision({ decision: 'approve', approvedQuantities }))}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PackageCheck className="w-4 h-4" />
            {isLoading && activeAction === 'approve' ? 'Issuing…' : 'Issue Parts'}
          </button>
        )}

        {isStoreKeeperStage && (
          <button
            onClick={() => {
              const finalReason = escalationReason === 'Other' ? customEscalation : escalationReason;
              if (activeAction !== 'escalate') {
                setActiveAction('escalate');
              } else if (finalReason.trim()) {
                run('escalate', () => onDecision({ decision: 'escalate', escalationReason: finalReason.trim() }));
              }
            }}
            disabled={
              isLoading ||
              (activeAction === 'escalate' &&
                !(escalationReason === 'Other' ? customEscalation.trim() : escalationReason.trim()))
            }
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
            {isLoading && activeAction === 'escalate'
              ? 'Escalating…'
              : activeAction === 'escalate'
              ? 'Confirm Escalate'
              : 'Escalate to Supervisor'}
          </button>
        )}

        <button
          onClick={() => {
            if (activeAction !== 'reject') {
              setActiveAction('reject');
            } else if (rejectReason.trim()) {
              run('reject', () => onDecision({ decision: 'reject', rejectionReason: rejectReason.trim() }));
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
