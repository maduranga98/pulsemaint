import { useState } from 'react';
import { QrCode, Trash2 } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { InventoryPart } from '@/types/inventory';
import { PartSearchInput } from '@/components/inventory/shared/PartSearchInput';
import { useToast } from '@/hooks/useToast';

export interface POItemRowData {
  partId: string;
  partNumber: string;
  partName: string;
  quantityOrdered: number;
  unitCost: number;
  leadTimeDays: number;
  expectedDelivery: string | null;
}

interface PurchaseOrderItemRowProps {
  index: number;
  value: POItemRowData;
  onUpdate: (data: POItemRowData) => void;
  onRemove: () => void;
}

export function PurchaseOrderItemRow({
  index,
  value,
  onUpdate,
  onRemove,
}: PurchaseOrderItemRowProps) {
  const { addToast } = useToast();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const [qrInput, setQrInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const lineTotal = value.quantityOrdered * value.unitCost;

  function handlePartSelect(part: InventoryPart) {
    onUpdate({
      ...value,
      partId: part.id,
      partNumber: part.partNumber,
      partName: part.name,
      unitCost: part.lastPurchasePrice || part.unitCost || 0,
    });
  }

  async function lookupByCode(code: string) {
    const term = code.trim();
    if (!term || !companyId) return;
    setLookingUp(true);
    try {
      // Exact match on partNumber (QR codes typically encode the part number).
      const snap = await getDocs(
        query(
          collection(db, 'inventoryParts'),
          where('companyId', '==', companyId),
          where('partNumber', '==', term),
          limit(1),
        ),
      );
      if (snap.empty) {
        addToast(`No part found for "${term}"`, 'error');
        return;
      }
      const docSnap = snap.docs[0];
      handlePartSelect({ id: docSnap.id, ...docSnap.data() } as InventoryPart);
      setQrInput('');
    } catch (err) {
      console.error('QR lookup failed', err);
      addToast('QR lookup failed', 'error');
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Item {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="Remove item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Part search */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Part *</label>
        {value.partId ? (
          <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <span className="font-mono text-blue-700 font-semibold">{value.partNumber}</span>
            <span className="text-gray-700 flex-1 truncate">{value.partName}</span>
            <button
              type="button"
              onClick={() => onUpdate({ ...value, partId: '', partNumber: '', partName: '', unitCost: 0 })}
              className="text-xs text-gray-400 hover:text-red-500 shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <PartSearchInput onSelect={handlePartSelect} placeholder="Search part by number or name…" />
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  onKeyDown={(e) => {
                    // USB QR / barcode scanners typically press Enter after
                    // emitting the code. Look up exact part-number match.
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      lookupByCode(qrInput);
                    }
                  }}
                  placeholder="Scan QR / enter part number, then Enter"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => lookupByCode(qrInput)}
                disabled={!qrInput || lookingUp}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
              >
                {lookingUp ? 'Looking…' : 'Lookup'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Quantity */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={value.quantityOrdered || ''}
            onChange={(e) => onUpdate({ ...value, quantityOrdered: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>

        {/* Unit cost */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unit Cost (LKR) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value.unitCost || ''}
            onChange={(e) => onUpdate({ ...value, unitCost: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>

        {/* Expected delivery */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expected Delivery</label>
          <input
            type="date"
            value={value.expectedDelivery ?? ''}
            onChange={(e) => onUpdate({ ...value, expectedDelivery: e.target.value || null })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Line total */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Line Total</label>
          <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800">
            LKR {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}
