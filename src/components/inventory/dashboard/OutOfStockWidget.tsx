import { useNavigate } from 'react-router-dom';
import { PackageX } from 'lucide-react';
import type { InventoryPart } from '@/types/inventory';

interface Props {
  parts: InventoryPart[];
}

/**
 * PM-047 — Out of stock alerts shown separately from low stock alerts,
 * with part details so the storekeeper can act on fully depleted items.
 */
export function OutOfStockWidget({ parts }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm">
      <div className="px-4 py-3 border-b border-red-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <PackageX className="w-4 h-4 text-red-600" />
          Out of Stock Alerts
          {parts.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold">
              {parts.length}
            </span>
          )}
        </h2>
      </div>

      {parts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-green-600 font-medium text-sm">✓ No parts are out of stock</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {parts.map((part) => (
            <div key={part.id} className="px-4 py-3 flex items-center gap-3 bg-red-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{part.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-mono">{part.partNumber}</span>
                  {' · '}
                  {part.category.replace(/_/g, ' ')}
                  {part.storeLocation && ` · ${part.storeLocation}`}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="font-bold text-red-600">Stock: 0 {part.unit}</span>
                  <span className="text-gray-500">Min: {part.minStockLevel} {part.unit}</span>
                  {part.supplierName && (
                    <span className="text-gray-500">Supplier: {part.supplierName}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/app/inventory/purchase-orders/new?partId=${part.id}`)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Reorder
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
