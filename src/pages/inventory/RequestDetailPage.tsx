import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  runTransaction,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { usePartsRequest } from '@/hooks/inventory/usePartsRequest';
import { useToast } from '@/hooks/useToast';
import { RequestDetailHeader } from '@/components/inventory/requests/RequestDetailHeader';
import { RequestWoContextCard } from '@/components/inventory/requests/RequestWoContextCard';
import { RequestItemsTable } from '@/components/inventory/requests/RequestItemsTable';
import { RequestReviewPanel } from '@/components/inventory/requests/RequestReviewPanel';
import { RequestReviewHistory } from '@/components/inventory/requests/RequestReviewHistory';

export function RequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const userRole = useAuthStore((s) => s.userProfile?.role) ?? '';
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  const { request, loading, error } = usePartsRequest(requestId);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4" />
        <div className="h-28 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-4">
        <Link to="/app/inventory/requests" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="w-4 h-4" /> Back to Requests
        </Link>
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error ?? 'Request not found.'}
        </div>
      </div>
    );
  }

  // Issue the parts: deduct stock immediately and move the request into the
  // "Parts to Collect" queue. The full requested quantity is issued (there is
  // no partial-approval step in this flow).
  async function handleIssue() {
    if (!request) return;

    try {
      const reviewDoc = {
        reviewedBy: userId,
        reviewedByName: userName,
        reviewedAt: serverTimestamp(),
        decision: 'approve' as const,
        notes: '',
        escalationReason: '',
      };

      // Firestore transactions require every read before any write, so read all
      // parts up front, then queue the writes.
      await runTransaction(db, async (tx) => {
        const partRefs = request.items.map((item) => doc(db, 'inventoryParts', item.partId));
        const partSnaps = await Promise.all(partRefs.map((ref) => tx.get(ref)));

        for (let i = 0; i < request.items.length; i++) {
          const item = request.items[i];
          const partSnap = partSnaps[i];
          if (!partSnap.exists()) continue;
          const partData = partSnap.data();
          const qty = item.quantityRequested;
          if (qty <= 0) continue;

          const currentStock = (partData.currentStock as number) ?? 0;
          const reservedStock = (partData.reservedStock as number) ?? 0;
          const totalUsedAllTime = (partData.totalUsedAllTime as number) ?? 0;
          const newCurrent = currentStock - qty;

          tx.update(partRefs[i], {
            currentStock: newCurrent,
            availableStock: Math.max(0, newCurrent - reservedStock),
            totalUsedAllTime: totalUsedAllTime + qty,
            lastIssuedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedBy: userId,
          });

          const movementRef = doc(collection(db, 'stockMovements'));
          tx.set(movementRef, {
            companyId,
            partId: item.partId,
            partNumber: item.partNumber,
            partName: item.partName,
            movementType: 'issue',
            quantityBefore: currentStock,
            quantityChange: -qty,
            quantityAfter: newCurrent,
            referenceType: 'parts_request',
            referenceId: request.id,
            workOrderId: request.workOrderId,
            workOrderNumber: request.workOrderNumber,
            partsRequestId: request.id,
            performedBy: userId,
            performedByName: userName,
            performedByRole: userRole,
            performedAt: serverTimestamp(),
            notes: 'Issued — awaiting collection',
            unitCostAtTime: item.unitCost,
            totalCostImpact: item.unitCost * qty,
          });
        }

        const requestRef = doc(db, 'partsRequests', request.id);
        tx.update(requestRef, {
          status: 'parts_reserved',
          storeKeeperReview: reviewDoc,
          items: request.items.map((item) => ({
            ...item,
            quantityApproved: item.quantityRequested,
            quantityIssued: item.quantityRequested,
          })),
          issuedAt: Timestamp.fromDate(new Date()),
          issuedBy: userId,
          issuedByName: userName,
          reservedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await addDoc(collection(db, 'partsRequests', request.id, 'reviewHistory'), {
        ...reviewDoc,
        companyId,
        requestId: request.id,
      });

      addToast('Parts issued — moved to Parts to Collect.', 'success');
      navigate('/app/inventory/requests');
    } catch (err) {
      addToast('Failed to issue parts.', 'error');
      console.error(err);
    }
  }

  // Reject the request. A reason is required (enforced by the panel).
  async function handleReject(reason: string) {
    if (!request) return;

    try {
      const reviewDoc = {
        reviewedBy: userId,
        reviewedByName: userName,
        reviewedAt: serverTimestamp(),
        decision: 'reject' as const,
        notes: reason,
        rejectionReason: reason,
        escalationReason: '',
      };

      await updateDoc(doc(db, 'partsRequests', request.id), {
        status: 'rejected',
        storeKeeperReview: reviewDoc,
        rejectionReason: reason,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'partsRequests', request.id, 'reviewHistory'), {
        ...reviewDoc,
        companyId,
        requestId: request.id,
      });

      addToast('Request rejected.', 'success');
      navigate('/app/inventory/requests');
    } catch (err) {
      addToast('Failed to reject request.', 'error');
      console.error(err);
    }
  }

  // Confirm collection outcome for a request that is waiting to be collected.
  // Collected → completed (and the issued parts are recorded on the linked WO).
  // Not collected → the previously-deducted stock is returned and the request
  // is closed.
  async function handleCollection(collected: boolean, collectorName: string) {
    if (!request) return;

    const issuedQtyFor = (item: (typeof request.items)[number]) =>
      item.quantityIssued > 0 ? item.quantityIssued : item.quantityApproved || item.quantityRequested;

    try {
      if (collected) {
        const nowTs = Timestamp.fromDate(new Date());
        await runTransaction(db, async (tx) => {
          const requestRef = doc(db, 'partsRequests', request.id);
          tx.update(requestRef, {
            status: 'completed',
            collectedByName: collectorName.trim() || request.requestedByName,
            collectedAt: nowTs,
            confirmedBy: userId,
            confirmedByName: userName,
            updatedAt: serverTimestamp(),
          });

          // Record the actually-collected parts on the linked WO so the
          // technician's completion form and cost reporting are accurate.
          if (request.workOrderId) {
            const woRef = doc(db, 'workOrders', request.workOrderId);
            tx.update(woRef, {
              partsUsed: arrayUnion(
                ...request.items
                  .filter((item) => issuedQtyFor(item) > 0)
                  .map((item) => ({
                    partId: item.partId,
                    partName: item.partName,
                    quantity: issuedQtyFor(item),
                    unit: item.unit,
                    source: 'stock',
                    unitCost: item.unitCost,
                    totalCost: item.unitCost * issuedQtyFor(item),
                    warrantyMonths: null,
                  })),
              ),
              updatedAt: serverTimestamp(),
            });
          }
        });

        addToast('Collection confirmed — request completed.', 'success');
      } else {
        // Not collected — return the stock that was deducted at issue.
        await runTransaction(db, async (tx) => {
          const partRefs = request.items.map((item) => doc(db, 'inventoryParts', item.partId));
          const partSnaps = await Promise.all(partRefs.map((ref) => tx.get(ref)));

          for (let i = 0; i < request.items.length; i++) {
            const item = request.items[i];
            const partSnap = partSnaps[i];
            if (!partSnap.exists()) continue;
            const qty = issuedQtyFor(item);
            if (qty <= 0) continue;
            const partData = partSnap.data();
            const currentStock = (partData.currentStock as number) ?? 0;
            const reservedStock = (partData.reservedStock as number) ?? 0;
            const totalUsedAllTime = (partData.totalUsedAllTime as number) ?? 0;
            const newCurrent = currentStock + qty;

            tx.update(partRefs[i], {
              currentStock: newCurrent,
              availableStock: Math.max(0, newCurrent - reservedStock),
              totalUsedAllTime: Math.max(0, totalUsedAllTime - qty),
              updatedAt: serverTimestamp(),
              updatedBy: userId,
            });

            const movementRef = doc(collection(db, 'stockMovements'));
            tx.set(movementRef, {
              companyId,
              partId: item.partId,
              partNumber: item.partNumber,
              partName: item.partName,
              movementType: 'return',
              quantityBefore: currentStock,
              quantityChange: qty,
              quantityAfter: newCurrent,
              referenceType: 'parts_request',
              referenceId: request.id,
              workOrderId: request.workOrderId,
              workOrderNumber: request.workOrderNumber,
              partsRequestId: request.id,
              performedBy: userId,
              performedByName: userName,
              performedByRole: userRole,
              performedAt: serverTimestamp(),
              notes: 'Not collected — stock returned',
              unitCostAtTime: item.unitCost,
              totalCostImpact: item.unitCost * qty,
            });
          }

          const requestRef = doc(db, 'partsRequests', request.id);
          tx.update(requestRef, {
            status: 'cancelled',
            items: request.items.map((item) => ({ ...item, quantityReturned: issuedQtyFor(item) })),
            collectedByName: null,
            updatedAt: serverTimestamp(),
          });
        });

        addToast('Marked not collected — stock returned.', 'success');
      }

      navigate('/app/inventory/requests');
    } catch (err) {
      addToast('Failed to update collection status.', 'error');
      console.error(err);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <Link
        to="/app/inventory/requests"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Requests
      </Link>

      <RequestDetailHeader request={request} />

      {(request.workOrderId || request.machineId || request.purpose) && (
        <RequestWoContextCard request={request} />
      )}

      <RequestItemsTable items={request.items} />

      <RequestReviewPanel
        request={request}
        onIssue={handleIssue}
        onReject={handleReject}
        onCollection={handleCollection}
      />

      <RequestReviewHistory request={request} />
    </div>
  );
}
export default RequestDetailPage;
