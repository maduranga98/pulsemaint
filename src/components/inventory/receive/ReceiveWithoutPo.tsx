import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { PartSearchInput } from '@/components/inventory/shared/PartSearchInput';
import { ReceiveItemRow } from './ReceiveItemRow';
import type { InventoryPart } from '@/types/inventory';

interface SelectedPart {
  part: InventoryPart;
  rowKey: string;
}

interface RowData {
  quantityReceived: number;
  unitCost: number;
  condition: string;
  notes: string;
}

let rowCounter = 0;

export function ReceiveWithoutPo() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;
  const toast = useToast();

  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [rowData, setRowData] = useState<Record<string, RowData>>({});
  const [supplierName, setSupplierName] = useState('');
  const [deliveryRef, setDeliveryRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handlePartSelect(part: InventoryPart) {
    rowCounter += 1;
    const key = `${part.id}-${rowCounter}`;
    setSelectedParts((prev) => [...prev, { part, rowKey: key }]);
  }

  function handleRemove(rowKey: string) {
    setSelectedParts((prev) => prev.filter((p) => p.rowKey !== rowKey));
    setRowData((prev) => {
      const copy = { ...prev };
      delete copy[rowKey];
      return copy;
    });
  }

  const handleRowUpdate = useCallback((rowKey: string, data: RowData) => {
    setRowData((prev) => ({ ...prev, [rowKey]: data }));
  }, []);

  function clearForm() {
    setSelectedParts([]);
    setRowData({});
    setSupplierName('');
    setDeliveryRef('');
    setNotes('');
  }

  async function handleSubmit() {
    if (!userProfile || !companyId || selectedParts.length === 0) return;
    setIsSubmitting(true);

    try {
      await runTransaction(db, async (tx) => {
        const now = serverTimestamp();

        for (const { part, rowKey } of selectedParts) {
          const row = rowData[rowKey];
          if (!row) continue;
          const qty = row.quantityReceived;
          if (qty <= 0) continue;

          const partRef = doc(db, 'inventoryParts', part.id);
          const partSnap = await tx.get(partRef);
          if (!partSnap.exists()) continue;

          const data = partSnap.data();
          const currentStock = (data.currentStock as number) ?? 0;

          if (row.condition === 'good') {
            tx.update(partRef, {
              currentStock: currentStock + qty,
              lastReceivedAt: now,
              lastPurchasePrice: row.unitCost > 0 ? row.unitCost : data.lastPurchasePrice,
              lastPurchaseDate: now,
              updatedAt: now,
              updatedBy: userProfile.id,
            });
          }

          const movRef = doc(collection(db, 'stockMovements'));
          tx.set(movRef, {
            companyId,
            partId: part.id,
            partNumber: part.partNumber,
            partName: part.name,
            movementType: 'receive',
            quantityBefore: currentStock,
            quantityChange: row.condition === 'good' ? qty : 0,
            quantityAfter: row.condition === 'good' ? currentStock + qty : currentStock,
            referenceType: 'manual_adjustment',
            referenceId: 'no_po',
            workOrderId: null,
            workOrderNumber: null,
            partsRequestId: null,
            performedBy: userProfile.id,
            performedByName: userProfile.fullName,
            performedByRole: userProfile.role,
            performedAt: now,
            notes: [row.notes, supplierName ? `Supplier: ${supplierName}` : '', deliveryRef ? `Ref: ${deliveryRef}` : '']
              .filter(Boolean)
              .join(' · '),
            unitCostAtTime: row.unitCost,
            totalCostImpact: row.unitCost * qty,
          });
        }
      });

      toast.success('Stock received successfully');
      clearForm();
    } catch (err) {
      console.error(err);
      toast.error('Failed to record receipt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const excludedIds = selectedParts.map((p) => p.part.id);

  return (
    <div className="space-y-5">
      {/* Part search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Search & Add Parts</label>
        <PartSearchInput onSelect={handlePartSelect} excludePartIds={excludedIds} />
      </div>

      {/* Selected parts */}
      {selectedParts.length > 0 && (
        <div className="space-y-3">
          {selectedParts.map(({ part, rowKey }, idx) => (
            <ReceiveItemRow
              key={rowKey}
              index={idx}
              item={{
                partId: part.id,
                partNumber: part.partNumber,
                partName: part.name,
                unit: part.unit,
              }}
              onUpdate={(data) => handleRowUpdate(rowKey, data)}
              onRemove={() => handleRemove(rowKey)}
            />
          ))}

          <button
            onClick={() => {
              // just focuses the search input via state re-render; user types again
            }}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Another Part
          </button>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Supplier Name</label>
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="e.g. ABC Traders"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Reference</label>
          <input
            type="text"
            value={deliveryRef}
            onChange={(e) => setDeliveryRef(e.target.value)}
            placeholder="e.g. DN-2025-001"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Any additional notes about this delivery…"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || selectedParts.length === 0}
        className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Confirming Receipt…' : 'Confirm Receipt'}
      </button>
    </div>
  );
}
