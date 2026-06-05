import { useState } from 'react';
import { CheckCircle, ArrowUp, XCircle, AlertTriangle } from 'lucide-react';
import type { PartsRequest } from '@/types/inventory';
import { useAuthStore } from '@/store/authStore';

interface Props {
  request: PartsRequest;
  settings: { approvalThresholdLKR: number };
  onDecision: (payload: {
    decision: 'approve' | 'escalate' | 'reject' | 'partial';
    notes: string;
    escalationReason: string;
    approvedQuantities?: Record<string, number>;
  }) => Promise<void>;
}

const ESCALATION_REASONS = [
  'Cost exceeds approval limit',
  'Critical parts require supervisor sign-off',
  'Unusual request — needs verification',
  'Contractor job — supervisor awareness required',
  'Other',
];

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RequestReviewPanel({ request, settings, onDecision }: Props) {
  const role = useAuthStore((s) => s.userProfile?.role);

  const hasCritical = request.items.some((i) => i.isCritical);
  const isEligibleForAutoApproval =
    request.totalEstimatedCost <= settings.approvalThresholdLKR && !hasCritical;

  const [notes, setNotes] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [customEscalation, setCustomEscalation] = useState('');
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>(
    Object.fromEntries(request.items.map((i) => [i.id, i.quantityRequested]))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<'approve' | 'escalate' | 'reject' | 'partial' | null>(null);

  async function handleDecision(decision: 'approve' | 'escalate' | 'reject' | 'partial') {
    setIsLoading(true);
    setActiveAction(decision);
    try {
      const finalEscalation =
        escalationReason === 'Other' ? customEscalation : escalationReason;
      await onDecision({
        decision,
        notes,
        escalationReason: finalEscalation,
        approvedQuantities: decision === 'partial' ? approvedQuantities : undefined,
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }

  // Completed states — read only
  if (
    ['parts_reserved', 'approved', 'issued', 'completed'].includes(request.status)
  ) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2 text-green-700 font-semibold">
          <CheckCircle className="w-5 h-5" />
          <span>{formatStatus(request.status)}</span>
        </div>
        <p className="text-sm text-green-600 mt-1">This request has been processed.</p>
      </div>
    );
  }

  // Technician sees nothing
  if (role === 'technician') return null;

  const isStoreKeeper = role === 'store_keeper';
  const isSupervisorOrAbove = role === 'supervisor' || role === 'plant_manager' || role === 'admin';

  return (
    <div className="space-y-4">
      {/* Auto-approval eligibility info */}
      <div
        className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
          isEligibleForAutoApproval
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}
      >
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">Auto-approval eligible: </span>
          {isEligibleForAutoApproval ? (
            <span>Yes — cost is within threshold and no critical parts</span>
          ) : (
            <span>
              No —{' '}
              {request.totalEstimatedCost > settings.approvalThresholdLKR
                ? `cost (LKR ${request.totalEstimatedCost.toLocaleString()}) exceeds threshold (LKR ${settings.approvalThresholdLKR.toLocaleString()})`
                : 'request contains critical parts'}
            </span>
          )}
        </div>
      </div>

      {/* Store Keeper actions */}
      {isStoreKeeper && request.status === 'pending_storekeeper' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Store Keeper Review</h3>

          {/* Per-item quantities */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Approved Quantities
            </p>
            {request.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.partName}</p>
                  <p className="text-xs text-gray-500 font-mono">{item.partNumber}</p>
                  {item.isCritical && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                      Critical
                    </span>
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
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        ),
                      }))
                    }
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">{item.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add any notes for the technician or supervisor…"
            />
          </div>

          {/* Escalation reason — shown when escalate action is selected */}
          {activeAction === 'escalate' && (
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Describe reason for escalation…"
                />
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDecision('approve')}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              {isLoading && activeAction === 'approve' ? 'Approving…' : 'Approve'}
            </button>

            <button
              onClick={() => {
                if (activeAction !== 'escalate') {
                  setActiveAction('escalate');
                } else if (escalationReason && (escalationReason !== 'Other' || customEscalation)) {
                  handleDecision('escalate');
                }
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
              {isLoading && activeAction === 'escalate'
                ? 'Escalating…'
                : activeAction === 'escalate'
                ? 'Confirm Escalate'
                : 'Escalate to Supervisor'}
            </button>

            <button
              onClick={() => handleDecision('reject')}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="w-4 h-4" />
              {isLoading && activeAction === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>

            {request.items.some(
              (i) => (approvedQuantities[i.id] ?? i.quantityRequested) < i.quantityRequested
            ) && (
              <button
                onClick={() => handleDecision('partial')}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {isLoading && activeAction === 'partial' ? 'Saving…' : 'Partially Approve'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Supervisor actions */}
      {isSupervisorOrAbove && request.status === 'pending_supervisor' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Supervisor Review</h3>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes / Reason</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add approval notes or rejection reason…"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleDecision('approve')}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              {isLoading && activeAction === 'approve' ? 'Approving…' : 'Approve'}
            </button>

            <button
              onClick={() => handleDecision('reject')}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="w-4 h-4" />
              {isLoading && activeAction === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
