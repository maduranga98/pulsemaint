import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Package, Clock, ShieldAlert, CheckCircle } from 'lucide-react';
import type { InventoryStats } from '@/types/inventory';

interface Props {
  stats: InventoryStats;
}

interface PillConfig {
  icon: React.ReactNode;
  count: number;
  label: string;
  path: string;
  colorClass: string;
  iconBg: string;
}

export function InventoryAlertPills({ stats }: Props) {
  const navigate = useNavigate();

  const pills: PillConfig[] = [
    {
      icon: <Package className="w-5 h-5" />,
      count: stats.outOfStockCount,
      label: 'Out of Stock',
      path: '/app/inventory/catalog?stockStatus=out_of_stock',
      colorClass: 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100',
      iconBg: 'text-red-500',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      count: stats.lowStockCount,
      label: 'Low Stock',
      path: '/app/inventory/catalog?stockStatus=low_stock',
      colorClass: 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100',
      iconBg: 'text-amber-500',
    },
    {
      icon: <Clock className="w-5 h-5" />,
      count: stats.pendingRequestsCount,
      label: 'Pending Requests',
      path: '/app/inventory/requests?status=pending_storekeeper',
      colorClass: 'text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100',
      iconBg: 'text-blue-500',
    },
    {
      icon: <ShieldAlert className="w-5 h-5" />,
      count: stats.pendingSupervisorCount,
      label: 'Awaiting Supervisor',
      path: '/app/inventory/requests?status=pending_supervisor',
      colorClass: 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100',
      iconBg: 'text-amber-500',
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      count: stats.partsToIssueCount,
      label: 'To Issue Today',
      path: '/app/inventory/requests?status=parts_reserved',
      colorClass: 'text-green-700 border-green-200 bg-green-50 hover:bg-green-100',
      iconBg: 'text-green-500',
    },
  ].filter((p) => p.count > 0);

  if (pills.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {pills.map((pill) => (
        <button
          key={pill.label}
          onClick={() => navigate(pill.path)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm whitespace-nowrap transition-colors shrink-0 ${pill.colorClass}`}
        >
          <span className={pill.iconBg}>{pill.icon}</span>
          <span className="text-xl font-bold">{pill.count}</span>
          <span>{pill.label}</span>
        </button>
      ))}
    </div>
  );
}
