import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { PackagePlus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { InventoryPart } from '@/types/inventory';
import type { POItemRowData } from './PurchaseOrderItemRow';

interface Props {
  supplierId: string;
  excludePartIds: string[];
  onAdd: (items: POItemRowData[]) => void;
}

// Shown once a supplier is picked (or prefilled from a low-stock "Order Now"
// link) on the PO form — surfaces that supplier's other low-stock parts so
// they can be bundled into the same shipment instead of raising separate POs.
// Nothing here is auto-selected; a part only joins the PO if the user checks
// it and confirms a quantity.
export function SupplierLowStockSuggestions({ supplierId, excludePartIds, onAdd }: Props) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const [candidates, setCandidates] = useState<InventoryPart[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});

  useEffect(() => {
    setSelected({});
    if (!companyId || !supplierId) {
      setCandidates([]);
      return;
    }
    const q = query(
      collection(db, 'inventoryParts'),
      where('companyId', '==', companyId),
      where('supplierId', '==', supplierId),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const parts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryPart));
      setCandidates(parts.filter((p) => p.isLowStock));
    });
    return () => unsubscribe();
  }, [companyId, supplierId]);

  const excluded = new Set(excludePartIds.filter(Boolean));
  const suggestions = candidates.filter((p) => !excluded.has(p.id));

  if (!supplierId || suggestions.length === 0) return null;

  function toggle(part: InventoryPart, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        next[part.id] = Math.max(1, (Number(part.maxStockLevel) || Number(part.minStockLevel) || 0) - (Number(part.currentStock) || 0));
      } else {
        delete next[part.id];
      }
      return next;
    });
  }

  function setQty(partId: string, qty: number) {
    setSelected((prev) => ({ ...prev, [partId]: Math.max(1, qty) }));
  }

  function addSelected() {
    const items: POItemRowData[] = suggestions
      .filter((p) => selected[p.id] != null)
      .map((p) => ({
        partId: p.id,
        partNumber: p.partNumber,
        partName: p.name,
        quantityOrdered: selected[p.id],
        unit: p.unit,
        unitCost: 0,
        leadTimeDays: p.leadTimeDays ?? 0,
        expectedDelivery: null,
      }));
    if (items.length === 0) return;
    onAdd(items);
    setSelected({});
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <PackagePlus className="w-4 h-4 text-amber-700" />
        <h3 className="font-semibold text-amber-900 text-sm">
          This supplier has other low-stock parts — add them to ship together?
        </h3>
      </div>
      <div className="space-y-2">
        {suggestions.map((p) => {
          const checked = selected[p.id] != null;
          return (
            <div
              key={p.id}
              className="bg-white border border-amber-100 rounded-lg px-3 py-2 flex flex-wrap items-center gap-3"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggle(p, e.target.checked)}
                className="w-4 h-4"
              />
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="font-mono text-xs text-gray-500">{p.partNumber}</p>
              </div>
              <div className="text-xs text-gray-600 flex gap-3">
                <span>Current: <strong>{p.currentStock}</strong></span>
                <span>Low at: <strong>{p.minStockLevel}</strong></span>
                <span>Max: <strong>{p.maxStockLevel}</strong></span>
              </div>
              {checked && (
                <input
                  type="number"
                  min="1"
                  value={selected[p.id]}
                  onChange={(e) => setQty(p.id, parseInt(e.target.value, 10) || 1)}
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addSelected}
        disabled={selectedCount === 0}
        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        Add {selectedCount > 0 ? selectedCount : ''} selected to this PO
      </button>
    </div>
  );
}
