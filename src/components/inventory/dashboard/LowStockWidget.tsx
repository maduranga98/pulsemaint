import { useNavigate } from 'react-router-dom';
import type { InventoryPart } from '@/types/inventory';

interface Props {
  parts: InventoryPart[];
}

export function LowStockWidget({ parts }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          Low Stock Alerts
          {parts.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
              {parts.length}
            </span>
          )}
        </h2>
      </div>

      {parts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-green-600 font-medium text-sm">
            ✓ All parts above minimum stock levels
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {parts.map((part) => {
            const isOut = part.currentStock === 0;
            return (
              <div
                key={part.id}
                className={`px-4 py-3 flex items-center gap-3 ${
                  isOut ? 'bg-red-50' : 'bg-amber-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{part.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {part.category.replace(/_/g, ' ')}
                    {part.supplierName && ` · ${part.supplierName}`}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className={`font-bold ${isOut ? 'text-red-600' : 'text-amber-600'}`}>
                      Stock: {part.currentStock} {part.unit}
                    </span>
                    <span className="text-gray-500">Min: {part.minStockLevel} {part.unit}</span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    navigate(`/app/inventory/purchase-orders/new?partId=${part.id}`)
                  }
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors"
                >
                  Order Now
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
