import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useMyJobQueue } from '@/hooks/dashboard/useMyJobQueue';
import { PartSearchInput } from '@/components/inventory/shared/PartSearchInput';
import type { InventoryPart, RequestItem } from '@/types/inventory';

interface WorkOrderContext {
  id: string;
  woNumber: string;
  woType: string;
  machineId: string | null;
  machineName: string | null;
  isContractorJob?: boolean;
  contractorCompany?: string | null;
}

interface CreatePartsRequestModalProps {
  onClose: () => void;
  onCreated?: (requestId: string) => void;
  /** When set, the request is linked to this work order. */
  workOrder?: WorkOrderContext;
}

type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

interface DraftItem {
  part: InventoryPart;
  quantity: number;
  notes: string;
}

function makeRequestNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `PR-${ymd}-${nanoid(5).toUpperCase()}`;
}

export function CreatePartsRequestModal({ onClose, onCreated, workOrder }: CreatePartsRequestModalProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>('medium');
  const [isUrgent, setIsUrgent] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // When the caller doesn't already pin a work order (e.g. a technician
  // opening "Request Parts" from the dashboard rather than from an open WO),
  // let them link one of their own open jobs, or fall back to a manual
  // reason. Fixed-context callers (the WO execution sheet) skip all of this.
  const allowWoPicker = !workOrder;
  const siteId = userProfile?.siteIds?.[0] ?? userProfile?.companyId ?? '';
  const { workOrders: myWorkOrders } = useMyJobQueue(
    allowWoPicker ? userProfile?.id ?? '' : '',
    siteId,
  );
  const [linkedWoId, setLinkedWoId] = useState<string>('');

  const selectedWo = allowWoPicker ? myWorkOrders.find((wo) => wo.id === linkedWoId) ?? null : null;
  const effectiveWorkOrder: WorkOrderContext | undefined = workOrder
    ?? (selectedWo
      ? {
          id: selectedWo.id,
          woNumber: selectedWo.woNumber,
          woType: selectedWo.woType,
          machineId: selectedWo.machineId,
          machineName: selectedWo.machineName,
          isContractorJob: selectedWo.woType === 'CONTRACTOR',
          contractorCompany: selectedWo.contractorCompanyName ?? null,
        }
      : undefined);
  const needsManualReason = allowWoPicker && !selectedWo;

  const addPart = (part: InventoryPart) => {
    setItems((prev) => [...prev, { part, quantity: 1, notes: '' }]);
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalEstimatedCost = items.reduce(
    (sum, it) => sum + (it.part.unitCost || 0) * it.quantity,
    0,
  );

  const handleSubmit = async () => {
    if (!userProfile || items.length === 0) return;
    if (items.some((it) => !it.quantity || it.quantity < 1)) {
      setError('Every item needs a quantity of at least 1.');
      return;
    }
    if (needsManualReason && !purpose.trim()) {
      setError('Select a linked work order, or enter a reason for this request.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const requestItems: RequestItem[] = items.map((it) => {
        const available = it.part.availableStock ?? it.part.currentStock ?? 0;
        return {
          id: nanoid(),
          partId: it.part.id,
          partNumber: it.part.partNumber,
          partName: it.part.name,
          unitCost: it.part.unitCost || 0,
          quantityRequested: it.quantity,
          quantityApproved: 0,
          quantityIssued: 0,
          quantityReturned: 0,
          unit: it.part.unit,
          notes: it.notes,
          availableAtRequest: available,
          isAvailable: available >= it.quantity,
          isCritical: it.part.isCritical ?? false,
        };
      });

      const docRef = await addDoc(collection(db, 'partsRequests'), {
        companyId: userProfile.companyId,
        requestNumber: makeRequestNumber(),
        workOrderId: effectiveWorkOrder?.id ?? null,
        workOrderNumber: effectiveWorkOrder?.woNumber ?? null,
        workOrderType: effectiveWorkOrder?.woType ?? null,
        machineId: effectiveWorkOrder?.machineId ?? null,
        machineName: effectiveWorkOrder?.machineName ?? null,
        requestedBy: userProfile.id,
        requestedByName: userProfile.fullName,
        requestedByRole: userProfile.role,
        requestedAt: serverTimestamp(),
        isContractorJob: effectiveWorkOrder?.isContractorJob ?? false,
        contractorCompany: effectiveWorkOrder?.contractorCompany ?? null,
        items: requestItems,
        purpose: purpose.trim() || null,
        totalEstimatedCost,
        totalApprovedCost: 0,
        status: 'pending_storekeeper',
        storeKeeperReview: null,
        supervisorReview: null,
        reservedAt: null,
        issuedAt: null,
        issuedBy: null,
        issuedByName: null,
        completedAt: null,
        returnedAt: null,
        priorityLevel,
        isUrgent,
      });
      setDone(true);
      onCreated?.(docRef.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Request Parts</h2>
            {effectiveWorkOrder && (
              <p className="text-xs text-gray-500 mt-0.5">
                For work order <span className="font-mono font-medium">{effectiveWorkOrder.woNumber}</span>
                {effectiveWorkOrder.machineName && <> · {effectiveWorkOrder.machineName}</>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {done ? (
            <div className="text-center py-8">
              <p className="text-green-600 font-medium text-lg">Parts request submitted!</p>
              <p className="text-sm text-gray-500 mt-1">
                The store keeper will review your request.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {allowWoPicker && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link to a work order (optional)
                  </label>
                  <select
                    value={linkedWoId}
                    onChange={(e) => setLinkedWoId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">No work order — enter a reason below</option>
                    {myWorkOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.woNumber} · {wo.machineName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Pick the job ticket this request is for, or leave unlinked and explain why below.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add parts</label>
                <PartSearchInput
                  onSelect={addPart}
                  excludePartIds={items.map((it) => it.part.id)}
                />
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((it, idx) => {
                    const available = it.part.availableStock ?? it.part.currentStock ?? 0;
                    return (
                      <div key={it.part.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{it.part.name}</p>
                            <p className="text-xs text-gray-500 font-mono">
                              {it.part.partNumber} · {available} {it.part.unit} available
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-gray-400 hover:text-red-600 shrink-0"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-3 mt-2">
                          <div className="w-28">
                            <label className="block text-xs text-gray-500 mb-0.5">Quantity</label>
                            <input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value, 10) || 0 })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-0.5">Notes (optional)</label>
                            <input
                              type="text"
                              value={it.notes}
                              onChange={(e) => updateItem(idx, { notes: e.target.value })}
                              placeholder="e.g. replacement for worn part"
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={priorityLevel}
                    onChange={(e) => setPriorityLevel(e.target.value as PriorityLevel)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={isUrgent}
                      onChange={(e) => setIsUrgent(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Mark as urgent
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {needsManualReason ? 'Reason for request (required)' : 'Purpose (optional)'}
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={2}
                  placeholder="What are these parts needed for?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {!done && (
          <div className="p-5 border-t border-gray-200 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {totalEstimatedCost > 0 && ` · est. cost ${totalEstimatedCost.toLocaleString()}`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={items.length === 0 || submitting || (needsManualReason && !purpose.trim())}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
