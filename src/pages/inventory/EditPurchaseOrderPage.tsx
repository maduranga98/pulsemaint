import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PurchaseOrderForm } from '@/components/inventory/po/PurchaseOrderForm';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import type { PurchaseOrder } from '@/types/inventory';

/**
 * PM-055 — Approvers must be able to edit PO details before approving and sending.
 */
export function EditPurchaseOrderPage() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const { orders, loading, error } = usePurchaseOrders();

  const order = orders.find((o) => o.id === poId);

  function handleSave(saved: PurchaseOrder) {
    navigate(`/app/inventory/purchase-orders/${saved.id}`);
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse max-w-3xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Link to="/app/inventory/purchase-orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="w-4 h-4" /> Back to Purchase Orders
        </Link>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          {error || 'Purchase order not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to={`/app/inventory/purchase-orders/${order.id}`} className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Edit {order.poNumber}</h1>
      </div>
      <PurchaseOrderForm initialPO={order} onSave={handleSave} />
    </div>
  );
}
export default EditPurchaseOrderPage;
