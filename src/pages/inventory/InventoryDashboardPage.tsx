import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useInventoryStats } from '@/hooks/inventory/useInventoryStats';
import { usePartsRequests } from '@/hooks/inventory/usePartsRequests';
import { useStockMovements } from '@/hooks/inventory/useStockMovements';
import { useInventoryParts } from '@/hooks/inventory/useInventoryParts';
import { InventoryAlertPills } from '@/components/inventory/dashboard/InventoryAlertPills';
import { InventoryStatCards } from '@/components/inventory/dashboard/InventoryStatCards';
import { PendingRequestsWidget } from '@/components/inventory/dashboard/PendingRequestsWidget';
import { LowStockWidget } from '@/components/inventory/dashboard/LowStockWidget';
import { RecentMovementsWidget } from '@/components/inventory/dashboard/RecentMovementsWidget';
import { ReservedStockWidget } from '@/components/inventory/dashboard/ReservedStockWidget';

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-8 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export function InventoryDashboardPage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { stats, loading: statsLoading } = useInventoryStats();
  const { requests, loading: reqLoading } = usePartsRequests({ status: 'all' });
  const { movements, loading: movLoading } = useStockMovements({ pageSize: 10 });
  const { parts, loading: partsLoading } = useInventoryParts({ stockStatus: 'low_stock', pageSize: 10 });

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Store Keeper Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">{todayStr}</p>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PendingRequestsWidget requests={requests} />
            <LowStockWidget parts={parts} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentMovementsWidget movements={movements} />
            <ReservedStockWidget parts={parts} />
          </div>
        </>
      )}
    </div>
  );
}
