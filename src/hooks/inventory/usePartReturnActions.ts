import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { notifyUsers } from '@/services/notifications.service';
import type { UserRole } from '@/types/auth';
import type { PartReturn, RequestItem } from '@/types/inventory';

type Condition = 'good' | 'damaged' | 'wrong_item';

/**
 * Confirm/reject actions for a pending parts return — the store keeper (or
 * a supervisor/plant manager/admin) marking a returned part as physically
 * received (and back on the shelf, if in good condition) or disputing it.
 * Shared between the dedicated Parts Returns queue and the Return column on
 * the Requests page, so both act on the exact same transaction.
 */
export function usePartReturnActions() {
  const { addToast } = useToast();
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const userRole = useAuthStore((s) => s.userProfile?.role) ?? '';
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  async function confirmReturn(partReturn: PartReturn, condition: Condition, notes: string) {
    try {
      await runTransaction(db, async (tx) => {
        const returnRef = doc(db, 'partReturns', partReturn.id);
        const partRef = doc(db, 'inventoryParts', partReturn.partId);
        const requestRef = doc(db, 'partsRequests', partReturn.partsRequestId);

        const [returnSnap, partSnap, requestSnap] = await Promise.all([
          tx.get(returnRef),
          tx.get(partRef),
          tx.get(requestRef),
        ]);
        if (!returnSnap.exists() || returnSnap.data().status !== 'pending') {
          throw new Error('This return has already been processed.');
        }
        if (!partSnap.exists()) throw new Error('Part no longer exists.');

        const partData = partSnap.data();
        const currentStock = (partData.currentStock as number) ?? 0;
        const reservedStock = (partData.reservedStock as number) ?? 0;
        // Damaged / wrong-item returns still close out the loan, but aren't
        // fit to go back on the shelf as sellable stock.
        const restock = condition === 'good' ? partReturn.quantity : 0;
        const newCurrent = currentStock + restock;

        tx.update(partRef, {
          currentStock: newCurrent,
          availableStock: Math.max(0, newCurrent - reservedStock),
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });

        tx.update(returnRef, {
          status: 'returned',
          storeKeeperConfirmedBy: userId,
          storeKeeperConfirmedByName: userName,
          storeKeeperConfirmedByRole: userRole,
          storeKeeperConfirmedAt: serverTimestamp(),
          condition,
          notes,
        });

        const movementRef = doc(collection(db, 'stockMovements'));
        tx.set(movementRef, {
          companyId,
          partId: partReturn.partId,
          partNumber: partReturn.partNumber,
          partName: partReturn.partName,
          movementType: 'return',
          quantityBefore: currentStock,
          quantityChange: restock,
          quantityAfter: newCurrent,
          referenceType: 'parts_request',
          referenceId: partReturn.partsRequestId,
          workOrderId: partReturn.workOrderId,
          workOrderNumber: partReturn.workOrderNumber,
          partsRequestId: partReturn.partsRequestId,
          performedBy: userId,
          performedByName: userName,
          performedByRole: userRole,
          performedAt: serverTimestamp(),
          notes: notes || `Returnable part received (${condition.replace('_', ' ')})`,
          unitCostAtTime: 0,
          totalCostImpact: 0,
        });

        if (requestSnap.exists()) {
          const requestData = requestSnap.data();
          const items = (requestData.items as RequestItem[]) ?? [];
          let anyStillOutstanding = false;
          const updatedItems = items.map((item) => {
            if (item.partId !== partReturn.partId) {
              if (item.isReturnable && !item.isReturned) anyStillOutstanding = true;
              return item;
            }
            const issuedQty = item.quantityIssued > 0 ? item.quantityIssued : item.quantityApproved;
            const newReturned = (item.quantityReturned ?? 0) + partReturn.quantity;
            const isReturned = newReturned >= issuedQty;
            if (item.isReturnable && !isReturned) anyStillOutstanding = true;
            return { ...item, quantityReturned: newReturned, isReturned };
          });

          tx.update(requestRef, {
            items: updatedItems,
            returnedAt: anyStillOutstanding ? requestData.returnedAt ?? null : serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      void notifyUsers(companyId, [partReturn.requestedBy], {
        type: 'parts',
        message: `Your return of ${partReturn.quantity} × ${partReturn.partName} was confirmed`,
        oversightMessage: `confirmed ${partReturn.requestedByName}'s return of ${partReturn.quantity} × ${partReturn.partName}`,
        severity: 'low',
        linkTo: `/app/inventory/requests/${partReturn.partsRequestId}`,
        actorName: userName,
        actorRole: (userRole || null) as UserRole | null,
        actorUserId: userId,
      });
      addToast('Return confirmed — stock updated.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to confirm return.', 'error');
      console.error(err);
    }
  }

  async function rejectReturn(partReturn: PartReturn, reason: string) {
    try {
      const returnRef = doc(db, 'partReturns', partReturn.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(returnRef);
        if (!snap.exists() || snap.data().status !== 'pending') {
          throw new Error('This return has already been processed.');
        }
        tx.update(returnRef, {
          status: 'rejected',
          storeKeeperConfirmedBy: userId,
          storeKeeperConfirmedByName: userName,
          storeKeeperConfirmedByRole: userRole,
          storeKeeperConfirmedAt: serverTimestamp(),
          notes: reason,
        });
      });
      void notifyUsers(companyId, [partReturn.requestedBy], {
        type: 'parts',
        message: `Your return of ${partReturn.quantity} × ${partReturn.partName} was rejected: ${reason}`,
        oversightMessage: `rejected ${partReturn.requestedByName}'s return of ${partReturn.quantity} × ${partReturn.partName}`,
        severity: 'medium',
        linkTo: `/app/inventory/requests/${partReturn.partsRequestId}`,
        actorName: userName,
        actorRole: (userRole || null) as UserRole | null,
        actorUserId: userId,
      });
      addToast('Return rejected.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to reject return.', 'error');
      console.error(err);
    }
  }

  return { confirmReturn, rejectReturn };
}
