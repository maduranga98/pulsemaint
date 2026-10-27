import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Truck } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { useInventoryParts } from '@/hooks/inventory/useInventoryParts';
import { PurchaseOrderList } from '@/components/inventory/po/PurchaseOrderList';
import { LowStockWidget } from '@/components/inventory/dashboard/LowStockWidget';
import { usePurchaseOrderDecisions } from '@/hooks/inventory/usePurchaseOrderDecisions';

export function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orders, loading, error } = usePurchaseOrders();
  const { parts: lowStockParts } = useInventoryParts({ stockStatus: 'low_stock', pageSize: 10 });
  const userProfile = useAuthStore((s) => s.userProfile);
  const { error: toastError, success: toastSuccess } = useToast();
  const { canApprove, approve, reject } = usePurchaseOrderDecisions();
  // Closed purchase orders (fully received or cancelled) are only ever
  // visible to admins — every other role stops seeing a PO once it's done.
  const CLOSED_PO_STATUSES = new Set(['received', 'cancelled']);
  const visibleOrders =
    userProfile?.role === 'admin' ? orders : orders.filter((o) => !CLOSED_PO_STATUSES.has(o.status));

  async function handleApprove(id: string) {
    const order = orders.find((o) => o.id === id);
    if (order) await approve(order);
  }

  async function handleReject(id: string) {
    const order = orders.find((o) => o.id === id);
    if (order) await reject(order);
  }

  async function handleCancel(id: string) {
    try {
      await updateDoc(doc(db, 'purchaseOrders', id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      toastSuccess(t('common.inventory.po.list.toasts.cancelled'));
    } catch (err) {
      toastError(
        err instanceof Error
          ? t('common.inventory.po.list.toasts.cancelFailed', { message: err.message })
          : t('common.inventory.po.list.toasts.cancelFailedGeneric'),
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('common.inventory.po.title')}</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/app/inventory/suppliers"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
          >
            <Truck className="w-4 h-4" />
            {t('common.inventory.po.suppliers')}
          </Link>
          <Link
            to="/app/inventory/purchase-orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('common.inventory.po.createPO')}
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {lowStockParts.length > 0 && (
        <LowStockWidget parts={lowStockParts.filter((p) => p.currentStock > 0)} />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <PurchaseOrderList
          orders={visibleOrders}
          onView={(id) => navigate(`/app/inventory/purchase-orders/${id}`)}
          onEdit={(id) => navigate(`/app/inventory/purchase-orders/${id}/edit`)}
          onMarkReceived={(id) => navigate(`/app/inventory/receive?poId=${id}`)}
          onCancel={handleCancel}
          onApprove={canApprove ? handleApprove : undefined}
          onReject={canApprove ? handleReject : undefined}
        />
      )}
    </div>
  );
}
export default PurchaseOrdersPage;
