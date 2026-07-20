import { useNavigate, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { PurchaseOrderList } from '@/components/inventory/po/PurchaseOrderList';
import { logAuditEvent } from '@/utils/reports/auditLogger';

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { orders, loading, error } = usePurchaseOrders();
  const userProfile = useAuthStore((s) => s.userProfile);
  const { error: toastError, success: toastSuccess } = useToast();
  const canApprove = userProfile?.role === 'plant_manager' || userProfile?.role === 'admin';

  async function handleApprove(id: string) {
    if (!userProfile) return;
    try {
      await updateDoc(doc(db, 'purchaseOrders', id), {
        status: 'approved',
        approvedBy: userProfile.id,
        approvedByName: userProfile.fullName ?? '',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toastSuccess('Purchase order approved.');
      logAuditEvent({
        companyId: userProfile.companyId,
        userId: userProfile.id,
        userName: userProfile.fullName ?? '',
        userRole: userProfile.role,
        action: 'APPROVE',
        entityType: 'inventory',
        entityId: id,
        entityName: `Purchase Order ${id}`,
      }).catch(() => {});
    } catch (err) {
      toastError(err instanceof Error ? `Failed to approve PO: ${err.message}` : 'Failed to approve PO.');
    }
  }

  async function handleReject(id: string) {
    if (!userProfile) return;
    const reason = window.prompt('Reason for rejection?') ?? '';
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'purchaseOrders', id), {
        status: 'rejected',
        rejectedReason: reason,
        approvedBy: userProfile.id,
        approvedByName: userProfile.fullName ?? '',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toastSuccess('Purchase order rejected.');
      logAuditEvent({
        companyId: userProfile.companyId,
        userId: userProfile.id,
        userName: userProfile.fullName ?? '',
        userRole: userProfile.role,
        action: 'REJECT',
        entityType: 'inventory',
        entityId: id,
        entityName: `Purchase Order ${id}`,
      }).catch(() => {});
    } catch (err) {
      toastError(err instanceof Error ? `Failed to reject PO: ${err.message}` : 'Failed to reject PO.');
    }
  }

  async function handleCancel(id: string) {
    try {
      await updateDoc(doc(db, 'purchaseOrders', id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      toastSuccess('Purchase order cancelled.');
    } catch (err) {
      toastError(err instanceof Error ? `Failed to cancel PO: ${err.message}` : 'Failed to cancel PO.');
    }
  }

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
          onCancel={handleCancel}
          onApprove={canApprove ? handleApprove : undefined}
          onReject={canApprove ? handleReject : undefined}
        />
      )}
    </div>
  );
}
export default PurchaseOrdersPage;
