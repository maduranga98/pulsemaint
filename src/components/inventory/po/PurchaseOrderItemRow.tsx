import { Trash2 } from 'lucide-react';
import type { InventoryPart } from '@/types/inventory';
import { PartSearchInput } from '@/components/inventory/shared/PartSearchInput';

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
          <PartSearchInput onSelect={handlePartSelect} placeholder="Search part by number or name…" />
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
