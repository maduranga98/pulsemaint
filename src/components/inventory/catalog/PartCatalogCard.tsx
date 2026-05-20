import type { InventoryPart } from '@/types/inventory';
import { PartStatusBadge } from '@/components/inventory/shared/PartStatusBadge';
import { PartCriticalityBadge } from '@/components/inventory/shared/PartCriticalityBadge';
import { CategoryBadge } from '@/components/inventory/shared/CategoryBadge';
import { StockLevelIndicator } from '@/components/inventory/shared/StockLevelIndicator';
import { MapPin } from 'lucide-react';

interface PartCatalogCardProps {
  part: InventoryPart;
  onClick: () => void;
}

export function PartCatalogCard({ part, onClick }: PartCatalogCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
    >
      {/* Header row: Part number + Status */}
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          {part.partNumber}
        </span>
        <PartStatusBadge status={part.status} />
      </div>

      {/* Part name */}
      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">
        {part.name}
      </h3>
      {part.brand && (
        <p className="text-xs text-gray-500 mb-2">{part.brand}</p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <CategoryBadge category={part.category} />
        <PartCriticalityBadge criticality={part.criticality} />
      </div>

      {/* Stock bar */}
      <div className="mb-3">
        <StockLevelIndicator
          currentStock={part.currentStock}
          reservedStock={part.reservedStock}
          minStockLevel={part.minStockLevel}
          maxStockLevel={part.maxStockLevel}
          unit={part.unit}
        />
      </div>

      {/* Footer: location + unit */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1 truncate">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{part.storeLocation || 'No location'}</span>
        </span>
        <span className="shrink-0 ml-2 font-medium text-gray-700">{part.unit}</span>
      </div>
    </button>
  );
}
