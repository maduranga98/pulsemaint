import { CheckCircle, AlertTriangle, XCircle, Pencil, PackagePlus, RefreshCw, ShoppingCart } from 'lucide-react';
import type { InventoryPart } from '@/types/inventory';
import { PartStatusBadge } from '@/components/inventory/shared/PartStatusBadge';
import { PartCriticalityBadge } from '@/components/inventory/shared/PartCriticalityBadge';
import { CategoryBadge } from '@/components/inventory/shared/CategoryBadge';
import { useAuthStore } from '@/store/authStore';
import { getStockStatus } from '@/lib/inventory/stockCalculator';

interface PartDetailHeaderProps {
  part: InventoryPart;
  onEdit?: () => void;
  onReceive?: () => void;
  onAdjust?: () => void;
  onRaisePO?: () => void;
}

export function PartDetailHeader({
  part,
  onEdit,
  onReceive,
  onAdjust,
  onRaisePO,
}: PartDetailHeaderProps) {
  const { canAccess } = useAuthStore();
  const stockStatus = getStockStatus(part);
  const available = Math.max(0, part.currentStock - part.reservedStock);

  const canEdit = canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin']);
  const canReceive = canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin']);
  const canAdjust = canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin']);
  const canRaisePO = canAccess(['supervisor', 'plant_manager', 'admin']);

  let banner: React.ReactNode;
  if (stockStatus === 'out_of_stock') {
    banner = (
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <XCircle className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium">Out of Stock — 0 {part.unit} available</span>
      </div>
    );
  } else if (stockStatus === 'low_stock') {
    banner = (
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium">
          Low Stock — {available} {part.unit} remaining (min: {part.minStockLevel})
        </span>
      </div>
    );
  } else {
    banner = (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium">
          In Stock — {available} {part.unit} available
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top row: Part number + badges */}
      <div className="flex flex-wrap items-start gap-3">
        <span className="font-mono text-lg font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">
          {part.partNumber}
        </span>
        <PartStatusBadge status={part.status} size="md" />
        <PartCriticalityBadge criticality={part.criticality} size="md" />
      </div>

      {/* Part name */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora] leading-tight">{part.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {part.brand && <span className="text-sm text-gray-600">{part.brand}</span>}
          {part.brand && <span className="text-gray-300">·</span>}
          <CategoryBadge category={part.category} size="md" />
        </div>
      </div>

      {/* Stock banner */}
      {banner}

      {/* Stock figures row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-0.5">Current</p>
          <p className="text-xl font-bold text-gray-900">{part.currentStock.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{part.unit}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-0.5">Reserved</p>
          <p className="text-xl font-bold text-gray-700">{part.reservedStock.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{part.unit}</p>
        </div>
        <div className={`border rounded-lg p-3 text-center ${stockStatus === 'out_of_stock' ? 'bg-red-50 border-red-200' : stockStatus === 'low_stock' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-xs text-gray-500 mb-0.5">Available</p>
          <p className={`text-xl font-bold ${stockStatus === 'out_of_stock' ? 'text-red-700' : stockStatus === 'low_stock' ? 'text-amber-700' : 'text-green-700'}`}>
            {available.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">{part.unit}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {canEdit && onEdit && (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit Part
          </button>
        )}
        {canReceive && onReceive && (
          <button
            onClick={onReceive}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            <PackagePlus className="w-4 h-4" />
            Receive Stock
          </button>
        )}
        {canAdjust && onAdjust && (
          <button
            onClick={onAdjust}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Adjust Stock
          </button>
        )}
        {canRaisePO && onRaisePO && (
          <button
            onClick={onRaisePO}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Raise PO
          </button>
        )}
      </div>
    </div>
  );
}
