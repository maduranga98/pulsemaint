import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, ShoppingCart, Bell } from 'lucide-react';
import { useInventoryStats } from '@/hooks/inventory/useInventoryStats';
import { usePartsRequests } from '@/hooks/inventory/usePartsRequests';
import { useStockMovements } from '@/hooks/inventory/useStockMovements';
import { useInventoryParts } from '@/hooks/inventory/useInventoryParts';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { PurchaseOrderList } from '@/components/inventory/po/PurchaseOrderList';
import type { PartsRequest } from '@/types/inventory';
import { InventoryAlertPills } from '@/components/inventory/dashboard/InventoryAlertPills';
import { InventoryStatCards } from '@/components/inventory/dashboard/InventoryStatCards';
import { PendingRequestsWidget } from '@/components/inventory/dashboard/PendingRequestsWidget';
import { LowStockWidget } from '@/components/inventory/dashboard/LowStockWidget';
import { OutOfStockWidget } from '@/components/inventory/dashboard/OutOfStockWidget';
import { RecentMovementsWidget } from '@/components/inventory/dashboard/RecentMovementsWidget';
import { ReservedStockWidget } from '@/components/inventory/dashboard/ReservedStockWidget';
import { PartsCatalogWidget } from '@/components/inventory/dashboard/PartsCatalogWidget';

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-8 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export function InventoryDashboardPage() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { stats, loading: statsLoading } = useInventoryStats();
  const { requests, loading: reqLoading } = usePartsRequests({ status: 'all' });
  const { movements, loading: movLoading } = useStockMovements({ pageSize: 10 });
  const { parts, loading: partsLoading } = useInventoryParts({ stockStatus: 'low_stock', pageSize: 10 });
  const { parts: outOfStockParts } = useInventoryParts({ stockStatus: 'out_of_stock', pageSize: 10 });
  const { parts: catalogParts, totalCount: catalogCount } = useInventoryParts({ pageSize: 5 });
  const { orders: purchaseOrders } = usePurchaseOrders();

  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isLoading = statsLoading || reqLoading || movLoading || partsLoading;

  return (
    <div className="space-y-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          You are currently offline. Showing cached data — changes will sync when you reconnect.
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Inventory Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">{todayStr}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            to="/app/inventory/catalog/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Link>
          <Link
            to="/app/inventory/purchase-orders/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
          >
            <ShoppingCart className="w-4 h-4" />
            Create PO
          </Link>
          <Link
            to="/app/inventory/settings"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg"
          >
            <Bell className="w-4 h-4" />
            Low Stock Alerts
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="flex gap-3 overflow-x-auto">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-8 w-28 bg-gray-200 rounded-full animate-pulse shrink-0" />
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((k) => <SkeletonCard key={k} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : (
        <>
          <InventoryAlertPills stats={stats} />
          <InventoryStatCards stats={stats} />

          {outOfStockParts.length > 0 && <OutOfStockWidget parts={outOfStockParts} />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PendingRequestsWidget requests={requests} />
            <LowStockWidget parts={parts.filter((p) => p.currentStock > 0)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentMovementsWidget movements={movements} />
            <ReservedStockWidget requests={requests as PartsRequest[]} />
          </div>

          <PartsCatalogWidget parts={catalogParts} totalCount={catalogCount} />

          {/* PM-057 — Purchase Orders library on the main Inventory page */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-gray-500" />
                Purchase Orders
                <span className="text-xs font-normal text-gray-500">({purchaseOrders.length})</span>
              </h2>
              <Link
                to="/app/inventory/purchase-orders"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all
              </Link>
            </div>
            <div className="p-2">
              <PurchaseOrderList
                orders={purchaseOrders.slice(0, 5)}
                onView={(id) => navigate(`/app/inventory/purchase-orders/${id}`)}
                onEdit={(id) => navigate(`/app/inventory/purchase-orders/${id}/edit`)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default InventoryDashboardPage;
