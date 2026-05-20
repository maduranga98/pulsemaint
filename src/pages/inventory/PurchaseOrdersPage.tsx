import { useNavigate, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { PurchaseOrderList } from '@/components/inventory/po/PurchaseOrderList';

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { orders, loading, error } = usePurchaseOrders();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Purchase Orders</h1>
        <Link
          to="/app/inventory/purchase-orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create PO
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <PurchaseOrderList
          orders={orders}
          onView={(id) => navigate(`/app/inventory/purchase-orders/${id}`)}
          onEdit={(id) => navigate(`/app/inventory/purchase-orders/${id}/edit`)}
          onMarkReceived={(id) => navigate(`/app/inventory/receive?poId=${id}`)}
        />
      )}
    </div>
  );
}
export default PurchaseOrdersPage;
