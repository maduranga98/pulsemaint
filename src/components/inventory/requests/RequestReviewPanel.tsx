import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, PackageCheck, Undo2, ArrowUp, RotateCcw, X } from 'lucide-react';
import type { PartsRequest } from '@/types/inventory';
import { useAuthStore } from '@/store/authStore';
import { usePartReturns } from '@/hooks/inventory/usePartReturns';

interface Props {
  request: PartsRequest;
  onDecision: (payload: {
    decision: 'approve' | 'partial' | 'escalate' | 'reject';
    notes?: string;
    escalationReason?: string;
    rejectionReason?: string;
    approvedQuantities?: Record<string, number>;
    returnableItemIds?: Record<string, boolean>;
  }) => Promise<void>;
  onCollection: (collected: boolean, collectorName: string, returnableItemIds?: Record<string, boolean>) => Promise<void>;
  onRequestReturn: (itemId: string, quantity: number) => Promise<void>;
  onCancelReturn: (returnId: string) => Promise<void>;
}

const ESCALATION_REASON_KEYS = [
  'costExceedsLimit',
  'criticalPartsSignOff',
  'unusualRequest',
  'contractorAwareness',
  'other',
] as const;

// Statuses in which the parts have been issued and are waiting to be collected.
const AWAITING_COLLECTION = ['parts_reserved', 'approved', 'partially_approved'];

