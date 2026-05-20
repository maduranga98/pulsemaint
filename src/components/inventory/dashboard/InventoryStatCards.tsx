import { Package, DollarSign, ClipboardList, ShoppingCart } from 'lucide-react';
import { formatLKR } from '@/lib/inventory/stockCalculator';
import type { InventoryStats } from '@/types/inventory';

interface Props {
  stats: InventoryStats;
}

interface StatCard {
  icon: React.ReactNode;
  value: string;
  label: string;
  iconColor: string;
  iconBg: string;
}

export function InventoryStatCards({ stats }: Props) {
  const cards: StatCard[] = [
    {
      icon: <Package className="w-7 h-7" />,
      value: stats.totalParts.toLocaleString(),
      label: 'Total Parts',
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      icon: <DollarSign className="w-7 h-7" />,
      value: formatLKR(stats.totalStockValue),
      label: 'Total Stock Value',
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50',
    },
    {
      icon: <ClipboardList className="w-7 h-7" />,
      value: stats.activeRequests.toLocaleString(),
      label: 'Active Requests',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
    {
      icon: <ShoppingCart className="w-7 h-7" />,
      value: stats.pendingPOs.toLocaleString(),
      label: 'POs Pending',
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 shadow-sm"
        >
          <div className={`p-2.5 rounded-lg ${card.iconBg} ${card.iconColor} shrink-0`}>
            {card.icon}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900 leading-tight truncate">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
