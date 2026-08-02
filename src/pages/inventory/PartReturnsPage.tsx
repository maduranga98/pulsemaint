import { Link } from 'react-router-dom';
import { ChevronLeft, Undo2 } from 'lucide-react';
import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { usePartReturns } from '@/hooks/inventory/usePartReturns';
import { useToast } from '@/hooks/useToast';
import { PartReturnQueueRow } from '@/components/inventory/returns/PartReturnQueueRow';
import type { PartReturn, RequestItem } from '@/types/inventory';

export function PartReturnsPage() {
  const { addToast } = useToast();
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const userRole = useAuthStore((s) => s.userProfile?.role) ?? '';
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  const { returns, loading } = usePartReturns({ status: 'pending' });

  async function handleConfirm(partReturn: PartReturn) {
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
        const newCurrent = currentStock + partReturn.quantity;

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
          storeKeeperConfirmedAt: serverTimestamp(),
        });

        const movementRef = doc(collection(db, 'stockMovements'));
        tx.set(movementRef, {
          companyId,
          partId: partReturn.partId,
          partNumber: partReturn.partNumber,
          partName: partReturn.partName,
          movementType: 'return',
          quantityBefore: currentStock,
          quantityChange: partReturn.quantity,
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
          notes: 'Returnable part confirmed returned',
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

      addToast('Return confirmed — stock updated.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to confirm return.', 'error');
      console.error(err);
    }
  }

  async function handleReject(partReturn: PartReturn, reason: string) {
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
          storeKeeperConfirmedAt: serverTimestamp(),
          notes: reason,
        });
      });
      addToast('Return rejected.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to reject return.', 'error');
      console.error(err);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Link
        to="/app/inventory"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Inventory
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora] flex items-center gap-2">
          <Undo2 className="w-6 h-6 text-purple-600" />
          Parts Returns
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Confirm parts being physically returned to stock by requesters.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : returns.length === 0 ? (
        <div className="py-12 text-center border border-gray-200 rounded-xl">
          <Undo2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No pending returns.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <PartReturnQueueRow key={r.id} partReturn={r} onConfirm={handleConfirm} onReject={handleReject} />
          ))}
        </div>
      )}
    </div>
  );
}

export default PartReturnsPage;
