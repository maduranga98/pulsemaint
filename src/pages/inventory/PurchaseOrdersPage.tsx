import { useNavigate, Link } from 'react-router-dom';
import { Plus, Truck } from 'lucide-react';
import { doc, serverTimestamp, updateDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { PurchaseOrderList } from '@/components/inventory/po/PurchaseOrderList';
import { logAuditEvent } from '@/utils/reports/auditLogger';

// Kept in sync with PurchaseOrderDetail's canApprove — approval is not
// limited to plant_manager/admin, supervisors can approve too.
const CAN_APPROVE_ROLES = ['plant_manager', 'admin', 'supervisor', 'maintenance_supervisor'];

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { orders, loading, error } = usePurchaseOrders();
  const userProfile = useAuthStore((s) => s.userProfile);
  const { error: toastError, success: toastSuccess } = useToast();
  const canApprove = !!userProfile && CAN_APPROVE_ROLES.includes(userProfile.role);

  async function queueEmail(order: (typeof orders)[number], event: 'approved' | 'rejected') {
    try {
      const usersSnap = await getDocs(
        query(collection(db, `companies/${order.companyId}/users`), where('role', 'in', ['plant_manager', 'admin'])),
      );
      const recipients = usersSnap.docs
        .map((d) => (d.data() as any).email as string | undefined)
        .filter(Boolean) as string[];
      if (recipients.length === 0) return;
      await addDoc(collection(db, 'po_notifications'), {
        companyId: order.companyId,
        poId: order.id,
        poNumber: order.poNumber,
        supplierName: order.supplierName,
        supplierEmail: order.supplierEmail ?? '',
        total: order.totalOrderValue,
        currency: order.currency,
        recipients,
        event,
        message: '',
        status: 'queued',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to queue PO email notification', err);
    }
  }

  async function handleApprove(id: string) {
    if (!userProfile) return;
    try {
      await updateDoc(doc(db, 'purchaseOrders', id), {
        status: 'approved',
        approvedBy: userProfile.id,
        approvedByName: userProfile.fullName ?? '',
        approvedByRole: userProfile.role,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const order = orders.find((o) => o.id === id);
      if (order) await queueEmail(order, 'approved');
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
        approvedByRole: userProfile.role,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const order = orders.find((o) => o.id === id);
      if (order) await queueEmail(order, 'rejected');
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
        <div className="flex items-center gap-3">
          <Link
            to="/app/inventory/suppliers"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
          >
            <Truck className="w-4 h-4" />
            Suppliers
          </Link>
          <Link
            to="/app/inventory/purchase-orders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create PO
          </Link>
        </div>
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
