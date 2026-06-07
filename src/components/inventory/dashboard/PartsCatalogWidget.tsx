import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import type { InventoryPart } from '@/types/inventory';

interface PartsCatalogWidgetProps {
  parts: InventoryPart[];
  totalCount?: number;
}

export function PartsCatalogWidget({ parts, totalCount }: PartsCatalogWidgetProps) {
  const preview = parts.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Parts Catalog</h2>
          {typeof totalCount === 'number' && (
            <span className="text-xs text-gray-500">({totalCount} items)</span>
          )}
        </div>
        <Link
          to="/app/inventory/catalog"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          View all <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {preview.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No parts in catalog yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {preview.map((part) => (
            <li key={part.id}>
              <Link
                to={`/app/inventory/catalog/${part.id}`}
                className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{part.name}</p>
                  <p className="font-mono text-xs text-blue-700">{part.partNumber}</p>
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {part.currentStock} {part.unit}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PartsCatalogWidget;
