import type { MovementType } from '@/types/inventory';
import { StockMovementIcon } from './StockMovementIcon';

interface StockMovementBadgeProps {
  type: MovementType;
  size?: 'sm' | 'md';
}

const movementLabels: Record<MovementType, string> = {
  issue: 'Issue',
  return: 'Return',
  receive: 'Receive',
  adjustment: 'Adjustment',
  reserve: 'Reserve',
  unreserve: 'Unreserve',
  import_create: 'Import (New)',
  import_update: 'Import (Update)',
  transfer_out: 'Transfer Out',
  transfer_in: 'Transfer In',
};

const movementBgColors: Record<MovementType, string> = {
  issue: 'bg-red-50 text-red-700',
  return: 'bg-green-50 text-green-700',
  receive: 'bg-green-50 text-green-700',
  adjustment: 'bg-amber-50 text-amber-700',
  reserve: 'bg-blue-50 text-blue-700',
  unreserve: 'bg-blue-50 text-blue-700',
  import_create: 'bg-gray-100 text-gray-600',
  import_update: 'bg-gray-100 text-gray-600',
  transfer_out: 'bg-blue-50 text-blue-700',
  transfer_in: 'bg-blue-50 text-blue-700',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
};

export function StockMovementBadge({ type, size = 'sm' }: StockMovementBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${movementBgColors[type]} ${sizeClasses[size]}`}
    >
      <StockMovementIcon type={type} className="w-3 h-3" />
      {movementLabels[type]}
    </span>
  );
}
