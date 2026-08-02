import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, ShoppingCart, Bell, Truck, ScanLine, PackagePlus, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
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
import { CreatePartsRequestModal } from '@/components/inventory/requests/CreatePartsRequestModal';

const PENDING_STATUSES = new Set(['pending_storekeeper', 'pending_supervisor']);

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-8 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

// Store keeper / management view has the full toolkit: stock levels, POs,
// receiving, movements. Technicians (and trainees, who share the same route
// permissions) only need to see the status of parts requests, browse the
// catalog, and request parts — everything else (PO creation, scan & issue,
// suppliers, settings) is off-limits to them at the router level already,
// so surfacing those links here just leads to dead ends.
function TechnicianInventoryView() {
  const [showRequest, setShowRequest] = useState(false);
  const { requests, loading } = usePartsRequests({ status: 'all' });
  const { parts: catalogParts, totalCount: catalogCount } = useInventoryParts({ pageSize: 5 });
  const pendingRequests = requests.filter((r) => PENDING_STATUSES.has(r.status));

  return (
    <div className="space-y-6">
      {showRequest && <CreatePartsRequestModal onClose={() => setShowRequest(false)} />}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Inventory</h1>
          <p className="text-gray-500 text-sm mt-0.5">Check request status and browse the parts catalog.</p>
        </div>
        <button
          onClick={() => setShowRequest(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
        >
          <PackagePlus className="w-4 h-4" />
          Request Parts
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <PendingRequestsWidget requests={pendingRequests} />
          <PartsCatalogWidget parts={catalogParts} totalCount={catalogCount} />
        </>
      )}
    </div>
  );
}

function FullInventoryDashboard() {
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
            to="/app/inventory/issue/manual"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg"
          >
            <ScanLine className="w-4 h-4" />
            Scan &amp; Issue
          </Link>
          <Link
            to="/app/inventory/returns"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg"
          >
            <RotateCcw className="w-4 h-4" />
            Parts Returns
          </Link>
          <Link
            to="/app/inventory/suppliers"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg"
          >
            <Truck className="w-4 h-4" />
            Suppliers
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
            {/* "Pending Requests" must list only requests still awaiting action,
                not every request (issued/completed belong on the requests page). */}
            <PendingRequestsWidget requests={requests.filter((r) => PENDING_STATUSES.has(r.status))} />
            <LowStockWidget parts={parts.filter((p) => p.currentStock > 0)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentMovementsWidget movements={movements} />
            <ReservedStockWidget
              requests={(requests as PartsRequest[]).filter((r) => r.status === 'parts_reserved')}
            />
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

// Supervisor inventory view: focused on the parts requests and POs a
// supervisor actually acts on — request parts, browse the catalog, approve
// escalated (awaiting-supervisor) requests, and see purchase orders pending
// approval. The store keeper's full stock/receiving/movements toolkit is left
// out deliberately.
function SupervisorInventoryView() {
  const navigate = useNavigate();
  const [showRequest, setShowRequest] = useState(false);
  const { requests, loading } = usePartsRequests({ status: 'all' });
  const { parts: catalogParts, totalCount: catalogCount } = useInventoryParts({ pageSize: 5 });
  const { orders: purchaseOrders } = usePurchaseOrders();

  const awaitingSupervisor = requests.filter((r) => r.status === 'pending_supervisor');
  const pendingPOs = purchaseOrders.filter((po) => po.status === 'pending_approval');

  return (
    <div className="space-y-6">
      {showRequest && <CreatePartsRequestModal onClose={() => setShowRequest(false)} />}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Inventory</h1>
          <p className="text-gray-500 text-sm mt-0.5">Requests awaiting your approval, purchase orders, and the parts catalog.</p>
        </div>
        <button
          onClick={() => setShowRequest(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
        >
          <PackagePlus className="w-4 h-4" />
          Request Parts
        </button>
      </div>

      {loading ? (
        <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <>
          {/* Awaiting supervisor approval */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Awaiting Supervisor Approval ({awaitingSupervisor.length})</h2>
            <PendingRequestsWidget requests={awaitingSupervisor} />
          </div>

          {/* Purchase orders pending approval */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-gray-500" />
                Pending PO Requests
                <span className="text-xs font-normal text-gray-500">({pendingPOs.length})</span>
              </h2>
              <Link to="/app/inventory/purchase-orders" className="text-sm text-blue-600 hover:text-blue-800 font-medium">View all</Link>
            </div>
            <div className="p-2">
              <PurchaseOrderList
                orders={pendingPOs.slice(0, 5)}
                onView={(id) => navigate(`/app/inventory/purchase-orders/${id}`)}
                onEdit={(id) => navigate(`/app/inventory/purchase-orders/${id}/edit`)}
              />
            </div>
          </div>

          <PartsCatalogWidget parts={catalogParts} totalCount={catalogCount} />
        </>
      )}
    </div>
  );
}

// Technicians and trainees share the same restricted inventory route
// permissions (catalog + requests only, see AppRouter) — route them to the
// scoped view instead of the store keeper's full management dashboard.
export function InventoryDashboardPage() {
  const role = useAuthStore((s) => s.userProfile?.role);
  if (role === 'technician' || role === 'trainee') {
    return <TechnicianInventoryView />;
  }
  if (role === 'supervisor') {
    return <SupervisorInventoryView />;
  }
  return <FullInventoryDashboard />;
}
export default InventoryDashboardPage;
