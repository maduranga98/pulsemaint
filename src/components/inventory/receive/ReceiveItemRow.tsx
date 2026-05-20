import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ItemData {
  partId: string;
  partNumber: string;
  partName: string;
  unit: string;
  quantityOrdered?: number;
  quantityReceivedSoFar?: number;
}

interface RowData {
  quantityReceived: number;
  unitCost: number;
  condition: string;
  notes: string;
}

interface Props {
  index: number;
  item: ItemData;
  onUpdate: (data: RowData) => void;
  onRemove?: () => void;
}

const CONDITIONS = [
  { value: 'good', label: 'Good' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'wrong_item', label: 'Wrong Item' },
];

export function ReceiveItemRow({ index, item, onUpdate, onRemove }: Props) {
  const [quantityReceived, setQuantityReceived] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    onUpdate({ quantityReceived, unitCost, condition, notes });
  }, [quantityReceived, unitCost, condition, notes, onUpdate]);

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{item.partName}</p>
          <p className="font-mono text-xs text-gray-500">{item.partNumber}</p>
          {item.quantityOrdered !== undefined && (
            <p className="text-xs text-gray-500 mt-1">
              Ordered: <span className="font-medium">{item.quantityOrdered} {item.unit}</span>
              {item.quantityReceivedSoFar !== undefined && (
                <> · Received so far: <span className="font-medium">{item.quantityReceivedSoFar} {item.unit}</span></>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">#{index + 1}</span>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Qty to Receive ({item.unit})
          </label>
          <input
            type="number"
            min={0}
            value={quantityReceived}
            onChange={(e) => setQuantityReceived(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Unit Cost (LKR)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Condition radio */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Condition</p>
        <div className="flex gap-4">
          {CONDITIONS.map((c) => (
            <label key={c.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="radio"
                name={`condition-${item.partId}-${index}`}
                value={c.value}
                checked={condition === c.value}
                onChange={() => setCondition(c.value)}
                className="text-blue-600"
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this item…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
