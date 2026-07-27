import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ScanLine, PackageMinus } from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { PartQrScanModal } from '@/components/inventory/shared/PartQrScanModal';
import { CategoryBadge } from '@/components/inventory/shared/CategoryBadge';
import type { InventoryPart } from '@/types/inventory';

const ISSUE_REASONS = [
  'Breakdown repair (no WO request raised)',
  'Preventive maintenance',
  'Contractor job',
  'Emergency / urgent need',
  'Other',
];

export function ManualIssuePage() {
  const { addToast } = useToast();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';

  const [showScanner, setShowScanner] = useState(true);
  const [part, setPart] = useState<InventoryPart | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState(ISSUE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { workOrders } = useWorkOrders({ status: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'] });

  async function handleScan(partNumber: string) {
    setShowScanner(false);
    if (!companyId) return;
    setLookingUp(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'inventoryParts'),
          where('companyId', '==', companyId),
          where('partNumber', '==', partNumber),
          limit(1),
        ),
      );
      if (snap.empty) {
        addToast(`No part found for "${partNumber}"`, 'error');
        return;
      }
      const docSnap = snap.docs[0];
      setPart({ ...docSnap.data(), id: docSnap.id } as InventoryPart);
      setQuantity(1);
    } catch (err) {
      console.error(err);
      addToast('Failed to look up part.', 'error');
    } finally {
      setLookingUp(false);
    }
  }

  function reset() {
    setPart(null);
    setQuantity(1);
    setReason(ISSUE_REASONS[0]);
    setCustomReason('');
    setWorkOrderId('');
    setShowScanner(true);
  }

  async function handleSubmit() {
    if (!part || !userProfile || !companyId) return;
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) {
      addToast('Enter a reason for issuing these parts.', 'error');
      return;
    }
    if (quantity <= 0 || quantity > part.currentStock) {
      addToast(`Quantity must be between 1 and available stock (${part.currentStock}).`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const selectedWo = workOrders.find((wo) => wo.id === workOrderId);

      await runTransaction(db, async (tx) => {
        const partRef = doc(db, 'inventoryParts', part.id);
        const partSnap = await tx.get(partRef);
        if (!partSnap.exists()) throw new Error('Part no longer exists.');
        const data = partSnap.data();
        const currentStock = (data.currentStock as number) ?? 0;
        if (quantity > currentStock) {
          throw new Error('Stock changed — not enough available anymore.');
        }

        const now = serverTimestamp();
        tx.update(partRef, {
          currentStock: currentStock - quantity,
          totalUsedAllTime: ((data.totalUsedAllTime as number) ?? 0) + quantity,
          lastIssuedAt: now,
          updatedAt: now,
          updatedBy: userProfile.id,
        });

        const movRef = doc(collection(db, 'stockMovements'));
        tx.set(movRef, {
          companyId,
          partId: part.id,
          partNumber: part.partNumber,
          partName: part.name,
          movementType: 'issue',
          quantityBefore: currentStock,
          quantityChange: -quantity,
          quantityAfter: currentStock - quantity,
          referenceType: 'manual_qr_issue',
          referenceId: null,
          workOrderId: selectedWo?.id ?? null,
          workOrderNumber: selectedWo?.woNumber ?? null,
          partsRequestId: null,
          performedBy: userProfile.id,
          performedByName: userProfile.fullName,
          performedByRole: userProfile.role,
          performedAt: now,
          notes: finalReason,
          unitCostAtTime: part.unitCost,
          totalCostImpact: part.unitCost * quantity,
        });
      });

      addToast('Parts issued successfully.', 'success');
      reset();
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Failed to issue parts.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/app/inventory" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Scan &amp; Issue Parts</h1>
      </div>
      <p className="text-sm text-gray-500">
        Scan a part's QR code to issue it directly from stock — for cases where no parts request
        exists yet (e.g. a breakdown handled on the spot).
      </p>

      {!part && (
        <button
          onClick={() => setShowScanner(true)}
          disabled={lookingUp}
          className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <ScanLine className="w-8 h-8" />
          <span className="font-medium">{lookingUp ? 'Looking up part…' : 'Tap to scan part QR'}</span>
        </button>
      )}

      {part && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 font-mono">{part.partNumber}</p>
              <h2 className="text-lg font-bold text-gray-900">{part.name}</h2>
              <div className="mt-1"><CategoryBadge category={part.category} /></div>
            </div>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-red-600">
              Scan different part
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Available Stock</p>
              <p className="font-semibold text-gray-900">{part.currentStock} {part.unit}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Store Location</p>
              <p className="font-semibold text-gray-900">{part.storeLocation || ''}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Issue *</label>
            <input
              type="number"
              min={1}
              max={part.currentStock}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ISSUE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the reason…"
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Order (optional)</label>
            <select
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— No WO ticket —</option>
              {workOrders.map((wo) => (
                <option key={wo.id} value={wo.id}>{wo.woNumber} · {wo.machineName} — {wo.description}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <PackageMinus className="w-4 h-4" />
            {submitting ? 'Issuing…' : 'Issue Parts'}
          </button>
        </div>
      )}

      {showScanner && (
        <PartQrScanModal
          title="Scan Part to Issue"
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
export default ManualIssuePage;
