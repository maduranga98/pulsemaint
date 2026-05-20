import type { PartUnit } from '@/types/inventory';
import { UnitLabel } from './UnitLabel';

interface StockGaugeProps {
  current: number;
  min: number;
  max: number;
  unit: PartUnit;
}

export function StockGauge({ current, min, max, unit }: StockGaugeProps) {
  const effectiveMax = max > 0 ? max : Math.max(min * 2, current * 1.5, 1);
  const fillPct = Math.min(100, Math.max(0, (current / effectiveMax) * 100));
  const minPct = Math.min(100, Math.max(0, (min / effectiveMax) * 100));

  let barColor = 'bg-green-500';
  if (current <= 0) barColor = 'bg-red-500';
  else if (current <= min) barColor = 'bg-amber-500';

  let labelColor = 'text-green-700';
  if (current <= 0) labelColor = 'text-red-700';
  else if (current <= min) labelColor = 'text-amber-700';

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
        {/* Fill */}
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${fillPct}%` }}
        />
        {/* Min marker */}
        {min > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
            style={{ left: `${minPct}%` }}
            title={`Min: ${min}`}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">
          Min: <span className="font-medium text-gray-700"><UnitLabel unit={unit} quantity={min} /></span>
        </span>
        <span className={`font-semibold ${labelColor}`}>
          <UnitLabel unit={unit} quantity={current} />
        </span>
        {max > 0 && (
          <span className="text-gray-500">
            Max: <span className="font-medium text-gray-700"><UnitLabel unit={unit} quantity={max} /></span>
          </span>
        )}
      </div>
    </div>
  );
}
