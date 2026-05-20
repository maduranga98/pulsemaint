import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { PurchaseOrderDetail } from '@/components/inventory/po/PurchaseOrderDetail';

export function PurchaseOrderDetailPage() {
  const { poId } = useParams<{ poId: string }>();
  const { orders, loading, error } = usePurchaseOrders();

  const order = orders.find((o) => o.id === poId);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-28 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link to="/app/inventory/purchase-orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="w-4 h-4" /> Back to Purchase Orders
        </Link>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          Purchase order not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/app/inventory/purchase-orders"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Purchase Orders
      </Link>
      <PurchaseOrderDetail order={order} />
    </div>
  );
}
export default PurchaseOrderDetailPage;
