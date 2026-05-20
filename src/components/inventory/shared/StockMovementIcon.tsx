import {
  ArrowDown,
  ArrowUp,
  Plus,
  RefreshCw,
  Lock,
  Unlock,
  Upload,
  ArrowRightLeft,
} from 'lucide-react';
import type { MovementType } from '@/types/inventory';

interface StockMovementIconProps {
  type: MovementType;
  className?: string;
}

const movementConfig: Record<
  MovementType,
  { Icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  issue: { Icon: ArrowDown, color: 'text-red-500' },
  return: { Icon: ArrowUp, color: 'text-green-500' },
  receive: { Icon: Plus, color: 'text-green-600' },
  adjustment: { Icon: RefreshCw, color: 'text-amber-500' },
  reserve: { Icon: Lock, color: 'text-blue-500' },
  unreserve: { Icon: Unlock, color: 'text-blue-500' },
  import_create: { Icon: Upload, color: 'text-gray-500' },
  import_update: { Icon: Upload, color: 'text-gray-500' },
  transfer_out: { Icon: ArrowRightLeft, color: 'text-blue-500' },
  transfer_in: { Icon: ArrowRightLeft, color: 'text-blue-500' },
};

export function StockMovementIcon({ type, className = '' }: StockMovementIconProps) {
  const config = movementConfig[type];
  const { Icon } = config;

  return <Icon className={`w-4 h-4 ${config.color} ${className}`} />;
}
