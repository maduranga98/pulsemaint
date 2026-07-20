import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  runTransaction,
  serverTimestamp,
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
import type { ReviewDecision } from '@/types/inventory';

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

  async function handleDecision(
    decision: ReviewDecision,
    notes: string,
    escalationReason: string,
    approvedQuantities?: Record<string, number>,
  ) {
    if (!request) return;

    try {
      const reviewDoc = {
        reviewedBy: userId,
        reviewedByName: userName,
        reviewedAt: serverTimestamp(),
        decision,
        notes,
        escalationReason,
      };

      let newStatus = request.status;
      if (decision === 'approve') newStatus = 'parts_reserved';
      else if (decision === 'reject') newStatus = 'rejected';
      else if (decision === 'escalate') newStatus = 'pending_supervisor';
      else if (decision === 'partial') newStatus = 'partially_approved';

      if (decision === 'approve' || decision === 'partial') {
        // Per-item approved quantity: full approval grants what was requested;
        // partial approval uses the quantities the storekeeper entered. This
        // must be persisted onto the request items — the physical issue screen
        // only issues items with quantityApproved > 0.
        const approvedQtyFor = (item: (typeof request.items)[number]) =>
          decision === 'approve'
            ? item.quantityRequested
            : Math.min(item.quantityRequested, approvedQuantities?.[item.id] ?? item.quantityRequested);

        // Reserve stock via transaction. Firestore transactions require every
        // read to happen before any write — interleaving tx.get/tx.update per
        // item in a loop throws ("all reads must be executed before all
        // writes"), which aborted the transaction and silently left the
        // request stuck, so all reads are gathered up front here.
        await runTransaction(db, async (tx) => {
          const partRefs = request.items.map((item) => doc(db, 'inventoryParts', item.partId));
          const partSnaps = await Promise.all(partRefs.map((ref) => tx.get(ref)));

          for (let i = 0; i < request.items.length; i++) {
            const item = request.items[i];
            const partSnap = partSnaps[i];
            if (!partSnap.exists()) continue;
            const partData = partSnap.data();
            const approvedQty = approvedQtyFor(item);
            if (approvedQty <= 0) continue;
            const reservedBefore = (partData.reservedStock ?? 0) as number;
            const newReserved = reservedBefore + approvedQty;
            const newAvailable = partData.currentStock - newReserved;
            tx.update(partRefs[i], {
              reservedStock: newReserved,
              availableStock: Math.max(0, newAvailable),
              updatedAt: serverTimestamp(),
              updatedBy: userId,
            });

            // Stock movement record — every quantity-changing operation must
            // be traceable, including reservations made on approval.
            const movementRef = doc(collection(db, 'stockMovements'));
            tx.set(movementRef, {
              companyId,
              partId: item.partId,
              partNumber: item.partNumber,
              partName: item.partName,
              movementType: 'reserve',
              quantityBefore: reservedBefore,
              quantityChange: approvedQty,
              quantityAfter: newReserved,
              referenceType: 'parts_request',
              referenceId: request.id,
              workOrderId: request.workOrderId,
              workOrderNumber: request.workOrderNumber,
              partsRequestId: request.id,
              performedBy: userId,
              performedByName: userName,
              performedByRole: userRole,
              performedAt: serverTimestamp(),
              notes: decision === 'partial' ? 'Partially approved and reserved' : 'Approved and reserved',
              unitCostAtTime: item.unitCost,
              totalCostImpact: item.unitCost * approvedQty,
            });
          }

          const requestRef = doc(db, 'partsRequests', request.id);
          tx.update(requestRef, {
            status: newStatus,
            storeKeeperReview: reviewDoc,
            items: request.items.map((item) => ({ ...item, quantityApproved: approvedQtyFor(item) })),
            reservedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } else {
        await updateDoc(doc(db, 'partsRequests', request.id), {
          status: newStatus,
          storeKeeperReview: reviewDoc,
          updatedAt: serverTimestamp(),
        });
      }

      // Log review history
      await addDoc(collection(db, 'partsRequests', request.id, 'reviewHistory'), {
        ...reviewDoc,
        companyId,
        requestId: request.id,
      });

      addToast('Decision recorded successfully.', 'success');
      navigate('/app/inventory/requests');
    } catch (err) {
      addToast('Failed to process decision.', 'error');
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

      {(request.workOrderId || request.machineId) && (
        <RequestWoContextCard request={request} />
      )}

      <RequestItemsTable items={request.items} />

      <RequestReviewPanel
        request={request}
        onDecision={(payload) =>
          handleDecision(payload.decision, payload.notes, payload.escalationReason, payload.approvedQuantities)
        }
      />

      <RequestReviewHistory request={request} />
    </div>
  );
}
export default RequestDetailPage;
