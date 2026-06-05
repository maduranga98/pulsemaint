import { useState, useRef, useEffect } from 'react';
import { Minus, Plus, RefreshCw, X, Check } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  doc,
  runTransaction,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuthStore } from '@/store/authStore';
import type { PartUnit } from '@/types/inventory';

interface QuickStockAdjustProps {
  partId: string;
  currentStock: number;
  unit: PartUnit;
  onComplete?: () => void;
}

type AllowedRole = 'store_keeper' | 'supervisor' | 'manager' | 'admin';
const ALLOWED_ROLES: AllowedRole[] = ['store_keeper', 'supervisor', 'manager', 'admin'];

export function QuickStockAdjust({ partId, currentStock, unit, onComplete }: QuickStockAdjustProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const role = userProfile?.role as string | undefined;

  const [isOpen, setIsOpen] = useState(false);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const canAdjust = role && ALLOWED_ROLES.includes(role as AllowedRole);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!canAdjust) return null;

  function open() {
    setDelta(0);
    setReason('');
    setError(null);
    setIsOpen(true);
  }

  async function handleSave() {
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    if (delta === 0) {
      setError('Adjustment quantity cannot be zero.');
      return;
    }
    const newStock = currentStock + delta;
    if (newStock < 0) {
      setError('Stock cannot go below zero.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const partRef = doc(db, 'inventoryParts', partId);
      const movementsCol = collection(db, 'stockMovements');
      const movementRef = doc(movementsCol);

      await runTransaction(db, async (txn) => {
        const partSnap = await txn.get(partRef);
        if (!partSnap.exists()) throw new Error('Part not found');

        const latestStock = (partSnap.data()?.currentStock ?? currentStock) as number;
        const adjustedStock = latestStock + delta;
        if (adjustedStock < 0) throw new Error('Stock cannot go below zero.');

        txn.update(partRef, {
          currentStock: adjustedStock,
          availableStock: Math.max(0, adjustedStock - ((partSnap.data()?.reservedStock ?? 0) as number)),
          updatedAt: serverTimestamp(),
          updatedBy: userProfile?.id ?? '',
        });

        txn.set(movementRef, {
          companyId: userProfile?.companyId ?? '',
          partId,
          partNumber: partSnap.data()?.partNumber ?? '',
          partName: partSnap.data()?.name ?? '',
          movementType: 'adjustment',
          quantityBefore: latestStock,
          quantityChange: delta,
          quantityAfter: adjustedStock,
          referenceType: 'manual_adjustment',
          referenceId: movementRef.id,
          workOrderId: null,
          workOrderNumber: null,
          partsRequestId: null,
          performedBy: userProfile?.id ?? '',
          performedByName: userProfile?.fullName ?? '',
          performedByRole: role ?? '',
          performedAt: serverTimestamp(),
          notes: reason.trim(),
          unitCostAtTime: partSnap.data()?.unitCost ?? 0,
          totalCostImpact: (partSnap.data()?.unitCost ?? 0) * delta,
        });
      });

      setIsOpen(false);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save adjustment.');
    } finally {
      setSaving(false);
    }
  }

  const newStock = currentStock + delta;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={open}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors"
        title="Quick Stock Adjust"
      >
        <RefreshCw className="w-3 h-3" />
        Adjust
      </button>

      {isOpen && (
        <div className="absolute z-50 right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Quick Adjust</h4>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-gray-500">
            Current: <span className="font-semibold text-gray-900">{currentStock} {unit}</span>
          </div>

          {/* Delta input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quantity Change</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDelta((d) => d - 1)}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 text-gray-600"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
                className="flex-1 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setDelta((d) => d + 1)}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-50 text-gray-600"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              New stock: <span className={`font-semibold ${newStock < 0 ? 'text-red-600' : 'text-gray-900'}`}>{newStock} {unit}</span>
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Counted during stocktake"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {saving ? 'Saving…' : 'Save Adjustment'}
          </button>
        </div>
      )}
    </div>
  );
}
