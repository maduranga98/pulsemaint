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
import { useInventorySettings } from '@/hooks/inventory/useInventorySettings';
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
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  const { request, loading, error } = usePartsRequest(requestId);
  const { settings } = useInventorySettings();

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

  async function handleDecision(decision: ReviewDecision, notes: string, escalationReason: string) {
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
        // Reserve stock via transaction
        await runTransaction(db, async (tx) => {
          for (const item of request.items) {
            const partRef = doc(db, 'inventoryParts', item.partId);
            const partSnap = await tx.get(partRef);
            if (!partSnap.exists()) continue;
            const partData = partSnap.data();
            const approvedQty = decision === 'approve' ? item.quantityRequested : item.quantityApproved;
            const newReserved = (partData.reservedStock ?? 0) + approvedQty;
            const newAvailable = partData.currentStock - newReserved;
            tx.update(partRef, {
              reservedStock: newReserved,
              availableStock: Math.max(0, newAvailable),
              updatedAt: serverTimestamp(),
              updatedBy: userId,
            });
          }

          const requestRef = doc(db, 'partsRequests', request.id);
          tx.update(requestRef, {
            status: newStatus,
            storeKeeperReview: reviewDoc,
            reservedAt: decision === 'approve' || decision === 'partial' ? serverTimestamp() : null,
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
        settings={settings ?? { approvalThresholdLKR: 0 }}
        onDecision={(payload) => handleDecision(payload.decision, payload.notes, payload.escalationReason)}
      />

      <RequestReviewHistory request={request} />
    </div>
  );
}
export default RequestDetailPage;
