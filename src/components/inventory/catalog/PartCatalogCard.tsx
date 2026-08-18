import { useState } from 'react';
import type { InventoryPart } from '@/types/inventory';
import { PartStatusBadge } from '@/components/inventory/shared/PartStatusBadge';
import { PartCriticalityBadge } from '@/components/inventory/shared/PartCriticalityBadge';
import { CategoryBadge } from '@/components/inventory/shared/CategoryBadge';
import { StockLevelIndicator } from '@/components/inventory/shared/StockLevelIndicator';
import { PartQrModal } from '@/components/inventory/catalog/PartQrModal';
import { MapPin, QrCode } from 'lucide-react';

interface PartCatalogCardProps {
  part: InventoryPart;
  onClick: () => void;
}

export function PartCatalogCard({ part, onClick }: PartCatalogCardProps) {
  // The grid/card layout is what mobile users actually see (the table with
  // its QR column is hidden below the `md` breakpoint — see
  // PartCatalogPage), so this needs its own QR entry point rather than
  // relying on the table's, which mobile never renders.
  const [showQr, setShowQr] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
    >
      {showQr && <PartQrModal part={part} onClose={() => setShowQr(false)} />}
      {/* Header row: Part number + Status + QR */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          {part.partNumber}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <PartStatusBadge status={part.status} />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowQr(true);
            }}
            className="rounded-md border border-gray-200 p-1 text-gray-500 hover:bg-gray-50 hover:text-indigo-600"
            aria-label="View QR code"
            title="View QR code"
          >
            <QrCode className="h-3.5 w-3.5" />
          </button>
        </div>
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
    </div>
  );
}
