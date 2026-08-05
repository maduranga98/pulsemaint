import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { PackagePlus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { InventoryPart } from '@/types/inventory';
import type { POItemRowData } from './PurchaseOrderItemRow';

interface Props {
  supplierId: string;
  supplierName: string;
  excludePartIds: string[];
  onAdd: (items: POItemRowData[]) => void;
}

function normalize(name: string) {
  return name.trim().toLowerCase();
}

// Shown once a supplier is picked (or prefilled from a low-stock "Order Now"
// link) on the PO form — lists every part previously bought from that
// supplier so they can all be picked into the same PO/shipment instead of
// raising separate orders. Low-stock parts are flagged and sorted first, but
// every part from the supplier is selectable, not just the low-stock ones.
// Nothing here is auto-selected; a part only joins the PO if the user checks
// it and confirms a quantity.
//
// Most POs are raised with a supplier typed in free-text rather than picked
// from a saved Supplier record, so `supplierId` is very often empty even
// though `supplierName` is always set — matching on name too (instead of
// requiring supplierId) is what makes parts actually show up for that common
// case.
export function SupplierPartsPicker({ supplierId, supplierName, excludePartIds, onAdd }: Props) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const [allParts, setAllParts] = useState<InventoryPart[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!companyId) {
      setAllParts([]);
      return;
    }
    const q = query(collection(db, 'inventoryParts'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAllParts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryPart)));
    });
    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    setSelected({});
  }, [supplierId, supplierName]);

  const normalizedName = normalize(supplierName || '');
  const candidates = allParts.filter((p) => {
    if (supplierId && p.supplierId === supplierId) return true;
    if (normalizedName && normalize(p.supplierName || '') === normalizedName) return true;
    return false;
  });

  const excluded = new Set(excludePartIds.filter(Boolean));
  const parts = candidates
    .filter((p) => !excluded.has(p.id))
    .sort((a, b) => Number(b.isLowStock) - Number(a.isLowStock) || a.name.localeCompare(b.name));

  if ((!supplierId && !normalizedName) || parts.length === 0) return null;

  function toggle(part: InventoryPart, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        next[part.id] = part.isLowStock
          ? Math.max(1, (Number(part.maxStockLevel) || Number(part.minStockLevel) || 0) - (Number(part.currentStock) || 0))
          : 1;
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
    const items: POItemRowData[] = parts
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
          Parts previously bought from this supplier — add any to ship together?
        </h3>
      </div>
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {parts.map((p) => {
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
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  {p.name}
                  {p.isLowStock && (
                    <span className="shrink-0 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                      Low stock
                    </span>
                  )}
                </p>
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
