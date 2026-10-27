import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, serverTimestamp, updateDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { logAuditEvent } from '@/utils/reports/auditLogger';

// Approval is not limited to plant_manager/admin — supervisors can approve too
// (kept in sync with PurchaseOrderDetail's canApprove).
export const CAN_APPROVE_PO_ROLES = ['plant_manager', 'admin', 'supervisor', 'maintenance_supervisor'];

export interface DecidablePO {
  id: string;
  companyId: string;
  poNumber: string;
  supplierName: string;
  supplierEmail?: string;
  totalOrderValue: number;
  currency: string;
}

/** Approve / reject a purchase order — shared by the PO list page and the
 * dashboard "PO Requests" widgets so both write the same fields, email and
 * audit entry. */
export function usePurchaseOrderDecisions() {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const { error: toastError, success: toastSuccess } = useToast();
  const canApprove = !!userProfile && CAN_APPROVE_PO_ROLES.includes(userProfile.role);

  const queueEmail = useCallback(async (order: DecidablePO, event: 'approved' | 'rejected') => {
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
  }, []);

  const approve = useCallback(
    async (order: DecidablePO) => {
      if (!userProfile) return;
      try {
        await updateDoc(doc(db, 'purchaseOrders', order.id), {
          status: 'approved',
          approvedBy: userProfile.id,
          approvedByName: userProfile.fullName ?? '',
          approvedByRole: userProfile.role,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await queueEmail(order, 'approved');
        toastSuccess(t('common.inventory.po.list.toasts.approved'));
        logAuditEvent({
          companyId: userProfile.companyId,
          userId: userProfile.id,
          userName: userProfile.fullName ?? '',
          userRole: userProfile.role,
          action: 'APPROVE',
          entityType: 'inventory',
          entityId: order.id,
          entityName: `Purchase Order ${order.id}`,
        }).catch(() => {});
      } catch (err) {
        toastError(
          err instanceof Error
            ? t('common.inventory.po.list.toasts.approveFailed', { message: err.message })
            : t('common.inventory.po.list.toasts.approveFailedGeneric'),
        );
      }
    },
    [userProfile, queueEmail, t, toastError, toastSuccess],
  );

  const reject = useCallback(
    async (order: DecidablePO) => {
      if (!userProfile) return;
      const reason = window.prompt(t('common.inventory.po.list.toasts.rejectPrompt')) ?? '';
      if (!reason) return;
      try {
        await updateDoc(doc(db, 'purchaseOrders', order.id), {
          status: 'rejected',
          rejectedReason: reason,
          approvedBy: userProfile.id,
          approvedByName: userProfile.fullName ?? '',
          approvedByRole: userProfile.role,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await queueEmail(order, 'rejected');
        toastSuccess(t('common.inventory.po.list.toasts.rejected'));
        logAuditEvent({
          companyId: userProfile.companyId,
          userId: userProfile.id,
          userName: userProfile.fullName ?? '',
          userRole: userProfile.role,
          action: 'REJECT',
          entityType: 'inventory',
          entityId: order.id,
          entityName: `Purchase Order ${order.id}`,
        }).catch(() => {});
      } catch (err) {
        toastError(
          err instanceof Error
            ? t('common.inventory.po.list.toasts.rejectFailed', { message: err.message })
            : t('common.inventory.po.list.toasts.rejectFailedGeneric'),
        );
      }
    },
    [userProfile, queueEmail, t, toastError, toastSuccess],
  );

  return { canApprove, approve, reject };
}
