import { useTranslation } from 'react-i18next';
import type { PartStatus, StockStatus } from '@/types/inventory';

interface PartStatusBadgeProps {
  status: PartStatus;
  /** Live stock level; an active part that is running low / out shows that instead of "Active". */
  stockStatus?: StockStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusColors: Record<PartStatus, { color: string; bg: string }> = {
  active: {
    color: 'text-green-700',
    bg: 'bg-green-50',
  },
  inactive: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  discontinued: {
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
};

const lowStockColors = {
  low_stock: { color: 'text-amber-700', bg: 'bg-amber-50' },
  out_of_stock: { color: 'text-red-700', bg: 'bg-red-50' },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function PartStatusBadge({ status, stockStatus, size = 'sm' }: PartStatusBadgeProps) {
  const { t } = useTranslation();
  // Derived from the live stock level, so it goes back to Active on its own
  // once the stock is topped up above the minimum.
  const low = status === 'active' && (stockStatus === 'low_stock' || stockStatus === 'out_of_stock') ? stockStatus : null;
  const config = low ? lowStockColors[low] : statusColors[status];
  const label = low ? t(`common.inventory.enums.stockStatus.${low}`) : t(`common.inventory.enums.status.${status}`);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