export function RequestReviewPanel({ request, onDecision, onCollection, onRequestReturn, onCancelReturn }: Props) {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.userProfile?.role);
  const userId = useAuthStore((s) => s.userProfile?.id);

  const escalationReasons = ESCALATION_REASON_KEYS.map((key) => ({
    key,
    label: t(`common.inventory.requests.reviewPanel.escalationReasons.${key}`),
  }));

  function formatStatus(status: string): string {
    return t(`common.inventory.requests.statusLabels.${status}`, {
      defaultValue: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    });
  }

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
  const [returnableItemIds, setReturnableItemIds] = useState<Record<string, boolean>>({});
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returningItemId, setReturningItemId] = useState<string | null>(null);
  const [cancellingReturnId, setCancellingReturnId] = useState<string | null>(null);

  const canManage = role === 'store_keeper' || role === 'supervisor' || role === 'admin' || role === 'plant_manager';
  const isRequester = request.requestedBy === userId;

  const { returns: myPendingReturns } = usePartReturns({ ownOnly: true, status: 'pending' });
  const pendingReturnsFor = (itemId: string) => {
    const item = request.items.find((i) => i.id === itemId);
    if (!item) return [];
    return myPendingReturns.filter((r) => r.partsRequestId === request.id && r.partId === item.partId);
  };
  const pendingReturnQtyFor = (itemId: string) =>
    pendingReturnsFor(itemId).reduce((sum, r) => sum + r.quantity, 0);

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
          <Trans
            i18nKey="common.inventory.requests.reviewPanel.awaitingCollectionMessage"
            values={{ name: request.requestedByName }}
            components={{ 1: <strong /> }}
          />
        </p>

        {canManage ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-600">{t('common.inventory.requests.reviewPanel.markReturnableTitle')}</p>
              {request.items.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!returnableItemIds[item.id]}
                    onChange={(e) =>
                      setReturnableItemIds((prev) => ({ ...prev, [item.id]: e.target.checked }))
                    }
                    className="rounded text-indigo-600"
                  />
                  {item.partName}
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.inventory.requests.reviewPanel.collectedByLabel')}</label>
              <input
                type="text"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                placeholder={t('common.inventory.requests.reviewPanel.collectedByPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => run('collect', () => onCollection(true, collectorName, returnableItemIds))}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {isLoading && activeAction === 'collect' ? t('common.inventory.requests.reviewPanel.saving') : t('common.inventory.requests.reviewPanel.markCollected')}
              </button>
              <button
                onClick={() => run('return', () => onCollection(false, collectorName))}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Undo2 className="w-4 h-4" />
                {isLoading && activeAction === 'return' ? t('common.inventory.requests.reviewPanel.returning') : t('common.inventory.requests.reviewPanel.notCollectedReturnStock')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-indigo-600">{t('common.inventory.requests.reviewPanel.storeKeeperWillConfirm')}</p>
        )}
      </div>
    );
  }

  // ── Completed / issued (legacy) ───────────────────────────────────────────
  if (['issued', 'completed'].includes(request.status)) {
    const collectedAt = request.collectedAt ?? request.issuedAt;
    const returnableItems = request.items.filter((i) => i.isReturnable && !i.isReturned);
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-700 font-semibold">
            <CheckCircle className="w-5 h-5" />
            <span>{formatStatus(request.status)}</span>
          </div>
          <div className="text-sm text-green-700 mt-2 space-y-1">
            {request.collectedByName && (
              <p>
                {t('common.inventory.requests.reviewPanel.collectedByStrong')} <strong>{request.collectedByName}</strong>
                {collectedAt && <> {t('common.inventory.requests.reviewPanel.collectedOn', { date: collectedAt.toDate().toLocaleString() })}</>}
              </p>
            )}
            {(request.confirmedByName || request.issuedByName) && (
              <p>
                {t('common.inventory.requests.reviewPanel.confirmedBy')} <strong>{request.confirmedByName ?? request.issuedByName}</strong>
              </p>
            )}
            {!request.collectedByName && <p className="text-green-600">{t('common.inventory.requests.reviewPanel.requestProcessed')}</p>}
          </div>
        </div>

        {isRequester && returnableItems.length > 0 && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-700 font-semibold">
              <RotateCcw className="w-5 h-5" />
              <span>{t('common.inventory.requests.reviewPanel.returnableItemsTitle')}</span>
            </div>
            {returnableItems.map((item) => {
              const alreadyIssued = item.quantityIssued > 0 ? item.quantityIssued : item.quantityApproved;
              const pending = pendingReturnsFor(item.id);
              const alreadyPending = pendingReturnQtyFor(item.id);
              const remaining = Math.max(0, alreadyIssued - alreadyPending);
              return (
                <div key={item.id} className="space-y-2">
                  {pending.length > 0 && (
                    <div className="space-y-1">
                      {pending.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between text-sm bg-purple-100 rounded-lg px-3 py-1.5"
                        >
                          <span className="text-purple-800">
                            {t('common.inventory.requests.reviewPanel.pendingConfirmation', {
                              part: item.partName,
                              quantity: r.quantity,
                              unit: item.unit,
                            })}
                          </span>
                          <button
                            onClick={async () => {
                              setCancellingReturnId(r.id);
                              try {
                                await onCancelReturn(r.id);
                              } finally {
                                setCancellingReturnId(null);
                              }
                            }}
                            disabled={cancellingReturnId === r.id}
                            className="flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            {cancellingReturnId === r.id ? t('common.inventory.requests.reviewPanel.cancelling') : t('common.inventory.requests.reviewPanel.cancel')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {remaining > 0 && (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{item.partName}</p>
                        <p className="text-xs text-gray-500">
                          {t('common.inventory.requests.reviewPanel.issuedLabel', { quantity: alreadyIssued, unit: item.unit })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={remaining}
                          value={returnQuantities[item.id] ?? remaining}
                          onChange={(e) =>
                            setReturnQuantities((prev) => ({
                              ...prev,
                              [item.id]: Math.min(remaining, Math.max(1, parseInt(e.target.value, 10) || 1)),
                            }))
                          }
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={async () => {
                            setReturningItemId(item.id);
                            try {
                              await onRequestReturn(item.id, returnQuantities[item.id] ?? remaining);
                            } finally {
                              setReturningItemId(null);
                            }
                          }}
                          disabled={returningItemId === item.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {returningItemId === item.id ? t('common.inventory.requests.reviewPanel.requesting') : t('common.inventory.requests.reviewPanel.markAsReturned')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
            {t('common.inventory.requests.reviewPanel.reasonLabel', {
              reason: request.rejectionReason || request.storeKeeperReview?.notes,
            })}
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
        {t('common.inventory.requests.reviewPanel.escalatedAwaitingSupervisor')}
      </div>
    );
  }

  // ── Store keeper / supervisor review ──────────────────────────────────────
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">
        {isSupervisorStage
          ? t('common.inventory.requests.reviewPanel.supervisorReviewTitle')
          : t('common.inventory.requests.reviewPanel.reviewRequestTitle')}
      </h3>

      {/* Per-item approved quantities (enables partial issue) */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('common.inventory.requests.reviewPanel.approvedQuantitiesTitle')}</p>
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
                  {t('common.inventory.requests.itemsTable.critical')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500">{t('common.inventory.requests.reviewPanel.reqLabel', { quantity: item.quantityRequested })}</span>
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
            {t('common.inventory.requests.reviewPanel.escalationReasonLabel')} <span className="text-red-500">*</span>
          </label>
          <div className="space-y-1">
            {escalationReasons.map((reason) => (
              <label key={reason.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="escalation"
                  value={reason.label}
                  checked={escalationReason === reason.label}
                  onChange={() => setEscalationReason(reason.label)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">{reason.label}</span>
              </label>
            ))}
          </div>
          {escalationReason === t('common.inventory.requests.reviewPanel.escalationReasons.other') && (
            <textarea
              value={customEscalation}
              onChange={(e) => setCustomEscalation(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={t('common.inventory.requests.reviewPanel.escalationReasonOtherPlaceholder')}
            />
          )}
        </div>
      )}

      {/* Reject reason */}
      {activeAction === 'reject' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('common.inventory.requests.reviewPanel.rejectionReasonLabel')} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder={t('common.inventory.requests.reviewPanel.rejectionReasonPlaceholder')}
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
            {isLoading && activeAction === 'partial' ? t('common.inventory.requests.reviewPanel.issuing') : t('common.inventory.requests.reviewPanel.partiallyIssue')}
          </button>
        ) : (
          <button
            onClick={() => run('approve', () => onDecision({ decision: 'approve', approvedQuantities }))}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PackageCheck className="w-4 h-4" />
            {isLoading && activeAction === 'approve' ? t('common.inventory.requests.reviewPanel.issuing') : t('common.inventory.requests.reviewPanel.issueParts')}
          </button>
        )}

        {isStoreKeeperStage && (
          <button
            onClick={() => {
              const finalReason = escalationReason === t('common.inventory.requests.reviewPanel.escalationReasons.other') ? customEscalation : escalationReason;
              if (activeAction !== 'escalate') {
                setActiveAction('escalate');
              } else if (finalReason.trim()) {
                run('escalate', () => onDecision({ decision: 'escalate', escalationReason: finalReason.trim() }));
              }
            }}
            disabled={
              isLoading ||
              (activeAction === 'escalate' &&
                !(escalationReason === t('common.inventory.requests.reviewPanel.escalationReasons.other') ? customEscalation.trim() : escalationReason.trim()))
            }
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
            {isLoading && activeAction === 'escalate'
              ? t('common.inventory.requests.reviewPanel.escalating')
              : activeAction === 'escalate'
              ? t('common.inventory.requests.reviewPanel.confirmEscalate')
              : t('common.inventory.requests.reviewPanel.escalateToSupervisor')}
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
            ? t('common.inventory.requests.reviewPanel.rejecting')
            : activeAction === 'reject'
            ? t('common.inventory.requests.reviewPanel.confirmReject')
            : t('common.inventory.requests.reviewPanel.reject')}
        </button>
      </div>
    </div>
  );
}
