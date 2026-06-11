import { useState } from 'react';
import { Eye, Pencil, ArrowUpDown, QrCode } from 'lucide-react';
import type { InventoryPart } from '@/types/inventory';
import { PartQrModal } from './PartQrModal';
import { PartStatusBadge } from '@/components/inventory/shared/PartStatusBadge';
import { PartCriticalityBadge } from '@/components/inventory/shared/PartCriticalityBadge';
import { CategoryBadge } from '@/components/inventory/shared/CategoryBadge';
import { CostDisplay } from '@/components/inventory/shared/CostDisplay';
import { QuickStockAdjust } from '@/components/inventory/shared/QuickStockAdjust';
import { useAuthStore } from '@/store/authStore';
import { getStockStatus } from '@/lib/inventory/stockCalculator';

interface PartCatalogTableProps {
  parts: InventoryPart[];
  onViewPart: (id: string) => void;
  onEditPart: (id: string) => void;
}

type SortKey = 'partNumber' | 'name' | 'category' | 'criticality' | 'currentStock' | 'unitCost' | 'status';
type SortDir = 'asc' | 'desc';

function stockColor(part: InventoryPart): string {
  const s = getStockStatus(part);
  if (s === 'out_of_stock') return 'text-red-600 font-semibold';
  if (s === 'low_stock') return 'text-amber-600 font-semibold';
  return 'text-green-700';
}

export function PartCatalogTable({ parts, onViewPart, onEditPart }: PartCatalogTableProps) {
  const isTechnician = useAuthStore((s) => s.isTechnician);
  const [qrPart, setQrPart] = useState<InventoryPart | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('partNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = [...parts].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    switch (sortKey) {
      case 'partNumber': av = a.partNumber; bv = b.partNumber; break;
      case 'name': av = a.name; bv = b.name; break;
      case 'category': av = a.category; bv = b.category; break;
      case 'criticality': {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        av = order[a.criticality]; bv = order[b.criticality]; break;
      }
      case 'currentStock': av = a.currentStock; bv = b.currentStock; break;
      case 'unitCost': av = a.unitCost; bv = b.unitCost; break;
      case 'status': av = a.status; bv = b.status; break;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function SortHeader({ label, colKey }: { label: string; colKey: SortKey }) {
    const active = sortKey === colKey;
    return (
      <button
        onClick={() => toggleSort(colKey)}
        className={`inline-flex items-center gap-1 font-medium hover:text-gray-900 ${active ? 'text-blue-700' : 'text-gray-600'}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
      </button>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">No parts found.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs">
            <th className="px-4 py-3 text-left"><SortHeader label="Part Number" colKey="partNumber" /></th>
            <th className="px-4 py-3 text-left"><SortHeader label="Part Name" colKey="name" /></th>
            <th className="px-4 py-3 text-left"><SortHeader label="Category" colKey="category" /></th>
            <th className="px-4 py-3 text-left"><SortHeader label="Criticality" colKey="criticality" /></th>
            <th className="px-4 py-3 text-right"><SortHeader label="Stock" colKey="currentStock" /></th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Min Stock Level</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Available</th>
            {!isTechnician && (
              <th className="px-4 py-3 text-right"><SortHeader label="Unit Cost" colKey="unitCost" /></th>
            )}
            <th className="px-4 py-3 text-left font-medium text-gray-600">Location</th>
            <th className="px-4 py-3 text-left"><SortHeader label="Status" colKey="status" /></th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((part) => {
            const available = Math.max(0, part.currentStock - part.reservedStock);
            return (
              <tr key={part.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-blue-700 font-medium">{part.partNumber}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 leading-tight">{part.name}</p>
                  {part.brand && <p className="text-xs text-gray-500">{part.brand}</p>}
                </td>
                <td className="px-4 py-3">
                  <CategoryBadge category={part.category} />
                </td>
                <td className="px-4 py-3">
                  <PartCriticalityBadge criticality={part.criticality} />
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${stockColor(part)}`}>
                  {part.currentStock.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                  {part.minStockLevel.toLocaleString()}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${stockColor(part)}`}>
                  {available.toLocaleString()}
                </td>
                {!isTechnician && (
                  <td className="px-4 py-3 text-right tabular-nums">
                    <CostDisplay amount={part.unitCost} />
                  </td>
                )}
                <td className="px-4 py-3 text-xs text-gray-600 max-w-[120px] truncate">
                  {part.storeLocation || '—'}
                </td>
                <td className="px-4 py-3">
                  <PartStatusBadge status={part.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => onViewPart(part.id)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                    <button
                      onClick={() => onEditPart(part.id)}
                      className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => setQrPart(part)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <QrCode className="w-3 h-3" />
                      QR
                    </button>
                    <QuickStockAdjust
                      partId={part.id}
                      currentStock={part.currentStock}
                      unit={part.unit}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {qrPart && <PartQrModal part={qrPart} onClose={() => setQrPart(null)} />}
    </div>
  );
}
