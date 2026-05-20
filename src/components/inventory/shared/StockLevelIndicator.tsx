import type { PartUnit } from '@/types/inventory';
import { UnitLabel } from './UnitLabel';

interface StockLevelIndicatorProps {
  currentStock: number;
  reservedStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  unit: PartUnit;
}

export function StockLevelIndicator({
  currentStock,
  reservedStock,
  minStockLevel,
  maxStockLevel,
  unit,
}: StockLevelIndicatorProps) {
  const available = currentStock - reservedStock;

  let barColor = 'bg-green-500';
  let textColor = 'text-green-700';
  if (available <= 0) {
    barColor = 'bg-red-500';
    textColor = 'text-red-700';
  } else if (available <= minStockLevel) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-700';
  }

  const barWidth =
    maxStockLevel > 0 ? Math.min(100, (currentStock / maxStockLevel) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-gray-500">Current</p>
          <p className="font-semibold text-gray-900">
            <UnitLabel unit={unit} quantity={currentStock} />
          </p>
        </div>
        <div>
          <p className="text-gray-500">Reserved</p>
          <p className="font-semibold text-gray-700">
            <UnitLabel unit={unit} quantity={reservedStock} />
          </p>
        </div>
        <div>
          <p className="text-gray-500">Available</p>
          <p className={`font-semibold ${textColor}`}>
            <UnitLabel unit={unit} quantity={available} />
          </p>
        </div>
      </div>

      {/* Bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
